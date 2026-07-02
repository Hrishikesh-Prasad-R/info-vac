"use client";

import { useState, useEffect } from "react";
import { Globe, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getProgramSources } from "@/lib/api";
import type { ProgramSource } from "@/types/api";

interface SourcesTabProps {
  programId: string;
}

const SOURCE_TYPE_LABELS: Record<string, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  tnc:          { label: "T&C",        bgColor: 'rgba(139,92,246,0.15)', textColor: '#a78bfa', borderColor: 'rgba(139,92,246,0.3)' },
  press:        { label: "Press",      bgColor: 'rgba(59,130,246,0.15)', textColor: '#60a5fa', borderColor: 'rgba(59,130,246,0.3)' },
  faq:          { label: "FAQ",        bgColor: 'rgba(14,165,233,0.15)', textColor: '#38bdf8', borderColor: 'rgba(14,165,233,0.3)' },
  homepage:     { label: "Homepage",   bgColor: 'rgba(255,255,255,0.08)', textColor: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' },
  benefits:     { label: "Benefits",   bgColor: 'rgba(20,184,166,0.15)', textColor: '#2dd4bf', borderColor: 'rgba(20,184,166,0.3)' },
  news:         { label: "News",       bgColor: 'rgba(245,158,11,0.15)', textColor: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' },
  mechanics:    { label: "Mechanics",  bgColor: 'rgba(99,102,241,0.15)', textColor: '#818cf8', borderColor: 'rgba(99,102,241,0.3)' },
  partners:     { label: "Partners",   bgColor: 'rgba(16,185,129,0.12)', textColor: '#34d399', borderColor: 'rgba(16,185,129,0.3)' },
  app_review:   { label: "App Review", bgColor: 'rgba(253,127,79,0.15)', textColor: '#fd7f4f', borderColor: 'rgba(253,127,79,0.3)' },
  competitors:  { label: "Competitor", bgColor: 'rgba(239,68,68,0.12)', textColor: '#f87171', borderColor: 'rgba(239,68,68,0.3)' },
  forum:        { label: "Forum",      bgColor: 'rgba(244,63,94,0.12)', textColor: '#fb7185', borderColor: 'rgba(244,63,94,0.3)' },
};

function Favicon({ url }: { url: string }) {
  const [err, setErr] = useState(false);
  const domain = url ? url.split("/")[2] || "" : "";
  if (err || !domain) {
    return <Globe size={14} className="shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
      onError={() => setErr(true)}
      className="w-3.5 h-3.5 rounded-sm object-contain shrink-0"
      alt=""
    />
  );
}

export function SourcesTab({ programId }: SourcesTabProps) {
  const [sources, setSources] = useState<ProgramSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = await getProgramSources(programId);
        if (active) setSources(data);
      } catch (err) {
        console.error("Failed to load sources:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [programId]);

  const succeeded = sources.filter((s) => s.fetch_status === "success" || s.fetch_status === "tavily_fallback");
  const failed = sources.filter((s) => s.fetch_status !== "success" && s.fetch_status !== "tavily_fallback");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
        <Loader2 size={16} className="animate-spin" style={{ color: '#fd7f4f' }} />
        Loading sources…
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <p className="text-sm text-center py-12" style={{ color: 'rgba(255,255,255,0.3)' }}>No source data available.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs font-mono rounded-[8px] px-4 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>Total crawled:</span>
        <span className="font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{sources.length}</span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <span className="font-semibold" style={{ color: '#10b981' }}>{succeeded.length} succeeded</span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <span className="font-semibold" style={{ color: '#ef4444' }}>{failed.length} failed</span>
      </div>

      {/* Source list */}
      <div className="overflow-hidden rounded-[8px]" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {sources.map((src) => {
          const badge = SOURCE_TYPE_LABELS[src.source_type] ?? {
            label: src.source_type,
            bgColor: 'rgba(255,255,255,0.06)',
            textColor: 'rgba(255,255,255,0.5)',
            borderColor: 'rgba(255,255,255,0.12)',
          };
          const domain = src.url.split("/")[2] ?? src.url;
          const date = new Date(src.fetched_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

          return (
            <div
              key={src.id}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {/* Status icon */}
              {src.fetch_status === "success" || src.fetch_status === "tavily_fallback" ? (
                <CheckCircle2 size={14} className="shrink-0" style={{ color: '#10b981' }} />
              ) : (
                <XCircle size={14} className="shrink-0" style={{ color: '#ef4444' }} />
              )}

              {/* Favicon */}
              <Favicon url={src.url} />

              {/* URL + title */}
              <div className="flex-1 min-w-0">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium truncate block transition-colors"
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fd7f4f')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                  title={src.url}
                >
                  {src.title || domain}
                </a>
                <span className="text-[10px] font-mono truncate block" style={{ color: 'rgba(255,255,255,0.3)' }}>{domain}</span>
              </div>

              {/* Source type badge */}
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] border shrink-0" style={{ backgroundColor: (badge as any).bgColor, color: (badge as any).textColor, borderColor: (badge as any).borderColor }}>
                {badge.label}
              </span>

              {/* Date */}
              <span className="text-[10px] font-mono shrink-0 w-20 text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>{date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
