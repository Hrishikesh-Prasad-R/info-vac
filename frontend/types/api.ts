// ──────────────────────────────────────────────
// InfoVac — TypeScript types matching the FastAPI backend schemas
// If backend adds a field, add it here → TypeScript will tell you
// everywhere it needs updating.
// ──────────────────────────────────────────────

export type ProgramStatus =
  | "pending"
  | "retrieving"
  | "retrieved"
  | "embedding"
  | "extracting"
  | "extracted"
  | "verifying"
  | "verified"
  | "narrating"
  | "complete"
  | "failed";

export interface Program {
  id: string;
  name: string;
  status: ProgramStatus;
  trace_url?: string | null;
  total_cost?: number | null;
  created_at: string;
  completed_at?: string | null;
}

export interface PipelineEvent {
  stage: string;
  progress: number;
  detail: string;
  created_at?: string;
}

// ── Extracted Fields ─────────────────────────────

export interface ExtractedField {
  id: string;
  program_id: string;
  category: string;
  field_name: string;
  field_value: string | null;
  is_null: boolean;
  claimed_snippet: string | null;
  gate_passed: boolean | null;
  match_score: number | null;
  citation_start: number | null;
  citation_end: number | null;
  corroboration_score: number | null;
  authority_score: number | null;
  recency_score: number | null;
  confidence: number | null;
  source_id: string | null;
  source_url: string | null;
  source_type: string | null;
  access_date: string | null;
  contradiction_flag: boolean;
  contradiction_note: string | null;
  created_at: string;
}

// ── Narrative ────────────────────────────────────

export interface Narrative {
  program_id: string;
  narrative: string;
  word_count: number;
  created_at: string;
}

// ── Comparison ───────────────────────────────────

export interface MatrixItem {
  category: string;
  rankings: string[];
  rationale: string;
}

export interface ComparisonAnalysis {
  executive_summary: string;
  matrix: MatrixItem[];
  strategic_recommendations: string;
}

export interface Comparison {
  comparison_id: string;
  program_ids: string[];
  analysis: ComparisonAnalysis;
  created_at: string;
}

// ── Evolution ────────────────────────────────────

export interface ChangelogItem {
  category: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  change_type: "upgraded" | "devalued" | "altered" | "none";
  analysis: string;
}

export interface Evolution {
  executive_summary: string;
  changelog: ChangelogItem[];
}

// ── Chat ─────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatHistory {
  conversation_id?: string;
  messages: ChatMessage[];
}

export interface ChatResponse {
  conversation_id: string;
  reply: string;
}

// ── Sources ──────────────────────────────────────

export interface ProgramSource {
  id: string;
  url: string;
  source_type: string;
  title: string | null;
  fetch_status: string;
  fetched_at: string;
}
