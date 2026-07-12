// ──────────────────────────────────────────────
// InfoVac — Single source of truth for all backend API calls.
//
// TO CHANGE THE BACKEND HOST: update API_BASE below.
// TO ADD A NEW ENDPOINT: add a function here.
// ──────────────────────────────────────────────

import type {
  Program,
  Narrative,
  ExtractedField,
  Comparison,
  Evolution,
  ChatHistory,
  ChatResponse,
  PipelineEvent,
  ProgramSource,
} from "@/types/api";

// ── Config ────────────────────────────────────────────────────────────────────
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// ── Helpers ───────────────────────────────────────────────────────────────────
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Programs ──────────────────────────────────────────────────────────────────

/** Create a new program row and return its UUID. Does NOT start the pipeline.
 * Pass force=true to bypass the dedup cache and always run a fresh analysis.
 */
export async function createProgram(name: string, force = false): Promise<Program> {
  return apiFetch<Program>("/api/programs", {
    method: "POST",
    body: JSON.stringify({ name, force }),
  });
}

/** Start the background pipeline for an existing program. */
export async function runProgram(programId: string): Promise<void> {
  await apiFetch(`/api/programs/${programId}/run`, { method: "POST" });
}

/** Get program status. */
export async function getProgram(programId: string): Promise<Program> {
  return apiFetch<Program>(`/api/programs/${programId}`);
}

/** Get all pipeline events for a program. */
export async function getProgramEvents(programId: string): Promise<PipelineEvent[]> {
  return apiFetch<PipelineEvent[]>(`/api/programs/${programId}/events`);
}

/** Get the analyst narrative for a completed program. */
export async function getNarrative(programId: string): Promise<Narrative> {
  return apiFetch<Narrative>(`/api/programs/${programId}/narrative`);
}

/** Get all extracted fields for a program (raw). */
export async function getExtractedFields(
  programId: string
): Promise<ExtractedField[]> {
  // Backend returns fields directly from the DB — we fetch them via a
  // helper endpoint. If you later add GET /api/programs/{id}/fields, update here.
  // For now we use the evolution endpoint to get structured diff, and
  // the admin page polls the fields directly if a dedicated endpoint is added.
  // Placeholder — returns empty array until backend adds the endpoint.
  try {
    const res = await fetch(`${API_BASE}/api/programs/${programId}/fields`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ── SSE ───────────────────────────────────────────────────────────────────────

/** Return the SSE URL for a program's pipeline events. */
export function getSSEUrl(programId: string): string {
  return `${API_BASE}/api/programs/${programId}/stream`;
}

// ── Comparator ────────────────────────────────────────────────────────────────

/** Run a strategic comparison between 2+ completed programs. */
export async function comparePrograms(
  programIds: string[]
): Promise<Comparison> {
  return apiFetch<Comparison>("/api/compare", {
    method: "POST",
    body: JSON.stringify({ program_ids: programIds }),
  });
}

/** Get a stored comparison by ID. */
export async function getComparison(comparisonId: string): Promise<Comparison> {
  return apiFetch<Comparison>(`/api/compare/${comparisonId}`);
}

// ── Evolution ─────────────────────────────────────────────────────────────────

/** Get the evolution changelog for a program (oldest vs newest run). */
export async function getEvolution(programId: string): Promise<Evolution> {
  return apiFetch<Evolution>(`/api/programs/${programId}/evolution`);
}

/** Send a chat message and get a response. */
export async function sendChatMessage(
  programId: string,
  message: string,
  sourceType?: string
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>(`/api/programs/${programId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message, source_type: sourceType ?? null }),
  });
}

/** Get chat history for a program. */
export async function getChatHistory(
  programId: string
): Promise<ChatHistory> {
  return apiFetch<ChatHistory>(`/api/programs/${programId}/chat`);
}

/** Send a chat message to a comparison and get a response. */
export async function sendComparisonChatMessage(
  comparisonId: string,
  message: string
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>(`/api/comparisons/${comparisonId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

/** Get chat history for a comparison. */
export async function getComparisonChatHistory(
  comparisonId: string
): Promise<ChatHistory> {
  return apiFetch<ChatHistory>(`/api/comparisons/${comparisonId}/chat`);
}

/** Hard-delete a program and all its data (SQL cascade + Qdrant cleanup). */
export async function deleteProgram(programId: string): Promise<{ deleted: boolean; program_name: string; qdrant_cleaned: boolean }> {
  return apiFetch(`/api/programs/${programId}`, { method: "DELETE" });
}

// ── Health ────────────────────────────────────────────────────────────────────

/** Simple health check. Returns true if the backend is reachable. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get all crawled sources for a program (powers the Sources tab). */
export async function getProgramSources(programId: string): Promise<ProgramSource[]> {
  try {
    return apiFetch<ProgramSource[]>(`/api/programs/${programId}/sources`);
  } catch {
    return [];
  }
}

/** Fuzzy search: returns completed programs whose name contains the query string.
 *  Powers the "similar programs found" modal shown before starting a new analysis.
 */
export async function searchPrograms(q: string): Promise<Program[]> {
  try {
    return apiFetch<Program[]>(`/api/programs/search?q=${encodeURIComponent(q)}`);
  } catch {
    return [];
  }
}
