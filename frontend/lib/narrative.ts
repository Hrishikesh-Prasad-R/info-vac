/**
 * narrative.ts — single source of truth for parsing the analyst brief.
 *
 * Both BriefView (UI) and ExportBar (PDF) must import from here.
 * This guarantees the reference list, numbering, and evidence snippets
 * are identical in the UI and the exported PDF.
 */
import type { ExtractedField } from "@/types/api";

export interface ParsedReference {
  num: number;
  url: string;
  /** Best-matched evidence snippet from the fields DB for this URL */
  snippet: string | null;
  /** ISO date string of access, or null */
  accessDate: string | null;
  /** Authority tier — lower = higher authority (used for ordering) */
  authorityTier: number;
}

export interface ParsedNarrative {
  /** Ordered map of url → citation number, in appearance order */
  urlMap: Map<string, number>;
  /** Sorted array of reference objects ready to render */
  references: ParsedReference[];
}

const CITATION_REGEX = /\(\s*source:\s*(https?:\/\/[^\s,)]+)\)/g;

// Authority tier order — lower tier = higher authority = listed first
const AUTHORITY_TIER: Record<string, number> = {
  tnc: 1,
  homepage: 2,
  faq: 3,
  press: 4,
  benefits: 5,
  mechanics: 6,
  partners: 7,
  news: 8,
  competitors: 9,
  app_review: 10,
  forum: 11,
};

/**
 * Score how well a snippet matches a surrounding narrative context window.
 * Returns the length of the longest common substring (case-insensitive).
 */
function longestCommonSubstringLength(a: string, b: string): number {
  const aL = a.toLowerCase();
  const bL = b.toLowerCase();
  const m = aL.length;
  const n = bL.length;
  if (m === 0 || n === 0) return 0;

  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);
  let maxLen = 0;

  for (let i = 1; i <= m; i++) {
    const charA = aL[i - 1];
    for (let j = 1; j <= n; j++) {
      if (charA === bL[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > maxLen) {
          maxLen = curr[j];
        }
      } else {
        curr[j] = 0;
      }
    }
    // Swap rows
    const temp = prev;
    prev = curr;
    curr = temp;
    // Clear current row for next iteration
    curr.fill(0);
  }

  return maxLen;
}

/**
 * Parse the raw narrative text and build the reference list.
 *
 * @param narrativeText - Raw narrative string containing (source: URL) annotations
 * @param fields        - Extracted fields from the DB (used to look up snippets)
 */
export function parseNarrative(
  narrativeText: string,
  fields: ExtractedField[]
): ParsedNarrative {
  const urlMap = new Map<string, number>();

  // First pass — collect unique URLs in order of appearance and map each
  // citation occurrence to its surrounding 300-char context window.
  const urlContexts = new Map<string, string[]>(); // url → list of context windows
  const regex = new RegExp(CITATION_REGEX.source, "g");
  let counter = 1;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(narrativeText)) !== null) {
    const url = m[1];
    if (!urlMap.has(url)) {
      urlMap.set(url, counter++);
      urlContexts.set(url, []);
    }
    // Capture the 300 chars immediately before this citation as context
    const ctxStart = Math.max(0, m.index - 300);
    const ctxWindow = narrativeText.slice(ctxStart, m.index).toLowerCase();
    urlContexts.get(url)!.push(ctxWindow);
  }

  // Build reference list with best-matched snippets per URL
  const references: ParsedReference[] = Array.from(urlMap.entries())
    .map(([url, num]) => {
      // Find all fields that cite this URL and have a snippet
      const matched = fields.filter(
        (f) => f.source_url === url && f.claimed_snippet != null && f.claimed_snippet.length > 0
      );

      // Pick the snippet whose content best overlaps with any context window
      // in which this URL was cited (longest-common-substring scoring).
      let bestSnippet: string | null = null;
      let bestScore = 0;

      const contexts = urlContexts.get(url) ?? [];

      if (matched.length > 0 && contexts.length > 0) {
        for (const f of matched) {
          const snip = f.claimed_snippet!;
          for (const ctx of contexts) {
            const score = longestCommonSubstringLength(snip, ctx);
            if (score > bestScore) {
              bestScore = score;
              bestSnippet = snip;
            }
          }
        }
        // If no overlap found at all, fall back to longest snippet (most informative)
        if (!bestSnippet) {
          bestSnippet = matched.reduce((a, b) =>
            (a.claimed_snippet?.length ?? 0) >= (b.claimed_snippet?.length ?? 0) ? a : b
          ).claimed_snippet ?? null;
        }
      } else if (matched.length > 0) {
        bestSnippet = matched[0].claimed_snippet ?? null;
      }

      // Access date from the first field with this URL that has a date
      const dateField = fields.find(
        (f) => f.source_url === url && f.access_date != null
      );

      let formattedDate: string | null = null;
      if (dateField?.access_date) {
        const d = new Date(dateField.access_date);
        formattedDate =
          d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
          ", " +
          d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      }

      // Determine authority tier from the source_type of the best-matched field
      const bestField = matched.find((f) => f.claimed_snippet === bestSnippet) ?? matched[0];
      const sourceType = bestField?.category ?? "";
      // Also check URL domain patterns for tier classification
      let authorityTier = AUTHORITY_TIER[sourceType] ?? 8;
      // Override by URL domain pattern — forum/reddit are always low authority
      if (/reddit\.com|quora\.com|trustpilot|tripadvisor|yelp|flyertalk/i.test(url)) {
        authorityTier = Math.max(authorityTier, AUTHORITY_TIER.forum);
      }
      if (/prnewswire|businesswire|globenewswire/i.test(url)) {
        authorityTier = Math.min(authorityTier, AUTHORITY_TIER.press);
      }

      return {
        num,
        url,
        snippet: bestSnippet,
        accessDate: formattedDate,
        authorityTier,
      };
    });

  // Sort references by authority tier (ascending = most authoritative first)
  // then by original appearance order within the same tier.
  references.sort((a, b) => {
    if (a.authorityTier !== b.authorityTier) return a.authorityTier - b.authorityTier;
    return a.num - b.num;
  });

  // Re-number after sorting so [1] is the most authoritative source
  const reNumberedUrlMap = new Map<string, number>();
  references.forEach((ref, idx) => {
    ref.num = idx + 1;
    reNumberedUrlMap.set(ref.url, idx + 1);
  });

  return { urlMap: reNumberedUrlMap, references };
}

/**
 * Split narrative text into segments, replacing (source: URL) with
 * the citation number so callers can render inline [N] badges.
 * Handles consecutive citations on the same sentence correctly.
 */
export interface NarrativeSegment {
  type: "text" | "citation";
  text: string;
  /** Only set when type === "citation" */
  url?: string;
  /** Only set when type === "citation" */
  num?: number;
}

export function splitNarrativeSegments(
  narrativeText: string,
  urlMap: Map<string, number>
): NarrativeSegment[] {
  const segments: NarrativeSegment[] = [];
  const re = new RegExp(CITATION_REGEX.source, "g");
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(narrativeText)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", text: narrativeText.slice(lastIndex, m.index) });
    }
    const url = m[1];
    segments.push({ type: "citation", text: `[${urlMap.get(url) ?? "?"}]`, url, num: urlMap.get(url) });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < narrativeText.length) {
    segments.push({ type: "text", text: narrativeText.slice(lastIndex) });
  }
  return segments;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract unique URLs from a set of fields, build and sort ParsedReference items.
 */
export function buildReferencesFromFields(allFields: ExtractedField[]): ParsedNarrative {
  const uniqueUrls = Array.from(
    new Set(
      allFields
        .filter((f) => f.gate_passed && f.source_url)
        .map((f) => f.source_url)
    )
  ).filter((url): url is string => url !== null);

  const references: ParsedReference[] = uniqueUrls.map((url, idx) => {
    const fieldsCiting = allFields.filter((f) => f.source_url === url);
    const bestField = fieldsCiting.find((f) => f.claimed_snippet) || fieldsCiting[0];

    // Format access date using identical sub-logic
    let formattedDate: string | null = null;
    const targetDate = bestField?.access_date || bestField?.created_at;
    if (targetDate) {
      const d = new Date(targetDate);
      formattedDate =
        d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
        ", " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    }

    // Determine authority tier
    const sourceType = bestField?.category ?? "";
    let authorityTier = AUTHORITY_TIER[sourceType] ?? 8;
    if (/reddit\.com|quora\.com|trustpilot|tripadvisor|yelp|flyertalk/i.test(url)) {
      authorityTier = Math.max(authorityTier, AUTHORITY_TIER.forum);
    }
    if (/prnewswire|businesswire|globenewswire/i.test(url)) {
      authorityTier = Math.min(authorityTier, AUTHORITY_TIER.press);
    }

    return {
      num: idx + 1,
      url,
      snippet: bestField?.claimed_snippet || null,
      accessDate: formattedDate,
      authorityTier,
    };
  });

  // Sort references by authority tier then by original number
  references.sort((a, b) => {
    if (a.authorityTier !== b.authorityTier) return a.authorityTier - b.authorityTier;
    return a.num - b.num;
  });

  // Re-number
  const urlMap = new Map<string, number>();
  references.forEach((ref, idx) => {
    ref.num = idx + 1;
    urlMap.set(ref.url, idx + 1);
  });

  return { urlMap, references };
}

/**
 * Calculate the clean word count of a narrative, stripping source URLs, citation brackets, and metadata keys.
 */
export function calculateWordCount(text: string): number {
  if (!text) return 0;
  const cleanText = text
    .replace(/\(source:\s*https?:\/\/[^\s)]+\)/g, "") // remove source urls
    .replace(/\[\d+\]/g, "") // remove citation numbers
    .replace(/\[[a-zA-Z0-9_]+\]/g, "") // remove database schema tags
    .trim();
  return cleanText ? cleanText.split(/\s+/).length : 0;
}

export const WATERMARK_TEXT = "Generated by InfoVac - Autonomous Competitive Intelligence Agent";
