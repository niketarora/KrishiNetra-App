/**
 * The one internal shape every Krishi Updates provider (GDELT, SACHET, PIB)
 * normalizes into. Nothing downstream of this file — scoring, dedup,
 * mobile — knows GDELT's JSON or SACHET's CAP XML; they only ever see this.
 *
 * Mirrors the shape sketched in docs/PHASE*_NOTES-adjacent planning for this
 * feature. Field names are camelCase (unlike the snake_case Supabase row
 * types in `types/domain.ts`) because nothing here is a database row — it
 * never touches Postgres.
 */

/** `risk` covers disaster/weather-hazard reports; the rest match the source's own beat. */
export type UpdateCategory = 'risk' | 'agriculture' | 'government' | 'market' | 'technology';

/**
 * `official` is reserved for a government/authority source (NDMA SACHET,
 * PIB). `reported` is everything GDELT surfaces — ordinary news coverage,
 * which may be accurate but is not an authority speaking directly.
 */
export type UpdateSourceType = 'official' | 'reported';

export type UpdateSeverity = 'info' | 'moderate' | 'high';

export type KrishiUpdateLocation = {
  country?: string;
  state?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
};

export type KrishiUpdateRelevance = {
  /** Internal ranking score (see relevance.ts). Never shown to the farmer as a number. */
  score: number;
  /** Short, human-readable reasons — "Relevant to Gorakhpur", "Matches your registered crop: Wheat". */
  reasons: string[];
  /** Only set when a real distance could be computed — never inferred or guessed. */
  distanceKm?: number;
};

export type KrishiUpdate = {
  id: string;
  title: string;
  summary?: string;
  category: UpdateCategory;
  source: {
    name: string;
    type: UpdateSourceType;
  };
  sourceUrl: string;
  /** ISO 8601. */
  publishedAt: string;
  location?: KrishiUpdateLocation;
  severity?: UpdateSeverity;
  relevance: KrishiUpdateRelevance;
  /** Short matched-topic labels ("flood", "mandi", the farm's crop name) — display hints, not raw scoring internals. */
  tags?: string[];
};

/** What a provider needs to build a farm-scoped, crop-aware query. */
export type UpdatesQueryContext = {
  farmId: string;
  latitude: number;
  longitude: number;
  district: string | null;
  state: string | null;
  cropCode: string | null;
  cropName: string | null;
};

/**
 * Every provider has this shape: farm context in, normalized updates out.
 * A provider must never throw — a network failure or a malformed response
 * resolves to `[]` so one provider's outage cannot take the others down
 * (the orchestrator still wraps each call in `Promise.allSettled` as a
 * second line of defence).
 */
export type UpdateProvider = (ctx: UpdatesQueryContext) => Promise<KrishiUpdate[]>;
