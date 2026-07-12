import { useState, useMemo, useEffect } from "react";
import { Copy, Check, ExternalLink, ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { CitationBadge } from "./CitationBadge";
import { exportPDF } from "./ExportBar";
import type { Narrative, ExtractedField } from "@/types/api";
import {
  parseNarrative,
  splitNarrativeSegments,
  parseBoldSegments,
  type ParsedReference,
  calculateWordCount,
  WATERMARK_TEXT,
} from "@/lib/narrative";

interface BriefViewProps {
  narrative: Narrative;
  fields: ExtractedField[];
  parsedRefs?: ParsedReference[];
  programName?: string;
}

interface NarrativeSection {
  title: string;
  elements: React.ReactNode[];
}

function groupNarrativeBySections(
  text: string,
  urlMap: Map<string, number>,
  onCiteClick: (url: string) => void
): NarrativeSection[] {
  const paragraphs = text.split(/\n{2,}/);
  const sections: NarrativeSection[] = [];
  let currentSection: NarrativeSection = { title: "Overview", elements: [] };

  paragraphs.forEach((para, i) => {
    const trimmed = para.trim();
    if (!trimmed) return;

    const h2Match = trimmed.match(/^##\s+(.+)/);
    const h3Match = trimmed.match(/^###\s+(.+)/);

    if (h2Match) {
      if (currentSection.elements.length > 0 || currentSection.title !== "Overview") {
        sections.push(currentSection);
      }
      currentSection = { title: h2Match[1], elements: [] };
    } else if (h3Match) {
      currentSection.elements.push(
        <h3
          key={`h3-${i}`}
          className="text-xs font-bold uppercase tracking-wider mt-4 mb-2"
          style={{ color: "rgba(9,37,56,0.5)", fontFamily: "var(--kobie-font-heading)" }}
        >
          {h3Match[1]}
        </h3>
      );
    } else {
      const segments = splitNarrativeSegments(trimmed, urlMap);
      currentSection.elements.push(
        <p
          key={`p-${i}`}
          className="text-xs leading-[1.8] mb-3"
          style={{ color: "rgba(9,37,56,0.8)", fontFamily: "var(--kobie-font-body)" }}
        >
          {segments.map((seg, j) =>
            seg.type === "text" ? (
              // Wrap all segments — mixing raw strings and elements in an array can drop strings
              parseBoldSegments(seg.text).map((b, k) =>
                b.bold
                  ? <strong key={`${j}-b${k}`} style={{ color: "rgba(9,37,56,0.95)", fontWeight: 700 }}>{b.text}</strong>
                  : <span key={`${j}-p${k}`}>{b.text}</span>
              )
            ) : (
              <CitationBadge
                key={j}
                num={seg.num ?? 1}
                url={seg.url}
                onClick={() => seg.url && onCiteClick(seg.url)}
              />
            )
          )}
        </p>
      );
    }
  });

  if (currentSection.elements.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function ReferencesSection({
  references,
  onRefClick,
}: {
  references: ParsedReference[];
  onRefClick: (url: string) => void;
}) {
  if (references.length === 0) return null;

  return (
    <div
      id="references-section"
      className="mt-10 p-5 rounded-[6px] border text-left"
      style={{
        backgroundColor: "#ffffff",
        borderColor: "rgba(0,0,0,0.06)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 2px 8px rgba(0,0,0,0.01)",
      }}
    >
      <span className="kobie-overline" style={{ color: "#092538", marginBottom: "16px", display: "block" }}>References</span>
      <ol className="space-y-5 list-none">
        {references.map((ref) => {
          const displayDate = ref.accessDate ?? "—";
          return (
            <li key={ref.url} id={`ref-${ref.num}`} className="flex items-start gap-3">
              <span
                className="text-[11px] font-bold shrink-0 mt-0.5 w-6 text-right"
                style={{ color: "#092538" }}
              >
                [{ref.num}]
              </span>
              <div className="flex-1 space-y-1">
                <div className="flex items-start gap-1.5">
                  <span
                    className="text-[11px] shrink-0 font-semibold w-28 text-left"
                    style={{ color: "rgba(9,37,56,0.45)" }}
                  >
                    Source
                  </span>
                  <button
                    onClick={() => onRefClick(ref.url)}
                    className="text-[11px] hover:underline text-left break-all transition-colors flex items-center gap-1"
                    style={{ color: "#2563eb" }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#1d4ed8'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#2563eb'; }}
                    title="View evidence"
                  >
                    {ref.url}
                    <ExternalLink size={9} className="shrink-0 opacity-50" />
                  </button>
                </div>
                <div className="flex items-start gap-1.5">
                  <span
                    className="text-[11px] shrink-0 font-semibold w-28 text-left"
                    style={{ color: "rgba(9,37,56,0.45)" }}
                  >
                    Evidence Quote
                  </span>
                  <span
                    className="text-[11px] italic leading-relaxed"
                    style={{ color: "rgba(9,37,56,0.7)" }}
                  >
                    {ref.snippet ? `"${ref.snippet}"` : "—"}
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span
                    className="text-[11px] shrink-0 font-semibold w-28 text-left"
                    style={{ color: "rgba(9,37,56,0.45)" }}
                  >
                    Access Date
                  </span>
                  <span className="text-[11px]" style={{ color: "rgba(9,37,56,0.6)" }}>
                    {displayDate}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function BriefView({ narrative, fields, parsedRefs, programName }: BriefViewProps) {
  const [copied, setCopied] = useState(false);
  const [drawerUrl, setDrawerUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Defer heavy parsing to ensure instant tab transition with loader
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const { urlMap, references } = useMemo(() => {
    if (!isReady) return { urlMap: new Map<string, number>(), references: [] };
    return parsedRefs
      ? (() => {
          const m = new Map<string, number>();
          parsedRefs.forEach((r) => m.set(r.url, r.num));
          return { urlMap: m, references: parsedRefs };
        })()
      : parseNarrative(narrative.narrative, fields);
  }, [narrative.narrative, fields, parsedRefs, isReady]);

  const sections = useMemo(() => {
    if (!isReady) return [];
    return groupNarrativeBySections(narrative.narrative, urlMap, setDrawerUrl);
  }, [narrative.narrative, urlMap, isReady]);

  // Set initial expanded section once parsed
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isReady && sections.length > 0) {
      setExpandedSections((prev) => {
        if (Object.keys(prev).length === 0) {
          return { [sections[0].title]: true };
        }
        return prev;
      });
    }
  }, [isReady, sections]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    sections.forEach((s) => {
      next[s.title] = true;
    });
    setExpandedSections(next);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  const allExpanded = useMemo(() => {
    return sections.length > 0 && sections.every((s) => !!expandedSections[s.title]);
  }, [sections, expandedSections]);

  async function handlePDFExport() {
    setPdfLoading(true);
    try {
      await exportPDF(narrative, fields, programName ?? "program");
    } catch (err) {
      console.error("Failed to export PDF:", err);
    } finally {
      setPdfLoading(false);
    }
  }

  const drawerField = drawerUrl
    ? fields.find(
        (f) => f.source_url === drawerUrl && f.claimed_snippet != null && f.claimed_snippet.length > 0
      ) ?? null
    : null;

  function handleCopy() {
    const clean = narrative.narrative.replace(/\(source:\s*https?:\/\/[^\s)]+\)/g, "");
    navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const wordCount = useMemo(() => calculateWordCount(narrative.narrative), [narrative.narrative]);

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Loader2 size={28} className="animate-spin text-[#fd7f4f]" />
        <p className="text-xs font-semibold text-[#092538]/60" style={{ fontFamily: "var(--kobie-font-heading)" }}>
          Loading Analyst Brief...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2 text-left">
          <div>
            <span className="kobie-overline" style={{ color: "#092538" }}>Analyst Brief</span>
            <p className="text-xs" style={{ color: "rgba(9, 37, 56, 0.5)" }}>
              {wordCount} words · Click{" "}
              <sup
                className="font-bold text-[9px] px-1 rounded border"
                style={{ color: "#fd7f4f", borderColor: "rgba(253,127,79,0.3)" }}
              >
                N
              </sup>{" "}
              citations to view source evidence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePDFExport}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 h-7 px-2.5 text-[10px] font-bold transition-all rounded-[4px] disabled:opacity-40"
              style={{
                fontFamily: "var(--kobie-font-heading)",
                color: "rgba(9,37,56,0.6)",
                border: "1px solid rgba(9,37,56,0.15)",
                background: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = "#092538";
                e.currentTarget.style.borderColor = "rgba(9,37,56,0.3)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = "rgba(9,37,56,0.6)";
                e.currentTarget.style.borderColor = "rgba(9,37,56,0.15)";
              }}
            >
              {pdfLoading ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <FileText size={10} strokeWidth={1.5} />
              )}
              {pdfLoading ? "Generating…" : "PDF"}
            </button>

            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-[10px] font-bold px-2.5 py-1 rounded transition-colors"
              style={{ color: "rgba(9,37,56,0.6)", border: "1px solid rgba(9,37,56,0.15)", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#092538")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(9,37,56,0.6)")}
            >
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 h-7 px-3 text-xs font-bold transition-all rounded-[6px]"
              style={{
                fontFamily: "var(--kobie-font-heading)",
                color: "rgba(9,37,56,0.6)",
                border: "1px solid rgba(9,37,56,0.15)",
                background: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#092538")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(9,37,56,0.6)")}
            >
              {copied ? (
                <Check size={12} strokeWidth={1.5} style={{ color: "#10b981" }} />
              ) : (
                <Copy size={12} strokeWidth={1.5} />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Accordion Sections List */}
        <div className="space-y-3.5 mb-8 text-left">
          {sections.map((sec) => {
            const isSecExpanded = !!expandedSections[sec.title];
            return (
              <div
                key={sec.title}
                className="rounded-[6px] border overflow-hidden transition-all duration-200"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: isSecExpanded ? "rgba(9,37,56,0.15)" : "rgba(0,0,0,0.06)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 2px 8px rgba(0,0,0,0.01)",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(sec.title)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors cursor-pointer"
                  style={{
                    backgroundColor: isSecExpanded ? "rgba(9,37,56,0.02)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSecExpanded) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.01)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSecExpanded) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    className="text-xs font-black uppercase tracking-wider text-[#092538]"
                    style={{ fontFamily: "var(--kobie-font-heading)" }}
                  >
                    {sec.title}
                  </span>
                  {isSecExpanded ? (
                    <ChevronDown size={14} className="text-[#092538] shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-[#092538]/40 shrink-0" />
                  )}
                </button>

                {isSecExpanded && (
                  <div className="px-5 pb-5 pt-3 leading-relaxed border-t border-[rgba(0,0,0,0.04)] bg-white">
                    {sec.elements}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <ReferencesSection references={references} onRefClick={setDrawerUrl} />

        {/* Watermark divider */}
        <div className="relative flex py-6 items-center mt-8">
          <div className="flex-grow" style={{ borderTop: "1px solid rgba(9,37,56,0.08)" }} />
          <span
            className="flex-shrink mx-4 text-[9px] font-mono uppercase tracking-wider"
            style={{ color: "rgba(9,37,56,0.3)" }}
          >
            {WATERMARK_TEXT}
          </span>
          <div className="flex-grow" style={{ borderTop: "1px solid rgba(9,37,56,0.08)" }} />
        </div>
      </div>

      <EvidenceDrawer
        open={drawerUrl !== null}
        onClose={() => setDrawerUrl(null)}
        sourceUrl={drawerUrl ?? ""}
        field={drawerField}
      />
    </>
  );
}
