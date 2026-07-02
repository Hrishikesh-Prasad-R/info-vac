import { API_BASE } from "@/lib/api";
import type { ExtractedField } from "@/types/api";

export function sanitizeFilename(name: string): string {
  return name.replace(/[\/\\:\*\?"<>\|]/g, "").replace(/\s+/g, "_");
}

export function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  const clean = String(val);
  if (clean.length > 0 && ["=", "+", "-", "@"].includes(clean[0])) {
    return `'${clean}`;
  }
  return clean;
}

let activeCsvUrl: string | null = null;
let activeComparisonCsvUrl: string | null = null;

export function exportCSV(fields: ExtractedField[], programName: string) {
  if (activeCsvUrl) {
    URL.revokeObjectURL(activeCsvUrl);
  }

  const header = [
    "category",
    "field_name",
    "field_value",
    "gate_passed",
    "confidence",
    "match_score",
    "contradiction_flag",
    "claimed_snippet",
  ].join(",");

  const rows = fields.map((f) =>
    [
      sanitizeCsvValue(f.category),
      sanitizeCsvValue(f.field_name),
      `"${sanitizeCsvValue(f.field_value ?? "").replace(/"/g, '""')}"`,
      sanitizeCsvValue(f.gate_passed),
      sanitizeCsvValue(f.confidence ?? ""),
      sanitizeCsvValue(f.match_score ?? ""),
      sanitizeCsvValue(f.contradiction_flag),
      `"${sanitizeCsvValue(f.claimed_snippet ?? "").replace(/"/g, '""')}"`,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  activeCsvUrl = url;

  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(programName)}_fields.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function exportComparisonCSV(comparison: any, programNames: string[]) {
  if (!programNames || programNames.length === 0) {
    throw new Error("No programs specified for comparison.");
  }

  if (activeComparisonCsvUrl) {
    URL.revokeObjectURL(activeComparisonCsvUrl);
  }

  // Fetch fields in parallel
  const programData = await Promise.all(
    comparison.program_ids.map(async (pid: string, pIdx: number) => {
      const fieldsRes = await fetch(`${API_BASE}/api/programs/${pid}/fields`);
      if (!fieldsRes.ok) {
        const pName = programNames[pIdx] || `ID ${pid}`;
        throw new Error(`Failed to load fields for program "${pName}".`);
      }
      const fields: ExtractedField[] = await fieldsRes.json();
      return { id: pid, fields };
    })
  );

  const headers = [
    "Category",
    "Metric/Parameter",
    ...programNames,
    "Category Winner",
    "Analysis Rationale"
  ];

  const rows: string[][] = [];

  // 1. Executive Summary
  rows.push([
    "Executive Summary",
    "Verdict Summary",
    ...programNames.map(() => "N/A"),
    "N/A",
    comparison.analysis.executive_summary || ""
  ]);

  // 2. Market Matrix
  comparison.analysis.matrix.forEach((item: any) => {
    const repFields: Record<string, string> = {
      "Program Basics": "program_type",
      "Earn Mechanics": "base_earn_rate",
      "Burn Mechanics": "redemption_options",
      "Tier System": "tier_names",
      "Digital Experience": "app_store_rating",
      "Member Sentiment": "overall_rating",
      "Competitive Position": "key_differentiators",
      "Partnerships": "partner_names"
    };
    const fieldName = repFields[item.category] || "";
    
    const programVals = programNames.map((_, pIdx) => {
      const field = programData[pIdx]?.fields.find((f: any) => f.field_name === fieldName);
      return field?.field_value || "—";
    });

    const winner = item.rankings?.[0] || "Tie";

    rows.push([
      item.category,
      fieldName ? fieldName.replace(/_/g, " ") : "Overview",
      ...programVals,
      winner,
      item.rationale || ""
    ]);
  });

  // 3. Side-by-Side parameters list
  const extraFields = [
    { label: "Points Expiry Policy", name: "expiry_policy" },
    { label: "Minimum Redemption Threshold", name: "minimum_redemption" }
  ];

  extraFields.forEach((item) => {
    const programVals = programNames.map((_, pIdx) => {
      const field = programData[pIdx]?.fields.find((f: any) => f.field_name === item.name);
      return field?.field_value || "—";
    });
    rows.push([
      "Detailed Parameters",
      item.label,
      ...programVals,
      "N/A",
      "Fact-checked parameter value"
    ]);
  });

  // 4. Strategic Recommendations
  rows.push([
    "Opportunities & Takeaways",
    "Strategic Recommendations",
    ...programNames.map(() => "N/A"),
    "N/A",
    comparison.analysis.strategic_recommendations || ""
  ]);

  const csvContent = [
    headers.map(val => sanitizeCsvValue(val)).join(","),
    ...rows.map(row => 
      row.map(val => `"${sanitizeCsvValue(val).replace(/"/g, '""')}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  activeComparisonCsvUrl = url;
  const a = document.createElement("a");
  a.href = url;
  a.download = `Competitive_Analysis_${sanitizeFilename(programNames.join("_vs_"))}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
