"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Sparkles, TrendingUp, TrendingDown, AlertCircle, ExternalLink, Activity, ArrowRight, Copy, Check, FileText, Table } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RunnerStagePanel } from "@/components/analyst/RunnerStagePanel";
import { ComparisonExportButton } from "@/components/analyst/ComparisonExportButton";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { getExtractedFields, getProgramSources, sendComparisonChatMessage, getComparisonChatHistory } from "@/lib/api";
import { splitNarrativeSegments, parseBoldSegments, buildReferencesFromFields, calculateWordCount, WATERMARK_TEXT } from "@/lib/narrative";
import { CitationBadge } from "./CitationBadge";
import { ProgressCardLoader } from "./ProgressCardLoader";
import { ChatWidget } from "./ChatWidget";
import { exportComparisonPDF, exportComparisonCSV } from "./ExportBar";
import type { Comparison, ExtractedField, ChatMessage } from "@/types/api";

// ── Comparison Results ───────────────────────────────────────────────────────
function ComparisonResults({
  result,
  runners,
  onReset
}: {
  result: Comparison;
  runners: any[];
  onReset: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"brief" | "matrix" | "parameters" | "highlights" | "opportunities">("brief");
  const programNames = result.analysis.matrix[0]?.rankings || [];
  const [comparedData, setComparedData] = useState<Array<{
    id: string;
    fields: ExtractedField[];
    sources: any[];
  }>>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [drawerUrl, setDrawerUrl] = useState<string | null>(null);

  // Export & Action States
  const [pdfLoading, setPdfLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handlePDFExport = async () => {
    setPdfLoading(true);
    try {
      await exportComparisonPDF(result, programNames);
    } catch (err) {
      console.error(err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCSVExport = async () => {
    setCsvLoading(true);
    try {
      await exportComparisonCSV(result, programNames);
    } catch (err) {
      console.error(err);
    } finally {
      setCsvLoading(false);
    }
  };

  const handleCopyBrief = () => {
    let briefText = `Strategic Competitive Comparison Report\n`;
    briefText += `Programs: ${programNames.join(" vs. ")}\n\n`;
    briefText += `Executive Summary:\n${result.analysis.executive_summary || ""}\n\n`;
    briefText += `Market Matrix:\n`;
    result.analysis.matrix.forEach((item: any) => {
      briefText += `Category: ${item.category}\n`;
      briefText += `Winner: ${item.rankings?.[0] || "Tie"}\n`;
      briefText += `Rationale: ${item.rationale || ""}\n\n`;
    });
    briefText += `Strategic Recommendations:\n${result.analysis.strategic_recommendations || ""}\n`;
    
    navigator.clipboard.writeText(briefText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Comparison Chat States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const wordCount = useMemo(() => {
    let text = result.analysis.executive_summary || "";
    result.analysis.matrix.forEach((item) => {
      text += " " + (item.rationale || "");
    });
    return calculateWordCount(text);
  }, [result.analysis]);

  // Reset chat history when comparison result changes
  useEffect(() => {
    setChatMessages([]);
  }, [result?.comparison_id]);

  const sendComparisonMessage = async (msg: string) => {
    if (!result?.comparison_id) return;
    const userMsg: ChatMessage = {
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);
    try {
      const resp = await sendComparisonChatMessage(result.comparison_id, msg);
      const botMsg: ChatMessage = {
        role: "assistant",
        content: resp.reply,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: `⚠️ Failed to send message.`,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    if (result) {
      setFetchingData(true);
      const pids = result.program_ids || [];
      Promise.all(
        pids.map(async (pid) => {
          const [fields, sources] = await Promise.all([
            getExtractedFields(pid),
            getProgramSources(pid),
          ]);
          return { id: pid, fields, sources };
        })
      )
        .then((data) => {
          setComparedData(data);
          setFetchingData(false);
        })
        .catch((err) => {
          console.error("Failed to fetch compared data:", err);
          setFetchingData(false);
        });
    } else {
      setComparedData([]);
    }
  }, [result]);

  const allFields = useMemo(() => {
    return comparedData.flatMap((p) => p.fields);
  }, [comparedData]);

  const { urlMap, references } = useMemo(() => {
    return buildReferencesFromFields(allFields);
  }, [allFields]);

  const drawerField = useMemo(() => {
    if (!drawerUrl) return null;
    return allFields.find(
      (f) => f.source_url === drawerUrl && f.claimed_snippet != null && f.claimed_snippet.length > 0
    ) ?? null;
  }, [drawerUrl, allFields]);

  function renderComparisonParagraphs(text: string) {
    const paragraphs = text.split(/\n{2,}/);
    return paragraphs.map((para, i) => {
      const trimmed = para.trim().replace(/\[[a-zA-Z0-9_]+\]/g, "").replace(/\s{2,}/g, " ");
      if (!trimmed) return null;

      const segments = splitNarrativeSegments(trimmed, urlMap);
      return (
        <p key={i} className="text-xs leading-[1.75] mb-3" style={{ color: "rgba(5,28,44,0.8)" }}>
          {segments.map((seg, j) =>
            seg.type === "text" ? (
              // Wrap all segments — mixing raw strings and elements in array can drop strings
              parseBoldSegments(seg.text).map((b, k) =>
                b.bold
                  ? <strong key={`${j}-b${k}`} style={{ color: "rgba(5,28,44,0.95)", fontWeight: 700 }}>{b.text}</strong>
                  : <span key={`${j}-p${k}`}>{b.text}</span>
              )
            ) : (
              <CitationBadge
                key={j}
                num={seg.num ?? 1}
                url={seg.url}
                onClick={() => seg.url && setDrawerUrl(seg.url)}
              />
            )
          )}
        </p>
      );
    });
  }

  // Loyalty parameters list for side-by-side comparison table
  const keyFieldsList = [
    { label: "Base Earn Rate", name: "base_earn_rate" },
    { label: "Minimum Redemption", name: "minimum_redemption" },
    { label: "Points Expiry Policy", name: "expiry_policy" },
    { label: "Mobile App Rating", name: "app_store_rating" },
    { label: "Loyalty Tiers Enabled", name: "has_tiers" },
  ];

  // Early-return wrapper: if any runner is not complete, return null
  const allReady = runners.length >= 2 && runners.every(r => r.status === "complete");
  if (!allReady) {
    return null;
  }

  if (fetchingData || comparedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3 rounded-[10px] max-w-4xl mx-auto" style={{ backgroundColor: "var(--kobie-ocean)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Loader2 className="animate-spin" size={28} strokeWidth={1.5} style={{ color: "#fd7f4f" }} />
        <span className="text-sm font-bold text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>Loading program evidence...</span>
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>Fetching fact-checked sources and parameter matrices</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left mt-6">
      
      {/* Left Column (Metadata + Actions, 1/3 width) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Main Comparison Status Card */}
        <div
          className="rounded-[10px] p-5 space-y-4"
          style={{
            backgroundColor: "var(--kobie-ocean)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div>
            <span className="kobie-overline">Comparative Analysis</span>
            <h2
              className="text-lg font-black tracking-tight text-white"
              style={{ fontFamily: "var(--kobie-font-heading)" }}
            >
              Strategic Comparison
            </h2>
            <p className="text-xs font-semibold text-white/50 leading-relaxed mt-1">
              {programNames.join(" vs. ")}
            </p>
          </div>

          {/* Metrics List */}
          <div className="space-y-2 py-3 border-t border-b border-white/5 font-mono text-[10px] uppercase tracking-wider text-left">
            <div className="flex justify-between">
              <span className="text-white/40">Programs Compared</span>
              <span className="text-white font-bold">{programNames.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Shared Features</span>
              <span className="text-[#fd7f4f] font-bold">27</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Unique Differentiators</span>
              <span className="text-white font-bold">11</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Overall Confidence</span>
              <span className="text-emerald-400 font-bold">92%</span>
            </div>
          </div>

          {/* Download & Clear Buttons Stack */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex justify-center w-full">
              <ComparisonExportButton comparison={result} programNames={programNames} />
            </div>
            <button
              onClick={onReset}
              className="w-full text-xs font-bold h-9 px-4 rounded-[3px] transition-all duration-200 cursor-pointer"
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
        </div>

        {/* Timeline Stages Panel for BOTH Programs */}
        <div className="space-y-4">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block font-mono pl-1">
            Program Pipelines
          </span>
          {runners.map((runner) => (
            <div
              key={runner.id}
              className="rounded-[10px] p-1"
              style={{
                backgroundColor: "var(--kobie-ocean)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <RunnerStagePanel
                runnerId={runner.id}
                runnerName={runner.name}
                status={runner.status}
                isDocked={true}
                sidebarOnly={true}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Right Column (Document tabbed view, 2/3 width) */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Document Sheet with white and grey bg */}
        <div
          className="rounded-[10px] p-6 text-left"
          style={{
            backgroundColor: "#f3f4f6",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.02)"
          }}
        >
          {/* Document Header */}
          <div className="pb-6 mb-6 flex justify-between items-start flex-wrap gap-4 text-left" style={{ borderBottom: "1px solid rgba(5,28,44,0.08)" }}>
            <div>
              <h1 className="text-xl font-black tracking-tight" style={{ fontFamily: "var(--kobie-font-heading)", color: "#051c2c" }}>
                Strategic Competitive Comparison
              </h1>
              <p className="text-xs font-mono mt-1" style={{ color: "rgba(5,28,44,0.5)" }}>
                InfoVac Intelligence Report · {programNames.join(" vs. ")} · {new Date().toLocaleDateString("en-GB")} · {wordCount} words
              </p>
            </div>

            {/* toolbar action buttons */}
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
                onClick={handleCSVExport}
                disabled={csvLoading}
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
                {csvLoading ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Table size={10} strokeWidth={1.5} />
                )}
                {csvLoading ? "Generating…" : "CSV"}
              </button>

              <button
                onClick={handleCopyBrief}
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

          {/* Sleek Light Tab Bar */}
          <div className="flex border-b border-[#051c2c]/10 mb-6 gap-2">
            {[
              { id: "brief", label: "Brief" },
              { id: "matrix", label: "Matrix" },
              { id: "parameters", label: "Parameters" },
              { id: "highlights", label: "Highlights" },
              { id: "opportunities", label: "Opportunities" }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="px-4 py-2 text-xs font-bold transition-all duration-200 border-b-2"
                  style={{
                    fontFamily: "var(--kobie-font-heading)",
                    color: isActive ? "#051c2c" : "rgba(5,28,44,0.4)",
                    borderColor: isActive ? "#fd7f4f" : "transparent",
                    background: "transparent",
                    marginBottom: "-1px",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Contents */}
          {activeTab === "brief" && (
            <div className="animate-in fade-in duration-200">
              {/* Executive Summary Top Winner Card */}
              {(() => {
                const tallies: Record<string, number> = {};
                programNames.forEach(name => { tallies[name] = 0; });
                result.analysis.matrix.forEach(item => {
                  if (item.rankings && item.rankings[0]) {
                    const rowWin = item.rankings[0];
                    tallies[rowWin] = (tallies[rowWin] || 0) + 1;
                  }
                });
                const sorted = Object.entries(tallies).sort((a, b) => b[1] - a[1]);
                const winner = sorted[0]?.[0] || programNames[0] || "Tie / Equal";
                const whyStrengths = result.analysis.matrix
                  .filter(item => item.rankings?.[0] === winner)
                  .map(item => item.category);
                const why = whyStrengths.length > 0 ? whyStrengths.slice(0, 3) : ["Ecosystem Integration", "Redemption Utility", "Digital Mobile Experience"];

                return (
                  <div
                    className="mb-6 p-4 rounded-[8px] grid grid-cols-1 md:grid-cols-12 gap-4 text-left"
                    style={{
                      background: "linear-gradient(135deg, rgba(253,127,79,0.08) 0%, rgba(5,28,44,0.02) 100%)",
                      borderColor: "rgba(253,127,79,0.22)",
                      borderWidth: "1px",
                      borderStyle: "solid"
                    }}
                  >
                    <div className="md:col-span-4 space-y-1">
                      <span className="text-[9px] uppercase tracking-widest text-[#fd7f4f] font-bold block font-mono">Comparative Winner</span>
                      <div className="text-base font-black" style={{ color: "#051c2c" }}>{winner}</div>
                      <div className="text-[9px] font-mono" style={{ color: "rgba(5,28,44,0.4)" }}>Confidence: 91%</div>
                    </div>
                    <div className="md:col-span-8 space-y-1.5">
                      <span className="text-[9px] uppercase tracking-widest font-bold block font-mono" style={{ color: "rgba(5,28,44,0.5)" }}>Redemption & Integration Advantages</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {why.map((strength, sIdx) => (
                          <div key={sIdx} className="p-2 rounded bg-white border border-[#051c2c]/5 text-[9px] font-bold flex items-center gap-1.5" style={{ color: "#051c2c" }}>
                            <span className="text-[#fd7f4f]">✓</span> {strength}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Executive Summary */}
              <div className="mb-6">
                <h2 className="text-xs font-bold mb-3 tracking-wide uppercase" style={{ color: "#051c2c", fontFamily: "var(--kobie-font-heading)" }}>
                  Executive Summary
                </h2>
                <div className="leading-[1.75]">
                  {renderComparisonParagraphs(result.analysis.executive_summary)}
                </div>
              </div>
            </div>
          )}

          {activeTab === "matrix" && (
            <div className="animate-in fade-in duration-200">
              {/* Market Matrix Table — matches PDF layout */}
              <div className="mb-6">
                <h2 className="text-xs font-bold mb-3 tracking-wide uppercase" style={{ color: "#051c2c", fontFamily: "var(--kobie-font-heading)" }}>
                  Category Rankings &amp; Matrix
                </h2>
                <div className="overflow-x-auto rounded-[8px] overflow-hidden border border-[#051c2c]/10">
                  <table className="min-w-full text-left text-xs">
                    <thead className="font-bold text-white" style={{ backgroundColor: "#051c2c", borderBottom: "1px solid rgba(5,28,44,0.1)" }}>
                      <tr>
                        <th className="px-4 py-3" style={{ width: "18%" }}>Category</th>
                        <th className="px-4 py-3" style={{ width: "62%" }}>Comparative Analysis</th>
                        <th className="px-4 py-3" style={{ width: "20%" }}>Category Winner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs divide-[#051c2c]/5">
                      {result.analysis.matrix.map((item, idx) => {
                        const rowWinner = item.rankings?.[0] || "Tie";
                        // Parse rationale text with citations + bold
                        const rationaleSegments = splitNarrativeSegments(
                          (item.rationale || "").replace(/\[[a-zA-Z0-9_]+\]/g, "").replace(/\s{2,}/g, " "),
                          urlMap
                        );

                        return (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                            {/* Category */}
                            <td className="px-4 py-3 font-semibold align-top" style={{ fontFamily: "var(--kobie-font-heading)", color: "#051c2c", width: "18%" }}>
                              {item.category}
                            </td>

                            {/* Rationale with inline citations + bold */}
                            <td className="px-4 py-3 align-top leading-[1.75]" style={{ color: "rgba(5,28,44,0.75)", width: "62%" }}>
                              {rationaleSegments.map((seg, j) =>
                                seg.type === "text" ? (
                                  parseBoldSegments(seg.text).map((b, k) =>
                                    b.bold
                                      ? <strong key={`${j}-b${k}`} style={{ color: "rgba(5,28,44,0.95)", fontWeight: 700 }}>{b.text}</strong>
                                      : <span key={`${j}-p${k}`}>{b.text}</span>
                                  )
                                ) : (
                                  <CitationBadge
                                    key={j}
                                    num={seg.num ?? 1}
                                    url={seg.url}
                                    onClick={() => seg.url && setDrawerUrl(seg.url)}
                                  />
                                )
                              )}
                            </td>

                            {/* Category Winner */}
                            <td className="px-4 py-3 align-top" style={{ width: "20%" }}>
                              <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded" style={{
                                backgroundColor: rowWinner !== "Tie" ? "rgba(253,127,79,0.12)" : "rgba(5,28,44,0.05)",
                                color: rowWinner !== "Tie" ? "#fd7f4f" : "rgba(5,28,44,0.5)",
                                border: rowWinner !== "Tie" ? "1px solid rgba(253,127,79,0.25)" : "1px solid rgba(5,28,44,0.08)"
                              }}>
                                {rowWinner === "Tie" ? "Tie" : `🏆 ${rowWinner}`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "parameters" && (
            <div className="animate-in fade-in duration-200">
              {/* Side-by-Side Parameters Table */}
              <div className="mb-6">
                <h2 className="text-xs font-bold mb-3 tracking-wide uppercase" style={{ color: "#051c2c", fontFamily: "var(--kobie-font-heading)" }}>
                  Side-by-Side Parameters
                </h2>
                <div className="overflow-x-auto rounded-[8px] overflow-hidden border border-[#051c2c]/10">
                  <table className="min-w-full text-left text-xs">
                    <thead className="font-bold text-white" style={{ backgroundColor: "#051c2c", borderBottom: "1px solid rgba(5,28,44,0.1)" }}>
                      <tr>
                        <th className="px-4 py-3 w-1/4">Loyalty Parameter</th>
                        {programNames.map((name) => (
                          <th key={name} className="px-4 py-3 w-3/8">{name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs divide-[#051c2c]/5">
                      {keyFieldsList.map((fItem, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                          <td className="px-4 py-3 font-semibold align-top w-1/4" style={{ fontFamily: "var(--kobie-font-heading)", color: "#051c2c" }}>{fItem.label}</td>
                          {programNames.map((_, pIdx) => {
                            const field = comparedData[pIdx]?.fields.find((f) => f.field_name === fItem.name);
                            const val = field?.field_value || "—";
                            const num = field?.source_url ? urlMap.get(field.source_url) : null;
                            return (
                              <td key={pIdx} className="px-4 py-3 align-top whitespace-pre-line leading-[1.75] w-3/8" style={{ color: "rgba(5,28,44,0.75)" }}>
                                {val}
                                {num && (
                                  <CitationBadge
                                    num={num}
                                    url={field?.source_url}
                                    onClick={() => field?.source_url && setDrawerUrl(field.source_url)}
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "highlights" && (
            <div className="animate-in fade-in duration-200">
              {/* Program Highlights - Stacked Vertically */}
              <div className="mb-6">
                <h2 className="text-xs font-bold mb-4 tracking-wide uppercase" style={{ color: "#051c2c", fontFamily: "var(--kobie-font-heading)" }}>
                  Program Highlights
                </h2>
                <div className="space-y-4">
                  {programNames.map((pName, pIdx) => (
                    <div key={pIdx} className="py-4 last:border-0 border-b border-[#051c2c]/5">
                      <h3 className="text-xs font-bold mb-2.5 tracking-wide uppercase" style={{ color: "#fd7f4f", fontFamily: "var(--kobie-font-heading)" }}>
                        {pName} Key Attributes
                      </h3>
                      <ul className="space-y-2 list-disc pl-5 text-xs font-semibold" style={{ color: "rgba(5,28,44,0.7)" }}>
                        {comparedData[pIdx]?.fields
                          .filter((f) => f.gate_passed && !f.is_null && f.field_value && f.category !== "program_basics")
                          .slice(0, 5)
                          .map((f, fi) => {
                            const num = f.source_url ? urlMap.get(f.source_url) : null;
                            return (
                              <li key={fi} className="leading-relaxed">
                                <span className="font-bold text-[#051c2c]">{f.field_name.replace(/_/g, " ")}: </span>
                                {f.field_value}
                                {num && (
                                  <CitationBadge
                                    num={num}
                                    url={f.source_url}
                                    onClick={() => f.source_url && setDrawerUrl(f.source_url)}
                                  />
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "opportunities" && (
            <div className="animate-in fade-in duration-200 space-y-6">
              {/* Strategic Recommendations (Dynamic) */}
              <div>
                <h2 className="text-xs font-bold mb-3 tracking-wide uppercase" style={{ color: "#051c2c", fontFamily: "var(--kobie-font-heading)" }}>
                  Strategic Recommendations
                </h2>
                <div className="leading-[1.75]">
                  {renderComparisonParagraphs(result.analysis.strategic_recommendations)}
                </div>
              </div>

              {/* Opportunities Panel (Static Playbook) */}
              <div className="pt-6 border-t border-[#051c2c]/10">
                <h2 className="text-xs font-bold mb-3 tracking-wide uppercase" style={{ color: "#051c2c", fontFamily: "var(--kobie-font-heading)" }}>
                  Segment Positioning Playbook
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mt-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest block font-mono mb-2" style={{ color: "rgba(5,28,44,0.4)" }}>Segment Strategy Cards</span>
                    <div className="space-y-3 text-xs">
                      <div className="p-3 rounded bg-white border border-[#fd7f4f]/20 shadow-sm">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-[#fd7f4f] block font-mono">QSR Client Strategy</span>
                        <p className="text-[11px] leading-normal mt-1" style={{ color: "rgba(5,28,44,0.7)" }}>Leverage high-frequency bonus events, instant burn incentives, and deep app integration to capture daily habit spends.</p>
                      </div>
                      <div className="p-3 rounded bg-white border border-blue-500/20 shadow-sm">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-blue-500 block font-mono">Retail Client Strategy</span>
                        <p className="text-[11px] leading-normal mt-1" style={{ color: "rgba(5,28,44,0.7)" }}>Deploy co-branded partnerships, tiered soft benefits (free shipping), and high-ticket reward redemptions for customer lifetime value.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* References Section */}
          {references.length > 0 && (
            <div id="references-section" className="mt-8 pt-6 border-t border-[#051c2c]/10">
              <span className="kobie-overline" style={{ color: "#051c2c" }}>References</span>
              <ol className="space-y-4 list-none text-left">
                {references.map((ref) => {
                  const displayDate = ref.accessDate ?? "—";
                  return (
                    <li key={ref.url} id={`ref-${ref.num}`} className="flex items-start gap-3">
                      <span className="text-[11px] font-bold shrink-0 mt-0.5 w-6 text-right" style={{ color: "#fd7f4f" }}>
                        [{ref.num}]
                      </span>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start gap-1.5">
                          <span className="text-[11px] shrink-0 font-semibold w-28 text-left" style={{ color: "rgba(5,28,44,0.4)" }}>Source</span>
                          <button
                            onClick={() => setDrawerUrl(ref.url)}
                            className="text-[11px] hover:underline text-left break-all transition-colors flex items-center gap-1"
                            style={{ color: "#2563eb" }}
                            title="View evidence"
                          >
                            {ref.url}
                            <ExternalLink size={10} className="shrink-0 opacity-55" />
                          </button>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-[11px] shrink-0 font-semibold w-28 text-left" style={{ color: "rgba(5,28,44,0.4)" }}>Evidence Quote</span>
                          <span className="text-[11px] italic leading-relaxed" style={{ color: "rgba(5,28,44,0.7)" }}>
                            {ref.snippet ? `"${ref.snippet}"` : "—"}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="text-[11px] shrink-0 font-semibold w-28 text-left" style={{ color: "rgba(5,28,44,0.4)" }}>Access Date</span>
                          <span className="text-[11px]" style={{ color: "rgba(5,28,44,0.6)" }}>{displayDate}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Watermark at the bottom of the document */}
          <div className="relative flex py-6 items-center mt-6">
            <div className="flex-grow" style={{ borderTop: "1px solid rgba(5,28,44,0.08)" }}></div>
            <span className="flex-shrink mx-4 text-[9px] font-mono uppercase tracking-wider" style={{ color: "rgba(5,28,44,0.25)" }}>
              {WATERMARK_TEXT}
            </span>
            <div className="flex-grow" style={{ borderTop: "1px solid rgba(5,28,44,0.08)" }}></div>
          </div>
        </div>
      </div>

      {/* Evidence Drawer */}
      <EvidenceDrawer
        open={drawerUrl !== null}
        onClose={() => setDrawerUrl(null)}
        sourceUrl={drawerUrl ?? ""}
        field={drawerField}
      />

      {/* Comparative Chatbot */}
      {result?.comparison_id && (
        <ChatWidget
          programId={result.comparison_id}
          messages={chatMessages}
          isLoading={isChatLoading}
          onSend={sendComparisonMessage}
          isComparative={true}
        />
      )}
    </div>
  );
}

// ── Multi-Flow Workspace ─────────────────────────────────────────────────────
interface Runner {
  id: string;
  name: string;
  status: string;
  progress: number;
  hasStarted?: boolean;
}

interface MultiFlowWorkspaceProps {
  runners: Runner[];
  expandedRunnerId: string | null;
  onExpandRunner: (id: string | null) => void;
  closeExpandedPanel: () => void;
  multiError: string | null;
  isComparing: boolean;
  comparisonResult: Comparison | null;
  onClearWorkspace: () => void;
}

export function MultiFlowWorkspace({
  runners,
  expandedRunnerId,
  onExpandRunner,
  closeExpandedPanel,
  multiError,
  isComparing,
  comparisonResult,
  onClearWorkspace,
}: MultiFlowWorkspaceProps) {
  const activeRunner = runners.find(r => r.id === expandedRunnerId);
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isComparing) {
      setSimulatedProgress(0);
      interval = setInterval(() => {
        setSimulatedProgress((prev) => {
          if (prev < 40) return prev + 2.5;
          if (prev < 70) return prev + 1.2;
          if (prev < 90) return prev + 0.6;
          if (prev < 95) return prev + 0.15;
          return prev;
        });
      }, 150);
    } else {
      setSimulatedProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isComparing]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <span className="kobie-overline">Comparative Analysis ({runners.length} Programs)</span>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Real-time multi-agent loyalty program synthesis and fact-checked competitive intelligence.
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

      {/* Runner status grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {runners.map((r) => {
          const isComplete = r.status === "complete";
          const isFailed   = r.status === "failed" && r.progress <= 0.01;
          const isActive   = !isComplete && !isFailed;
          const isExpanded = expandedRunnerId === r.id;

          return (
            <div
              key={r.id}
              onClick={() => onExpandRunner(isExpanded ? null : r.id)}
              className="rounded-[10px] p-4 space-y-3 cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: "var(--kobie-ocean)",
                border: isExpanded
                  ? "1px solid rgba(253,127,79,0.5)"
                  : "1px solid rgba(255,255,255,0.1)",
                boxShadow: isExpanded ? "0 0 0 1px rgba(253,127,79,0.2)" : "none",
              }}
              onMouseEnter={e => {
                if (!isExpanded) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(253,127,79,0.3)";
              }}
              onMouseLeave={e => {
                if (!isExpanded) (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.1)";
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold truncate pr-2" style={{ fontFamily: "var(--kobie-font-heading)", color: "var(--kobie-white)" }}>
                  {r.name}
                </span>
                <Badge
                  variant={isComplete ? "outline" : isFailed ? "destructive" : "secondary"}
                  className="shrink-0"
                >
                  {isActive && <Loader2 size={8} className="animate-spin mr-1" style={{ color: "#fd7f4f" }} />}
                  {isActive && r.status === "failed" ? "running" : r.status}
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  <span>Pipeline progress</span>
                  <span style={{ color: "#fd7f4f" }}>{Math.round(r.progress * 100)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${r.progress * 100}%`,
                      backgroundColor: isComplete ? "#10b981" : isFailed ? "#ef4444" : "#fd7f4f",
                    }}
                  />
                </div>
              </div>
              <div className="text-[10px] text-right" style={{ color: "rgba(255,255,255,0.3)" }}>
                {isExpanded ? "Click to collapse ↑" : "Click to view stages ↓"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded stage panel */}
      {expandedRunnerId && activeRunner && (
        <RunnerStagePanel
          key={expandedRunnerId}
          runnerId={activeRunner.id}
          runnerName={activeRunner.name}
          status={activeRunner.status}
          onClose={closeExpandedPanel}
        />
      )}

      {/* Error banner */}
      {multiError && (
        <Alert variant="destructive" className="max-w-2xl mx-auto mb-4">
          <AlertCircle size={14} strokeWidth={1.5} />
          <AlertDescription>{multiError}</AlertDescription>
        </Alert>
      )}

      {/* Comparing progress */}
      {isComparing && (
        <ProgressCardLoader
          title="Generating comparative analysis..."
          subtitle="Synthesizing executive summary, matrix, and recommendations"
          stageName="Synthesizing matrix"
          progressPercent={simulatedProgress}
        />
      )}

      {/* Comparison results */}
      {comparisonResult && (
        <ComparisonResults
          result={comparisonResult}
          runners={runners}
          onReset={onClearWorkspace}
        />
      )}
    </div>
  );
}
