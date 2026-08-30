/**
 * The deterministic keyword groups the whole Krishi Updates feature is built
 * on — what a provider queries for, and what the scorer later recognizes in
 * a result's title. Centralized so both sides always agree on the same list.
 *
 * These are prototype term lists (product brief's suggested topic groups),
 * not an exhaustive taxonomy — see relevance.ts's file comment for the same
 * caveat about the scoring weights.
 */

export const RISK_TERMS = [
  'flood',
  'heavy rain',
  'cloudburst',
  'cyclone',
  'drought',
  'hailstorm',
  'heatwave',
  'landslide',
  'lightning',
];

/** Deliberately includes mandi/procurement/MSP — CROP-relevance still narrows to the farm's own crop separately. */
export const AGRICULTURE_TERMS = [
  'agriculture',
  'farmer',
  'crop',
  'harvest',
  'irrigation',
  'fertilizer',
  'pest',
  'disease',
  'mandi',
  'procurement',
  'MSP',
];

/** These particular agriculture terms read as market news rather than general farming coverage. */
export const MARKET_TERMS = ['mandi', 'procurement', 'MSP'];

/** PIB-flavoured government/scheme terms (P1) — see providers/pib.provider.ts. */
export const GOVERNMENT_TERMS = [
  'PM-KISAN',
  'PMFBY',
  'crop insurance',
  'Kisan Credit Card',
  'subsidy',
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
