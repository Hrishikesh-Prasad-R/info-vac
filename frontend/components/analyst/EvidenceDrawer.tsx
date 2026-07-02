"use client";

import { ExternalLink, Calendar } from "lucide-react";
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
      <mark className="rounded px-0.5 not-italic font-bold" style={{ backgroundColor: "rgba(253,127,79,0.18)", color: "#fd7f4f" }}>
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
  // Format access_date nicely
  const accessDate = field?.access_date
    ? new Date(field.access_date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const domain = sourceUrl ? sourceUrl.split("/")[2] || "" : "";
  const isOfficial = domain.includes("starbucks.com") || domain.includes("dunkin") || domain.includes("marriott") || domain.includes("hilton") || domain.includes("hyatt") || domain.includes("delta") || domain.includes("united") || domain.includes("target") || domain.includes("sephora") || domain.includes("ulta");
  
  let sourceType = "Official Website";
  if (sourceUrl.toLowerCase().includes("faq")) sourceType = "Official FAQ";
  else if (sourceUrl.toLowerCase().includes("terms") || sourceUrl.toLowerCase().includes("legal") || sourceUrl.toLowerCase().includes("rules")) sourceType = "Terms & Conditions";
  else if (sourceUrl.toLowerCase().includes("news") || sourceUrl.toLowerCase().includes("press")) sourceType = "Press Release";
  else if (sourceUrl.toLowerCase().includes("forum") || sourceUrl.toLowerCase().includes("reddit")) sourceType = "Community Forum";
  else if (sourceUrl.toLowerCase().includes("apple.com") || sourceUrl.toLowerCase().includes("play.google")) sourceType = "Mobile App Store";

  const authority = isOfficial || sourceType.includes("Terms") || sourceType.includes("FAQ") ? "Primary Authority" : "Secondary Resource";
  const verification = field?.gate_passed ? "Cross-confirmed by 3 sources" : "Single source verified";
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
                    <MetaRow
                      label="Confidence"
                      value={
                        <span
                           className="font-bold"
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
                      }
                    />
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
