import type { KrishiUpdate, KrishiUpdateRelevance } from './types.js';

/**
 * Deterministic relevance scoring — no ML, no LLM call. Every signal is a
 * plain rule over data the provider already normalized, so the same input
 * always produces the same score and the same reasons.
 *
 * The weights below are prototype tuning constants, not a scientific claim
 * about how much each signal "should" matter — kept in one place so they are
 * easy to retune after looking at real results, per the product brief.
 */
export const RELEVANCE_WEIGHTS = {
  location: 30,
  agriculture: 25,
  crop: 15,
  sourceTrust: 15,
  recency: 10,
  severity: 5,
} as const;

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two points, in kilometres. Deliberately just Haversine — no geospatial dependency. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type DistanceBand = 'very' | 'regional' | 'weak' | 'far';

/** Prototype bands from the product brief: 0-100km very relevant, 100-250 regional, 250-500 weak, beyond that not distance-relevant. */
export function distanceBand(km: number): DistanceBand {
  if (km <= 100) return 'very';
  if (km <= 250) return 'regional';
  if (km <= 500) return 'weak';
  return 'far';
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export type RelevanceContext = {
  district: string | null;
  state: string | null;
  cropName: string | null;
  farmLat: number;
  farmLng: number;
};

/**
 * Scores one already-normalized update against the farm it will be shown
 * to. Pure — no I/O — so it is trivially unit-testable and reusable across
 * providers.
 *
 * Distance is only ever computed and reported when the update carries real
 * coordinates; a district/state name match earns its own, smaller reward
 * instead of a fabricated km figure. That distinction is deliberate — see
 * the safety rule in the product brief: "Flood reported 80 km away" is fine,
 * "Flood will reach your farm" is not, and neither is a distance nobody
 * actually measured.
 */
export function scoreUpdate(update: KrishiUpdate, ctx: RelevanceContext): KrishiUpdateRelevance {
  const reasons: string[] = [];
  let score = 0;
  let distanceKm: number | undefined;

  // --- location -------------------------------------------------------------
  const location = update.location;
  if (location?.latitude !== undefined && location?.longitude !== undefined) {
    distanceKm = Math.round(
      haversineKm({ lat: ctx.farmLat, lng: ctx.farmLng }, { lat: location.latitude, lng: location.longitude }),
    );
    const band = distanceBand(distanceKm);
    if (band === 'very') {
      score += RELEVANCE_WEIGHTS.location;
      reasons.push(`${distanceKm} km from your farm`);
    } else if (band === 'regional') {
      score += RELEVANCE_WEIGHTS.location * 0.7;
      reasons.push(`${distanceKm} km from your farm`);
    } else if (band === 'weak') {
      score += RELEVANCE_WEIGHTS.location * 0.4;
      reasons.push(`${distanceKm} km from your farm`);
    }
  } else if (ctx.district && location?.district && sameText(location.district, ctx.district)) {
    score += RELEVANCE_WEIGHTS.location;
    reasons.push(`Relevant to ${ctx.district}`);
  } else if (ctx.state && location?.state && sameText(location.state, ctx.state)) {
    score += RELEVANCE_WEIGHTS.location * 0.65;
    reasons.push(`Regional news for ${ctx.state}`);
  } else if (location?.country && sameText(location.country, 'india')) {
    score += RELEVANCE_WEIGHTS.location * 0.3;
    reasons.push('National agriculture update');
  }

  // --- agriculture topic ------------------------------------------------------
  const tags = update.tags ?? [];
  const topicTags = ctx.cropName ? tags.filter((tag) => !sameText(tag, ctx.cropName!)) : tags;
  if (topicTags.length > 0) {
    score += Math.min(RELEVANCE_WEIGHTS.agriculture, topicTags.length * 10);
    reasons.push('Related to agriculture or farming');
  }

  // --- crop ------------------------------------------------------------------
  if (ctx.cropName && tags.some((tag) => sameText(tag, ctx.cropName!))) {
    score += RELEVANCE_WEIGHTS.crop;
    reasons.push(`Matches your registered crop: ${ctx.cropName}`);
  }

  // --- source trust ------------------------------------------------------------
  if (update.source.type === 'official') {
    score += RELEVANCE_WEIGHTS.sourceTrust;
    reasons.push('Official government source');
  } else {
    score += RELEVANCE_WEIGHTS.sourceTrust * 0.4;
  }

  // --- recency -----------------------------------------------------------------
  const publishedMs = Date.parse(update.publishedAt);
  const hoursOld = Number.isFinite(publishedMs) ? (Date.now() - publishedMs) / 3_600_000 : Infinity;

  if (hoursOld <= 24) {
    score += RELEVANCE_WEIGHTS.recency;
    reasons.push('Published today');
  } else if (hoursOld <= 72) {
    score += RELEVANCE_WEIGHTS.recency * 0.7;
  } else if (hoursOld <= 24 * 7) {
    score += RELEVANCE_WEIGHTS.recency * 0.4;
  } else {
    score += RELEVANCE_WEIGHTS.recency * 0.1;
  }

  // --- severity ----------------------------------------------------------------
  if (update.severity === 'high') {
    score += RELEVANCE_WEIGHTS.severity;
    reasons.push('High-severity risk');
  } else if (update.severity === 'moderate') {
    score += RELEVANCE_WEIGHTS.severity * 0.5;
  }

  return {
    score: Math.round(score),
    reasons: [...new Set(reasons)],
    distanceKm,
  };
}
