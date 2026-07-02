"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import type { Comparison } from "@/types/api";
import { exportComparisonPDF } from "./ExportBar";

interface ComparisonExportButtonProps {
  comparison: Comparison;
  programNames: string[];
}

export function ComparisonExportButton({ comparison, programNames }: ComparisonExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handlePDF() {
    setLoading(true);
    try {
      await exportComparisonPDF(comparison, programNames);
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      alert(`PDF generation failed: ${err?.message || "Unknown error occurred"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePDF}
      disabled={loading}
      className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold transition-all rounded-[3px]"
      style={{
        fontFamily: "var(--kobie-font-heading)",
        color: "rgba(255,255,255,0.55)",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "transparent",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = "#fd7f4f";
        e.currentTarget.style.borderColor = "rgba(253,127,79,0.4)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = "rgba(255,255,255,0.55)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
      }}
    >
      {loading ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <FileText size={11} strokeWidth={1.5} />
      )}
      {loading ? "Generating…" : "Export PDF"}
    </button>
  );
}
