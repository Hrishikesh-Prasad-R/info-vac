# Graph Report - KOBIE_hackathon  (2026-07-01)

## Corpus Check
- 137 files · ~95,810 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1301 nodes · 2302 edges · 122 communities (110 shown, 12 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 131 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b3108827`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 114|Community 114]]
- [[_COMMUNITY_Community 115|Community 115]]
- [[_COMMUNITY_Community 117|Community 117]]
- [[_COMMUNITY_Community 119|Community 119]]
- [[_COMMUNITY_Community 121|Community 121]]
- [[_COMMUNITY_Community 123|Community 123]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 88 edges
2. `Program` - 31 edges
3. `ExtractedField` - 28 edges
4. `Source` - 24 edges
5. `ChatRequest` - 22 edges
6. `Kobie Design System: Visual Language & Frontend Audit` - 21 edges
7. `Narrative` - 20 edges
8. `Comparison` - 20 edges
9. `discover_sources()` - 18 edges
10. `compute_confidence()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `DummyExtractedSchema` --uses--> `GateResult`  [INFERRED]
  tests/test_comprehensive_system.py → backend/gate.py
- `DummyProgramBasics` --uses--> `GateResult`  [INFERRED]
  tests/test_comprehensive_system.py → backend/gate.py
- `_call_llm_judge()` --calls--> `_make_client()`  [INFERRED]
  orchestrator/nodes.py → backend/llm_client.py
- `_call_llm()` --calls--> `_make_client()`  [INFERRED]
  tests/eval_ragas.py → backend/llm_client.py
- `DummyExtractedSchema` --uses--> `PipelineState`  [INFERRED]
  tests/test_comprehensive_system.py → orchestrator/state.py

## Import Cycles
- 1-file cycle: `backend/qdrant_client.py -> backend/qdrant_client.py`
- 1-file cycle: `frontend/components/ui/button.tsx -> frontend/components/ui/button.tsx`
- 1-file cycle: `frontend/components/ui/input.tsx -> frontend/components/ui/input.tsx`
- 1-file cycle: `frontend/components/ui/sonner.tsx -> frontend/components/ui/sonner.tsx`
- 1-file cycle: `frontend/components/ui/tabs.tsx -> frontend/components/ui/tabs.tsx`
- 1-file cycle: `frontend/components/ui/scroll-area.tsx -> frontend/components/ui/scroll-area.tsx`
- 1-file cycle: `frontend/components/ui/progress.tsx -> frontend/components/ui/progress.tsx`
- 1-file cycle: `frontend/components/ui/avatar.tsx -> frontend/components/ui/avatar.tsx`
- 1-file cycle: `frontend/components/ui/dialog.tsx -> frontend/components/ui/dialog.tsx`
- 1-file cycle: `frontend/components/ui/select.tsx -> frontend/components/ui/select.tsx`
- 1-file cycle: `frontend/components/ui/separator.tsx -> frontend/components/ui/separator.tsx`

## Hyperedges (group relationships)
- **Multi-Agent LangGraph Pipeline** — backend_retriever, backend_extractor, backend_gate, backend_verifier, backend_narrator [EXTRACTED 1.00]
- **Data Persistence & Vector Search** — backend_models, postgres_db, backend_qdrant_client [INFERRED 0.90]

## Communities (122 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.19
Nodes (32): MarketMatrixOutput, MatrixItem, Comparator — Phase 6.  Generates a strategic competitive comparison between mult, Rankings and rationale for a single loyalty program category., Structured competitive market matrix comparison., CompareRequest, ExtractedFieldResponse, PipelineEventResponse (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (56): BurnMechanics, CompetitivePosition, DigitalExperience, EarnMechanics, EvidenceState, EvidenceStateValue, ExtractedSchema, ExtractedValue (+48 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (45): dependencies, ai, @base-ui/react, class-variance-authority, clsx, cmdk, lucide-react, next (+37 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (38): compute_confidence(), _corroboration_score(), _detect_contradiction(), Verifier — Phase 3.  Deterministic confidence formula and contradiction detectio, Full verifier output for one field., Fraction of distinct sources that support this value.      'Distinct' = unique s, Check if multiple gate-verified values disagree with each other.      Two values, Compute confidence for one field using the deterministic formula.      This is t (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (30): AsyncClient, classify_source(), Source Classifier.  Classifies fetched sources into specific category groups usi, Classify source_type using a four-level priority chain.      Priority (highest t, _async_firecrawl_fetch(), _Candidate, _check_robots(), clean_utf8_mojibake() (+22 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (29): _build_comparison_context_multi(), compare_programs(), _load_program_data(), Any, AsyncSession, ExtractedField, UUID, Build the GROUNDED DATA block with multiple programs side by side. (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (29): _build_context(), _calculate_usage_cost(), _call_narrator(), _count_words(), generate_narrative(), Any, AsyncSession, ExtractedField (+21 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (27): AdminDashboard(), deriveStats(), ComparatorPicker(), ComparatorPickerProps, ConfidenceBarChart(), ConfidenceBarChartProps, CostCard(), CostCardProps (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (35): get_db(), AsyncSession, FastAPI dependency — yields an async DB session., create_comparison(), create_program(), get_chat_history(), get_comparison(), get_comparison_chat_history() (+27 more)

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (11): ⏱️ 56. Pipeline Event Scopes (`scratch/why_failed.py`), 📋 57. Program List Printer (`scratch/list_programs.py`), 🧪 58. Instructor Smoke Test (`scripts/instructor_smoke.py`), 📟 61. Service Orchestrations (`start.ps1` & `setup.bat` & `start.bat`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises: (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.04
Nodes (46): Built and verified, Built and verified, Decisions, Decisions, Decisions closed this session, Decisions & Findings closed this session, Design Decisions, Design Decisions (+38 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (11): 📊 27. Parameters Tab Table (`frontend/components/analyst/FieldsGrid.tsx`), 📈 28. Time-series Changelog (`frontend/components/analyst/EvolutionTab.tsx`), 💬 29. Interactive Chat (`frontend/components/analyst/ChatWidget.tsx`), 🗄️ 30. Evidence Sliding Drawer (`frontend/components/analyst/EvidenceDrawer.tsx`), 🔲 31. Comparative Workspace Grid (`frontend/components/analyst/MultiFlowWorkspace.tsx`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises: (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (16): ProgramName, Instructor + Gemini smoke test — Phase 0.  Demonstrates that:   1. Instructor wr, Single-field model — simplest possible extraction target., run_smoke_test(), _get_asyncpg_conn(), Phase 0 Definition-of-Done tests.  All five tests must pass for Phase 0 to be, DoD: that UUID is a real row in programs., DoD: standalone script → one Instructor+Gemini call returns valid parsed Pydanti (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (23): BriefView(), BriefViewProps, NarrativeSection, EvidenceDrawer(), createSharedStyles(), ExportBarProps, exportComparisonPDF(), exportPDF() (+15 more)

### Community 17 - "Community 17"
Cohesion: 0.20
Nodes (6): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (11): ComparisonExportButtonProps, SOURCE_TYPE_LABELS, SourcesTab(), SourcesTabProps, ChangelogItem, ChatHistory, ChatResponse, Comparison (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (15): ChatWidget(), ChatWidgetProps, COMPARATIVE_QUICK_PROMPTS, getFollowUpSuggestions(), SINGLE_QUICK_PROMPTS, CitationBadge(), CitationBadgeProps, ComparisonExportButton() (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (21): WorkspacePhase, UseSSEOptions, UseSSEReturn, apiFetch(), comparePrograms(), createProgram(), getChatHistory(), getComparison() (+13 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (20): make_background_session(), Database connection — async SQLAlchemy engine + session factory., NullPool session for background pipeline tasks.      Creates a brand-new engine, find_best_source_for_quote(), Scan ALL fetched sources to find where evidence_quote best matches.      Called, ensure_collection(), get_qdrant_client(), Ensure the Qdrant collection exists for storing source chunks.      Upgraded for (+12 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (6): SimilarProgramsModal(), SimilarProgramsModalProps, InputRowProps, ProgramInput(), ProgramInputProps, Program

### Community 23 - "Community 23"
Cohesion: 0.22
Nodes (9): 🕸️ 16. Graph Setup (`orchestrator/graph.py`), ⚙️ 17. Pipeline Nodes (`orchestrator/nodes.py`), 📦 18. Pipeline State (`orchestrator/state.py`), 📢 19. Event Dispatcher (`orchestrator/events.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises: (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (17): list_all_fields(), Return latest extracted fields across all programs., Filters a list of ExtractedField objects, keeping only the latest run for each f, _build_golden_qa(), _build_ragas_llm(), _call_llm(), _fetch_program_data(), Any (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (14): Embed query, compute sparse TF-IDF, and execute Qdrant RRF hybrid search., _sync_search_qdrant(), embed_texts(), Convert a list of text chunks into vector embeddings using Google's API with key, _call_llm_judge(), Verify if the quote is semantically present in context, allowing minor formattin, Verify that when a source_type is specified, Qdrant FieldCondition is built., Verify that embed_texts rotates keys if the first one throws an exception. (+6 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (17): 10-Day Task Breakdown, Adversarial Case Handling, API Design, Confidence Formula, Database Schema, Endpoints, InfoVac: Solution Document, MVP Architecture (+9 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (15): ChatRequest, ChatResponse, handle_chat_message(), handle_comparison_chat_message(), _is_unk_reply(), AsyncSession, chat_with_comparison(), chat_with_program() (+7 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (15): 1. PRD, 2. MVP Scope, 3. Tech Stack — final, 4. Architecture Diagram, 5. Database Schema, 6. API Design, 7. Wireframes (text format), 8. Task Breakdown — 10 days, 2 engineers (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (5): Phase 4 orchestrator — live e2e test.  Requires:   - docker compose up -d  (P, Full pipeline run via real API.      DoD: programs.status = 'complete' within, Create a program, start pipeline, collect SSE events, assert order.      Uses, test_e2e_run_completes(), test_sse_events_in_correct_order()

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (26): AnalystWorkspace(), EvolutionTab(), EvolutionTabProps, ExportBar(), ALL_FIELDS, CATEGORY_FIELDS, PipelineTracker(), PipelineTrackerProps (+18 more)

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (4): geistMono, inter, metadata, roboto

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (9): 🔍 23. Autocomplete Search Input (`frontend/components/analyst/ProgramInput.tsx`), 🗂️ 24. Single Program Workspace (`frontend/components/analyst/SingleProgramView.tsx`), 🔍 25. Brief View Report (`frontend/components/analyst/BriefView.tsx`), 🎚️ 26. Key Stats Cards (`frontend/components/analyst/OverviewTab.tsx`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises: (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (7): Built and verified this session, Decisions made and why, Deviated from SOLUTION.md / PHASES.md?, Do not reconsider, Exact next step, Handoff — [timestamp] — Phase N [in progress / complete], Open / blocked

### Community 52 - "Community 52"
Cohesion: 0.15
Nodes (12): 1. Environment Setup, 1. The Multi-Agent Pipeline (Backend), 2. High-Density UI Workspace (Frontend), 2. Installation (Automated Setup), 3. Running the Platform (Single-Click), 🕸️ Codebase Knowledge Graph (Graphify), InfoVac — Autonomous Competitive Intelligence Platform, Prerequisites (+4 more)

### Community 54 - "Community 54"
Cohesion: 0.17
Nodes (15): extract_node(), narrate_node(), Generate the analyst brief from gate-verified extracted_fields.      Non-block, iter_fields(), PipelineState, Pipeline state definition and field iteration helpers., Yield (category_key, field_name, ev_dict) for every field in the schema.      Ar, Shared state flowing through the LangGraph pipeline.      All values must be JSO (+7 more)

### Community 55 - "Community 55"
Cohesion: 0.22
Nodes (9): ⏱️ 32. Hybrid Connection Hook (`frontend/hooks/useSSE.ts`), 🔄 33. Runner Stage Panel (`frontend/components/analyst/RunnerStagePanel.tsx`), 🔀 34. Cache Conflict Modal (`frontend/components/analyst/CacheConflictModal.tsx`), 📥 35. Data Exporters (`frontend/components/analyst/ComparisonExportButton.tsx`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises: (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.22
Nodes (9): 🛡️ 42. Citation Gates (`tests/test_gate.py`), 🕸️ 43. Unit Node Exceptions (`tests/test_orchestrator_unit.py`), 🏁 44. E2E Graph Integration (`tests/test_orchestrator_e2e.py`), 📡 45. Crawler Mock Verification (`tests/test_retriever.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises: (+1 more)

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (9): 💸 46. Transaction Assertions (`tests/test_comprehensive_system.py`), 🤖 47. Chat Verification (`tests/test_chat.py`), 🔀 48. Strategic Matrices (`tests/test_comparator.py`), 📝 49. Narrator overview layouts (`tests/test_narrator.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises: (+1 more)

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (3): #1 — Robots.txt: what to do when the check fails or is ambiguous, #2 — Test suite: live API calls vs mocked for routine runs, InfoVac — Open Decisions Log

### Community 61 - "Community 61"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 81 - "Community 81"
Cohesion: 0.22
Nodes (8): 1. CSS Stylesheet (`kobie-theme.css`), 20. Code Boilerplate (Copy-Paste Foundations), 2. Scaffold Template (`index.html`), 6. Component Library, Image/Video Poster Playback Block, Kobie Design System: Visual Language & Frontend Audit, Primary Buttons, Solution & Feature Cards

### Community 82 - "Community 82"
Cohesion: 0.20
Nodes (16): gate_verify(), gate_verify_batch(), Verify multiple fields against one source in a single call.      Args:         f, Verify that `evidence_quote` is textually present in `source_raw_content`., Phase 2 Gate — unit tests.  Pure function tests — no marker needed (no API calls, Gate correctly rejects an injected hallucinated value — Phase 2 DoD., test_batch_verify(), test_custom_threshold() (+8 more)

### Community 83 - "Community 83"
Cohesion: 0.08
Nodes (25): chunk_text(), _get_gemini_keys(), Split raw text into semantic chunks for vector search., Returns a list of all configured Gemini keys, checking GEMINI_API_KEYS and singl, APIKeyBroker, Thread-safe key manager that load-balances key usage and tracks failures., Thread-safe checkout of the next available healthy key.         Blocks until a k, Stall an API key if it fails. (+17 more)

### Community 84 - "Community 84"
Cohesion: 0.29
Nodes (7): 💾 10. Extraction Schemas (`backend/extraction_schemas.py`), 🗄️ 11. SQLAlchemy Models (`backend/models.py`), 🧵 12. Session Management (`backend/db.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 4: Data Models & Session Scopes)

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (7): 🧠 13. Text Embeddings (`backend/embeddings.py`), 📡 14. Vector Database Config (`backend/qdrant_client.py`), 🛣️ 15. API Routers (`backend/routers/` & `backend/main.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 5: Vector Stores & API Gateways)

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (7): 🔑 1. API Key Broker (`backend/key_broker.py`), 🔀 2. Fallback Router Client (`backend/llm_client.py`), 🏷️ 3. Source Classifier (`backend/classifier.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 1: Key Management & Routing)

### Community 87 - "Community 87"
Cohesion: 0.29
Nodes (7): 🖥️ 20. Workspace Home (`frontend/app/page.tsx`), 📊 21. Admin Dashboard (`frontend/app/admin/page.tsx`), 🎨 22. App Layout (`frontend/app/layout.tsx`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 7: App Gateway Pages)

### Community 88 - "Community 88"
Cohesion: 0.15
Nodes (19): gate_verify_multi_source(), GateResult, Citation-Verification Gate — Phase 2.  Every non-null field extracted by the Ext, Verify each segment of evidence_quote against ALL available sources.          Re, Result of a single gate verification., Update programs.trace_url with a public LangSmith tracing URL.          Robust t, set_trace_url(), build_graph() (+11 more)

### Community 89 - "Community 89"
Cohesion: 0.29
Nodes (7): ⚓ 36. Workspace State Hook (`frontend/hooks/useProgram.ts`), 🔌 37. API Fetch Connectors (`frontend/lib/api.ts`), 📄 38. Type Specifications (`frontend/types/api.ts`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 11: Hooks & Connectors)

### Community 90 - "Community 90"
Cohesion: 0.29
Nodes (7): 🤖 39. RAGAS Evaluation Suite (`tests/eval_ragas.py`), 🔍 40. Hybrid RAG Verification (`tests/test_rag_upgrades.py`), 📊 41. Verifier Formula Asserts (`tests/test_verifier.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 12: Test Suites & Audits)

### Community 91 - "Community 91"
Cohesion: 0.29
Nodes (7): 🔍 4. Structured Schema Extractor (`backend/extractor.py`), 🛡️ 5. Verification Gate (`backend/gate.py`), 📊 6. Confidence & Contradictions (`backend/verifier.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 2: Extraction & Verification)

### Community 92 - "Community 92"
Cohesion: 0.29
Nodes (7): ⚙️ 50. Parallelizations & Calibration (`tests/test_phase8.py`), 📦 51. Vector Batching (`tests/test_embed.py`), 🧪 52. Pytest shared environment (`tests/conftest.py` & `tests/phase0_test.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 15: Parallelizations & Pytest Environment)

### Community 93 - "Community 93"
Cohesion: 0.29
Nodes (7): 🧹 53. Target Purges & Cascades (`scratch/delete_mcd.py`), 📡 54. Collections Purge (`scratch/delete_qdrant.py`), 🔑 55. Credentials Diagnostics (`scratch/test_api_keys.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 16: One-Off Scripts & DB Purges)

### Community 94 - "Community 94"
Cohesion: 0.29
Nodes (7): 🌐 7. Web Crawler (`backend/retriever.py`), 📊 8. Comparative Engine (`backend/comparator.py`), 📝 9. Analyst Brief Narrator (`backend/narrator.py`), Cool Features & Surprises:, Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 3: Retrieval & Synthesis)

### Community 95 - "Community 95"
Cohesion: 0.40
Nodes (5): Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 96 - "Community 96"
Cohesion: 0.40
Nodes (5): ⚙️ 59. Container Settings (`docker-compose.yml` & `Dockerfile`), 🔬 60. Pytest asynchronous boundaries (`pytest.ini`), Cool Features & Surprises:, Cool Features & Surprises:, InfoVac Codebase Surprises & Engineering Audit (Part 19: Root Settings and Containers)

### Community 97 - "Community 97"
Cohesion: 0.40
Nodes (5): 10. Content Hierarchy, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 98 - "Community 98"
Cohesion: 0.40
Nodes (5): 11. Imagery, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 99 - "Community 99"
Cohesion: 0.40
Nodes (5): 12. Design Tokens, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 100 - "Community 100"
Cohesion: 0.40
Nodes (5): 13. Frontend Architecture, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 101 - "Community 101"
Cohesion: 0.40
Nodes (5): 14. UI Patterns, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 102 - "Community 102"
Cohesion: 0.40
Nodes (5): 15. UX Decisions, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 103 - "Community 103"
Cohesion: 0.40
Nodes (5): 16. Visual Hierarchy, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 104 - "Community 104"
Cohesion: 0.40
Nodes (5): 17. Responsive Design, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 105 - "Community 105"
Cohesion: 0.40
Nodes (5): 18. Accessibility, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 106 - "Community 106"
Cohesion: 0.40
Nodes (5): 19. Recreating the Kobie Feel: The Design Blueprint, Common Mistakes to Avoid, Core Design Rules, Do's and Don'ts, Spacing Guidelines

### Community 107 - "Community 107"
Cohesion: 0.40
Nodes (5): 1. Brand Personality, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 108 - "Community 108"
Cohesion: 0.40
Nodes (5): 2. Color System, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 109 - "Community 109"
Cohesion: 0.40
Nodes (5): 3. Typography System, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 110 - "Community 110"
Cohesion: 0.40
Nodes (5): 4. Layout System, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 111 - "Community 111"
Cohesion: 0.40
Nodes (5): 5. Hero Section Analysis, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 112 - "Community 112"
Cohesion: 0.40
Nodes (5): 7. Shapes & Visual Language, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 113 - "Community 113"
Cohesion: 0.40
Nodes (5): 8. Motion Design, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 114 - "Community 114"
Cohesion: 0.40
Nodes (5): 9. Navigation UX, How to recreate it, What it is, What psychological effect it creates, Why Kobie chose it

### Community 115 - "Community 115"
Cohesion: 0.29
Nodes (6): db_session(), AsyncSession, Shared pytest fixtures for InfoVac tests.  Key design decision: NullPool. asyncp, Fresh NullPool engine + session per test — no cross-loop asyncpg issues., Insert a Program row; delete it (+ cascaded sources) after each test., temp_program()

### Community 117 - "Community 117"
Cohesion: 0.16
Nodes (10): EvidenceDrawerProps, ScrollArea(), ScrollBar(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader() (+2 more)

### Community 119 - "Community 119"
Cohesion: 0.21
Nodes (12): col, columns, FieldsGridProps, Input(), Table(), TableBody(), TableCaption(), TableCell() (+4 more)

### Community 123 - "Community 123"
Cohesion: 0.22
Nodes (16): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), SelectContent(), SelectGroup() (+8 more)

## Knowledge Gaps
- **342 isolated node(s):** `inter`, `roboto`, `geistMono`, `metadata`, `$schema` (+337 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 123` to `Community 7`, `Community 8`, `Community 16`, `Community 17`, `Community 117`, `Community 119`, `Community 121`, `Community 30`, `Community 95`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 2` to `Community 7`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `Program` (e.g. with `ChatRequest` and `ChatResponse`) actually correct?**
  _`Program` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `ExtractedField` (e.g. with `ChatRequest` and `ChatResponse`) actually correct?**
  _`ExtractedField` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Add raw_html TEXT column to sources table.      Stores up to 80K chars of raw HT`, `Add citation_start and citation_end columns to extracted_fields.      Used to st`, `Add total_cost column to programs table.      Tracks accumulated LLM API cost in` to the rest of the system?**
  _529 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06610259122157588 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._