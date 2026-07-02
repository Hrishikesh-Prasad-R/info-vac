"use client";

import { useEffect, useRef } from "react";
import { Clock, Zap, RefreshCw, X, Search } from "lucide-react";
import type { Program } from "@/types/api";

interface SimilarProgramsModalProps {
  query: string;
  matches: Program[];
  onSelect: (program: Program) => void;
  onRunFresh: () => void;
  onDismiss: () => void;
}

function formatRelative(isoDate: string): string {
  const d = new Date(isoDate);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatFull(isoDate: string): string {
  const d = new Date(isoDate);
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

/** Highlight the matching portion of the name */
function HighlightedName({ name, query }: { name: string; query: string }) {
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1 || !query) return <span>{name}</span>;
  return (
    <span>
      {name.slice(0, idx)}
      <mark className="rounded px-0.5 not-italic font-semibold" style={{ backgroundColor: "rgba(253,127,79,0.15)", color: "#fd7f4f" }}>
        {name.slice(idx, idx + query.length)}
      </mark>
      {name.slice(idx + query.length)}
    </span>
  );
}

export function SimilarProgramsModal({
  query,
  matches,
  onSelect,
  onRunFresh,
  onDismiss,
}: SimilarProgramsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  useEffect(() => { modalRef.current?.focus(); }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: "rgba(5, 28, 44, 0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="similar-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-[10px] shadow-2xl outline-none overflow-hidden"
        style={{
          backgroundColor: "var(--kobie-midnight)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          animation: "slideUp 0.22s cubic-bezier(0.34,1.2,0.64,1) both",
          boxShadow: "0 32px 64px -12px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(253,127,79,0.12)", border: "1px solid rgba(253,127,79,0.25)" }}>
              <Search size={15} style={{ color: "#fd7f4f" }} />
            </div>
            <div>
              <h2 id="similar-modal-title" className="text-sm font-bold text-white leading-tight" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                Similar analyses found
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                {matches.length} result{matches.length !== 1 ? "s" : ""} matching
                {" "}<span className="font-semibold text-white">"{query}"</span>
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="transition-colors rounded-[4px] p-1 -mr-1 -mt-1"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fd7f4f")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        {/* Match list */}
        <div className="max-h-72 overflow-y-auto" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
          {matches.map((prog, idx) => {
            const completedAt = prog.completed_at ?? prog.created_at;
            return (
              <button
                key={prog.id}
                onClick={() => onSelect(prog)}
                className="w-full text-left px-5 py-3.5 transition-colors group flex items-center justify-between gap-3"
                style={{
                  borderBottom: idx === matches.length - 1 ? "none" : "1px solid rgba(255, 255, 255, 0.05)",
                  background: "transparent",
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-semibold truncate leading-tight" style={{ color: "rgba(255, 255, 255, 0.85)", fontFamily: "var(--kobie-font-heading)" }}>
                    <HighlightedName name={prog.name} query={query} />
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    <Clock size={10} className="shrink-0" />
                    <span className="font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>{formatRelative(completedAt)}</span>
                    <span>·</span>
                    <span>{formatFull(completedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: "rgba(253,127,79,0.12)", color: "#fd7f4f", border: "1px solid rgba(253,127,79,0.25)" }}>
                    Load
                  </span>
                  <Zap size={13} style={{ color: "#fd7f4f" }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer: run fresh */}
        <div className="px-5 py-3.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)" }}>
          <button
            onClick={onRunFresh}
            className="w-full flex items-center justify-between text-xs transition-colors group"
            style={{ color: "rgba(255, 255, 255, 0.65)" }}
            onMouseEnter={e => { (e.currentTarget.querySelector('.footer-fresh-lbl') as HTMLElement).style.color = '#fd7f4f'; }}
            onMouseLeave={e => { (e.currentTarget.querySelector('.footer-fresh-lbl') as HTMLElement).style.color = 'rgba(255, 255, 255, 0.65)'; }}
          >
            <span>
              None of these?{" "}
              <span className="font-bold footer-fresh-lbl transition-colors">
                Run fresh analysis for <span style={{ color: "#fd7f4f" }}>"{query}"</span>
              </span>
            </span>
            <RefreshCw
              size={13}
              style={{ color: "rgba(255,255,255,0.3)" }}
              className="group-hover:rotate-180 transition-all duration-500"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
