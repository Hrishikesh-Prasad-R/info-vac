"use client";

import { useState } from "react";
import { Download, FileText, TableIcon, Loader2 } from "lucide-react";
import type { Narrative, ExtractedField } from "@/types/api";
import { API_BASE } from "@/lib/api";
import {
  parseNarrative,
  splitNarrativeSegments,
  parseBoldSegments,
  buildReferencesFromFields,
  calculateWordCount,
  WATERMARK_TEXT,
  WATERMARK_TEXT_PDF,
} from "@/lib/narrative";

interface ExportBarProps {
  narrative?: Narrative | null;
  fields: ExtractedField[];
  programName: string;
}

interface LocalSource {
  id?: string;
  url: string;
  source_type?: string;
}

function exportCSV(fields: ExtractedField[], programName: string) {
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
      f.category,
      f.field_name,
      `"${(f.field_value ?? "").replace(/"/g, '""')}"`,
      f.gate_passed,
      f.confidence ?? "",
      f.match_score ?? "",
      f.contradiction_flag,
      `"${(f.claimed_snippet ?? "").replace(/"/g, '""')}"`,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${programName.replace(/\s+/g, "_")}_fields.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 20000);
}

function getFullUrl(refUrl: string, fields: ExtractedField[]): string {
  if (!refUrl) return refUrl;
  const cleanRef = refUrl.endsWith("...") ? refUrl.slice(0, -3) : refUrl;
  const match = fields.find(
    (f) =>
      f.source_url &&
      (f.source_url === refUrl || f.source_url.startsWith(cleanRef))
  );
  return match?.source_url || refUrl;
}

// ── Shared styles used by both Single and Compare PDF layouts ──
const createSharedStyles = (StyleSheet: any) =>
  StyleSheet.create({
    page: { padding: 40, fontFamily: "Helvetica", backgroundColor: "#FAFAF9" },
    header: { marginBottom: 12, borderBottom: "2px solid #FD7F4F", paddingBottom: 8 },
    headerTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6 },
    title: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#051C2C" },
    logoContainer: { flexDirection: "row", alignItems: "center" },
    logoText: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#051C2C" },
    subtitle: { fontSize: 9, color: "#666666" },
    sectionHeading: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#051C2C", marginTop: 18, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
    body: { fontSize: 9.5, lineHeight: 1.6, color: "#051C2C" },
    bodyWrap: { marginBottom: 12 },
    h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#051C2C", marginTop: 16, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
    h3: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: "#051C2C", marginTop: 12, marginBottom: 4 },
    paragraph: { fontSize: 10, lineHeight: 1.7, color: "#051C2C", marginBottom: 12 },
    citationLink: { fontSize: 8.5, color: "#FD7F4F", fontFamily: "Helvetica-Bold", textDecoration: "none" },
    
    // Table layout styles (Comparison specific)
    table: { marginTop: 10, marginBottom: 15, borderBottom: "1px solid #FD7F4F", borderRadius: 4, overflow: "hidden" },
    tableHeaderRow: { flexDirection: "row", backgroundColor: "#051C2C", borderTop: "1px solid #FD7F4F", borderLeft: "1px solid #FD7F4F", borderRight: "1px solid #FD7F4F", borderBottom: "1px solid #FD7F4F" },
    tableRow: { flexDirection: "row", borderLeft: "1px solid #FD7F4F", borderRight: "1px solid #FD7F4F", borderBottom: "1px solid #F6E2D9", minHeight: 28, backgroundColor: "#FFFFFF" },
    tableRowAlt: { flexDirection: "row", borderLeft: "1px solid #FD7F4F", borderRight: "1px solid #FD7F4F", borderBottom: "1px solid #F6E2D9", minHeight: 28, backgroundColor: "#FFF9F6" },
    tableHeaderCellContainer: { padding: 6, justifyContent: "center" },
    tableHeaderCell: { color: "#FFFFFF", fontSize: 8.5, fontFamily: "Helvetica-Bold" },
    tableCellCategory: { padding: 6, borderRight: "1px solid #F6E2D9", backgroundColor: "#FFF2EC", justifyContent: "center" },
    tableCellContent: { padding: 6, borderRight: "1px solid #F6E2D9" },
    rankBadge: { fontSize: 7.5, fontWeight: "bold", color: "#666666", marginBottom: 3 },

    // Highlights column styles (Comparison specific)
    highlightsContainer: { flexDirection: "column", gap: 12, marginTop: 10, marginBottom: 15 },
    highlightCol: { marginBottom: 10 },
    highlightColTitle: { fontSize: 10, fontWeight: "bold", color: "#051C2C", marginBottom: 4 },
    highlightItem: { fontSize: 8, color: "#666666", marginBottom: 4, lineHeight: 1.4 },

    // References styles
    refSection: { marginTop: 0, paddingTop: 0 },
    refHeading: { fontSize: 10, fontWeight: "bold", color: "#051C2C", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
    refItem: { flexDirection: "row", gap: 6, marginBottom: 8 },
    refNum: { fontSize: 8, fontWeight: "bold", color: "#FD7F4F", width: 18, textAlign: "right" },
    refBlock: { flex: 1, gap: 1 },
    refLabel: { fontSize: 8, color: "#666666", fontWeight: "bold", width: 80, flexShrink: 0 },
    refValue: { fontSize: 8, color: "#051C2C", flex: 1 },
    refRow: { flexDirection: "row", gap: 4 },
    refQuote: { fontSize: 8, color: "#666666", fontStyle: "italic", flex: 1 },
    watermark: { fontSize: 7.5, color: "#A8A29E", marginTop: 24, textAlign: "center" },
  });

// ── Export helper for Single Program Briefs ──
export async function exportPDF(narrative: Narrative, fields: ExtractedField[], programName: string) {
  const { pdf, Document, Page, Text, View, StyleSheet, Link, Svg, Path } = await import(
    "@react-pdf/renderer"
  );

  const { urlMap, references } = parseNarrative(narrative.narrative, fields);
  const styles = createSharedStyles(StyleSheet);

  function buildBodyNodes(text: string) {
    const paragraphs = text.split(/\n{2,}/);
    return paragraphs.map((para, i) => {
      const trimmed = para.trim();
      if (!trimmed) return null;

      const h2Match = trimmed.match(/^##\s+(.+)/);
      const h3Match = trimmed.match(/^###\s+(.+)/);

      if (h2Match) {
        return (
          <Text key={`h2-${i}`} minPresenceAhead={30} style={styles.h2}>
            {h2Match[1]}
          </Text>
        );
      } else if (h3Match) {
        return (
          <Text key={`h3-${i}`} minPresenceAhead={25} style={styles.h3}>
            {h3Match[1]}
          </Text>
        );
      } else {
        const segments = splitNarrativeSegments(trimmed, urlMap);
        return (
          <Text key={`p-${i}`} style={styles.paragraph}>
            {segments.map((seg, idx) =>
              seg.type === "text" ? (
                // In react-pdf ALL children must be <Text>, never raw strings mixed with <Text>
                parseBoldSegments(seg.text).map((b, k) =>
                  b.bold
                    ? <Text key={`b${idx}-${k}`} style={{ fontFamily: "Helvetica-Bold" }}>{b.text}</Text>
                    : <Text key={`p${idx}-${k}`}>{b.text}</Text>
                )
              ) : (
                <Link key={`l${idx}`} src={`#ref-${seg.num}`} style={styles.citationLink}>
                  {" "}[{seg.num}]
                </Link>
              )
            )}
          </Text>
        );
      }
    });
  }

  const PageHeader = () => (
    <View fixed style={styles.header}>
      <View style={styles.headerTopRow}>
        <Text style={styles.title}>{programName}</Text>
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
        InfoVac Competitive Intelligence · {new Date().toLocaleDateString("en-GB")} ·{" "}
        {calculateWordCount(narrative.narrative)} words
      </Text>
    </View>
  );

  const PDFWatermark = () => (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 30, marginBottom: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: "#E7E5E4" }} />
      {/* Heart rendered as SVG — same path as PageHeader, avoids Helvetica encoding issues */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }}>
        <Text style={{ fontSize: 7.5, color: "#A8A29E", fontFamily: "Helvetica", letterSpacing: 0.5 }}>
          Generated by InfoVac{" "}
        </Text>
        <Svg width={6.5} height={6.5} viewBox="0 0 24 24">
          <Path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="#FD7F4F"
          />
        </Svg>
        <Text style={{ fontSize: 7.5, color: "#A8A29E", fontFamily: "Helvetica", letterSpacing: 0.5 }}>
          {" "} - Autonomous Competitive Intelligence Agent
        </Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: "#E7E5E4" }} />
    </View>
  );

  const PDFDoc = () => (
    <Document title={`${programName} — InfoVac Intelligence Brief`}>
      <Page size="A4" style={styles.page}>
        <PageHeader />
        {buildBodyNodes(narrative.narrative).filter(Boolean)}
        {references.length === 0 && <PDFWatermark />}
      </Page>

      {references.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader />
          <View style={styles.refSection}>
            <Text minPresenceAhead={30} style={styles.refHeading}>References</Text>
            {references.map((ref) => {
              const accessDate = ref.accessDate ?? "—";
              const snippet = ref.snippet
                ? `"${ref.snippet.slice(0, 180)}${ref.snippet.length > 180 ? "…" : ""}"`
                : "—";
              const displayUrl = ref.url.length > 65 ? ref.url.slice(0, 65) + "..." : ref.url;
              const fullUrl = getFullUrl(ref.url, fields);

              return (
                <View key={ref.url} wrap={true} style={styles.refItem} id={`ref-${ref.num}`}>
                  <Link src={fullUrl} style={[styles.refNum, { textDecoration: "none" }]}>
                    [{ref.num}]
                  </Link>
                  <View style={styles.refBlock}>
                    <View style={styles.refRow}>
                      <Text style={styles.refLabel}>Source</Text>
                      <Link src={fullUrl} style={[styles.refValue, { color: "#FD7F4F", textDecoration: "none" }]}>
                        {displayUrl}
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
  const a = document.createElement("a");
  a.href = url;
  a.download = `${programName.replace(/\s+/g, "_")}_brief.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 20000);
}

// ── Export helper for Multi-Program Comparisons (Consolidated) ──
export async function exportComparisonPDF(comparison: any, programNames: string[]) {
  const { pdf, Document, Page, Text, View, StyleSheet, Link, Svg, Path } = await import(
    "@react-pdf/renderer"
  );

  // 1. Fetch fields and sources for all compared programs in parallel
  const programData = await Promise.all(
    comparison.program_ids.map(async (pid: string) => {
      const [fieldsRes, sourcesRes] = await Promise.all([
        fetch(`${API_BASE}/api/programs/${pid}/fields`),
        fetch(`${API_BASE}/api/programs/${pid}/sources`),
      ]);
      const fields: ExtractedField[] = fieldsRes.ok ? await fieldsRes.json() : [];
      const sources: LocalSource[] = sourcesRes.ok ? await sourcesRes.json() : [];
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

  // Citation + bold parser for comparison PDF
  function buildTextWithCitations(text: string) {
    if (!text) return [];
    const cleanText = text.replace(/\[[a-zA-Z0-9_]+\]/g, "").replace(/\s{2,}/g, " ");
    const segments = splitNarrativeSegments(cleanText, urlMap);
    // In react-pdf ALL children of <Text> must be <Text> — never mix raw strings with elements
    return segments.flatMap((seg, idx) =>
      seg.type === "text"
        ? parseBoldSegments(seg.text).map((b, k) =>
            b.bold
              ? <Text key={`bt${idx}-${k}`} style={{ fontFamily: "Helvetica-Bold" }}>{b.text}</Text>
              : <Text key={`pt${idx}-${k}`}>{b.text}</Text>
          )
        : [<Link key={`l${idx}`} src={`#ref-${seg.num}`} style={styles.citationLink}>{" "}[{seg.num}]</Link>]
    );
  }

  function buildParagraphsWithCitations(text: string) {
    if (!text) return [];
    const paragraphs = text.split(/\n+/);
    return paragraphs.map((para, idx) => {
      const trimmed = para.trim();
      if (!trimmed) return null;
      return (
        <View key={idx} wrap={false} style={styles.bodyWrap}>
          <Text style={styles.body}>
            {buildTextWithCitations(trimmed)}
          </Text>
        </View>
      );
    });
  }

  const keyFieldsList = [
    { label: "Base Earn Rate", name: "base_earn_rate" },
    { label: "Minimum Redemption", name: "minimum_redemption" },
    { label: "Points Expiry Policy", name: "expiry_policy" },
    { label: "Mobile App Rating", name: "app_store_rating" },
    { label: "Loyalty Tiers Enabled", name: "has_tiers" },
  ];

  const categoryWidth = "24%";
  const programColWidth = `${76 / programNames.length}%`;

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

  const PDFWatermark = () => (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 30, marginBottom: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: "#E7E5E4" }} />
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10 }}>
        <Text style={{ fontSize: 7.5, color: "#A8A29E", fontFamily: "Helvetica", letterSpacing: 0.5 }}>
          GENERATED BY INFOVAC{" "}
        </Text>
        <Svg width={7} height={7} viewBox="0 0 24 24">
          <Path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="#FD7F4F"
          />
        </Svg>
        <Text style={{ fontSize: 7.5, color: "#A8A29E", fontFamily: "Helvetica", letterSpacing: 0.5 }}>
          {" "}AUTONOMOUS COMPETITIVE INTELLIGENCE AGENT
        </Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: "#E7E5E4" }} />
    </View>
  );

  const PDFDoc = () => (
    <Document title={`Competitive Matrix — ${programNames.join(" vs ")}`}>
      {/* Main Flow: Executive Summary, Category Rankings & Matrix, Parameters, Highlights, Recommendations */}
      <Page size="A4" style={styles.page}>
        <PageHeader />

        {/* Executive Summary */}
        <Text minPresenceAhead={30} style={styles.sectionHeading}>Executive Summary</Text>
        {buildParagraphsWithCitations(analysis.executive_summary)}

        {/* Category Rankings & Matrix */}
        <Text minPresenceAhead={30} style={styles.sectionHeading}>Category Rankings & Matrix</Text>
        <View minPresenceAhead={80} style={styles.table}>
          <View fixed style={styles.tableHeaderRow}>
            <View style={[styles.tableHeaderCellContainer, { width: "24%", borderRightWidth: 1, borderRightColor: "#FD7F4F" }]}>
              <Text style={styles.tableHeaderCell}>Category</Text>
            </View>
            <View style={[styles.tableHeaderCellContainer, { width: "76%" }]}>
              <Text style={styles.tableHeaderCell}>Comparative Analysis</Text>
            </View>
          </View>

          {analysis.matrix.map((item: any, i: number) => {
            const isAlt = i % 2 !== 0;
            return (
              <View key={i} wrap={false} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
                <View style={[styles.tableCellCategory, { width: "24%" }]}>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#051C2C" }}>{item.category}</Text>
                </View>
                <View style={[styles.tableCellContent, { width: "76%", borderRightWidth: 0 }]}>
                  <Text style={{ fontSize: 8, lineHeight: 1.4, color: "#051C2C" }}>
                    {buildTextWithCitations(item.rationale)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Detailed Parameters Table */}
        <Text minPresenceAhead={30} style={styles.sectionHeading}>Side-by-Side Parameters</Text>
        <View minPresenceAhead={80} style={styles.table}>
          <View fixed style={styles.tableHeaderRow}>
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

          {keyFieldsList.map((fItem, i) => {
            const isAlt = i % 2 !== 0;
            return (
              <View key={i} wrap={false} style={isAlt ? styles.tableRowAlt : styles.tableRow}>
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
                        {num && (
                          <Link src={`#ref-${num}`} style={styles.citationLink}>
                            {" "}[{num}]
                          </Link>
                        )}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* Individual Highlights */}
        <Text minPresenceAhead={50} style={styles.sectionHeading}>Program Highlights</Text>
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
                      {num && (
                        <Link src={`#ref-${num}`} style={styles.citationLink}>
                          {" "}[{num}]
                        </Link>
                      )}
                    </Text>
                  );
                })}
            </View>
          ))}
        </View>

        {/* Strategic Recommendations / Opportunities */}
        <Text minPresenceAhead={30} style={styles.sectionHeading}>Strategic Recommendations</Text>
        {buildParagraphsWithCitations(analysis.strategic_recommendations)}

        {/* Segment Positioning Playbook */}
        <View wrap={false} minPresenceAhead={60}>
          <Text style={styles.sectionHeading}>Segment Positioning Playbook</Text>
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
          </View>{/* end row */}
        </View>{/* end wrap={false} Segment block */}

        {references.length === 0 && <PDFWatermark />}
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
              const displayUrl = ref.url.length > 70 ? ref.url.slice(0, 70) + "..." : ref.url;
              const fullUrl = getFullUrl(ref.url, allFields);

              return (
                <View key={`${ref.num}-${ref.url}`} wrap={true} style={styles.refItem} id={`ref-${ref.num}`}>
                  <Link src={fullUrl} style={[styles.refNum, { textDecoration: "none" }]}>
                    [{ref.num}]
                  </Link>
                  <View style={styles.refBlock}>
                    <View style={styles.refRow}>
                      <Text style={styles.refLabel}>Source</Text>
                      <Link src={fullUrl} style={[styles.refValue, { color: "#FD7F4F", textDecoration: "none" }]}>
                        {displayUrl}
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
  const a = document.createElement("a");
  a.href = url;
  a.download = `Competitive_Analysis_${programNames.join("_vs_")}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 20000);
}

// ── Export helper for Multi-Program Comparison CSV ──
export async function exportComparisonCSV(comparison: any, programNames: string[]) {
  // Fetch fields in parallel
  const programData = await Promise.all(
    comparison.program_ids.map(async (pid: string) => {
      const fieldsRes = await fetch(`${API_BASE}/api/programs/${pid}/fields`);
      const fields: ExtractedField[] = fieldsRes.ok ? await fieldsRes.json() : [];
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
    headers.join(","),
    ...rows.map(row => 
      row.map(val => `"${val.replace(/"/g, '""')}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Competitive_Analysis_${programNames.join("_vs_")}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 20000);
}

export function ExportBar({ narrative, fields, programName }: ExportBarProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  async function handlePDF() {
    if (!narrative) return;
    setPdfLoading(true);
    try {
      await exportPDF(narrative, fields, programName);
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
