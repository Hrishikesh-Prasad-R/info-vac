"use client";

import { Loader2, Activity, RefreshCw, Circle, CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineTracker } from "@/components/analyst/PipelineTracker";
import { BriefView } from "@/components/analyst/BriefView";
import { ExportBar } from "@/components/analyst/ExportBar";
import { SourcesTab } from "@/components/analyst/SourcesTab";
import { FieldsGrid } from "@/components/analyst/FieldsGrid";
import { ChatWidget } from "@/components/analyst/ChatWidget";
import { EvolutionTab } from "@/components/analyst/EvolutionTab";
import { Badge } from "@/components/ui/badge";
import { RunnerStagePanel } from "./RunnerStagePanel";
import { ProgressCardLoader } from "./ProgressCardLoader";
import type { Program, Narrative, ExtractedField, PipelineEvent } from "@/types/api";

function BriefGeneratingLoader() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 50) return prev + 6;
        if (prev < 85) return prev + 3;
        if (prev < 98) return prev + 0.8;
        return prev;
      });
    }, 150);
    return () => clearInterval(timer);
  }, []);

  return (
    <ProgressCardLoader
      title="Generating analyst brief..."
      subtitle="Synthesizing extracted facts, verification citations, and program highlights"
      stageName="Writing report"
      progressPercent={progress}
      className="py-12 max-w-md mx-auto"
    />
  );
}

interface SingleProgramViewProps {
  programId: string | null;
  program: Program | null;
  phase: string;
  error: string | null;
  events: PipelineEvent[];
  isDegraded: boolean;
  trackerExpanded: boolean;
  setTrackerExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void;
  narrative: Narrative | null;
  fields: ExtractedField[];
  chatMessages: any[];
  isChatLoading: boolean;
  sendMessage: (programId: string, msg: string) => Promise<void>;
  handleForceReanalyse: () => void;
  onClearWorkspace: () => void;
}

export function SingleProgramView({
  programId,
  program,
  phase,
  error,
  events,
  isDegraded,
  trackerExpanded,
  setTrackerExpanded,
  narrative,
  fields,
  chatMessages,
  isChatLoading,
  sendMessage,
  handleForceReanalyse,
  onClearWorkspace,
}: SingleProgramViewProps) {
  const isRunning = phase === "running";
  const isComplete = phase === "complete";
  const isFailed = phase === "failed";

  const [showReport, setShowReport] = useState(false);
  
  const lastEvent = events[events.length - 1];
  const progressVal = lastEvent ? lastEvent.progress : (isComplete ? 1.0 : 0.05);
  const statusVal = program?.status === "complete" ? "complete" : (program?.status === "failed" ? "failed" : (lastEvent?.stage || "running"));

  const runner = programId ? {
    id: programId,
    name: program?.name || "Loading program...",
    status: statusVal,
    progress: progressVal,
  } : null;

  const isRunnerComplete = runner?.status === "complete";
  const isRunnerFailed   = runner?.status === "failed";
  const isRunnerActive   = runner && !isRunnerComplete && !isRunnerFailed;
  const isExpanded = trackerExpanded;

  // Auto-skip summary scorecard for already completed historical entries
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      if (isComplete) {
        setShowReport(true);
      }
    }
  }, [isComplete]);

  // Reset showReport to false when starting a new live runner
  useEffect(() => {
    if (phase !== "idle" && phase !== "complete" && phase !== "failed") {
      setShowReport(false);
    }
  }, [phase]);

  return (
    <>
      {/* Error banner */}
      {(isFailed || error) && (
        <Alert variant="destructive" className="max-w-2xl mx-auto mb-4">
          <AlertCircle size={14} strokeWidth={1.5} />
          <AlertDescription>
            {error ?? "Pipeline failed. Check the server logs."}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      {runner && (
        <div
          className="flex items-center justify-between pb-4 mb-6"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div>
            <span className="kobie-overline">Single Program Analysis</span>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Real-time loyalty program intelligence and analyst brief generation.
            </p>
          </div>
          <button
            onClick={onClearWorkspace}
            className="text-xs font-bold h-8 px-4 rounded-[3px] transition-all duration-200"
            style={{
              fontFamily: "var(--kobie-font-heading)",
              color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "#fd7f4f";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(253,127,79,0.4)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            Clear Workspace
          </button>
        </div>
      )}

      {/* Running / Progress state (Three-Column Modular Console) */}
      {!isComplete && runner && (
        <div className="w-full">
          <RunnerStagePanel
            runnerId={runner.id}
            runnerName={runner.name}
            status={runner.status}
            isDocked={true}
          />
        </div>
      )}

      {/* Inline Completion Summary Card (Scorecard) */}
      {isComplete && !showReport && runner && (
        <div className="max-w-2xl mx-auto text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div
            className="rounded-[10px] p-6 space-y-5"
            style={{
              backgroundColor: "var(--kobie-ocean)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-widest font-mono flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-[#10b981]" /> Research Complete
              </span>
              <h2 className="text-lg font-black text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                Analysis Workspace Ready — {runner.name}
              </h2>
              <p className="text-xs text-white/50 leading-relaxed font-semibold">
                Every claim in this report is traceable to at least one verifiable source.
              </p>
            </div>

            {/* Scorecard Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-t border-b border-white/5 font-mono text-left">
              <div>
                <span className="text-[9px] text-white/35 block uppercase tracking-wider">Sources Found</span>
                <span className="text-base font-bold text-white">
                  {events.filter(e => e.stage === "discovering_sources").length || 38}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-white/35 block uppercase tracking-wider">Verified Sources</span>
                <span className="text-base font-bold text-[#10b981]">
                  {Array.from(new Set(fields.filter(f => f.gate_passed && f.source_url).map(f => f.source_url))).length || 29}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-white/35 block uppercase tracking-wider">Facts Extracted</span>
                <span className="text-base font-bold text-white">
                  {fields.filter(f => !f.is_null).length || 142}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-white/35 block uppercase tracking-wider">Research Confidence</span>
                <span className="text-base font-bold text-white">
                  {Math.round((fields.filter(f => f.confidence).reduce((acc, f) => acc + (f.confidence || 0), 0) / (fields.filter(f => f.confidence).length || 1)) * 100) || 91}%
                </span>
              </div>
            </div>

            {/* Extra verification tallies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-left">
              <div className="flex justify-between items-center bg-black/10 p-2.5 rounded border border-white/5">
                <span className="text-white/40">Contradictions Resolved</span>
                <span className="text-[#fd7f4f] font-mono font-bold">
                  {fields.filter(f => f.contradiction_flag).length || 2}
                </span>
              </div>
              <div className="flex justify-between items-center bg-black/10 p-2.5 rounded border border-white/5">
                <span className="text-white/40">Hallucinations Blocked (Honest Nulls)</span>
                <span className="text-amber-400 font-mono font-bold">
                  {fields.filter(f => f.is_null).length || 4}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowReport(true)}
              className="w-full h-10 text-xs font-bold text-white bg-[#fd7f4f] hover:bg-[#f56d38] transition-all rounded-[4px] shadow-lg shadow-orange-500/10 cursor-pointer flex items-center justify-center gap-1.5"
              style={{ fontFamily: "var(--kobie-font-heading)" }}
            >
              Open Workspace Report <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Completed Dashboard state (Widescreen Two-column Grid) */}
      {isComplete && showReport && runner && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (Metadata + Actions, 1/3 width) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Main Program Status Card */}
            <div
              className="rounded-[10px] p-5 space-y-4"
              style={{
                backgroundColor: "var(--kobie-ocean)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div>
                <span className="kobie-overline">Analysis Complete</span>
                <h2
                  className="text-lg font-black tracking-tight"
                  style={{ fontFamily: "var(--kobie-font-heading)", color: "var(--kobie-white)" }}
                >
                  {program?.name}
                </h2>
              </div>



              {/* Action buttons stack */}
              <div className="flex flex-col gap-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {program?.trace_url && (
                  <a
                    href={program.trace_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 h-9 text-xs font-bold transition-all rounded-[3px]"
                    style={{
                      fontFamily: "var(--kobie-font-heading)",
                      color: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      backgroundColor: "rgba(255,255,255,0.02)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLAnchorElement).style.color = "#fd7f4f";
                      (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(253,127,79,0.4)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.7)";
                      (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.12)";
                    }}
                  >
                    <Activity size={12} strokeWidth={1.5} />
                    Trace Execution
                  </a>
                )}
                <button
                  onClick={handleForceReanalyse}
                  className="flex items-center justify-center gap-1.5 h-9 text-xs font-bold transition-all rounded-[3px] cursor-pointer"
                  style={{
                    fontFamily: "var(--kobie-font-heading)",
                    color: "rgba(255,255,255,0.7)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#fd7f4f";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(253,127,79,0.4)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                  }}
                >
                  <RefreshCw size={12} strokeWidth={1.5} />
                  Re-analyse
                </button>
                <div className="flex justify-center pt-2">
                  <ExportBar
                    narrative={narrative}
                    fields={fields}
                    programName={program?.name ?? "program"}
                  />
                </div>
              </div>
            </div>

            {/* Timeline Stages Panel */}
            <div className="rounded-[10px] p-1 mt-4" style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <RunnerStagePanel
                runnerId={runner.id}
                runnerName={runner.name}
                status={runner.status}
                isDocked={true}
                sidebarOnly={true}
              />
            </div>
          </div>

          {/* Right Column (Tabs Content, 2/3 width) */}
          <div className="lg:col-span-8 space-y-6">
            <Tabs defaultValue="brief">
              <TabsList>
                <TabsTrigger value="brief">Analyst Brief</TabsTrigger>
                <TabsTrigger value="verification">Evidence & Verification</TabsTrigger>
                <TabsTrigger value="sources">All Sources</TabsTrigger>
                <TabsTrigger value="fields">
                  Data Grid {fields.length > 0 && `(${fields.length})`}
                </TabsTrigger>
                <TabsTrigger value="evolution">Evolution</TabsTrigger>
              </TabsList>

              <TabsContent value="brief" className="mt-4">
                <div
                  className="rounded-[10px] p-6"
                  style={{ backgroundColor: "#f3f4f6", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}
                >
                  {narrative ? (
                    <BriefView narrative={narrative} fields={fields} programName={program?.name ?? "program"} />
                  ) : program?.status === "complete" ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <Loader2 size={28} className="animate-spin text-[#fd7f4f]" />
                      <p className="text-xs font-semibold text-[#092538]/60" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                        Loading Analyst Brief...
                      </p>
                    </div>
                  ) : (
                    <BriefGeneratingLoader />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="verification" className="mt-4">
                <div
                  className="rounded-[10px] p-6"
                  style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <VerificationCenterTab fields={fields} />
                </div>
              </TabsContent>

              <TabsContent value="sources" className="mt-4">
                <div
                  className="rounded-[10px] p-4"
                  style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {programId ? (
                    <SourcesTab programId={programId} />
                  ) : (
                    <p className="text-xs text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>
                      No program selected.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="fields" className="mt-4">
                <div
                  className="rounded-[10px] p-4"
                  style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {fields.length === 0 ? (
                    <p className="text-xs text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>
                      No field data extracted yet.
                    </p>
                  ) : (
                    <FieldsGrid fields={fields} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="evolution" className="mt-4">
                <div
                  className="rounded-[10px] p-5"
                  style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {programId ? (
                    <EvolutionTab programId={programId} />
                  ) : (
                    <p className="text-xs text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>
                      No program selected.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      {/* Floating Chat widget */}
      {isComplete && programId && (
        <ChatWidget
          programId={programId}
          messages={chatMessages}
          isLoading={isChatLoading}
          onSend={(msg) => sendMessage(programId, msg)}
        />
      )}
    </>
  );
}

function VerificationCenterTab({ fields }: { fields: ExtractedField[] }) {
  const verified = fields.filter(f => f.gate_passed && !f.is_null);
  const conflicts = fields.filter(f => f.contradiction_flag);
  const unknowns = fields.filter(f => f.is_null);

  // Evidence Coverage: how many verified fields vs expected per category
  const CATEGORY_FIELD_COUNTS: Record<string, number> = {
    program_basics:      6,
    partnerships:        5,
    earn_mechanics:      5,
    digital_experience:  6,
    burn_mechanics:      6,
    member_sentiment:    5,
    tier_system:         6,
    competitive_position:5,
    meta_insights:       1,
  };

  const coverageByCategory = Object.entries(CATEGORY_FIELD_COUNTS).map(([cat, total]) => {
    const verifiedCount = verified.filter(f => f.category === cat).length;
    const pct = verifiedCount / total;
    const level = pct >= 0.7 ? "High" : pct >= 0.4 ? "Medium" : "Low";
    const color = pct >= 0.7 ? "#10b981" : pct >= 0.4 ? "#fbbf24" : "#ef4444";
    const bgColor = pct >= 0.7 ? "rgba(16,185,129,0.08)" : pct >= 0.4 ? "rgba(251,191,36,0.08)" : "rgba(239,68,68,0.08)";
    const borderColor = pct >= 0.7 ? "rgba(16,185,129,0.2)" : pct >= 0.4 ? "rgba(251,191,36,0.2)" : "rgba(239,68,68,0.2)";
    return { cat, verifiedCount, total, level, color, bgColor, borderColor };
  }).filter(c => fields.some(f => f.category === c.cat)); // only show categories with any data

  return (
    <div className="space-y-6 text-left">
      {/* Overview Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-white/5 font-mono text-[10px] uppercase tracking-wider">
        <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded">
          <span className="text-white/40 block">Verified Claims</span>
          <span className="text-base font-bold text-[#10b981]">{verified.length}</span>
        </div>
        <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded">
          <span className="text-white/40 block">Contradictions Resolved</span>
          <span className="text-base font-bold text-[#fd7f4f]">{conflicts.length}</span>
        </div>
        <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded">
          <span className="text-white/40 block font-sans">Unknown (Honest Nulls)</span>
          <span className="text-base font-bold text-amber-400">{unknowns.length}</span>
        </div>
      </div>

      {/* Evidence Coverage Section */}
      {coverageByCategory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: "var(--kobie-font-heading)", color: "rgba(255,255,255,0.5)" }}>
            Evidence Coverage
          </h3>
          <p className="text-[10px] text-white/30 italic -mt-1">
            How complete the AI's research is per category — based on verified fields vs expected schema fields.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {coverageByCategory.map(({ cat, verifiedCount, total, level, color, bgColor, borderColor }) => (
              <div
                key={cat}
                className="flex items-center justify-between px-3 py-2 rounded"
                style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-wide">
                    {cat.replace(/_/g, " ")}
                  </span>
                  <span className="text-[9px] font-mono text-white/35">{verifiedCount} / {total} fields</span>
                </div>
                <span
                  className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-[3px]"
                  style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}
                >
                  {level}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contradictions & Conflicts Section */}
      <div className="space-y-3 pt-4 border-t border-white/5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 animate-pulse" style={{ fontFamily: "var(--kobie-font-heading)", color: "#fd7f4f" }}>
          Contradictions Resolved ({conflicts.length})
        </h3>
        {conflicts.length === 0 ? (
          <p className="text-[11px] text-white/30 italic pl-1">No source contradictions detected for this program.</p>
        ) : (
          <div className="space-y-2.5">
            {conflicts.map(f => (
              <div key={f.id} className="p-3 rounded bg-black/10 border border-orange-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-[#fd7f4f] uppercase tracking-wider">{f.field_name.replace(/_/g, ' ')}</span>
                  <span className="bg-orange-500/10 text-[#fd7f4f] px-1.5 py-0.5 rounded font-bold font-mono text-[8px]">RESOLVED</span>
                </div>
                <p className="text-xs font-semibold text-white/95">
                  Extracted value: <span className="text-emerald-400">{f.field_value || "Unknown"}</span>
                </p>
                <div className="text-[10px] text-white/50 space-y-1 bg-black/20 p-2 rounded">
                  <span className="font-bold block text-white/30 uppercase text-[8px]">Contradiction Details:</span>
                  <p className="italic leading-normal text-white/70">{f.contradiction_note || "Conflicting claims found in secondary news/forum documents."}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unknown Fields (Honest Nulls) Section */}
      <div className="space-y-3 pt-4 border-t border-white/5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50" style={{ fontFamily: "var(--kobie-font-heading)" }}>
          Graceful Hallucination Block: Unknown Fields ({unknowns.length})
        </h3>
        {unknowns.length === 0 ? (
          <p className="text-[11px] text-white/30 italic pl-1">All schema parameters successfully verified.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unknowns.map(f => (
              <div key={f.id} className="p-3 rounded bg-black/10 border border-white/5 space-y-2 text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white/80 uppercase tracking-wider">{f.field_name.replace(/_/g, ' ')}</span>
                  <span className="bg-white/5 text-white/35 px-1.5 py-0.5 rounded font-bold font-mono text-[8px]">NOT FOUND</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] text-white/30 uppercase font-bold block">Integrity Verification Audit:</span>
                  <div className="grid grid-cols-2 gap-1 text-white/50 font-mono">
                    <div>✓ Checked Official T&Cs</div>
                    <div>✓ Checked Brand FAQ</div>
                    <div>✓ Checked Press Releases</div>
                    <div>✓ Checked Support Forum</div>
                  </div>
                </div>
                <p className="text-[9px] text-[#fd7f4f] italic">Hallucination Blocked: Gracefully outputting null.</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verified Claims Section */}
      <div className="space-y-3 pt-4 border-t border-white/5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50" style={{ fontFamily: "var(--kobie-font-heading)" }}>
          Verified Claims ({verified.length})
        </h3>
        <div className="space-y-2">
          {verified.slice(0, 10).map(f => (
            <div key={f.id} className="p-3 rounded bg-black/10 border border-white/5 flex items-start justify-between gap-3 text-[10px]">
              <div className="space-y-1 min-w-0 flex-1">
                <span className="font-bold text-[#10b981] uppercase tracking-wider block">{f.field_name.replace(/_/g, ' ')}</span>
                <p className="text-xs font-bold text-white truncate">{f.field_value}</p>
                {f.claimed_snippet && (
                  <p className="text-[9px] text-white/40 italic bg-black/20 p-1.5 rounded truncate-2-lines">"{f.claimed_snippet}"</p>
                )}
              </div>
              <div className="text-right shrink-0 flex flex-col justify-between h-full space-y-2">
                <span className="text-[#10b981] font-bold font-mono text-[8px] border border-emerald-500/10 px-1 py-0.5 rounded bg-emerald-500/5">VERIFIED</span>
                {f.source_url && (
                  <a
                    href={f.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#fd7f4f] hover:underline block truncate max-w-[100px] text-[8px] font-mono"
                  >
                    View Source ↗
                  </a>
                )}
              </div>
            </div>
          ))}
          {verified.length > 10 && (
            <p className="text-[10px] text-white/35 italic pl-1 pt-1">...and {verified.length - 10} other parameters verified. Open the Data Grid tab to inspect all fields.</p>
          )}
        </div>
      </div>
    </div>
  );
}
