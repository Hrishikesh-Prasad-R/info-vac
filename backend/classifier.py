"""Source Classifier.

Classifies fetched sources into specific category groups using a deterministic priority chain
on domain patterns, path keywords, title keywords, and snippet text.
"""
from __future__ import annotations
import re

# ── Classification tables — ordered priority chains ───────────────────────────

# Priority 1: Trusted domain patterns — near-certain, checked first
_DOMAIN_PATTERNS: list[tuple[str, str]] = [
    (r"apps\.apple\.com|play\.google\.com|appstore\.com", "app_review"),
    (r"reddit\.com|quora\.com|trustpilot\.com|tripadvisor\.com|yelp\.com|glassdoor\.com|flyertalk\.com", "forum"),
    (r"prnewswire\.com|businesswire\.com|globenewswire\.com|sec\.gov|accesswire\.com", "press"),
    (r"nerdwallet\.com|thepointsguy\.com|bankrate\.com|creditkarma\.com|forbes\.com", "news"),
]

# Priority 2: URL path patterns — high confidence (includes .pdf)
_PATH_PATTERNS: list[tuple[str, str]] = [
    (r"\.pdf($|\?)|terms|conditions|tnc|legal|policy|rules|agreement", "tnc"),
    (r"faq|faqs|help\.|support\.|questions|howto|how-to", "faq"),
    (r"press|newsroom|press-release|ir\.|investor", "press"),
    (r"review|rating|feedback|app-store", "app_review"),
    # Third-party blog/editorial content — classify as news, not homepage/benefits
    (r"/blog/|/blogs/|/article/|/articles/|/post/|/posts/|/editorial/", "news"),
]

# Priority 3: Title keywords — medium confidence
_TITLE_KEYWORDS: dict[str, list[str]] = {
    "tnc":        ["terms", "conditions", "legal", "policy", "rules", "agreement"],
    "faq":        ["faq", "frequently asked", "help center", "support", "how to"],
    "press":      ["press release", "announces", "launches", "expands", "partners with"],
    "news":       ["review", "guide", "best credit", "comparison", "ranking", "worth it",
                   "breakdown", "complete guide", "vs ", "vs.", "explained", "overview",
                   "analysis", "deep dive", "deep-dive", "top 10", "pros and cons"],
    "app_review": ["app review", "ios", "android rating", "app store"],
}

# Priority 4: Snippet keywords — fallback
_SNIPPET_KEYWORDS: dict[str, list[str]] = {
    "tnc": ["pursuant to", "herein", "shall not", "termination", "obligations"],
    "faq": ["how do i", "how to", "can i ", "when will", "what is the"],
}


def classify_source(url: str, title: str, snippet: str, default: str) -> str:
    """Classify source_type using a four-level priority chain.

    Priority (highest to lowest):
      1. Trusted domain patterns — near-certain (e.g. reddit.com → forum)
      2. URL path patterns — high confidence (e.g. /terms, .pdf → tnc)
      3. Page title keyword matching — medium confidence
      4. Tavily snippet keyword matching — fallback

    No LLM call: all signal comes from data Tavily already returns.
    """
    url_lower = url.lower()
    title_lower = (title or "").lower()
    snippet_lower = (snippet or "").lower()

    for pattern, stype in _DOMAIN_PATTERNS:
        if re.search(pattern, url_lower):
            return stype

    for pattern, stype in _PATH_PATTERNS:
        if re.search(pattern, url_lower):
            return stype

    for stype, keywords in _TITLE_KEYWORDS.items():
        if any(kw in title_lower for kw in keywords):
            return stype

    for stype, keywords in _SNIPPET_KEYWORDS.items():
        if any(kw in snippet_lower for kw in keywords):
            return stype

    return default
