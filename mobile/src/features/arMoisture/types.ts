/**
 * AR Moisture Guidance — types.
 *
 * `MoistureTarget` deliberately carries no moisture percentage, confidence,
 * or "zone" language. KrishiNetra's soil-moisture model produces exactly
 * one scalar value for an entire farm (see
 * `backend/src/services/soilMoisturePrediction.service.ts`) — there is no
 * spatial/per-point moisture data anywhere in the system yet. A target here
 * is a place to walk to and look, not a measured reading, and `provenance`
 * exists specifically so the UI can never accidentally present one as the
 * other.
 */

export type MoistureTargetSource = 'demo' | 'api';

export type MoistureTargetProvenance = {
  source: MoistureTargetSource;
  /** Always 'sampling_target' today — a place to inspect, never 'measured_zone', because nothing in KrishiNetra measures spatial moisture yet. */
  type: 'sampling_target';
};

export type MoistureTarget = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  provenance: MoistureTargetProvenance;
  /** Short farmer-facing guidance — a generic call to action, never a moisture-derived claim. */
  note?: string;
};
