"""FastAPI application — Phase 6: full pipeline + SSE + narrative + comparator.

Endpoints:
  POST /api/programs                    → create program row, return UUID
  POST /api/programs/{id}/run           → start background pipeline
  GET  /api/programs/{id}               → program status + metadata
  GET  /api/programs/{id}/stream        → SSE: live pipeline_events via pg LISTEN
  GET  /api/programs/{id}/narrative     → analyst brief (200-1000 words)
  POST /api/compare                     → two-program strategic comparison
  GET  /api/compare/{id}                → retrieve comparison result
"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional

import asyncpg
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db import get_db
from backend.models import Program, Narrative, Comparison, ExtractedField, PipelineEvent, Source
from backend.comparator import compare_programs
from orchestrator.graph import run_pipeline

app = FastAPI(
    title="InfoVac API",
    version="0.3.0",
    description="Autonomous Competitive Intelligence Agent",
)


ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
# Ensure the Vercel frontend is always allowed even if env var not set
_EXTRA_ORIGINS = [
    "https://infovac-kobie.vercel.app",
    "http://localhost:3000",
]
for _o in _EXTRA_ORIGINS:
    if _o not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(_o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# @app.on_event("startup")
# async def create_tables_on_startup():
#     """Ensure all DB tables exist on startup."""
#     try:
#         from backend.models import Base
#         from backend.db import engine
#         async with engine.begin() as conn:
#             await conn.run_sync(Base.metadata.create_all)
#     except Exception as e:
#         import logging
#         logging.getLogger(__name__).warning(f"DB table creation warning: {e}")

_ASYNCPG_DSN = os.getenv(
    "ASYNCPG_DSN",
    "postgresql://infovac:infovac_dev@localhost:5432/infovac",
)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ProgramCreate(BaseModel):
    name: str
    force: bool = False  # if True, bypass dedup cache and run a fresh analysis


class ProgramResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    trace_url: Optional[str] = None
    total_cost: Optional[float] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CompareRequest(BaseModel):
    program_ids: list[uuid.UUID]


class ExtractedFieldResponse(BaseModel):
    id: uuid.UUID
    program_id: uuid.UUID
    category: str
    field_name: str
    field_value: Optional[str] = None
    is_null: bool
    claimed_snippet: Optional[str] = None
    gate_passed: Optional[bool] = None
    match_score: Optional[float] = None
    citation_start: Optional[int] = None
    citation_end: Optional[int] = None
    corroboration_score: Optional[float] = None
    authority_score: Optional[float] = None
    recency_score: Optional[float] = None
    confidence: Optional[float] = None
    source_id: Optional[uuid.UUID] = None
    source_url: Optional[str] = None
    source_type: Optional[str] = None
    access_date: Optional[datetime] = None
    contradiction_flag: bool
    contradiction_note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PipelineEventResponse(BaseModel):
    id: str
    program_id: uuid.UUID
    stage: str
    progress: float
    detail: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/programs", response_model=list[ProgramResponse])
async def list_programs(db: AsyncSession = Depends(get_db)):
    """List all programs in the database."""
    result = await db.execute(select(Program).order_by(Program.created_at.desc()))
    return result.scalars().all()


@app.get("/api/fields", response_model=list[ExtractedFieldResponse])
async def list_all_fields(db: AsyncSession = Depends(get_db)):
    """Return latest extracted fields across all programs."""
    result = await db.execute(select(ExtractedField).order_by(ExtractedField.created_at.asc()))
    all_fields = result.scalars().all()
    
    # Group by program_id to apply get_latest_only per program
    by_program = {}
    for f in all_fields:
        by_program.setdefault(f.program_id, []).append(f)
        
    latest_fields = []
    for prog_id, fields in by_program.items():
        latest_fields.extend(ExtractedField.get_latest_only(fields))
        
    return latest_fields


@app.get("/api/programs/{program_id}/fields", response_model=list[ExtractedFieldResponse])
async def get_program_fields(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return all extracted fields for a program, keeping only the latest run per field_name."""
    result = await db.execute(
        select(ExtractedField, Source.url.label("source_url"), Source.source_type.label("source_type"))
        .outerjoin(Source, ExtractedField.source_id == Source.id)
        .where(ExtractedField.program_id == program_id)
    )
    
    fields = []
    for row in result.all():
        field_obj = row[0]
        field_obj.source_url = row[1]
        field_obj.source_type = row[2]
        fields.append(field_obj)
        
    return ExtractedField.get_latest_only(fields)


@app.get("/api/programs/{program_id}/events", response_model=list[PipelineEventResponse])
async def get_program_events(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return all pipeline events for a program ordered sequentially."""
    result = await db.execute(
        select(PipelineEvent)
        .where(PipelineEvent.program_id == program_id)
        .order_by(PipelineEvent.created_at.asc(), PipelineEvent.id.asc())
    )
    events = result.scalars().all()
    response = []
    for e in events:
        try:
            p_val = float(e.progress) if e.progress else 0.0
        except ValueError:
            p_val = 0.0
        response.append(
            PipelineEventResponse(
                id=str(e.id),
                program_id=e.program_id,
                stage=e.stage,
                progress=p_val,
                detail=e.detail,
                created_at=e.created_at
            )
        )
    return response


@app.delete("/api/programs/{program_id}")
async def delete_program(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Hard-delete a program and ALL its data from SQL (cascade) and Qdrant vector DB."""
    import traceback
    import logging
    logger = logging.getLogger(__name__)
    try:
        prog = await db.get(Program, program_id)
        if prog is None:
            raise HTTPException(status_code=404, detail=f"Program {program_id} not found.")
        prog_name = prog.name

        # 1. Delete Qdrant vectors (best-effort — don't fail if Qdrant is down)
        qdrant_ok = False
        try:
            from backend.qdrant_client import get_qdrant_client
            from qdrant_client.http import models as qmodels
            qclient = get_qdrant_client()
            qclient.delete(
                collection_name="sources",
                points_selector=qmodels.FilterSelector(
                    filter=qmodels.Filter(
                        must=[qmodels.FieldCondition(
                            key="program_id",
                            match=qmodels.MatchValue(value=str(program_id))
                        )]
                    )
                )
            )
            qdrant_ok = True
        except Exception as exc:
            logger.warning(f"Qdrant cleanup failed for {program_id}: {exc}")

        # 2. Delete comparisons and extracted_fields first to prevent FK constraint violations
        from sqlalchemy import text
        try:
            # Delete comparisons where this program is program_a or program_b
            await db.execute(
                text("DELETE FROM comparisons WHERE program_a_id = :pid OR program_b_id = :pid"),
                {"pid": program_id}
            )
            # Delete comparisons where this program is in the program_ids list
            await db.execute(
                text("DELETE FROM comparisons WHERE program_ids IS NOT NULL AND program_ids::jsonb ? :pid_str"),
                {"pid_str": str(program_id)}
            )
            # Delete conversations referencing this program first (prevents setting program_id to NULL on delete)
            await db.execute(
                text("DELETE FROM conversations WHERE program_id = :pid"),
                {"pid": program_id}
            )
            # Delete extracted fields for this program (this removes FK reference to sources.id)
            await db.execute(
                text("DELETE FROM extracted_fields WHERE program_id = :pid"),
                {"pid": program_id}
            )
            await db.flush()
        except Exception as exc:
            logger.warning(f"Pre-deletion cleanup failed for {program_id}: {exc}")
            # Continue and let db.delete fail if it must, or let it rollback

        # 3. SQL delete — cascade handles sources, events, narratives, conversations -> messages
        await db.delete(prog)
        await db.commit()

        return {
            "deleted": True,
            "program_id": str(program_id),
            "program_name": prog_name,
            "qdrant_cleaned": qdrant_ok,
        }
    except Exception as main_exc:
        logger.error(f"EXCEPTION IN DELETE ROUTE: {main_exc}\n{traceback.format_exc()}")
        if isinstance(main_exc, HTTPException):
            raise main_exc
        raise HTTPException(status_code=500, detail=str(main_exc))


@app.get("/api/programs/search", response_model=list[ProgramResponse])
async def search_programs(q: str, db: AsyncSession = Depends(get_db)):
    """Return completed programs whose name contains the query string (case-insensitive).
    Powers the 'similar programs found' modal in the frontend.
    Excludes programs whose name contains a comma (old multi-program rows).
    """
    result = await db.execute(
        select(Program)
        .where(
            func.lower(Program.name).contains(func.lower(q.strip())),
            Program.status == "complete",
            ~Program.name.contains(","),  # exclude stale multi-name rows
        )
        .order_by(Program.created_at.desc())
        .limit(8)
    )
    return result.scalars().all()


class SourceResponse(BaseModel):
    id: uuid.UUID
    url: str
    source_type: str
    title: Optional[str] = None
    fetch_status: str
    fetched_at: datetime

    model_config = {"from_attributes": True}


@app.get("/api/programs/{program_id}/sources", response_model=list[SourceResponse])
async def get_program_sources(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return all crawled sources for a program (used by the Sources tab in the UI)."""
    result = await db.execute(
        select(Source)
        .where(Source.program_id == program_id)
        .order_by(Source.fetched_at.asc())
    )
    return result.scalars().all()


@app.get("/api/sources/count")
async def get_sources_count(db: AsyncSession = Depends(get_db)):
    """Return the total count of crawled sources in the database."""
    result = await db.execute(select(func.count(Source.id)))
    count = result.scalar() or 0
    return {"count": count}


@app.post("/api/programs", response_model=ProgramResponse, status_code=200)
async def create_program(body: ProgramCreate, db: AsyncSession = Depends(get_db)):
    """Create a program row and return its UUID. Does NOT start the pipeline.
    
    Smart deduplication: if a program with the same name (case-insensitive)
    already exists with status 'complete', return it immediately — no re-crawl needed.
    """
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=422, detail="name must not be empty")
    
    name_clean = body.name.strip()

    # Check for an existing completed program with the same name (case-insensitive)
    # Skip this check if force=True (user wants a fresh re-analysis)
    if not body.force:
        existing_res = await db.execute(
            select(Program)
            .where(
                func.lower(Program.name) == func.lower(name_clean),
                Program.status == "complete",
            )
            .order_by(Program.created_at.desc())
            .limit(1)
        )
        existing = existing_res.scalars().first()
        if existing:
            # Return the cached complete program — frontend will skip the pipeline
            return existing

    program = Program(name=name_clean)
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


@app.post("/api/programs/{program_id}/run", status_code=202)
async def run_program(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Start the background pipeline for an existing program."""
    program = await db.get(Program, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    if program.status not in ("pending", "failed"):
        raise HTTPException(
            status_code=409,
            detail=f"Program is already in status '{program.status}'"
        )
    asyncio.create_task(
        run_pipeline(str(program_id), program.name)
    )
    return {"status": "accepted", "program_id": str(program_id)}


@app.get("/api/programs/{program_id}", response_model=ProgramResponse)
async def get_program(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return program status and metadata."""
    program = await db.get(Program, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@app.get("/api/programs/{program_id}/stream")
async def stream_program(program_id: uuid.UUID):
    """SSE stream of pipeline_events for this program.

    Uses asyncpg LISTEN directly (not SQLAlchemy) so notifications arrive
    as push events rather than polling. The stream closes automatically when
    a 'complete' or 'failed' stage event is received.
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        conn: asyncpg.Connection | None = None
        queue: asyncio.Queue = asyncio.Queue()

        def _on_notify(conn, pid, channel, payload: str):
            queue.put_nowait(payload)

        try:
            conn = await asyncpg.connect(_ASYNCPG_DSN)
            channel = f"pipeline_events_{program_id}"
            await conn.add_listener(channel, _on_notify)

            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    yield "event: heartbeat\ndata: {}\n\n"
                    continue

                yield f"event: stage_update\ndata: {payload}\n\n"

                try:
                    data = json.loads(payload)
                    if data.get("stage") in ("complete", "failed"):
                        break
                except (json.JSONDecodeError, KeyError):
                    pass
        finally:
            if conn:
                try:
                    await conn.remove_listener(channel, _on_notify)
                    await conn.close()
                except Exception:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/programs/{program_id}/narrative")
async def get_narrative(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return the analyst brief for a completed program.

    Returns 404 if the narrative has not been generated yet (pipeline
    still running or narrative generation failed).
    """
    result = await db.execute(
        select(Narrative).where(Narrative.program_id == program_id)
    )
    narrative = result.scalar_one_or_none()
    if narrative is None:
        raise HTTPException(
            status_code=404,
            detail="Narrative not yet available. The pipeline may still be running.",
        )
    return {
        "program_id": str(program_id),
        "narrative": narrative.narrative_text,
        "word_count": narrative.word_count,
        "created_at": narrative.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Comparator endpoints (Phase 6)
# ---------------------------------------------------------------------------

@app.post("/api/compare", status_code=200)
async def create_comparison(body: CompareRequest, db: AsyncSession = Depends(get_db)):
    """Run a strategic comparison between multiple completed programs.

    All programs must exist, be in 'complete' status, and there must be at least 2 programs.
    Returns the full comparison analysis.
    """
    if len(body.program_ids) < 2:
        raise HTTPException(status_code=400, detail="Comparison requires at least 2 program IDs.")

    p_ids_str = []
    for pid in body.program_ids:
        prog = await db.get(Program, pid)
        if prog is None:
            raise HTTPException(status_code=404, detail=f"Program not found: {pid}")
        if prog.status != "complete":
            raise HTTPException(
                status_code=409,
                detail=f"Program {prog.name} is in status '{prog.status}', must be 'complete'",
            )
        p_ids_str.append(str(pid))

    try:
        comparison = await compare_programs(p_ids_str, db)
    except Exception as exc:
        err_msg = str(exc)
        if "429" in err_msg or "quota" in err_msg or "rate limit" in err_msg or "limit exceeded" in err_msg:
            detail_msg = "Rate limit reached or LLM quota exhausted on all configured keys in your .env. Please add a new key."
        else:
            detail_msg = f"Comparison generation failed: {err_msg}"
        raise HTTPException(status_code=500, detail=detail_msg)

    await db.commit()
    return {
        "comparison_id": str(comparison.id),
        "program_ids": [str(p) for p in comparison.program_ids] if comparison.program_ids else [str(comparison.program_a_id), str(comparison.program_b_id)],
        "analysis": comparison.analysis_json,
        "created_at": comparison.created_at.isoformat(),
    }


@app.get("/api/compare/{comparison_id}")
async def get_comparison(comparison_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieve a previously generated comparison by its UUID."""
    comparison = await db.get(Comparison, comparison_id)
    if comparison is None:
        raise HTTPException(status_code=404, detail="Comparison not found.")
    return {
        "comparison_id": str(comparison.id),
        "program_ids": [str(p) for p in comparison.program_ids] if comparison.program_ids else [str(comparison.program_a_id), str(comparison.program_b_id)],
        "program_a_id": str(comparison.program_a_id) if comparison.program_a_id else None,
        "program_b_id": str(comparison.program_b_id) if comparison.program_b_id else None,
        "analysis": comparison.analysis_json,
        "created_at": comparison.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Chat / RAG
# ---------------------------------------------------------------------------

from backend.chat import ChatRequest, handle_chat_message, handle_comparison_chat_message
from backend.models import Conversation, Message
from sqlalchemy import select

@app.post("/api/programs/{program_id}/chat")
async def chat_with_program(
    program_id: str,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Ask a question about a program using RAG."""
    return await handle_chat_message(program_id, body, db)


@app.get("/api/programs/{program_id}/chat")
async def get_chat_history(
    program_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve chat history for a program."""
    conv_res = await db.execute(
        select(Conversation).where(Conversation.program_id == uuid.UUID(program_id))
    )
    conv = conv_res.scalars().first()
    if not conv:
        return {"messages": []}
        
    msg_res = await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.asc())
    )
    messages = msg_res.scalars().all()
    
    return {
        "conversation_id": str(conv.id),
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat()
            }
            for m in messages
        ]
    }


@app.post("/api/comparisons/{comparison_id}/chat")
async def chat_with_comparison(
    comparison_id: str,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Ask a comparative question about the programs in this comparison."""
    return await handle_comparison_chat_message(comparison_id, body, db)


@app.get("/api/comparisons/{comparison_id}/chat")
async def get_comparison_chat_history(
    comparison_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve comparative chat history."""
    conv_res = await db.execute(
        select(Conversation).where(Conversation.program_id == uuid.UUID(comparison_id))
    )
    conv = conv_res.scalars().first()
    if not conv:
        return {"messages": []}
        
    msg_res = await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at.asc())
    )
    messages = msg_res.scalars().all()
    
    return {
        "conversation_id": str(conv.id),
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat()
            }
            for m in messages
        ]
    }


# ---------------------------------------------------------------------------
# Program Evolution Changelog Router Registration
# ---------------------------------------------------------------------------
from backend.routers.evolution import router as evolution_router
app.include_router(evolution_router)


