"use client";

import { useState } from "react";
import { FileText, TableIcon, Loader2 } from "lucide-react";
import type { Narrative, ExtractedField } from "@/types/api";
import { exportPDF } from "./export/singleProgramPdf";
import { exportCSV } from "./export/csvExport";

interface ExportBarProps {
  narrative?: Narrative | null;
  fields: ExtractedField[];
  programName: string;
}

export function ExportBar({ narrative, fields, programName }: ExportBarProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  async function handlePDF() {
    if (!narrative) return;
    setPdfLoading(true);
    try {
      await exportPDF(narrative, fields, programName);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {narrative && (
        <button
          onClick={handlePDF}
          disabled={pdfLoading}
          className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold transition-all rounded-[3px]"
          style={{
            fontFamily: "var(--kobie-font-heading)",
            color: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "transparent",
            cursor: "pointer",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "#fd7f4f";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(253,127,79,0.4)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
          }}
        >
          {pdfLoading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <FileText size={11} strokeWidth={1.5} />
          )}
          {pdfLoading ? "Generating…" : "Export PDF"}
        </button>
      )}

      {fields.length > 0 && (
        <button
          onClick={() => exportCSV(fields, programName)}
          className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold transition-all rounded-[3px]"
          style={{
            fontFamily: "var(--kobie-font-heading)",
            color: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "transparent",
            cursor: "pointer",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "#fd7f4f";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(253,127,79,0.4)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
          }}
        >
          <TableIcon size={11} strokeWidth={1.5} />
          Export CSV
        </button>
      )}
    </div>
  );
}
export { exportPDF, exportCSV };
export { exportComparisonPDF } from "./export/comparisonPdf";
export { exportComparisonCSV } from "./export/csvExport";
