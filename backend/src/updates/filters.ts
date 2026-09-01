import {
  AGRICULTURE_SIGNAL_TERMS,
  AGRITECH_CONTEXT_TERMS,
  NON_AGRICULTURE_REJECT_TERMS,
  SCHEME_SIGNAL_TERMS,
  TECH_CONTEXT_TERMS,
} from './keywords.js';

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Word-boundary matching, unlike `keywords.ts`'s plain-substring
 * `matchKeywords` (kept as-is for SACHET/tag display, which this file
 * deliberately does not touch). A headline filter over natural-language
 * prose cannot use substring matching for short terms — `TECH_CONTEXT_TERMS`
 * includes the two-letter acronym "AI", and a substring check matches it
 * inside ordinary words like "captain" or "certain", which is exactly how a
 * sports headline ("...kabaddi captain...") could otherwise slip through as
 * "technology". `\b` boundaries eliminate that class of false positive for
 * every term in every list this file checks against.
 */
function hasWordBoundaryMatch(text: string, terms: string[]): boolean {
  return terms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text));
}

/**
 * Deterministic, headline-driven relevance rules shared by every "ordinary
 * news" provider (GDELT, Google News RSS) — SACHET is exempt, since its own
 * district/state text match in `sachet.provider.ts` is already a strict
 * relevance rule of its own kind. No ML, no embeddings: a keyword filter is
 * the correct tool for a farmer-facing prototype (deterministic, free,
 * instantly explainable — "why was this shown"), but it is a heuristic, not
 * a classifier. It will occasionally reject a genuinely relevant story whose
 * headline is written obliquely, and occasionally accept a borderline one —
 * that trade-off is deliberate: false positives ("farmer's son becomes
 * kabaddi captain") are worse for a farmer-trust product than an
 * occasional false negative, so the rules below lean toward exclusion.
 */

/**
 * True only when the headline carries a real agriculture signal AND isn't
 * overridden by a strong non-agriculture context term. A bare "farmer"
 * mention is not enough on its own to survive a sports/crime/entertainment/
 * health headline riding along with it — see `NON_AGRICULTURE_REJECT_TERMS`'s
 * header comment for the canonical false-positive this guards against.
 */
export function isAgricultureHeadline(title: string): boolean {
  const hasSignal = hasWordBoundaryMatch(title, AGRICULTURE_SIGNAL_TERMS);
  if (!hasSignal) return false;

  const hasReject = hasWordBoundaryMatch(title, NON_AGRICULTURE_REJECT_TERMS);
  return !hasReject;
}

/**
 * True when the headline reads as scheme-discovery/application content
 * ("How to apply for PM-KISAN", eligibility/registration copy) rather than
 * agricultural news — Government Schemes is a separate KrishiNetra feature,
 * so this content is excluded from Krishi Updates entirely, not merely
 * down-ranked. Deliberately narrow: `subsidy`/`MSP`/`procurement` alone
 * never trigger this — those are genuine market/policy vocabulary.
 */
export function isSchemeArticle(title: string, description?: string): boolean {
  const haystack = `${title} ${description ?? ''}`;
  return hasWordBoundaryMatch(haystack, SCHEME_SIGNAL_TERMS);
}

/**
 * Technology classification requires BOTH a technology-context term AND an
 * agriculture-context term in the same headline — this is what keeps a
 * generic "AI"/"drone" story with no farming connection from ever being
 * classified as agritech, independent of whichever query surfaced it.
 */
export function isAgritechHeadline(title: string): boolean {
  const hasTech = hasWordBoundaryMatch(title, TECH_CONTEXT_TERMS);
  const hasAgriContext = hasWordBoundaryMatch(title, AGRITECH_CONTEXT_TERMS);
  return hasTech && hasAgriContext;
}
