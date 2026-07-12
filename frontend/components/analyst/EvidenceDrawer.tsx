"use client";

import { useState } from "react";
import { ExternalLink, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExtractedField } from "@/types/api";

interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  sourceUrl: string;
  field: ExtractedField | null;
}

/** Highlight the claimed snippet within source text using character offsets. */
function HighlightedContent({
  content,
  start,
  end,
}: {
  content: string;
  start: number | null;
  end: number | null;
}) {
  if (start == null || end == null || start < 0 || end <= start) {
    return <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255, 255, 255, 0.9)" }}>{content}</p>;
  }

  const before = content.slice(0, start);
  const highlighted = content.slice(start, end);
  const after = content.slice(end);

  return (
    <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255, 255, 255, 0.9)" }}>
      {before}
      <mark className="bg-[rgba(253,127,79,0.18)] text-[#fd7f4f] rounded px-0.5 not-italic font-bold">
        {highlighted}
      </mark>
      {after}
    </p>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 last:border-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="text-[11px] shrink-0 pt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
      <span className="text-[11px] font-semibold text-right break-all" style={{ color: "rgba(255,255,255,0.85)" }}>{value}</span>
    </div>
  );
}

export function EvidenceDrawer({ open, onClose, sourceUrl, field }: EvidenceDrawerProps) {
  const [scoreExpanded, setScoreExpanded] = useState(false);
  // Format access_date nicely
  const accessDate = field?.access_date
    ? new Date(field.access_date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  // ── Source type: use real DB value, fall back to URL sniffing only if null ──
  const SOURCE_TYPE_LABELS: Record<string, string> = {
    tnc:        "Terms & Conditions",
    faq:        "Official FAQ",
    homepage:   "Official Website",
    press:      "Press Release",
    news:       "News Coverage",
    app_review: "App Store Listing",
    forum:      "Community Forum",
    benefits:   "Benefits Page",
    mechanics:  "Mechanics Page",
    partners:   "Partners Page",
    competitors:"Competitor Coverage",
  };

  // ── Authority tier: derived from the real source_type ──
  const AUTHORITY_LABELS: Record<string, string> = {
    tnc:        "Primary Authority",
    faq:        "Primary Authority",
    homepage:   "Primary Authority",
    press:      "Brand Press Release",
    news:       "Third-party Coverage",
    app_review: "App Store Listing",
    forum:      "Community Forum",
    benefits:   "Primary Authority",
    mechanics:  "Primary Authority",
    partners:   "Primary Authority",
    competitors:"Third-party Coverage",
  };

  let sourceType: string;
  let authority: string;

  if (field?.source_type) {
    // Use the real source_type from the DB
    sourceType = SOURCE_TYPE_LABELS[field.source_type] ?? field.source_type;
    authority  = AUTHORITY_LABELS[field.source_type] ?? "Secondary Resource";
  } else {
    // Legacy fallback: URL pattern sniffing (for fields without source_type)
    const url = sourceUrl.toLowerCase();
    if (url.includes("faq"))                                               { sourceType = "Official FAQ";        authority = "Primary Authority"; }
    else if (url.includes("terms") || url.includes("legal") || url.includes("rules")) { sourceType = "Terms & Conditions"; authority = "Primary Authority"; }
    else if (url.includes("news") || url.includes("press"))               { sourceType = "Press Release";       authority = "Brand Press Release"; }
    else if (url.includes("forum") || url.includes("reddit"))             { sourceType = "Community Forum";     authority = "Community Forum"; }
    else if (url.includes("apple.com") || url.includes("play.google"))    { sourceType = "Mobile App Store";   authority = "App Store Listing"; }
    else                                                                    { sourceType = "Official Website";    authority = "Secondary Resource"; }
  }

  // ── Verification: use corroboration_score from DB instead of fake hardcoded string ──
  let verification: string;
  if (!field?.gate_passed) {
    verification = "Not gate-verified";
  } else if (field.corroboration_score == null) {
    verification = "Gate-verified";
  } else if (field.corroboration_score >= 0.5) {
    verification = "High corroboration across sources";
  } else if (field.corroboration_score >= 0.2) {
    verification = "Corroborated by multiple sources";
  } else {
    verification = "Single source verified";
  }

  const usedIn = field ? `${field.category} > ${field.field_name.replace(/_/g, ' ')}` : "Executive Summary & Matrices";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:w-[540px] flex flex-col p-0 gap-0 h-full overflow-hidden border-l" style={{ backgroundColor: "var(--kobie-midnight)", borderColor: "rgba(255,255,255,0.1)" }}>
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" }}>
          <SheetTitle className="text-sm font-bold text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>
            Evidence Source
          </SheetTitle>
          <SheetDescription className="text-xs mt-1">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors break-all"
                style={{ color: "#fd7f4f" }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                <ExternalLink size={11} strokeWidth={1.5} className="shrink-0" />
                {sourceUrl}
              </a>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.35)" }}>No source URL</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">
            {field ? (
              <>
                {/* Field metadata card */}
                <div className="rounded-[8px] px-4 py-1" style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <MetaRow label="Field" value={`${field.category}.${field.field_name}`} />
                  <MetaRow
                    label="Value"
                    value={
                      <span className="max-w-[200px] block text-right">
                        {String(field.field_value ?? "—")}
                      </span>
                    }
                  />
                  {field.confidence != null && (
                    <>
                      {/* Confidence row — clickable to expand sub-scores */}
                      <button
                        className="w-full flex items-center justify-between py-2.5 border-b text-left"
                        style={{ borderColor: "rgba(255,255,255,0.06)", cursor: "pointer" }}
                        onClick={() => setScoreExpanded(v => !v)}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--kobie-font-heading)" }}>
                          Confidence
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="font-bold text-[11px]"
                            style={{
                              color:
                                field.confidence >= 0.6
                                  ? "#10b981"
                                  : field.confidence >= 0.4
                                  ? "#fbbf24"
                                  : "#ef4444"
                            }}
                          >
                            {(field.confidence * 100).toFixed(0)}%
                          </span>
                          {scoreExpanded
                            ? <ChevronDown size={10} strokeWidth={2} style={{ color: "rgba(255,255,255,0.3)" }} />
                            : <ChevronRight size={10} strokeWidth={2} style={{ color: "rgba(255,255,255,0.3)" }} />
                          }
                        </span>
                      </button>
                      {/* Sub-scores breakdown — visible when expanded */}
                      {scoreExpanded && (
                        <div className="py-2 space-y-2 px-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {([
                            { label: "Corroboration", val: field.corroboration_score, tip: "Fraction of sources that agreed on this value" },
                            { label: "Authority",     val: field.authority_score,     tip: "Weight given to the source type (official > forum)" },
                            { label: "Recency",       val: field.recency_score,       tip: "How recently the source was published" },
                          ] as const).map(({ label, val, tip }) => (
                            <div key={label} className="flex items-center justify-between" title={tip}>
                              <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                                {label}
                              </span>
                              {val != null ? (
                                <div className="flex items-center gap-2">
                                  {/* Mini bar */}
                                  <div className="w-16 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.round(val * 100)}%`,
                                        backgroundColor: val >= 0.6 ? "#10b981" : val >= 0.4 ? "#fbbf24" : "#ef4444",
                                      }}
                                    />
                                  </div>
                                  <span className="text-[9px] font-mono font-bold" style={{ color: val >= 0.6 ? "#10b981" : val >= 0.4 ? "#fbbf24" : "#ef4444" }}>
                                    {Math.round(val * 100)}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                              )}
                            </div>
                          ))}
                          <p className="text-[8px] italic text-right pt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                            Click row to collapse
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {field.match_score != null && (
                    <MetaRow
                      label="Gate score"
                      value={
                        <span
                          className="font-bold"
                          style={{
                            color: field.match_score >= 0.8 ? "#10b981" : "#ef4444"
                          }}
                        >
                          {(field.match_score * 100).toFixed(0)}%
                        </span>
                      }
                    />
                  )}
                  <MetaRow label="Source Type" value={sourceType} />
                  <MetaRow
                    label="Authority"
                    value={
                      <span className="font-bold text-white/90">
                        {authority}
                      </span>
                    }
                  />
                  <MetaRow label="Verification" value={verification} />
                  {/* Contradiction warning if sources disagreed */}
                  {field.contradiction_flag && field.contradiction_note && (
                    <MetaRow
                      label="⚠ Conflict"
                      value={
                        <span className="text-[10px] text-amber-400 font-semibold leading-snug block max-w-[220px] text-right">
                          {field.contradiction_note.replace(/Conflicting values found:\s*/i, "")}
                        </span>
                      }
                    />
                  )}
                  <MetaRow
                    label="Used In"
                    value={
                      <span className="text-[10px] text-[#fd7f4f] truncate block max-w-[220px]">
                        {usedIn}
                      </span>
                    }
                  />
                  {accessDate ? (
                    <MetaRow
                      label="Accessed"
                      value={
                        <span className="flex items-center gap-1 justify-end">
                           <Calendar size={10} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.3)" }} />
                          {accessDate}
                        </span>
                      }
                    />
                  ) : (
                    <MetaRow label="Accessed" value="—" />
                  )}
                </div>

                {/* Evidence quote */}
                {field.claimed_snippet && (
                  <div className="mt-7">
                    <span className="kobie-overline text-white" style={{ fontSize: "10px", marginBottom: "8px", display: "block", color: "#ffffff" }}>
                      Evidence Quote
                    </span>
                    <div className="rounded-[8px] p-4 mt-2" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <HighlightedContent
                        content={field.claimed_snippet}
                        start={field.citation_start}
                        end={field.citation_end}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-32 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                No field evidence available for this citation.
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
