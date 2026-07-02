import React from "react";
import { WATERMARK_TEXT } from "@/lib/narrative";

export { WATERMARK_TEXT };

/** Factory that creates the shared PDF footer component (watermark + page number).
 *  Must be called after dynamically importing @react-pdf/renderer, passing View and Text. */
export function createPDFWatermark(View: any, Text: any) {
  return function PDFWatermark() {
    return React.createElement(
      View,
      {
        fixed: true,
        style: {
          position: "absolute",
          bottom: 20,
          left: 40,
          right: 40,
          borderTopWidth: 0.5,
          borderTopColor: "#D1D5DB",
          paddingTop: 6,
          flexDirection: "row",
          alignItems: "center",
        },
      },
      React.createElement(Text, {
        style: {
          flex: 1,
          color: "#A8A29E",
          fontSize: 7,
          fontFamily: "Helvetica",
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => {
          if (pageNumber !== totalPages) return "";
          return `\u2014 ${WATERMARK_TEXT} \u2014`;
        },
      }),
      React.createElement(Text, {
        style: {
          fontSize: 8,
          fontFamily: "Helvetica-Bold",
          color: "#FD7F4F",
        },
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `${pageNumber}/${totalPages}`,
      })
    );
  };
}


/** Inserts zero-width spaces after special characters to allow long URLs to wrap cleanly in PDF. */
export function formatLongUrl(url: string): string {
  if (!url) return "";
  return url.replace(/([\/_\.\?=&%-])/g, "$1\u200B");
}


export const FIELD_LABEL_MAP: Record<string, string> = {
  // Basics
  brand: "Brand",
  industry: "Industry Sector",
  program_type: "Program Type",
  geography: "Geography",
  membership_count: "Member Count",
  // Earn
  base_earn_rate: "Base Earn Rate",
  bonus_categories: "Bonus Categories",
  earning_currency: "Earning Currency",
  earn_cap: "Earn Cap",
  // Burn
  redemption_options: "Redemption Options",
  minimum_redemption: "Minimum Redemption",
  expiry_policy: "Expiry Policy",
  point_value_cents: "Est. Point Value (cents)",
  // Tiers
  has_tiers: "Tiers Enabled",
  tier_count: "Number of Tiers",
  tier_names: "Tier Names",
  // Digital
  mobile_app_available: "Mobile App Available",
  app_store_rating: "App Store Rating",
  play_store_rating: "Play Store Rating",
  // Sentiment & Position
  overall_rating: "Overall Rating",
  key_differentiators: "Key Differentiators",
  weaknesses: "Weaknesses",
  closest_competitors: "Closest Competitors",
  market_position: "Market Position",
  recent_changes: "Recent Changes",
  // Partnerships
  partner_names: "Partner Names",
  partnership_types: "Partnership Types",
};

export const createSharedStyles = (StyleSheet: any) =>
  StyleSheet.create({
    page: { 
      paddingTop: 40, 
      paddingLeft: 40, 
      paddingRight: 40, 
      paddingBottom: 50, 
      fontFamily: "Helvetica", 
      backgroundColor: "#FAFAF9" 
    },
    header: { 
      marginBottom: 12, 
      borderBottom: "2px solid #FD7F4F", 
      paddingBottom: 8 
    },
    headerTopRow: { 
      flexDirection: "row", 
      justifyContent: "space-between", 
      alignItems: "flex-end", 
      marginBottom: 6 
    },
    title: { 
      fontSize: 15, 
      fontFamily: "Helvetica-Bold", 
      color: "#051C2C" 
    },
    logoContainer: { 
      flexDirection: "row", 
      alignItems: "center" 
    },
    logoText: { 
      fontSize: 14, 
      fontFamily: "Helvetica-Bold", 
      color: "#051C2C" 
    },
    subtitle: { 
      fontSize: 9, 
      color: "#666666" 
    },
    sectionHeading: { 
      fontSize: 11, 
      fontFamily: "Helvetica-Bold", 
      color: "#051C2C", 
      marginTop: 18, 
      marginBottom: 8, 
      textTransform: "uppercase", 
      letterSpacing: 0.5 
    },
    body: { 
      fontSize: 9.5, 
      lineHeight: 1.6, 
      color: "#051C2C" 
    },
    bodyWrap: { 
      marginBottom: 12 
    },
    h2: { 
      fontSize: 12, 
      fontFamily: "Helvetica-Bold", 
      color: "#051C2C", 
      marginTop: 16, 
      marginBottom: 6, 
      textTransform: "uppercase", 
      letterSpacing: 0.5 
    },
    h3: { 
      fontSize: 10.5, 
      fontFamily: "Helvetica-Bold", 
      color: "#051C2C", 
      marginTop: 12, 
      marginBottom: 4 
    },
    paragraph: { 
      fontSize: 10, 
      lineHeight: 1.7, 
      color: "#051C2C", 
      marginBottom: 12 
    },
    citationLink: { 
      fontSize: 8.5, 
      color: "#FD7F4F", 
      fontFamily: "Helvetica-Bold", 
      textDecoration: "none" 
    },
    
    // Table layout styles (Comparison specific)
    table: { 
      marginTop: 10, 
      marginBottom: 15, 
      borderBottom: "1px solid #FD7F4F", 
      borderRadius: 4, 
      overflow: "hidden" 
    },
    tableHeaderRow: { 
      flexDirection: "row", 
      backgroundColor: "#051C2C", 
      borderTop: "1px solid #FD7F4F", 
      borderLeft: "1px solid #FD7F4F", 
      borderRight: "1px solid #FD7F4F", 
      borderBottom: "1px solid #FD7F4F" 
    },
    tableRow: { 
      flexDirection: "row", 
      alignItems: "stretch",
      borderLeft: "1px solid #FD7F4F", 
      borderRight: "1px solid #FD7F4F", 
      borderBottom: "1px solid #F6E2D9", 
      minHeight: 28, 
      backgroundColor: "#FFFFFF" 
    },
    tableRowAlt: { 
      flexDirection: "row", 
      alignItems: "stretch",
      borderLeft: "1px solid #FD7F4F", 
      borderRight: "1px solid #FD7F4F", 
      borderBottom: "1px solid #F6E2D9", 
      minHeight: 28, 
      backgroundColor: "#FFF9F6" 
    },
    tableHeaderCellContainer: { 
      padding: 6, 
      justifyContent: "center" 
    },
    tableHeaderCell: { 
      color: "#FFFFFF", 
      fontSize: 8.5, 
      fontFamily: "Helvetica-Bold",
      textAlign: "center"
    },
    tableCellCategory: { 
      padding: 6, 
      borderRight: "1px solid #F6E2D9", 
      backgroundColor: "#FFF2EC", 
      justifyContent: "center" 
    },
    tableCellContent: { 
      padding: 6, 
      borderRight: "1px solid #F6E2D9" 
    },
    rankBadge: { 
      fontSize: 7.5, 
      fontWeight: "bold", 
      color: "#666666", 
      marginBottom: 3 
    },

    // Highlights column styles (Comparison specific)
    highlightsContainer: { 
      flexDirection: "column", 
      gap: 12, 
      marginTop: 10, 
      marginBottom: 15 
    },
    highlightCol: { 
      marginBottom: 10 
    },
    highlightColTitle: { 
      fontSize: 10, 
      fontWeight: "bold", 
      color: "#051C2C", 
      marginBottom: 4 
    },
    highlightItem: { 
      fontSize: 8, 
      color: "#000000", 
      marginBottom: 4, 
      lineHeight: 1.4 
    },

    // References styles
    refSection: { 
      marginTop: 0, 
      paddingTop: 0 
    },
    refHeading: { 
      fontSize: 10, 
      fontWeight: "bold", 
      color: "#051C2C", 
      marginBottom: 8, 
      textTransform: "uppercase", 
      letterSpacing: 1 
    },
    refItem: { 
      flexDirection: "row", 
      gap: 6, 
      marginBottom: 8 
    },
    refNum: { 
      fontSize: 8, 
      fontWeight: "bold", 
      color: "#FD7F4F", 
      width: 18, 
      textAlign: "right" 
    },
    refBlock: { 
      flex: 1, 
      gap: 1 
    },
    refLabel: { 
      fontSize: 8, 
      color: "#666666", 
      fontWeight: "bold", 
      width: 80, 
      flexShrink: 0 
    },
    refValue: { 
      fontSize: 8, 
      color: "#051C2C", 
      flex: 1 
    },
    refRow: { 
      flexDirection: "row", 
      gap: 4 
    },
    refQuote: { 
      fontSize: 8, 
      color: "#666666", 
      fontStyle: "italic", 
      flex: 1 
    },
    watermark: { 
      fontSize: 7.5, 
      color: "#A8A29E", 
      marginTop: 24, 
      textAlign: "center" 
    },
  });
