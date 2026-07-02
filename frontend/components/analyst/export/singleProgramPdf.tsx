import React from "react";
import type { Narrative, ExtractedField } from "@/types/api";
import {
  parseNarrative,
  splitNarrativeSegments,
  calculateWordCount,
} from "@/lib/narrative";
import { createSharedStyles, createPDFWatermark, formatLongUrl } from "./pdfStyles";
import { sanitizeFilename } from "./csvExport";

let activePdfUrl: string | null = null;

export async function exportPDF(narrative: Narrative, fields: ExtractedField[], programName: string) {
  if (activePdfUrl) {
    URL.revokeObjectURL(activePdfUrl);
  }

  const { pdf, Document, Page, Text, View, StyleSheet, Link, Svg, Path, Font } = await import(
    "@react-pdf/renderer"
  );
  Font.registerHyphenationCallback((word) => [word]);

  const { urlMap, references } = parseNarrative(narrative.narrative, fields);
  const styles = createSharedStyles(StyleSheet);

  function buildBodyNodes(text: string) {
    const paragraphs = text.split(/\n{2,}/);
    const nodes: React.ReactNode[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const trimmed = paragraphs[i].trim();
      if (!trimmed) continue;

      const h2Match = trimmed.match(/^##\s+(.+)/);
      const h3Match = trimmed.match(/^###\s+(.+)/);

      if (h2Match || h3Match) {
        const titleText = h2Match ? h2Match[1] : h3Match![1];
        const style = h2Match ? styles.h2 : styles.h3;

        // Peek ahead to see if the next element is a standard paragraph (not a heading)
        const nextPara = paragraphs[i + 1]?.trim();
        const nextIsPara = nextPara && !nextPara.startsWith("##") && !nextPara.startsWith("###");

        if (nextIsPara) {
          // Wrap heading + the following paragraph inside a wrap={false} View to prevent orphan headings!
          const segments = splitNarrativeSegments(nextPara, urlMap);
          nodes.push(
            <View key={`heading-group-${i}`} wrap={false}>
              <Text style={style}>{titleText}</Text>
              <Text style={styles.paragraph}>
                {segments.map((seg, idx) =>
                  seg.type === "text" ? (
                    seg.text
                  ) : (
                    <Link key={`l${idx}`} src={`#ref-${seg.num}`} style={styles.citationLink}>
                      {" "}[{seg.num}]
                    </Link>
                  )
                )}
              </Text>
            </View>
          );
          i++; // Skip the next paragraph since we bundled it
        } else {
          // Standalone heading (if followed by another heading or nothing)
          nodes.push(
            <Text key={`h-${i}`} style={style}>
              {titleText}
            </Text>
          );
        }
      } else {
        const segments = splitNarrativeSegments(trimmed, urlMap);
        nodes.push(
          <Text key={`p-${i}`} style={styles.paragraph}>
            {segments.map((seg, idx) =>
              seg.type === "text" ? (
                seg.text
              ) : (
                <Link key={`l${idx}`} src={`#ref-${seg.num}`} style={styles.citationLink}>
                  {" "}[{seg.num}]
                </Link>
              )
            )}
          </Text>
        );
      }
    }

    return nodes;
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

  const PDFWatermark = createPDFWatermark(View, Text);

  const PDFDoc = () => (
    <Document title={`${programName} — InfoVac Intelligence Brief`}>
      <Page size="A4" style={styles.page}>
        <PageHeader />
        {buildBodyNodes(narrative.narrative).filter(Boolean)}
        <PDFWatermark />
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
              const displayUrl = ref.url;

              return (
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
  activePdfUrl = url;
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(programName)}_brief.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
