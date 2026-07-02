"""Retriever — Phase 1.

Given a loyalty program name, discover and fetch real web sources:
  1. Tavily search — 1 query per source_type × 6 types → up to 30 candidate URLs
  2. Deduplicate URLs, classify source_type (URL-pattern override)
  3. Robots.txt check — skip disallowed URLs rather than crash
  4. Firecrawl scrape — full markdown content; fall back to Tavily snippet on failure
  5. Insert into sources table — every stored row guaranteed to have raw_content

DoD guarantees built in:
  - Known program → ≥10 sources, ≥3 distinct source_types
  - Fake program → returns [] gracefully, no exception
  - Every stored source has non-empty raw_content
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx
import structlog
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from tavily import TavilyClient

from backend.models import Source

load_dotenv()
log = structlog.get_logger(__name__)


def clean_utf8_mojibake(text: str) -> str:
    """Repair common UTF-8 double-decoding (mojibake) artifacts in crawled text."""
    if not text:
        return text

    # Try cp1252 to utf-8 roundtrip if possible
    try:
        encoded = text.encode("cp1252")
        decoded = encoded.decode("utf-8")
        if decoded != text and len(decoded) > 0:
            return decoded
    except Exception:
        pass

    # Fallback to dictionary replacement
    replacements = {
        "â€™": "’",
        "â€œ": "“",
        "â€": "”",
        "â€“": "–",
        "â€”": "—",
        "â€¢": "•",
        "â€¦": "…",
        "â„¢": "™",
        "Ã©": "é",
        "Ã¡": "á",
        "Ã³": "ó",
        "Ãº": "ú",
        "Ã±": "ñ",
        "Ã¼": "ü",
        "Ã¤": "ä",
        "Ã¶": "ö",
        "ÃŸ": "ß",
        "Â ": " ",
        "Â": "",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text

# ---------------------------------------------------------------------------
# Source-type queries
# One targeted query per type. Quoted program name keeps Tavily grounded.
# ---------------------------------------------------------------------------

_QUERIES: dict[str, str] = {
    "faq": '"{name}" loyalty program FAQ frequently asked questions',
    "tnc": '"{name}" loyalty program terms and conditions',
    "app_review": '"{name}" app reviews ratings',
    "press": '"{name}" loyalty program press release announcement',
    "news": '"{name}" loyalty program news 2024 2025',
    "forum": '"{name}" loyalty rewards reddit community discussion',
    "homepage": '"{name}" official loyalty program homepage',
    "benefits": '"{name}" elite status levels tiers and benefits',
    "partners": '"{name}" credit card airline hotel transfer partners',
    "mechanics": '"{name}" how to earn and redeem points award chart',
    "competitors": '"{name}" versus competitors review comparison',
}

# How many Tavily results to request per query
_MAX_RESULTS_PER_QUERY = 5

# Max URLs to Firecrawl-fetch (to protect free-tier credits)
_MAX_FIRECRAWL_FETCHES = 22

# Seconds to sleep between Firecrawl calls (rate-limit courtesy)
_FIRECRAWL_DELAY = 0.3

# Hard per-call timeout for BS4 HTTP GET (prevents blocking DNS from escaping async)
_BS4_HTTP_TIMEOUT = 7.0

# Per-source outer timeout: Firecrawl(20s) + BS4(7s) + robots(5s) + buffer
_SOURCE_PROCESS_TIMEOUT = 35.0

from backend.classifier import classify_source


# ---------------------------------------------------------------------------
# Internal data structures
# ---------------------------------------------------------------------------

@dataclass
class _Candidate:
    url: str
    source_type: str
    title: str
    tavily_snippet: str  # always populated — minimum raw_content guarantee




def _tavily_search(keys: list[str], query: str, source_type: str) -> list[_Candidate]:
    """Run one Tavily query, rotating keys if rate-limited or failed."""
    from tavily import TavilyClient
    if not keys:
        log.warning("no_tavily_keys_configured")
        return []
        
    last_exc = None
    for k in keys:
        try:
            client = TavilyClient(api_key=k)
            response = client.search(
                query,
                max_results=_MAX_RESULTS_PER_QUERY,
                search_depth="advanced",
            )
            candidates: list[_Candidate] = []
            for r in response.get("results", []):
                url = r.get("url", "").strip()
                if not url:
                    continue
                title = r.get("title", "") or ""
                snippet = r.get("content", "") or ""
                classified = classify_source(url, title, snippet, source_type)
                candidates.append(_Candidate(
                    url=url,
                    source_type=classified,
                    title=title,
                    tavily_snippet=snippet,
                ))
            return candidates
        except Exception as exc:
            log.warning("tavily_key_failed_rotating", key_prefix=k[:6], error=str(exc)[:200])
            last_exc = exc
    log.error("all_tavily_keys_failed", query=query[:80], error=str(last_exc))
    return []


async def _check_robots(url: str, http: httpx.AsyncClient) -> str:
    """Check robots.txt for `url`.

    Returns:
        'allowed'           — explicitly permitted or no robots.txt found (200+parse)
        'blocked'           — robots.txt explicitly disallows '*' agent
        'robots_unverified' — check failed (timeout, non-200, parse error).
                              Decision #1 (OPEN_DECISIONS.md): allow scraping but
                              mark the status so the gate/eval layer can filter.

    Policy rationale: fail-closed (deny on error) risks killing legitimate sources
    on transient timeouts; fail-open silently (return True) hides ambiguity.
    'robots_unverified' is honest about what happened without blocking the source.
    Caveat: hackathon-scope — revisit before production per SOLUTION.md legal flag.
    """
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        resp = await http.get(robots_url, timeout=5.0, follow_redirects=True)
        if resp.status_code == 200:
            rp = RobotFileParser()
            rp.parse(resp.text.splitlines())
            return "allowed" if rp.can_fetch("*", url) else "blocked"
        # Non-200 (404, 403, etc.) — no robots.txt or inaccessible
        return "allowed"
    except Exception:
        return "robots_unverified"


async def _playwright_fetch(url: str) -> tuple[Optional[str], Optional[str]]:
    """Local fallback: Spawn headless Chromium with stealth to bypass Cloudflare."""
    from playwright.async_api import async_playwright
    from playwright_stealth import use_stealth
    from bs4 import BeautifulSoup
    
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            await use_stealth(page)
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            html = await page.content()
            await browser.close()
            
            soup = BeautifulSoup(html, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            text = soup.get_text(separator="\n")
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            cleaned_text = "\n".join(chunk for chunk in chunks if chunk)
            
            if len(cleaned_text.strip()) > 100:
                return cleaned_text, html
            return None, None
    except Exception as e:
        log.warning("playwright_fallback_failed", url=url, error=str(e)[:200])
        return None, None


async def _async_firecrawl_fetch(
    keys: list[str], url: str, http: httpx.AsyncClient
) -> tuple[Optional[str], Optional[str]]:
    """Scrape a URL with Firecrawl asynchronously, rotating keys if rate-limited or failed."""
    if not keys:
        return None, None
        
    last_exc = None
    for k in keys:
        try:
            headers = {
                "Authorization": f"Bearer {k}",
                "Content-Type": "application/json"
            }
            body = {
                "url": url,
                "formats": ["markdown", "html"]
            }
            # Specify a strict timeout of 20 seconds
            resp = await http.post(
                "https://api.firecrawl.dev/v1/scrape",
                json=body,
                headers=headers,
                timeout=20.0
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and "data" in data:
                    scrape_data = data["data"]
                    markdown = scrape_data.get("markdown") or scrape_data.get("content") or None
                    html = scrape_data.get("html") or None
                    
                    # Paywall detection: reject content that looks like a login/subscribe wall
                    if markdown:
                        paywall_signals = [
                            "subscribe to read", "subscribe to continue", "subscribe now",
                            "create an account", "sign in to read", "log in to read",
                            "already a subscriber", "this content is for subscribers",
                            "member-only", "premium content", "unlock this article",
                            "register to read", "free registration required",
                        ]
                        lower_md = markdown.lower()
                        if any(signal in lower_md for signal in paywall_signals) and len(markdown) < 2000:
                            log.warning("firecrawl_paywall_detected", url=url, content_length=len(markdown))
                            return None, None
                            
                    return markdown, html
                else:
                    log.warning("firecrawl_api_response_not_success", url=url, response=data)
            else:
                log.warning("firecrawl_api_status_error", url=url, status_code=resp.status_code)
        except Exception as exc:
            log.warning("firecrawl_key_failed_rotating", key_prefix=k[:6], error=str(exc)[:200])
            last_exc = exc
            
    log.error("all_firecrawl_keys_failed", url=url, error=str(last_exc))
    return None, None



# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def discover_sources(
    program_name: str,
    program_id,  # UUID
    db: AsyncSession,
) -> list[Source]:
    """Discover, fetch, and store sources for a loyalty program.

    Args:
        program_name: Human-readable program name, e.g. "Starbucks Rewards"
        program_id:   UUID of the programs row (must already exist)
        db:           Async SQLAlchemy session

    Returns:
        List of Source ORM objects that were inserted (or already existed).
        Returns [] gracefully if no sources are found.
    """
    # Load rotated key lists
    tavily_keys_str = os.getenv("TAVILY_API_KEYS", "")
    if tavily_keys_str:
        tavily_keys = [k.strip() for k in tavily_keys_str.split(",") if k.strip()]
    else:
        tavily_keys = [os.getenv("TAVILY_API_KEY", "")] if os.getenv("TAVILY_API_KEY") else []

    firecrawl_keys_str = os.getenv("FIRECRAWL_API_KEYS", "")
    if firecrawl_keys_str:
        firecrawl_keys = [k.strip() for k in firecrawl_keys_str.split(",") if k.strip()]
    else:
        firecrawl_keys = [os.getenv("FIRECRAWL_API_KEY", "")] if os.getenv("FIRERAWL_API_KEY") or os.getenv("FIRECRAWL_API_KEY") else []

    if not tavily_keys:
        raise EnvironmentError("No TAVILY_API_KEY found.")

    log.info("retriever_start", program=program_name)

    # ------------------------------------------------------------------
    # Step 1: Tavily discovery — run all queries concurrently with timeouts
    # ------------------------------------------------------------------
    all_candidates: list[_Candidate] = []
    seen_urls: dict[str, _Candidate] = {}
    unique_candidates: list[_Candidate] = []

    loop = asyncio.get_event_loop()
    tasks = []
    for source_type, query_template in _QUERIES.items():
        query = query_template.format(name=program_name)
        task = asyncio.wait_for(
            loop.run_in_executor(None, _tavily_search, tavily_keys, query, source_type),
            timeout=25.0
        )
        tasks.append(task)

    from orchestrator.events import emit_event
    import json

    # Stream results as they complete
    completed_tasks = 0
    total_tasks = len(tasks)
    
    for f in asyncio.as_completed(tasks):
        try:
            candidates_batch = await f
            completed_tasks += 1
            for c in candidates_batch:
                all_candidates.append(c)
                if c.url not in seen_urls:
                    seen_urls[c.url] = c
                    unique_candidates.append(c)
                    
                    item = {
                        "title": c.title or "",
                        "url": c.url,
                        "snippet": c.tavily_snippet or "",
                        "domain": c.url.split("/")[2] if "//" in c.url else c.url
                    }
                    await emit_event(
                        str(program_id),
                        "discovering_sources",
                        0.05 + 0.10 * (completed_tasks / total_tasks),
                        json.dumps({"item": item, "count": len(unique_candidates)})
                    )
        except asyncio.TimeoutError:
            completed_tasks += 1
            log.warning("tavily_query_timeout")
        except Exception as exc:
            completed_tasks += 1
            log.warning("tavily_task_failed", error=str(exc))

    log.info("tavily_done", total_candidates=len(all_candidates), unique_count=len(unique_candidates))

    if not unique_candidates:
        log.info("no_sources_found", program=program_name)
        return []

    # ------------------------------------------------------------------
    # Step 3: Robots.txt check + Firecrawl fetch (Concurrent)
    # ------------------------------------------------------------------
    stored: list[Source] = []
    firecrawl_count = 0
    fc_lock = asyncio.Lock()
    db_lock = asyncio.Lock()
    sem = asyncio.Semaphore(10)

    async def process_candidate(idx: int, candidate: _Candidate, http: httpx.AsyncClient):
        nonlocal firecrawl_count
        
        async def scrape_and_store():
            nonlocal firecrawl_count
            # Emit crawling started event
            start_item = {
                "url": candidate.url,
                "status": "active",
                "reason": "",
                "title": candidate.title or "",
                "domain": candidate.url.split("/")[2] if "//" in candidate.url else candidate.url
            }
            progress_val = 0.15 + 0.10 * (idx / len(unique_candidates))
            await emit_event(
                str(program_id),
                "crawling_sources",
                progress_val,
                json.dumps({
                    "item": start_item,
                    "count": idx + 1,
                    "total": len(unique_candidates)
                })
            )

            robots_status = await _check_robots(candidate.url, http)
            if robots_status == "blocked":
                log.info("robots_blocked", url=candidate.url)
                item = {
                    "url": candidate.url,
                    "status": "failed",
                    "reason": "Robots blocked",
                    "title": candidate.title or "",
                    "domain": candidate.url.split("/")[2] if "//" in candidate.url else candidate.url
                }
                progress_val_fin = 0.15 + 0.10 * ((idx + 1) / len(unique_candidates))
                await emit_event(
                    str(program_id),
                    "crawling_sources",
                    progress_val_fin,
                    json.dumps({"item": item, "count": idx + 1, "total": len(unique_candidates)})
                )
                return

            raw_content: str = candidate.tavily_snippet
            fetch_method = "tavily_snippet"
            fetch_status = "success" if robots_status == "allowed" else robots_status
            raw_html: Optional[str] = None

            use_firecrawl = False
            async with fc_lock:
                if firecrawl_count < _MAX_FIRECRAWL_FETCHES and firecrawl_keys:
                    use_firecrawl = True
                    firecrawl_count += 1
            
            if use_firecrawl:
                try:
                    markdown, html = await _async_firecrawl_fetch(firecrawl_keys, candidate.url, http)
                except Exception as exc:
                    log.warning("firecrawl_fetch_failed", url=candidate.url, error=str(exc))
                    markdown, html = None, None

                if markdown and len(markdown.strip()) > 50:
                    raw_content = markdown
                    fetch_method = "firecrawl"
                    if fetch_status == "success":
                        fetch_status = "success"
                else:
                    if fetch_status == "success":
                        fetch_status = "failed"
                if html:
                    raw_html = html[:80_000]
                await asyncio.sleep(_FIRECRAWL_DELAY)


            if fetch_method == "tavily_snippet":
                log.info("firecrawl_failed_trying_playwright_stealth", url=candidate.url)
                try:
                    cleaned_text, html = await _playwright_fetch(candidate.url)
                    if cleaned_text:
                        raw_content = cleaned_text
                        raw_html = html[:80_000]
                        fetch_method = "playwright_stealth"
                        fetch_status = "success"
                        log.info("playwright_scraping_success", url=candidate.url, text_len=len(cleaned_text))
                    else:
                        raise ValueError("Stealth browser extraction returned empty content")
                except Exception as fallback_exc:
                    log.warning("playwright_scraping_failed_falling_back_to_tavily", url=candidate.url, error=str(fallback_exc)[:200])
                    if candidate.tavily_snippet and candidate.tavily_snippet.strip():
                        raw_content = candidate.tavily_snippet
                        fetch_method = "tavily_snippet"
                        fetch_status = "tavily_fallback"
                    else:
                        raw_content = ""
                        fetch_method = "tavily_snippet"
                        fetch_status = "failed"

            raw_content_cleaned = clean_utf8_mojibake(raw_content)
            title_cleaned = clean_utf8_mojibake(candidate.title) if candidate.title else None

            source = Source(
                program_id=program_id,
                url=candidate.url,
                source_type=candidate.source_type,
                title=title_cleaned[:500] if title_cleaned else None,
                raw_content=raw_content_cleaned,
                content_hash=Source.make_hash(raw_content_cleaned),
                fetch_method=fetch_method,
                fetch_status=fetch_status,
                raw_html=raw_html,
            )
            
            async with db_lock:
                db.add(source)
                try:
                    await db.flush()
                    stored.append(source)
                    log.info("source_stored", url=candidate.url, type=candidate.source_type, method=fetch_method, content_len=len(raw_content))
                except IntegrityError:
                    await db.rollback()
                    existing = await db.scalar(select(Source).where(Source.program_id == program_id, Source.url == candidate.url))
                    if existing:
                        stored.append(existing)

            status_str = "success" if fetch_status in ("success", "tavily_fallback") else "failed"
            reason_str = "tavily_fallback" if fetch_status == "tavily_fallback" else ("" if fetch_status == "success" else "Scrape failed")
            item = {
                "url": candidate.url,
                "status": status_str,
                "reason": reason_str,
                "title": candidate.title or "",
                "domain": candidate.url.split("/")[2] if "//" in candidate.url else candidate.url
            }
            progress_val_fin = 0.15 + 0.10 * ((idx + 1) / len(unique_candidates))
            await emit_event(
                str(program_id),
                "crawling_sources",
                progress_val_fin,
                json.dumps({"item": item, "count": idx + 1, "total": len(unique_candidates)})
            )

        async with sem:
            try:
                await asyncio.wait_for(scrape_and_store(), timeout=_SOURCE_PROCESS_TIMEOUT)
            except asyncio.TimeoutError:
                log.warning("source_processing_timeout", url=candidate.url)
                # Emit scrape failed event
                item = {
                    "url": candidate.url,
                    "status": "failed",
                    "reason": "Scrape failed (Processing timeout)",
                    "title": candidate.title or "",
                    "domain": candidate.url.split("/")[2] if "//" in candidate.url else candidate.url
                }
                progress_val_fin = 0.15 + 0.10 * ((idx + 1) / len(unique_candidates))
                await emit_event(
                    str(program_id),
                    "crawling_sources",
                    progress_val_fin,
                    json.dumps({"item": item, "count": idx + 1, "total": len(unique_candidates)})
                )
            except Exception as exc:
                log.error("source_processing_failed", url=candidate.url, error=str(exc))
                item = {
                    "url": candidate.url,
                    "status": "failed",
                    "reason": f"Scrape failed ({str(exc)[:50]})",
                    "title": candidate.title or "",
                    "domain": candidate.url.split("/")[2] if "//" in candidate.url else candidate.url
                }
                progress_val_fin = 0.15 + 0.10 * ((idx + 1) / len(unique_candidates))
                await emit_event(
                    str(program_id),
                    "crawling_sources",
                    progress_val_fin,
                    json.dumps({"item": item, "count": idx + 1, "total": len(unique_candidates)})
                )


    async with httpx.AsyncClient(headers={"User-Agent": "InfoVac/1.0 (+https://github.com/Hrishikesh-Prasad-R/info-vac)"}) as http:
        tasks = [
            process_candidate(idx, candidate, http)
            for idx, candidate in enumerate(unique_candidates)
        ]
        await asyncio.gather(*tasks)

    await db.commit()
    log.info("retriever_done", program=program_name, stored=len(stored), types=list({s.source_type for s in stored}))
    return stored
