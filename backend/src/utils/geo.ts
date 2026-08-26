import turfArea from '@turf/area';
import turfCentroid from '@turf/centroid';
import { polygon as turfPolygon } from '@turf/helpers';

/**
 * The server's copy of the geometry the app computes on the device.
 *
 * Phase 1 computed area in `mobile/src/utils/geo.ts` and the database accepted
 * whatever arrived. Once an HTTP API is reachable, anything can post to it, so
 * the server re-derives every measurement and stores its own numbers. The
 * client keeps computing for the live on-map readout — that is a UX need — but
 * the database now trusts only this file.
 *
 * The formulas and the constant below must stay identical to the mobile copy.
 */

/** GeoJSON Polygon, the shape stored in `farms.boundary`. */
export type BoundaryGeoJSON = {
  type: 'Polygon';
  /** Ring of [longitude, latitude] pairs; first and last are identical. */
  coordinates: [number, number][][];
};

export type FarmArea = {
  squareMeters: number;
  acres: number;
  hectares: number;
};

export type Centroid = { latitude: number; longitude: number };

export const SQ_METERS_PER_ACRE = 4046.8564224;
export const SQ_METERS_PER_HECTARE = 10000;

/**
 * How far the client's numbers may differ from the server's before the request
 * is rejected. Wide enough to absorb floating-point differences between Hermes
 * and V8, narrow enough that a meaningfully wrong area cannot get through.
 */
export const AREA_TOLERANCE = 0.01;

/**
 * Geodesic area on the WGS84 spheroid, via Turf.
 *
 * A planar shoelace formula over raw lat/lng degrees is wrong by a factor that
 * grows with latitude, so it would misprice a farmer's crop. Always use this.
 */
export function areaFromBoundary(boundary: BoundaryGeoJSON): FarmArea {
  const squareMeters = turfArea(turfPolygon(boundary.coordinates));

  return {
    squareMeters,
    acres: squareMeters / SQ_METERS_PER_ACRE,
    hectares: squareMeters / SQ_METERS_PER_HECTARE,
  };
}

export function centroidFromBoundary(boundary: BoundaryGeoJSON): Centroid {
  const [longitude, latitude] = turfCentroid(turfPolygon(boundary.coordinates)).geometry
    .coordinates as [number, number];

  return { latitude, longitude };
}

/** Relative difference between two positive numbers, guarded against zero. */
function relativeDifference(a: number, b: number): number {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return 0;
  return Math.abs(a - b) / scale;
}

export type DerivedFarmGeometry = {
  area_sq_meters: number;
  area_acres: number;
  area_hectares: number;
  centroid_lat: number;
  centroid_lng: number;
};

export type GeometryCheck =
  | { ok: true; values: DerivedFarmGeometry }
  | { ok: false; reason: string };

/**
 * Re-derive every measurement from the submitted polygon and compare it with
 * what the client claimed. On agreement the server's own numbers are returned,
 * so the row never stores a client-supplied figure even when it was correct.
 */
export function deriveAndVerify(
  boundary: BoundaryGeoJSON,
  claimed: {
    area_sq_meters: number;
    area_acres: number;
    area_hectares: number;
    centroid_lat: number;
    centroid_lng: number;
  },
): GeometryCheck {
  const area = areaFromBoundary(boundary);

  if (!(area.squareMeters > 0)) {
    return { ok: false, reason: 'The boundary encloses no area.' };
  }

  if (relativeDifference(area.squareMeters, claimed.area_sq_meters) > AREA_TOLERANCE) {
    return {
      ok: false,
      reason: 'The submitted area does not match the submitted boundary.',
    };
  }

  if (
    relativeDifference(area.acres, claimed.area_acres) > AREA_TOLERANCE ||
    relativeDifference(area.hectares, claimed.area_hectares) > AREA_TOLERANCE
  ) {
    return {
      ok: false,
      reason: 'The submitted area units are inconsistent with each other.',
    };
  }

  const centre = centroidFromBoundary(boundary);

  // The centroid is checked as an absolute distance in degrees rather than a
  // ratio: near the equator or the prime meridian a coordinate legitimately
  // approaches zero, which makes a relative comparison meaningless.
  const centroidDrift = Math.max(
    Math.abs(centre.latitude - claimed.centroid_lat),
    Math.abs(centre.longitude - claimed.centroid_lng),
  );

  // Roughly 11 metres of latitude. Comfortably inside a field, far outside a
  // rounding error.
  if (centroidDrift > 0.0001) {
    return {
      ok: false,
      reason: 'The submitted centre does not match the submitted boundary.',
    };
  }

  return {
    ok: true,
    values: {
      area_sq_meters: area.squareMeters,
      area_acres: area.acres,
      area_hectares: area.hectares,
      centroid_lat: centre.latitude,
      centroid_lng: centre.longitude,
    },
  };
}
