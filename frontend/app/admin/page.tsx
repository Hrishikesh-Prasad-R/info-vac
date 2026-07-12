"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Loader2, BarChart2, Trash2, Search, AlertTriangle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { GateDonutChart } from "@/components/admin/GateDonutChart";
import { ConfidenceBarChart } from "@/components/admin/ConfidenceBarChart";
import { SourceTracker } from "@/components/admin/SourceTracker";
import { ComparatorPicker } from "@/components/admin/ComparatorPicker";
import { FieldsGrid } from "@/components/analyst/FieldsGrid";
import { checkHealth, deleteProgram, searchPrograms } from "@/lib/api";
import { API_BASE } from "@/lib/api";
import type { Program, ExtractedField } from "@/types/api";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// ── Derived stats helpers ──

function deriveStats(fields: ExtractedField[]) {
  const gateFields = fields.filter((f) => f.gate_passed !== null);
  const passed = gateFields.filter((f) => f.gate_passed).length;
  const failed = gateFields.filter((f) => !f.gate_passed).length;

  const confFields = fields.filter((f) => f.confidence !== null);
  const avgConf =
    confFields.length > 0
      ? confFields.reduce((s, f) => s + (f.confidence ?? 0), 0) / confFields.length
      : 0;
  const avgCorr =
    confFields.length > 0
      ? confFields.reduce((s, f) => s + (f.corroboration_score ?? 0), 0) / confFields.length
      : 0;
  const avgAuth =
    confFields.length > 0
      ? confFields.reduce((s, f) => s + (f.authority_score ?? 0), 0) / confFields.length
      : 0;
  const avgRec =
    confFields.length > 0
      ? confFields.reduce((s, f) => s + (f.recency_score ?? 0), 0) / confFields.length
      : 0;

  return { passed, failed, avgConf, avgCorr, avgAuth, avgRec };
}

// ── Fetchers ──

async function fetchPrograms(): Promise<Program[]> {
  try {
    const res = await fetch(`${API_BASE}/api/programs`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchAllFields(): Promise<ExtractedField[]> {
  try {
    const res = await fetch(`${API_BASE}/api/fields`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ── Delete Program Panel ──────────────────────────────────────────────────────

function DeleteProgramPanel({ onDeleted }: { onDeleted: () => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Program[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [selected, setSelected] = useState<Program | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchPrograms(q).then(data => { setSuggestions(data); setShowDrop(true); }).finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(prog: Program) {
    setSelected(prog);
    setQuery(prog.name);
    setShowDrop(false);
  }

  async function handleConfirmDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      const result = await deleteProgram(selected.id);
      toast.success(`"${result.program_name}" deleted`, {
        description: result.qdrant_cleaned
          ? "SQL + Qdrant vectors removed."
          : "SQL removed. Qdrant cleanup failed (check backend logs).",
      });
      setSelected(null);
      setQuery("");
      setSuggestions([]);
      setConfirming(false);
      onDeleted();
    } catch (err: unknown) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="rounded-[10px] p-5 space-y-4"
      style={{ backgroundColor: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Trash2 size={14} style={{ color: "#ef4444" }} strokeWidth={1.5} />
        <span className="text-sm font-bold" style={{ color: "#ef4444", fontFamily: "var(--kobie-font-heading)" }}>
          Delete Program
        </span>
        <span className="text-[10px] text-white/30 ml-1">— permanently removes all SQL data and Qdrant vectors</span>
      </div>

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={14} strokeWidth={1.5} style={{ color: "rgba(255,255,255,0.25)" }} />
          {searching && <Loader2 size={13} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.25)" }} />}
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); setShowDrop(true); }}
            onFocus={() => { if (suggestions.length > 0) setShowDrop(true); }}
            onKeyDown={e => { if (e.key === "Enter" && selected) { e.preventDefault(); setConfirming(true); } }}
            placeholder="Search program to delete…"
            className="w-full h-10 pl-10 pr-4 text-sm rounded-[8px] outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "rgba(255,255,255,0.85)",
            }}
          />
        </div>

        {/* Dropdown */}
        {showDrop && suggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-50 overflow-y-auto max-h-56 rounded-[8px] shadow-2xl"
            style={{ backgroundColor: "#0d2d3f", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            {suggestions.map(prog => (
              <div
                key={prog.id}
                onClick={() => handleSelect(prog)}
                className="px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors border-b border-white/5"
                style={{ color: "rgba(255,255,255,0.85)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <div>
                  <p className="text-[11px] font-bold">{prog.name}</p>
                  <p className="text-[9px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{prog.id}</p>
                </div>
                <span className="text-[9px] text-red-400/70 font-semibold shrink-0 ml-3">Select →</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected program chip */}
      {selected && (
        <div
          className="flex items-center justify-between px-3 py-2 rounded-[6px]"
          style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <div>
            <p className="text-xs font-bold" style={{ color: "#ef4444", fontFamily: "var(--kobie-font-heading)" }}>{selected.name}</p>
            <p className="text-[9px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{selected.id}</p>
          </div>
          <button
            onClick={() => { setSelected(null); setQuery(""); }}
            className="ml-3 p-1 rounded transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Delete trigger button */}
      {selected && (
        <button
          onClick={() => setConfirming(true)}
          className="h-9 px-5 text-xs font-bold rounded-[6px] flex items-center gap-2 transition-all"
          style={{
            fontFamily: "var(--kobie-font-heading)",
            backgroundColor: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#ef4444",
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.25)"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.15)"; }}
        >
          <Trash2 size={12} strokeWidth={2} />
          Delete "{selected.name}"
        </button>
      )}

      {/* Confirmation Modal */}
      {confirming && selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div
            className="w-full max-w-sm rounded-[12px] p-6 space-y-4 shadow-2xl"
            style={{ backgroundColor: "#0d1f2d", border: "1px solid rgba(239,68,68,0.35)" }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} style={{ color: "#ef4444" }} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                  Are you sure?
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                  This will permanently delete <span className="text-white font-semibold">"{selected.name}"</span> and all its sources, fields, narratives, and Qdrant vectors. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="h-9 px-4 text-xs font-bold rounded-[6px] transition-colors"
                style={{
                  fontFamily: "var(--kobie-font-heading)",
                  color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="h-9 px-5 text-xs font-bold rounded-[6px] flex items-center gap-2 transition-all disabled:opacity-60"
                style={{
                  fontFamily: "var(--kobie-font-heading)",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  border: "1px solid #ef4444",
                }}
              >
                {deleting ? (
                  <><Loader2 size={12} className="animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 size={12} /> Yes, Delete</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main AdminDashboard component ─────────────────────────────────────────────

export default function AdminDashboard() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableSearch, setTableSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const [progs, flds, ok] = await Promise.all([
      fetchPrograms(),
      fetchAllFields(),
      checkHealth(),
    ]);
    setPrograms(progs);
    setFields(flds);
    setHealthy(ok);

    const cost = progs.reduce((sum, p) => sum + (p.total_cost ?? 0), 0);
    setTotalCost(cost);

    if (!ok) {
      toast.error("Backend unreachable", {
        description: `Could not reach ${API_BASE}/health`,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = deriveStats(fields);
  const sourceMap = new Map<string, number>();
  fields.forEach((f) => {
    if (f.category) sourceMap.set(f.category, (sourceMap.get(f.category) ?? 0) + 1);
  });
  const sourceEntries = Array.from(sourceMap.entries()).map(([source_type, count]) => ({
    source_type,
    count,
  }));

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "var(--kobie-midnight)" }}>
      <Toaster position="bottom-right" />

      {/* Nav */}
      <header className="sticky top-0 z-50 py-4" style={{ backgroundColor: "var(--kobie-midnight)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white tracking-tight" style={{ fontFamily: "var(--kobie-font-heading)" }}>InfoVac</span>
            <span className="text-xs uppercase font-bold" style={{ color: "#fd7f4f", fontFamily: "var(--kobie-font-heading)" }}>Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Health dot */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  healthy === null
                    ? "bg-white/20 animate-pulse"
                    : healthy
                    ? "bg-[#10b981]"
                    : "bg-red-500"
                }`}
              />
              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                {healthy === null ? "Checking…" : healthy ? "Backend online" : "Backend offline"}
              </span>
            </div>

            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold transition-all rounded-[3px] cursor-pointer"
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
              {loading ? (
                <Loader2 size={11} strokeWidth={1.5} className="animate-spin" style={{ color: "#fd7f4f" }} />
              ) : (
                <RefreshCw size={11} strokeWidth={1.5} />
              )}
              Refresh
            </button>

            <Link
              href="/"
              className="text-xs transition-colors flex items-center gap-1 font-semibold"
              style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fd7f4f")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
            >
              ← Analyst Workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Widescreen KPI Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Hero Card - Focal Point Overview */}
          <div
            className="lg:col-span-5 rounded-[10px] p-5 space-y-6 flex flex-col justify-between"
            style={{
              backgroundColor: "var(--kobie-ocean)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div>
              <span className="kobie-overline text-[9px] uppercase tracking-wider" style={{ color: "var(--kobie-coral)" }}>
                Overview
              </span>
              <h2 className="text-base font-bold text-white tracking-tight" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                Analysis Console
              </h2>
            </div>

            <div className="space-y-4">
              {/* Programs Analyzed */}
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-white/35 tracking-wider block" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                  Programs Analyzed
                </span>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-3xl font-black text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                    {programs.length}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    ↑ +12 Today
                  </span>
                </div>
              </div>

              {/* Extraction Cost */}
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-white/35 tracking-wider block" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                  Extraction Cost
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white animate-pulse" style={{ fontFamily: "var(--kobie-font-heading)" }}>
                    ${totalCost.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-white/30 font-mono">
                    avg ${(programs.length > 0 ? totalCost / programs.length : 0).toFixed(3)}/ea
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${healthy ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="text-[9px] font-mono text-white/40">
                  {healthy ? "Connection online" : "Connection failed"}
                </span>
              </div>
              <span className="text-[9px] text-white/30">
                Updated just now
              </span>
            </div>
          </div>

          {/* Right Metrics Cards Subgrid */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-6">
            <GateDonutChart passed={stats.passed} failed={stats.failed} />
            
            <ConfidenceBarChart
              avgCorroboration={stats.avgCorr}
              avgAuthority={stats.avgAuth}
              avgRecency={stats.avgRec}
              avgConfidence={stats.avgConf}
            />

            <SourceTracker sources={sourceEntries} />
          </div>
        </div>

        {/* Separator line between KPIs and Data Grid */}
        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)" }} />

        {/* Unified Table/Data Toolbar and Card */}
        <div
          className="rounded-[10px] overflow-hidden"
          style={{
            backgroundColor: "var(--kobie-ocean)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Tabs defaultValue="fields" className="w-full">
            {/* Cohesive Notion/Linear style Toolbar */}
            <div
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 py-3"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                backgroundColor: "rgba(255,255,255,0.015)",
              }}
            >
              {/* Left: Tab list */}
              <TabsList className="bg-transparent p-0 gap-1 border-none justify-start">
                <TabsTrigger value="fields">
                  Data Grid {fields.length > 0 && `(${fields.length})`}
                </TabsTrigger>
                <TabsTrigger value="programs">
                  Programs {programs.length > 0 && `(${programs.length})`}
                </TabsTrigger>
                <TabsTrigger value="compare">
                  Comparator
                </TabsTrigger>
              </TabsList>

              {/* Right: Quick actions toolbar + Search input */}
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Search grid parameters..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="h-8 text-xs max-w-[180px] bg-transparent border-white/10 text-white placeholder-white/30 focus-visible:ring-1 focus-visible:ring-[#fd7f4f]"
                />
                
                <button
                  onClick={() => {
                    const headers = ["ID", "Program ID", "Source", "Category", "Field", "Value", "Confidence", "Passed"];
                    const rows = fields.map(f => [
                      f.id,
                      f.program_id,
                      f.source_url || "",
                      f.category || "",
                      f.field_name || "",
                      f.field_value || "",
                      f.confidence !== null ? `${Math.round(f.confidence * 100)}%` : "",
                      f.gate_passed ? "Yes" : "No"
                    ]);
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `infovac_data_export_${new Date().toISOString().slice(0, 10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success("CSV Export complete!");
                  }}
                  className="h-8 px-3 text-xs font-bold transition-all rounded-[3px] flex items-center gap-1.5 cursor-pointer"
                  style={{
                    fontFamily: "var(--kobie-font-heading)",
                    color: "rgba(255,255,255,0.65)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#fd7f4f";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(237,127,79,0.35)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                  }}
                >
                  Export CSV
                </button>
                
                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fields, null, 2));
                    const downloadAnchor = document.createElement("a");
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `infovac_data_export_${new Date().toISOString().slice(0, 10)}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    document.body.removeChild(downloadAnchor);
                    toast.success("JSON Export complete!");
                  }}
                  className="h-8 px-3 text-xs font-bold transition-all rounded-[3px] flex items-center gap-1.5 cursor-pointer"
                  style={{
                    fontFamily: "var(--kobie-font-heading)",
                    color: "rgba(255,255,255,0.65)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#fd7f4f";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(237,127,79,0.35)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                  }}
                >
                  Download JSON
                </button>
              </div>
            </div>

            {/* Contents Area */}
            <div className="p-4">
              <TabsContent value="fields" className="mt-0">
                {fields.length === 0 ? (
                  <p className="text-xs text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>
                    No field data available.
                  </p>
                ) : (
                  <FieldsGrid fields={fields} externalFilter={tableSearch} hideFilterInput={true} />
                )}
              </TabsContent>

              <TabsContent value="programs" className="mt-0">
                <div className="rounded-[8px] divide-y divide-white/10 overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  {programs.length === 0 ? (
                    <p className="text-xs text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>
                      No programs found.
                    </p>
                  ) : (
                    programs.map((p) => {
                      const isComplete = p.status === "complete";
                      const isFailed   = p.status === "failed";
                      return (
                        <div key={p.id} className="flex items-center justify-between px-4 py-3 transition-colors" style={{ backgroundColor: "rgba(255,255,255,0.01)" }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)")} onMouseLeave={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.01)")}>
                          <div>
                            <p className="text-xs font-bold text-white" style={{ fontFamily: "var(--kobie-font-heading)" }}>{p.name}</p>
                            <p className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{p.id}</p>
                          </div>
                          <Badge
                            variant={isComplete ? "outline" : isFailed ? "destructive" : "secondary"}
                            className="shrink-0 text-[10px]"
                          >
                            {p.status}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              <TabsContent value="compare" className="mt-0">
                <ComparatorPicker programs={programs} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* ── Danger Zone ── */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: "rgba(239,68,68,0.6)", fontFamily: "var(--kobie-font-heading)" }}>
            Danger Zone
          </p>
          <DeleteProgramPanel onDeleted={refresh} />
        </div>
      </main>
    </div>
  );
}
