/**
 * The deterministic keyword groups the whole Krishi Updates feature is built
 * on — what a provider queries for, and what the scorer/filters later
 * recognize in a result's title. Centralized so every provider (SACHET,
 * GDELT, Google News) always agrees on the same lists.
 *
 * These are prototype term lists (product brief's suggested topic groups),
 * not an exhaustive taxonomy — see relevance.ts's file comment for the same
 * caveat about the scoring weights, and filters.ts's header comment for why
 * a deterministic keyword filter can never be a perfect classifier.
 */

export const RISK_TERMS = [
  'flood',
  'heavy rain',
  'thunderstorm',
  'cloudburst',
  'cyclone',
  'drought',
  'hailstorm',
  'hail',
  'heatwave',
  'landslide',
  'lightning',
];

/** Deliberately includes mandi/procurement/MSP — CROP-relevance still narrows to the farm's own crop separately. */
export const AGRICULTURE_TERMS = [
  'agriculture',
  'farmer',
  'farming',
  'crop',
  'harvest',
  'irrigation',
  'soil',
  'seed',
  'fertilizer',
  'pest',
  'disease',
  'horticulture',
  'mandi',
  'procurement',
  'MSP',
];

/** These particular agriculture terms read as market news rather than general farming coverage. */
export const MARKET_TERMS = ['mandi', 'procurement', 'MSP'];

/** PIB-flavoured government/scheme terms (P1) — see providers/pib.provider.ts. Not currently queried (PIB is disabled — see updates.service.ts), kept for that provider's own use if it is ever re-enabled. */
export const GOVERNMENT_TERMS = [
  'PM-KISAN',
  'PMFBY',
  'crop insurance',
  'Kisan Credit Card',
  'subsidy',
];

/**
 * Headline-level agriculture signal — used by `filters.ts`'s
 * `isAgricultureHeadline` to decide whether a GDELT/Google News result is
 * genuinely agricultural rather than merely mentioning a farmer/agriculture
 * minister in passing (a political, crime, sports, or entertainment story,
 * say). Deliberately broader than `AGRICULTURE_TERMS` (which also drives
 * GDELT's own query construction) because a headline filter needs to catch
 * everything a farmer would recognize as "about farming", including terms
 * the query itself doesn't search for.
 */
export const AGRICULTURE_SIGNAL_TERMS = [
  'farmer',
  'farmers',
  'farming',
  'agriculture',
  'agricultural',
  'crop',
  'crops',
  'irrigation',
  'mandi',
  'harvest',
  'soil',
  'fertilizer',
  'fertiliser',
  'seed',
  'seeds',
  'pest',
  'horticulture',
  'livestock',
  'dairy',
];

/**
 * A headline can contain a term from `AGRICULTURE_SIGNAL_TERMS` (most often
 * "farmer") and still not be agricultural news at all — "farmer's son
 * becomes kabaddi captain" is the canonical false positive. Any of these
 * terms co-occurring with an agriculture signal overrides it back to
 * "not relevant" — see `isAgricultureHeadline` in `filters.ts`.
 */
export const NON_AGRICULTURE_REJECT_TERMS = [
  'kabaddi',
  'cricket',
  'football',
  'hockey',
  'badminton',
  'wrestling',
  'olympics',
  'gold medal',
  'movie',
  'film',
  'bollywood',
  'actor',
  'actress',
  'singer',
  'wedding',
  'engagement',
  'divorce',
  'hospital',
  'hospitalised',
  'hospitalized',
  'health condition',
  'ambulance',
  'arrested',
  'murder',
  'robbery',
  'assault',
  'kidnap',
  'fraud case',
  'election campaign',
  'lok sabha',
  'assembly election',
  'political rally',
  'cabinet reshuffle',
];

/**
 * Scheme-discovery/application content — Government Schemes is a separate
 * KrishiNetra feature, so an article that reads as "how do I apply for
 * Yojana X" is excluded from Krishi Updates entirely (see `isSchemeArticle`
 * in `filters.ts`). Deliberately does NOT include `subsidy`, `MSP`, or
 * `procurement` — those are genuine agricultural policy/market terms and
 * must not be excluded just for using them.
 */
export const SCHEME_SIGNAL_TERMS = [
  'yojana',
  'government scheme',
  'scheme eligibility',
  'eligibility criteria',
  'how to apply',
  'application process',
  'beneficiary eligibility',
  'registration for scheme',
  'documents required',
  'apply online',
];

/**
 * Small, deliberately short query term set for GDELT/Google News's agritech
 * query — kept short per the product brief ("no 20-term query"). Broader
 * technology-context detection for *classification* lives in
 * `TECH_CONTEXT_TERMS` below instead, which is never sent as a query.
 */
export const AGRITECH_QUERY_TERMS = [
  'agritech',
  'precision farming',
  'precision agriculture',
  'agricultural drone',
  'smart irrigation',
  'satellite agriculture',
  'digital agriculture',
  'AI farming',
];

/** Broad technology-context signal — classification only, never sent as a query. */
export const TECH_CONTEXT_TERMS = [
  'AI',
  'artificial intelligence',
  'machine learning',
  'drone',
  'satellite',
  'remote sensing',
  'sensor',
  'IoT',
  'robotics',
  'automation',
  'precision',
  'digital',
];

/**
 * Agriculture/farming context terms an agritech story must also carry —
 * kept separate from `AGRICULTURE_TERMS` so this stays a short, deliberate
 * clause rather than the whole (much larger) list. Includes both singular
 * and plural forms deliberately: `filters.ts` matches every term here on
 * exact word boundaries (never a bare substring — see that file's header
 * comment for why, e.g. `TECH_CONTEXT_TERMS`'s "AI" must never match inside
 * "captain"), so "farmers"/"crops" need their own entries rather than
 * relying on "farmer"/"crop" to match them as a substring.
 */
export const AGRITECH_CONTEXT_TERMS = [
  'agriculture',
  'agricultural',
  'farming',
  'farmer',
  'farmers',
  'farm',
  'farms',
  'crop',
  'crops',
  'irrigation',
  'soil',
  'harvest',
  'harvesting',
];

/** Case-insensitive substring match, returning which of `terms` actually appear in `text`. */
export function matchKeywords(text: string, terms: string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

/** Builds a GDELT-style `(a OR "b c" OR d)` clause, quoting multi-word terms. */
export function orClause(terms: string[]): string {
  const parts = terms.map((term) => (term.includes(' ') ? `"${term}"` : term));
  return `(${parts.join(' OR ')})`;
}
