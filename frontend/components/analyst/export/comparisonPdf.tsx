import React from "react";
import type { ExtractedField } from "@/types/api";
import { API_BASE } from "@/lib/api";
import {
  splitNarrativeSegments,
  buildReferencesFromFields,
  calculateWordCount,
} from "@/lib/narrative";
import { createSharedStyles, createPDFWatermark, FIELD_LABEL_MAP, formatLongUrl } from "./pdfStyles";
import { sanitizeFilename } from "./csvExport";

interface LocalSource {
  id?: string;
  url: string;
  source_type?: string;
}

let activeComparisonPdfUrl: string | null = null;

export async function exportComparisonPDF(comparison: any, programNames: string[]) {
  if (!programNames || programNames.length === 0) {
    throw new Error("No programs specified for comparison.");
  }

  if (activeComparisonPdfUrl) {
    URL.revokeObjectURL(activeComparisonPdfUrl);
  }

  const { pdf, Document, Page, Text, View, StyleSheet, Link, Svg, Path, Font } = await import(
    "@react-pdf/renderer"
  );
  Font.registerHyphenationCallback((word) => [word]);

  // 1. Fetch fields and sources for all compared programs in parallel
  // Throwing error on failure covers Case 7 and Case 8
  const programData = await Promise.all(
    comparison.program_ids.map(async (pid: string, pIdx: number) => {
      const pName = programNames[pIdx] || `ID ${pid}`;
      const [fieldsRes, sourcesRes] = await Promise.all([
        fetch(`${API_BASE}/api/programs/${pid}/fields`),
        fetch(`${API_BASE}/api/programs/${pid}/sources`),
      ]);
      
      if (!fieldsRes.ok) {
        throw new Error(`Failed to load fields for program "${pName}".`);
      }
      if (!sourcesRes.ok) {
        throw new Error(`Failed to load sources for program "${pName}".`);
      }

      const fields: ExtractedField[] = await fieldsRes.json();
      const sources: LocalSource[] = await sourcesRes.json();
      return { id: pid, fields, sources };
    })
  );

  // Combine all fields and sources to resolve citations from either program
  const allFields = programData.flatMap((p) => p.fields);
  const allSources = programData.flatMap((p) => p.sources);

  // Map source ID to URL for reference lookup
  const url_by_source_id: Record<string, string> = {};
  allSources.forEach((src) => {
    if (src.id) url_by_source_id[String(src.id)] = src.url;
  });

  const analysis = comparison.analysis;
  const { urlMap, references } = buildReferencesFromFields(allFields);

  const wordCount = (() => {
    let text = analysis.executive_summary || "";
    analysis.matrix.forEach((item: any) => {
      text += " " + (item.rationale || "");
    });
    return calculateWordCount(text);
  })();

  const styles = createSharedStyles(StyleSheet);

  // Citation parser helper
  function buildTextWithCitations(text: string) {
    if (!text) return [];
    // Strip **bold** markers and field-ref brackets for plain PDF text
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\[[a-zA-Z0-9_]+\]/g, "")
      .replace(/\s{2,}/g, " ");
    const segments = splitNarrativeSegments(cleanText, urlMap);
    return segments.map((seg, idx) =>
      seg.type === "text" ? (
        seg.text
      ) : (
        // Case 6: Safe-guard citation link resolution from urlMap
        seg.num ? (
          <Link key={`l${idx}`} src={`#ref-${seg.num}`} style={styles.citationLink}>
            {" "}[{seg.num}]
          </Link>
        ) : null
      )
    );
  }

  function buildParagraphsWithCitations(text: string) {
    if (!text) return [];
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    return lines.map((line, idx) => {
      const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        return (
          <View key={idx} style={[styles.bodyWrap, { flexDirection: "row" }]}>
            <Text style={[styles.body, { fontFamily: "Helvetica-Bold", marginRight: 4, minWidth: 14 }]}>
              {numMatch[1]}.
            </Text>
            <Text style={[styles.body, { flex: 1 }]}>
              {buildTextWithCitations(numMatch[2])}
            </Text>
          </View>
        );
      }
      return (
        <View key={idx} wrap={false} style={styles.bodyWrap}>
          <Text style={styles.body}>
            {buildTextWithCitations(line)}
          </Text>
        </View>
      );
    });
  }

  // Case 11: Dynamically derive parameter fields that actually have data
  const activeFields = Array.from(
    new Set(
      allFields
        .filter((f) => f.gate_passed && !f.is_null && f.field_value && f.field_value !== "—")
        .map((f) => f.field_name)
    )
  );

  const excludedBasics = ["program_name", "brand", "notable_unstructured_details"];
  const dynamicFieldsList = activeFields
    .filter((name) => FIELD_LABEL_MAP[name] && !excludedBasics.includes(name))
    .map((name) => ({
      name,
      label: FIELD_LABEL_MAP[name],
    }));

  const keyFieldsList = dynamicFieldsList.length > 0 ? dynamicFieldsList.slice(0, 8) : [
    { label: "Base Earn Rate", name: "base_earn_rate" },
    { label: "Minimum Redemption", name: "minimum_redemption" },
    { label: "Points Expiry Policy", name: "expiry_policy" },
    { label: "Mobile App Rating", name: "app_store_rating" },
    { label: "Loyalty Tiers Enabled", name: "has_tiers" },
  ];

  const categoryWidth = "24%";
  // Case 4: Guard against divide-by-zero
  const programColWidth = `${76 / (programNames.length || 1)}%`;

  const PageHeader = () => (
    <View fixed style={styles.header}>
      <View style={styles.headerTopRow}>
        <Text style={styles.title}>Strategic Competitive Comparison</Text>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>InfoVac</Text>
          <Svg width={9} height={9} viewBox="0 0 24 24" style={{ marginLeft: 2 }}>
            <Path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="#FD7F4F"
            />
          </Svg>
        </View>
      </View>
      <Text style={styles.subtitle}>
        InfoVac Competitive Intelligence Report · {programNames.join(" vs ")} · {new Date().toLocaleDateString("en-GB")} · {wordCount} words
      </Text>
    </View>
  );

  const PDFWatermark = createPDFWatermark(View, Text);

  const PDFDoc = () => (
    <Document title={`Competitive Matrix — ${programNames.join(" vs ")}`}>
      <Page size="A4" style={styles.page}>
        <PageHeader />

        {/* Executive Summary */}
        <View wrap={false}>
          <Text minPresenceAhead={30} style={styles.sectionHeading}>Executive Summary</Text>
          {buildParagraphsWithCitations(analysis.executive_summary)}
        </View>

        {/* Category Rankings & Matrix */}
        <View style={styles.table}>
          {/* Bundle heading + header + first row together, remaining rows flow freely across pages */}
          <View wrap={false}>
            <Text minPresenceAhead={30} style={styles.sectionHeading}>Category Rankings & Matrix</Text>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.tableHeaderCellContainer, { width: "15%", borderRightWidth: 1, borderRightColor: "#FD7F4F" }]}>
                <Text style={styles.tableHeaderCell}>Category</Text>
              </View>
              {programNames.map((name, i) => (
                <View key={i} style={[styles.tableHeaderCellContainer, { width: "25%", borderRightWidth: 1, borderRightColor: "#FD7F4F" }]}>
                  <Text style={styles.tableHeaderCell}>{name}</Text>
                </View>
              ))}
              <View style={[styles.tableHeaderCellContainer, { width: "35%" }]}>
                <Text style={styles.tableHeaderCell}>Key Insight</Text>
              </View>
            </View>
            {analysis.matrix.length > 0 && (() => {
              const item = analysis.matrix[0];
              const repFields: Record<string, { label: string; fieldName: string }> = {
                "Program Basics": { label: "Program Type", fieldName: "program_type" },
                "Earn Mechanics": { label: "Base Earn Rate", fieldName: "base_earn_rate" },
                "Burn Mechanics": { label: "Redemption Options", fieldName: "redemption_options" },
                "Tier System": { label: "Tiers & Status", fieldName: "tier_names" },
                "Digital Experience": { label: "App Store Rating", fieldName: "app_store_rating" },
                "Member Sentiment": { label: "Overall Rating", fieldName: "overall_rating" },
                "Competitive Position": { label: "Key Differentiators", fieldName: "key_differentiators" },
                "Competitive Positioning": { label: "Key Differentiators", fieldName: "key_differentiators" },
                "Partnerships": { label: "Partner Names", fieldName: "partner_names" }
              };
              const repInfo = repFields[item.category] || { label: item.category, fieldName: "notable_unstructured_details" };
              return (
                <View style={styles.tableRow}>
                  <View style={[styles.tableCellCategory, { width: "15%" }]}>
                    <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#051C2C" }}>{item.category}</Text>
                    <Text style={{ fontSize: 6.5, color: "rgba(5,28,44,0.5)", marginTop: 2 }}>{repInfo.label}</Text>
                  </View>
                  {programNames.map((_, pIdx) => {
                    const field = programData[pIdx]?.fields.find((f: any) => f.field_name === repInfo.fieldName);
                    const val = field?.field_value || "—";
                    const num = field?.source_url ? urlMap.get(field.source_url) : null;
                    return (
                      <View key={pIdx} style={[styles.tableCellContent, { width: "25%" }]}>
                        <Text style={{ fontSize: 8, lineHeight: 1.4, color: "#051C2C" }}>
                          {val}
                          {num ? (
                            <Link src={`#ref-${num}`} style={styles.citationLink}>
                              {" "}[{num}]
                            </Link>
                          ) : null}
                        </Text>
                      </View>
                    );
                  })}
                  <View style={[styles.tableCellContent, { width: "35%", borderRightWidth: 0 }]}>
                    <Text style={{ fontSize: 8, lineHeight: 1.4, color: "#051C2C" }}>
                      {buildTextWithCitations(item.rationale)}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>

          {analysis.matrix.slice(1).map((item: any, i: number) => {
            const isAlt = (i + 1) % 2 !== 0;
            const repFields: Record<string, { label: string; fieldName: string }> = {
              "Program Basics": { label: "Program Type", fieldName: "program_type" },
              "Earn Mechanics": { label: "Base Earn Rate", fieldName: "base_earn_rate" },
              "Burn Mechanics": { label: "Redemption Options", fieldName: "redemption_options" },
              "Tier System": { label: "Tiers & Status", fieldName: "tier_names" },
              "Digital Experience": { label: "App Store Rating", fieldName: "app_store_rating" },
              "Member Sentiment": { label: "Overall Rating", fieldName: "overall_rating" },
              "Competitive Position": { label: "Key Differentiators", fieldName: "key_differentiators" },
              "Competitive Positioning": { label: "Key Differentiators", fieldName: "key_differentiators" },
              "Partnerships": { label: "Partner Names", fieldName: "partner_names" }
            };
            const repInfo = repFields[item.category] || { label: item.category, fieldName: "notable_unstructured_details" };
            return (
              <View key={i + 1} wrap={false} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                <View style={[styles.tableCellCategory, { width: "15%" }]}>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#051C2C" }}>{item.category}</Text>
                  <Text style={{ fontSize: 6.5, color: "rgba(5,28,44,0.5)", marginTop: 2 }}>{repInfo.label}</Text>
                </View>
                {programNames.map((_, pIdx) => {
                  const field = programData[pIdx]?.fields.find((f: any) => f.field_name === repInfo.fieldName);
                  const val = field?.field_value || "—";
                  const num = field?.source_url ? urlMap.get(field.source_url) : null;
                  return (
                    <View key={pIdx} style={[styles.tableCellContent, { width: "25%" }]}>
                      <Text style={{ fontSize: 8, lineHeight: 1.4, color: "#051C2C" }}>
                        {val}
                        {num ? (
                          <Link src={`#ref-${num}`} style={styles.citationLink}>
                            {" "}[{num}]
                          </Link>
                        ) : null}
                      </Text>
                    </View>
                  );
                })}
                <View style={[styles.tableCellContent, { width: "35%", borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 8, lineHeight: 1.4, color: "#051C2C" }}>
                    {buildTextWithCitations(item.rationale)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Detailed Parameters Table — wrap={false} keeps entire table together so header never orphans */}
        <View style={styles.table} wrap={false}>
          {/* Bundle Heading, Table Header and First Data Row in wrap={false} to avoid orphaned headers */}
          <View wrap={false}>
            <Text minPresenceAhead={30} style={styles.sectionHeading}>Side-by-Side Parameters</Text>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.tableHeaderCellContainer, { width: categoryWidth, borderRightWidth: 1, borderRightColor: "#FD7F4F" }]}>
                <Text style={styles.tableHeaderCell}>Loyalty Parameter</Text>
              </View>
              {programNames.map((name, i) => {
                const isLast = i === programNames.length - 1;
                return (
                  <View key={i} style={[styles.tableHeaderCellContainer, { width: programColWidth, borderRightWidth: isLast ? 0 : 1, borderRightColor: "#FD7F4F" }]}>
                    <Text style={styles.tableHeaderCell}>{name}</Text>
                  </View>
                );
              })}
            </View>
            {keyFieldsList.length > 0 && (() => {
              const fItem = keyFieldsList[0];
              return (
                <View style={styles.tableRow}>
                  <View style={[styles.tableCellCategory, { width: categoryWidth }]}>
                    <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#051C2C" }}>{fItem.label}</Text>
                  </View>
                  {programNames.map((_, pIdx) => {
                    const field = programData[pIdx]?.fields.find((f: any) => f.field_name === fItem.name);
                    const val = field?.field_value || "—";
                    const num = field?.source_url ? urlMap.get(field.source_url) : null;
                    const isLast = pIdx === programNames.length - 1;
                    return (
                      <View key={pIdx} style={[styles.tableCellContent, { width: programColWidth, borderRightWidth: isLast ? 0 : 1 }]}>
                        <Text style={{ fontSize: 8, lineHeight: 1.4, color: "#051C2C" }}>
                          {val}
                          {num ? (
                            <Link src={`#ref-${num}`} style={styles.citationLink}>
                              {" "}[{num}]
                            </Link>
                          ) : null}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>

          {keyFieldsList.slice(1).map((fItem, i) => {
            const isAlt = (i + 1) % 2 !== 0;
            return (
              <View key={i + 1} wrap={false} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                <View style={[styles.tableCellCategory, { width: categoryWidth }]}>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#051C2C" }}>{fItem.label}</Text>
                </View>
                {programNames.map((_, pIdx) => {
                  const field = programData[pIdx]?.fields.find((f: any) => f.field_name === fItem.name);
                  const val = field?.field_value || "—";
                  const num = field?.source_url ? urlMap.get(field.source_url) : null;
                  const isLast = pIdx === programNames.length - 1;
                  return (
                    <View key={pIdx} style={[styles.tableCellContent, { width: programColWidth, borderRightWidth: isLast ? 0 : 1 }]}>
                      <Text style={{ fontSize: 8, lineHeight: 1.4, color: "#051C2C" }}>
                        {val}
                        {num ? (
                          <Link src={`#ref-${num}`} style={styles.citationLink}>
                            {" "}[{num}]
                          </Link>
                        ) : null}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* Individual Highlights */}
        <View style={{ marginBottom: 15 }}>
          {/* minPresenceAhead prevents orphan heading without locking all content onto one page */}
          <Text minPresenceAhead={60} style={styles.sectionHeading}>Program Highlights</Text>
          <View style={styles.highlightsContainer}>
            {programNames.map((pName, pIdx) => (
              <View key={pIdx} wrap={true} style={styles.highlightCol}>
                <Text style={styles.highlightColTitle}>{pName} Highlights</Text>
                {programData[pIdx]?.fields
                  .filter((f: any) => f.gate_passed && !f.is_null && f.field_value && f.category !== "program_basics")
                  .slice(0, 5)
                  .map((f: any, fi: number) => {
                    const num = f.source_url ? urlMap.get(f.source_url) : null;
                    return (
                      <Text key={fi} style={styles.highlightItem}>
                        • <Text style={{ fontWeight: "bold" }}>{f.field_name.replace(/_/g, " ")}</Text>: {f.field_value}
                        {num ? (
                          <Link src={`#ref-${num}`} style={styles.citationLink}>
                            {" "}[{num}]
                          </Link>
                        ) : null}
                      </Text>
                    );
                  })}
              </View>
            ))}
          </View>
        </View>

        {/* Strategic Recommendations / Opportunities */}
        <View style={{ marginBottom: 15 }}>
          <View wrap={false}>
            <Text minPresenceAhead={30} style={styles.sectionHeading}>Strategic Recommendations</Text>
          </View>
          {buildParagraphsWithCitations(analysis.strategic_recommendations)}
        </View>

        {/* Segment Positioning Playbook */}
        <View wrap={false}>
          <Text minPresenceAhead={30} style={styles.sectionHeading}>Segment Positioning Playbook</Text>
          <View style={{ flexDirection: "row", marginTop: 6, marginBottom: 10 }}>
            <View style={{ flex: 1, borderRadius: 4, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(253,127,79,0.22)", backgroundColor: "#FFFFFF", padding: 10, marginRight: 12 }}>
              <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FD7F4F", textTransform: "uppercase", marginBottom: 4 }}>QSR Client Strategy</Text>
              <Text style={{ fontSize: 8, lineHeight: 1.4, color: "#051C2C" }}>
                Leverage high-frequency bonus events, instant burn incentives, and deep app integration to capture daily habit spends.
              </Text>
            </View>
            <View style={{ flex: 1, borderRadius: 4, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(5,28,44,0.1)", backgroundColor: "#FFFFFF", padding: 10 }}>
              <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#3B82F6", textTransform: "uppercase", marginBottom: 4 }}>Retail Client Strategy</Text>
              <Text style={{ fontSize: 8, lineHeight: 1.4, color: "#051C2C" }}>
                Deploy co-branded partnerships, tiered soft benefits (free shipping), and high-ticket reward redemptions for customer lifetime value.
              </Text>
            </View>
          </View>
        </View>

        <PDFWatermark />
      </Page>

      {/* Page 4: References */}
      {references.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader />
          <View style={styles.refSection}>
            <Text minPresenceAhead={30} style={styles.refHeading}>References</Text>
            {references.map((ref: any) => {
              const accessDate = ref.accessDate ?? "—";
              const snippet = ref.snippet
                ? `"${ref.snippet.slice(0, 150)}${ref.snippet.length > 150 ? "…" : ""}"`
                : "—";
              const displayUrl = ref.url;

              return (
                // Case 5: Use key={ref.num}
                <View key={`ref-${ref.num}`} wrap={false} style={styles.refItem} id={`ref-${ref.num}`}>
                  <Link src={ref.url} style={[styles.refNum, { textDecoration: "none" }]}>
                    [{ref.num}]
                  </Link>
                  <View style={styles.refBlock}>
                    <View style={styles.refRow}>
                      <Text style={styles.refLabel}>Source</Text>
                      <Link src={ref.url} style={[styles.refValue, { color: "#FD7F4F", textDecoration: "none" }]}>
                        {formatLongUrl(displayUrl)}
                      </Link>
                    </View>
                    <View style={styles.refRow}>
                      <Text style={styles.refLabel}>Evidence Quote</Text>
                      <Text style={styles.refQuote}>{snippet}</Text>
                    </View>
                    <View style={styles.refRow}>
                      <Text style={styles.refLabel}>Access Date</Text>
                      <Text style={styles.refValue}>{accessDate}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          <PDFWatermark />
        </Page>
      )}
    </Document>
  );

  const blob = await pdf(<PDFDoc />).toBlob();
  const url = URL.createObjectURL(blob);
  activeComparisonPdfUrl = url;
  const a = document.createElement("a");
  a.href = url;
  a.download = `Competitive_Analysis_${sanitizeFilename(programNames.join("_vs_"))}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
