"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CheckCircle2, Circle, AlertCircle, Loader2, Globe, ChevronDown, ChevronRight, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import type { PipelineEvent, ProgramStatus } from "@/types/api";

interface PipelineTrackerProps {
  events: PipelineEvent[];
  isDegraded: boolean;
  isConnected: boolean;
}

// 44 fields grouped by category mapping
const CATEGORY_FIELDS: Record<string, string[]> = {
  "Program Basics": ["program_name", "brand", "industry", "program_type", "geography", "membership_count"],
  "Partnerships": ["partner_names", "partnership_types", "notable_partnerships", "airline_hotel_links", "partner_earn_rates"],
  "Earn Mechanics": ["base_earn_rate", "bonus_categories", "non_transactional_earn", "earn_cap", "earning_currency"],
  "Digital Experience": ["mobile_app_available", "app_store_rating", "play_store_rating", "personalization_features", "gamification_features", "digital_exclusives"],
  "Burn Mechanics": ["redemption_options", "minimum_redemption", "point_value_cents", "expiry_policy", "blackout_dates", "transfer_options"],
  "Member Sentiment": ["overall_rating", "common_praise", "common_complaints", "nps_or_satisfaction", "sentiment_sources_checked"],
  "Tier System": ["has_tiers", "tier_names", "tier_qualification_criteria", "top_tier_benefits", "qualification_period", "tier_count"],
  "Competitive Position": ["key_differentiators", "weaknesses", "closest_competitors", "market_position", "recent_changes"],
  "Meta Insights": ["notable_unstructured_details"]
};

// Flattened field list for counting and displaying
const ALL_FIELDS = Object.entries(CATEGORY_FIELDS).flatMap(([cat, fields]) =>
  fields.map(f => ({ name: f, category: cat }))
);

function Favicon({ url }: { url: string }) {
  const [err, setErr] = useState(false);
  const domain = url ? url.split("/")[2] || "" : "";
  if (err || !domain) {
    return <Globe size={14} className="text-stone-400 shrink-0" />;
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

export function PipelineTracker({ events, isDegraded, isConnected }: PipelineTrackerProps) {
  // Stage collapse states: Discovering(1), Crawling(2), Discovered(3), Extracting(4), Finalizing(5)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({
    1: true,  // start with stage 1 open
    2: false,
    3: false,
    4: false,
    5: false,
  });

  const [activeStage, setActiveStage] = useState<number>(1);
  const [stageTimes, setStageTimes] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0
  });

  const autoScrolls = useRef<Record<number, boolean>>({ 1: true, 2: true, 4: true });
  const containers = useRef<Record<number, HTMLDivElement | null>>({ 1: null, 2: null, 4: null });

  // Memoized stream data parsing
  const { candidates, crawls, extractedMap } = useMemo(() => {
    const candidatesList: Array<{ title: string; url: string; snippet: string; domain: string }> = [];
    const crawlMap: Record<string, { url: string; status: "active" | "success" | "failed"; reason: string; domain: string; title: string }> = {};
    const extractedMap: Record<string, { status: "completed" | "failed"; category: string }> = {};

    events.forEach((evt) => {
      if (evt.stage === "discovering_sources") {
        try {
          const payload = JSON.parse(evt.detail);
          if (payload.item) {
            if (!candidatesList.some(c => c.url === payload.item.url)) {
              candidatesList.push(payload.item);
            }
          }
        } catch {}
      } else if (evt.stage === "crawling_sources") {
        try {
          const payload = JSON.parse(evt.detail);
          if (payload.item) {
            crawlMap[payload.item.url] = payload.item;
          }
        } catch {}
      } else if (evt.stage === "extracting_fields") {
        try {
          const payload = JSON.parse(evt.detail);
          if (payload.item) {
            extractedMap[payload.item.field_name] = {
              status: payload.item.status,
              category: payload.item.category
            };
          }
        } catch {}
      }
    });

    return {
      candidates: candidatesList,
      crawls: Object.values(crawlMap),
      extractedMap,
    };
  }, [events]);

  const crawlsCount = crawls.filter(c => c.status === "success" || c.status === "failed").length;
  const crawlsSuccess = crawls.filter(c => c.status === "success").length;
  const crawlsFailed = crawls.filter(c => c.status === "failed").length;


  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const pipelineStatus: string = latestEvent ? latestEvent.stage : "pending";

  const extractingLogs = useMemo(() => {
    return events
      .filter((evt) => evt.stage === "extracting_fields")
      .map((evt) => {
        try {
          const parsed = JSON.parse(evt.detail);
          if (parsed.item) return null;
          return parsed.message || evt.detail;
        } catch {
          return evt.detail;
        }
      })
      .filter(Boolean) as string[];
  }, [events]);

  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [extractingLogs.length]);

  // Determine stage states and auto-collapsing active lifecycle
  useEffect(() => {
    let nextActive = 1;
    if (pipelineStatus === "complete" || pipelineStatus === "failed") {
      nextActive = 5;
    } else if (pipelineStatus === "verifying" || pipelineStatus === "verified" || pipelineStatus === "narrating") {
      nextActive = 5;
    } else if (pipelineStatus === "extracting" || pipelineStatus === "extracted" || latestEvent?.stage === "extracting_fields") {
      nextActive = 4;
    } else if (latestEvent?.stage === "retrieved" || latestEvent?.stage === "embedding") {
      nextActive = 3;
    } else if (latestEvent?.stage === "crawling_sources") {
      nextActive = 2;
    } else if (latestEvent?.stage === "discovering_sources" || pipelineStatus === "retrieving") {
      nextActive = 1;
    }

    setActiveStage(nextActive);

    // When pipeline finishes, collapse everything
    if (pipelineStatus === "complete" || pipelineStatus === "failed") {
      setExpanded({ 1: false, 2: false, 3: false, 4: false, 5: false });
      return;
    }

    // When a new stage becomes active, open it — but keep all already-open stages open
    setExpanded((prev) => {
      const nextExp = { ...prev };
      nextExp[nextActive] = true; // ensure active stage is expanded
      return nextExp;
    });
  }, [pipelineStatus, latestEvent?.stage]);

  const timerSum = (stageTimes[1] || 0) + (stageTimes[2] || 0) + (stageTimes[3] || 0) + (stageTimes[4] || 0) + (stageTimes[5] || 0);
  const totalExecutionTimeFallback = events.length >= 2 && events[0].created_at && events[events.length - 1].created_at
    ? (new Date(events[events.length - 1].created_at!).getTime() - new Date(events[0].created_at!).getTime()) / 1000
    : 0;
  const displayTime = timerSum > 0 ? timerSum : totalExecutionTimeFallback;

  const stageStartTimes = useRef<Record<number, number>>({});

  // Record wall-clock start time for the active stage
  useEffect(() => {
    stageStartTimes.current[activeStage] = Date.now();
  }, [activeStage]);

  // Stage timer counts using wall-clock delta to prevent browser throttle bugs
  useEffect(() => {
    if (pipelineStatus === "complete" || pipelineStatus === "failed") return;

    if (!stageStartTimes.current[activeStage]) {
      stageStartTimes.current[activeStage] = Date.now();
    }

    const startTimestamp = stageStartTimes.current[activeStage];

    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTimestamp) / 1000;
      setStageTimes((prev) => ({
        ...prev,
        [activeStage]: elapsed,
      }));
    }, 100);

    return () => clearInterval(timer);
  }, [activeStage, pipelineStatus]);

  // Handle auto-scroll check inside containers
  const handleScroll = (stageId: number) => {
    const el = containers.current[stageId];
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 15;
    autoScrolls.current[stageId] = isAtBottom;
  };

  const triggerScrollToBottom = useCallback((stageId: number) => {
    const el = containers.current[stageId];
    if (el && autoScrolls.current[stageId]) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // Scroll to bottom on new items
  useEffect(() => {
    triggerScrollToBottom(1);
  }, [candidates.length, triggerScrollToBottom]);

  useEffect(() => {
    triggerScrollToBottom(2);
  }, [crawls.length, triggerScrollToBottom]);

  useEffect(() => {
    triggerScrollToBottom(4);
  }, [Object.keys(extractedMap).length, triggerScrollToBottom]);

  const toggleExpand = (stageId: number) => {
    setExpanded((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  // Get total extracted count
  const extractedCount = Object.keys(extractedMap).length;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4" style={{ fontFamily: 'var(--kobie-font-body)' }}>
      {isDegraded && (
        <Alert variant="destructive" className="py-2 rounded-[8px]">
          <AlertDescription className="text-xs font-medium" style={{ color: '#fd7f4f' }}>
            Connection unstable — falling back to backup polling updates.
          </AlertDescription>
        </Alert>
      )}

      {/* Vertical pipeline of 5 stages */}
      <div className="space-y-3 relative">
        {/* Stage 1: Discovering Sources */}
        <div className="rounded-[10px] transition-all duration-200" style={{ backgroundColor: 'var(--kobie-ocean)', border: activeStage === 1 ? '1px solid rgba(253,127,79,0.45)' : '1px solid rgba(255,255,255,0.1)', boxShadow: activeStage === 1 ? '0 0 0 1px rgba(253,127,79,0.15)' : 'none' }}>
          <div
            onClick={() => toggleExpand(1)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer select-none rounded-t-[10px] sticky top-0 z-10" style={{ backgroundColor: 'var(--kobie-ocean)' }}
          >
            <div className="flex items-center gap-2.5">
              {activeStage === 1 ? (
                <Loader2 size={16} className="animate-spin shrink-0" style={{ color: '#fd7f4f' }} />
              ) : activeStage > 1 ? (
                <CheckCircle2 size={16} className="shrink-0" style={{ color: '#10b981' }} />
              ) : (
                <Circle size={16} className="shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
              )}
              <span className="text-xs font-bold" style={{ fontFamily: 'var(--kobie-font-heading)', color: activeStage === 1 ? '#fd7f4f' : 'rgba(255,255,255,0.7)' }}>
                1. Discovering Sources
              </span>
              {stageTimes[1] > 0 && (
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>({stageTimes[1].toFixed(1)}s)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {candidates.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {candidates.length} candidate{candidates.length !== 1 && "s"}
                </span>
              )}
              {expanded[1] ? <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
            </div>
          </div>

          {expanded[1] && (
            <div className="px-4 pb-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              {/* Live discovery progress bar */}
              {candidates.length > 0 && (
                <div className="mb-3 space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <span>Sources found</span>
                    <span className="font-bold" style={{ color: '#fd7f4f' }}>
                      {activeStage > 1 ? `${candidates.length} discovered` : `${candidates.length} discovered so far…`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full animate-pulse transition-all duration-500"
                      style={{ width: `${activeStage > 1 ? 100 : Math.min(100, (candidates.length / 40) * 100)}%`, backgroundColor: '#fd7f4f' }}
                    />
                  </div>
                </div>
              )}
              <div
                ref={(el) => { containers.current[1] = el; }}
                onScroll={() => handleScroll(1)}
                className="max-h-40 overflow-y-auto space-y-2 pr-1 rounded-[8px] p-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {candidates.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs py-1.5 px-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <Loader2 size={12} className="animate-spin" style={{ color: '#fd7f4f' }} />
                    Searching Web indices...
                  </div>
                ) : (
                  candidates.map((c, i) => (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded-[6px] transition-all group"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(253,127,79,0.35)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
                    >
                      <div className="flex items-center gap-2">
                        <Favicon url={c.url} />
                        <span className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
                          {c.title || c.domain}
                        </span>
                      </div>
                      <span className="text-[10px] block font-mono mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{c.domain}</span>
                      {c.snippet && (
                        <p className="text-[10px] mt-1 line-clamp-1 break-all" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {c.snippet.replace(/\s+/g, " ").slice(0, 120)}
                        </p>
                      )}
                    </a>
                  ))
                )}
              </div>
              <div className="mt-2 flex justify-between items-center text-[10px] px-1 font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <span>Sources discovered: {candidates.length}</span>
                <span>Gathering candidates...</span>
              </div>
            </div>
          )}
        </div>

        {/* Stage 2: Crawling Sources */}
        <div className="rounded-[10px] transition-all duration-200" style={{ backgroundColor: 'var(--kobie-ocean)', border: activeStage === 2 ? '1px solid rgba(253,127,79,0.45)' : '1px solid rgba(255,255,255,0.1)', boxShadow: activeStage === 2 ? '0 0 0 1px rgba(253,127,79,0.15)' : 'none' }}>
          <div
            onClick={() => toggleExpand(2)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer select-none rounded-t-[10px] sticky top-0 z-10" style={{ backgroundColor: 'var(--kobie-ocean)' }}
          >
            <div className="flex items-center gap-2.5">
              {activeStage === 2 ? (
                <Loader2 size={16} className="animate-spin shrink-0" style={{ color: '#fd7f4f' }} />
              ) : activeStage > 2 ? (
                <CheckCircle2 size={16} className="shrink-0" style={{ color: '#10b981' }} />
              ) : (
                <Circle size={16} className="shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
              )}
              <span className="text-xs font-bold" style={{ fontFamily: 'var(--kobie-font-heading)', color: activeStage === 2 ? '#fd7f4f' : 'rgba(255,255,255,0.7)' }}>
                2. Crawling Sources
              </span>
              {stageTimes[2] > 0 && (
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>({stageTimes[2].toFixed(1)}s)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {crawlsCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {crawlsSuccess} crawled / {crawlsFailed} failed
                </span>
              )}
              {expanded[2] ? <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
            </div>
          </div>

          {expanded[2] && (
            <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span>Progress</span>
                  <span>{activeStage > 2 ? `${candidates.length} / ${candidates.length}` : `${crawlsCount} / ${candidates.length}`} pages crawled</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${activeStage > 2 ? 100 : (candidates.length ? (crawlsCount / candidates.length) * 100 : 0)}%`, backgroundColor: '#fd7f4f' }} />
                </div>
              </div>
              <div
                ref={(el) => { containers.current[2] = el; }}
                onScroll={() => handleScroll(2)}
                className="max-h-40 overflow-y-auto space-y-1.5 pr-1 rounded-[8px] p-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {crawls.length === 0 ? (
                  <div className="text-xs py-1.5 px-2 font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Waiting for crawler session...
                  </div>
                ) : (
                  crawls.map((c, i) => (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start justify-between text-xs py-1.5 px-2 rounded-[5px] transition-all group block"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(253,127,79,0.35)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {c.status === "active" && activeStage === 2 ? (
                          <Loader2 size={12} className="animate-spin shrink-0" style={{ color: '#fd7f4f' }} />
                        ) : c.status === "success" ? (
                          <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                            <Check size={8} style={{ color: '#10b981' }} />
                          </span>
                        ) : (
                          <AlertCircle size={12} className="shrink-0" style={{ color: '#ef4444' }} />
                        )}
                        <span className="truncate font-medium group-hover:underline" style={{ color: 'rgba(255,255,255,0.65)' }}>{c.title || c.domain}</span>
                      </div>
                      <span className="text-[10px] font-mono shrink-0 ml-2" style={{ color: (c.status === "active" && activeStage === 2) ? '#fd7f4f' : c.status === "success" ? '#10b981' : '#ef4444' }}>
                        {c.status === "active" ? (activeStage === 2 ? "crawling" : "failed") : c.status === "success" ? "success" : c.reason || "failed"}
                      </span>
                    </a>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stage 3: Sources Discovered */}
        <div className="rounded-[10px] transition-all duration-200" style={{ backgroundColor: 'var(--kobie-ocean)', border: activeStage === 3 ? '1px solid rgba(253,127,79,0.45)' : '1px solid rgba(255,255,255,0.1)', boxShadow: activeStage === 3 ? '0 0 0 1px rgba(253,127,79,0.15)' : 'none' }}>
          <div
            onClick={() => toggleExpand(3)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer select-none rounded-t-[10px] sticky top-0 z-10" style={{ backgroundColor: 'var(--kobie-ocean)' }}
          >
            <div className="flex items-center gap-2.5">
              {activeStage === 3 ? (
                <Loader2 size={16} className="animate-spin shrink-0" style={{ color: '#fd7f4f' }} />
              ) : activeStage > 3 ? (
                <CheckCircle2 size={16} className="shrink-0" style={{ color: '#10b981' }} />
              ) : (
                <Circle size={16} className="shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
              )}
              <span className="text-xs font-bold" style={{ fontFamily: 'var(--kobie-font-heading)', color: activeStage === 3 ? '#fd7f4f' : 'rgba(255,255,255,0.7)' }}>
                3. Sources Discovered
              </span>
              {stageTimes[3] > 0 && (
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>({stageTimes[3].toFixed(1)}s)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {crawlsSuccess > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] font-bold" style={{ backgroundColor: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px solid rgba(16,185,129,0.15)' }}>
                  {crawlsSuccess} source{crawlsSuccess !== 1 && "s"} verified
                </span>
              )}
              {expanded[3] ? <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
            </div>
          </div>

          {expanded[3] && (
            <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-[6px] text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-xs font-bold font-mono" style={{ color: 'rgba(255,255,255,0.8)' }}>{candidates.length}</div>
                  <div className="text-[9px] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Discovered</div>
                </div>
                <div className="p-2 rounded-[6px] text-center" style={{ backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div className="text-xs font-bold font-mono" style={{ color: '#10b981' }}>{crawlsSuccess}</div>
                  <div className="text-[9px] uppercase" style={{ color: '#10b981', opacity: 0.7 }}>Crawled</div>
                </div>
                <div className="p-2 rounded-[6px] text-center" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="text-xs font-bold font-mono" style={{ color: '#ef4444' }}>{crawlsFailed}</div>
                  <div className="text-[9px] uppercase" style={{ color: '#ef4444', opacity: 0.7 }}>Failed</div>
                </div>
                <div className="p-2 rounded-[6px] text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-xs font-bold font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {Math.max(0, candidates.length - crawlsSuccess - crawlsFailed)}
                  </div>
                  <div className="text-[9px] uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>Ignored</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span>Verification Progress</span>
                  <span>{activeStage > 3 ? `${crawlsSuccess} / ${crawlsSuccess}` : `${crawlsSuccess} / ${candidates.length}`} active sources</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${activeStage > 3 ? 100 : (candidates.length ? (crawlsSuccess / candidates.length) * 100 : 0)}%`, backgroundColor: '#fd7f4f' }} />
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 rounded-[8px] p-2" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {crawls.filter(c => c.status === "success").length === 0 ? (
                  <div className="text-xs py-1.5 px-2 font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    No sources successfully crawled yet.
                  </div>
                ) : (
                  crawls.filter(c => c.status === "success").map((c, i) => (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-[6px] transition-all group"
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(253,127,79,0.35)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
                    >
                      <Favicon url={c.url} />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold truncate block" style={{ color: 'rgba(255,255,255,0.75)' }}>
                          {c.title || c.domain}
                        </span>
                        <span className="text-[9px] font-mono block mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{c.url}</span>
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stage 4: Extracting Fields */}
        <div className="rounded-[10px] transition-all duration-200" style={{ backgroundColor: 'var(--kobie-ocean)', border: activeStage === 4 ? '1px solid rgba(253,127,79,0.45)' : '1px solid rgba(255,255,255,0.1)', boxShadow: activeStage === 4 ? '0 0 0 1px rgba(253,127,79,0.15)' : 'none' }}>
          <div
            onClick={() => toggleExpand(4)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer select-none rounded-t-[10px] sticky top-0 z-10" style={{ backgroundColor: 'var(--kobie-ocean)' }}
          >
            <div className="flex items-center gap-2.5">
              {activeStage > 4 || ["verifying", "verified", "narrating", "complete"].includes(pipelineStatus) ? (
                <CheckCircle2 size={16} className="shrink-0" style={{ color: '#10b981' }} />
              ) : activeStage === 4 ? (
                <Loader2 size={16} className="animate-spin shrink-0" style={{ color: '#fd7f4f' }} />
              ) : (
                <Circle size={16} className="shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
              )}
              <span className="text-xs font-bold" style={{ fontFamily: 'var(--kobie-font-heading)', color: activeStage === 4 ? '#fd7f4f' : 'rgba(255,255,255,0.7)' }}>
                4. Extracting Fields
              </span>
              {stageTimes[4] > 0 && (
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>({stageTimes[4].toFixed(1)}s)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {extractedCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  {extractedCount} / {ALL_FIELDS.length} fields
                </span>
              )}
              {expanded[4] ? <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
            </div>
          </div>

          {expanded[4] && (
            <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span>Fields Extracted</span>
                  <span style={{ color: '#fd7f4f' }}>{extractedCount} / {ALL_FIELDS.length} fields</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(extractedCount / ALL_FIELDS.length) * 100}%`, backgroundColor: '#fd7f4f' }} />
                </div>
              </div>

              {/* Scrollable list of fields */}
              <div
                ref={(el) => { containers.current[4] = el; }}
                onScroll={() => handleScroll(4)}
                className="max-h-40 overflow-y-auto space-y-1.5 pr-1 rounded-[8px] p-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {ALL_FIELDS.map((f, i) => {
                  const stateVal = extractedMap[f.name];
                  // If category has already started extracting but field is not completed
                  const isCategoryActive = Object.values(extractedMap).some(item => item.category === f.category);
                  const isCompleted = !!stateVal;

                  return (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-[5px]" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2 truncate">
                        {isCompleted ? (
                          stateVal.status === "completed" ? (
                            <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                              <Check size={8} style={{ color: '#10b981' }} />
                            </span>
                          ) : (
                            <AlertCircle size={12} className="shrink-0" style={{ color: '#ef4444' }} />
                          )
                        ) : activeStage === 4 && isCategoryActive ? (
                          <Loader2 size={12} className="animate-spin shrink-0" style={{ color: '#fd7f4f' }} />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
                        )}
                        <span className="truncate font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {f.name.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono uppercase shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {f.category}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Live console box for retry/rate-limit status */}
              {extractingLogs.length > 0 && (
                <div className="space-y-1 mt-3">
                  <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Live Extraction Engine Status</div>
                  <div 
                    ref={logsContainerRef}
                    className="rounded-[6px] p-2.5 font-mono text-[10px] space-y-1 max-h-24 overflow-y-auto"
                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
                  >
                    {extractingLogs.map((logStr, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="font-bold" style={{ color: '#fd7f4f' }}>»</span>
                        <span className="break-all">{logStr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stage 5: Finalizing Results */}
        <div className="rounded-[10px] transition-all duration-200" style={{ backgroundColor: 'var(--kobie-ocean)', border: activeStage === 5 ? '1px solid rgba(253,127,79,0.45)' : '1px solid rgba(255,255,255,0.1)', boxShadow: activeStage === 5 ? '0 0 0 1px rgba(253,127,79,0.15)' : 'none' }}>
          <div
            onClick={() => toggleExpand(5)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer select-none rounded-t-[10px] sticky top-0 z-10" style={{ backgroundColor: 'var(--kobie-ocean)' }}
          >
            <div className="flex items-center gap-2.5">
              {activeStage === 5 && pipelineStatus !== "complete" && pipelineStatus !== "failed" ? (
                <Loader2 size={16} className="animate-spin shrink-0" style={{ color: '#fd7f4f' }} />
              ) : pipelineStatus === "complete" ? (
                <CheckCircle2 size={16} className="shrink-0" style={{ color: '#10b981' }} />
              ) : pipelineStatus === "failed" ? (
                <AlertCircle size={16} className="shrink-0" style={{ color: '#ef4444' }} />
              ) : (
                <Circle size={16} className="shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
              )}
              <span className="text-xs font-bold" style={{ fontFamily: 'var(--kobie-font-heading)', color: activeStage === 5 ? '#fd7f4f' : 'rgba(255,255,255,0.7)' }}>
                5. Finalizing Results
              </span>
              {stageTimes[5] > 0 && (
                <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>({stageTimes[5].toFixed(1)}s)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pipelineStatus === "complete" && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] font-bold" style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                  Complete
                </span>
              )}
              {expanded[5] ? <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
            </div>
          </div>

          {expanded[5] && (
            <div className="px-4 pb-4 pt-3 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="space-y-0 rounded-[8px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  {
                    label: "Running citation gate",
                    sublabel: "Verifying LLM quotes against raw page content",
                    done: ["deduplication", "citation_ranking", "verified", "narrating", "complete"].includes(pipelineStatus),
                    active: pipelineStatus === "verifying",
                  },
                  {
                    label: "De-duplicating sources",
                    sublabel: "Building citation index from verified fields",
                    done: ["citation_ranking", "verified", "narrating", "complete"].includes(pipelineStatus),
                    active: pipelineStatus === "deduplication",
                  },
                  {
                    label: "Ranking citations",
                    sublabel: "Scoring by authority, recency, and corroboration",
                    done: ["verified", "narrating", "complete"].includes(pipelineStatus),
                    active: pipelineStatus === "citation_ranking",
                  },
                  {
                    label: "Writing analyst brief",
                    sublabel: "Generating the narrative from verified fields",
                    done: pipelineStatus === "complete",
                    active: pipelineStatus === "narrating",
                  },
                  {
                    label: "Saving output",
                    sublabel: "Persisting results to database",
                    done: pipelineStatus === "complete",
                    active: false,
                  },
                ].map((task, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-3 py-2.5 last:border-0 transition-colors"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      backgroundColor: task.active ? 'rgba(253,127,79,0.06)' : 'transparent'
                    }}
                  >
                    {task.done ? (
                      <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        <Check size={8} style={{ color: '#10b981' }} />
                      </span>
                    ) : task.active ? (
                      <Loader2 size={14} className="animate-spin shrink-0 mt-0.5" style={{ color: '#fd7f4f' }} />
                    ) : (
                      <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
                    )}
                    <div>
                      <span className="text-xs font-medium block" style={{
                        color: task.done ? 'rgba(255,255,255,0.25)' : task.active ? '#fd7f4f' : 'rgba(255,255,255,0.6)',
                        textDecoration: task.done ? 'line-through' : 'none'
                      }}>
                        {task.label}
                      </span>
                      {task.active && (
                        <span className="text-[10px] animate-pulse" style={{ color: 'rgba(255,255,255,0.35)' }}>{task.sublabel}</span>
                      )}
                    </div>
                    {task.active && (
                      <div className="ml-auto">
                        <div className="h-1 w-16 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full animate-pulse w-2/3" style={{ backgroundColor: 'rgba(253,127,79,0.4)' }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Completion Summary Card */}
              {pipelineStatus === "complete" && (
                <div className="p-4 rounded-[10px] space-y-2.5 transition-all duration-300" style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <Check size={10} style={{ color: '#10b981' }} />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--kobie-font-heading)', color: '#10b981' }}>
                      Research Complete
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono pt-2 mt-0.5" style={{ borderTop: '1px solid rgba(16,185,129,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'rgba(255,255,255,0.35)' }}>Sources discovered:</span>
                      <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{candidates.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'rgba(255,255,255,0.35)' }}>Successfully crawled:</span>
                      <span className="font-semibold" style={{ color: '#10b981' }}>{crawlsSuccess}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'rgba(255,255,255,0.35)' }}>Failed/ignored:</span>
                      <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>{crawlsFailed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'rgba(255,255,255,0.35)' }}>Fields extracted:</span>
                      <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{extractedCount} / {ALL_FIELDS.length}</span>
                    </div>
                    <div className="flex justify-between col-span-2 pt-1.5 mt-0.5" style={{ borderTop: '1px solid rgba(16,185,129,0.12)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.35)' }}>Total execution time:</span>
                      <span className="font-bold" style={{ color: '#fd7f4f' }}>
                        {displayTime.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
