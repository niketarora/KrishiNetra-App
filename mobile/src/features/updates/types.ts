import type { LocalizedText } from '@/utils/localizedText';

/**
 * `AgriUpdate` (below) is the shape of the local demo feed in
 * `demoUpdates.ts`, kept only as the fallback the screen falls back to when
 * `EXPO_PUBLIC_DEMO_MODE=true` and the real feed can't load — see that
 * file's header comment and `screens/updates/useUpdatesData.ts`.
 *
 * `KrishiUpdate` (further below) is the real thing: the shape
 * `GET /api/v1/updates?farmId=...` returns, normalized server-side from
 * GDELT/NDMA SACHET/PIB — see `backend/src/updates/types.ts`, which this
 * mirrors field-for-field. Nothing in this file talks to a provider or an
 * API key; mobile only ever sees the backend's already-normalized shape.
 */
export type UpdateCategory = 'agriculture' | 'weather' | 'government' | 'market' | 'technology';

export type AgriUpdate = {
  id: string;
  title: LocalizedText;
  category: UpdateCategory;
  summary: LocalizedText;
  body: LocalizedText;
  /** Days before today, so the feed never reads as stale — same trick as `demoMode.ts`. */
  publishedDaysAgo: number;
  source: string;
  sourceUrl?: string;
  relatedTopic?: string;
};

/** `risk` is a disaster/weather-hazard report; the rest match the source's own beat. */
export type KrishiUpdateCategory = 'risk' | 'agriculture' | 'government' | 'market' | 'technology';

/** `official` is a government/authority source (NDMA SACHET, PIB); `reported` is ordinary news coverage (GDELT). */
export type KrishiUpdateSourceType = 'official' | 'reported';

export type KrishiUpdateSeverity = 'info' | 'moderate' | 'high';

export type KrishiUpdateLocation = {
  country?: string;
  state?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
};

export type KrishiUpdateRelevance = {
  /** Internal ranking score — never rendered as a number, only used to sort. */
  score: number;
  /** "Why this matters" — short, human-readable reasons the card surfaces directly. */
  reasons: string[];
  /** Only set when the backend computed a real distance — never a guess. */
  distanceKm?: number;
};

export type KrishiUpdate = {
  id: string;
  title: string;
  summary?: string;
  category: KrishiUpdateCategory;
  source: {
    name: string;
    type: KrishiUpdateSourceType;
  };
  sourceUrl: string;
  /** ISO 8601. */
  publishedAt: string;
  location?: KrishiUpdateLocation;
  severity?: KrishiUpdateSeverity;
  relevance: KrishiUpdateRelevance;
  tags?: string[];
};
