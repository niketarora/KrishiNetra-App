/**
 * AR Moisture Guidance — types.
 *
 * `KrishiNetra`'s soil-moisture engine is a deterministic formula, not
 * genuine pretrained OASSM-10 inference (see
 * `backend/src/services/soilMoisturePrediction.service.ts` and
 * `backend/src/services/moistureZones.service.ts`'s header comments). Since
 * the spatial-moisture-zones extension, `GET /api/v1/farms/:farmId/moisture-zones`
 * runs that same formula once per point on a grid instead of once at the
 * farm centroid — still a prototype estimate, never a measured reading.
 * `provenance` exists specifically so the UI can never present one as the
 * other; API-backed targets additionally carry `estimatedMoisturePercent`
 * and `relativeStatus`, which demo targets never do.
 */

export type MoistureTargetSource = 'demo' | 'api';

export type MoistureTargetProvenance = {
  source: MoistureTargetSource;
  /** Always 'sampling_target' today — a place to inspect, never 'measured_zone', because nothing in KrishiNetra measures spatial moisture yet. */
  type: 'sampling_target';
};

export type MoistureTargetRelativeStatus = 'LOWER_THAN_FARM_AVERAGE' | 'NEAR_FARM_AVERAGE';

export type MoistureTarget = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  provenance: MoistureTargetProvenance;
  /** Short farmer-facing guidance — a generic call to action, never a moisture-derived claim. */
  note?: string;
  /** Only present for `provenance.source === 'api'` targets — the prototype spatial engine's estimate for this location. Never present on demo targets. */
  estimatedMoisturePercent?: number;
  /** How this point compares with the farm's own spatial average — only present alongside `estimatedMoisturePercent`. */
  relativeStatus?: MoistureTargetRelativeStatus;
};
