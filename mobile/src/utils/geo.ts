import turfArea from '@turf/area';
import turfCentroid from '@turf/centroid';
import { polygon as turfPolygon } from '@turf/helpers';

/** A boundary vertex as the map reports it. */
export type LatLng = { latitude: number; longitude: number };

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

export const SQ_METERS_PER_ACRE = 4046.8564224;
export const SQ_METERS_PER_HECTARE = 10000;

/** A polygon needs at least three distinct vertices to enclose any area. */
export const MIN_VERTICES = 3;

export function isValidPolygon(points: LatLng[]): boolean {
  return points.length >= MIN_VERTICES;
}

/** Convert a LatLng {latitude, longitude} to a Mapbox/GeoJSON Position [longitude, latitude]. */
export function toPosition(point: LatLng): [number, number] {
  return [point.longitude, point.latitude];
}

/** Convert a Mapbox/GeoJSON Position [longitude, latitude] to a LatLng {latitude, longitude}. */
export function fromPosition(position: [number, number] | number[]): LatLng {
  return { longitude: position[0] ?? 0, latitude: position[1] ?? 0 };
}

/**
 * Convert map vertices to a closed GeoJSON ring.
 *
 * GeoJSON is [longitude, latitude] — the reverse of React Native LatLng order.
 * Getting this backwards silently produces a plausible-looking but wrong area,
 * so it is done in exactly one place.
 */
export function toGeoJSON(points: LatLng[]): BoundaryGeoJSON {
  if (!isValidPolygon(points)) {
    throw new Error(`A boundary needs at least ${MIN_VERTICES} points.`);
  }

  const ring: [number, number][] = points.map((p) => [p.longitude, p.latitude]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return { type: 'Polygon', coordinates: [ring] };
}

/** Read a stored boundary back into map vertices, dropping the closing point. */
export function fromGeoJSON(boundary: BoundaryGeoJSON): LatLng[] {
  const ring = boundary.coordinates[0] ?? [];
  const open =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;

  return open.map(([longitude, latitude]) => ({ latitude, longitude }));
}

/**
 * Geodesic area on the WGS84 spheroid, via Turf.
 *
 * A planar shoelace formula over raw lat/lng degrees is wrong by a factor that
 * grows with latitude — at 28°N (the Indo-Gangetic plain) it overstates area by
 * roughly 13%, which would misprice a farmer's crop. Always use this.
 */
export function areaSquareMeters(points: LatLng[]): number {
  if (!isValidPolygon(points)) return 0;
  return turfArea(turfPolygon(toGeoJSON(points).coordinates));
}

export const toAcres = (squareMeters: number): number => squareMeters / SQ_METERS_PER_ACRE;

export const toHectares = (squareMeters: number): number =>
  squareMeters / SQ_METERS_PER_HECTARE;

/** All three units at once — the shape the area card and `farms` row both need. */
export function calculateArea(points: LatLng[]): FarmArea {
  const squareMeters = areaSquareMeters(points);
  return {
    squareMeters,
    acres: toAcres(squareMeters),
    hectares: toHectares(squareMeters),
  };
}

/** Centre of the boundary — used to re-centre the map on a saved farm. */
export function centroid(points: LatLng[]): LatLng {
  if (points.length === 0) {
    throw new Error('Cannot take the centroid of an empty boundary.');
  }
  if (!isValidPolygon(points)) {
    // Fall back to the mean of the points for a 1–2 point sketch.
    const sum = points.reduce(
      (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
      { latitude: 0, longitude: 0 },
    );
    return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length };
  }

  const [longitude, latitude] = turfCentroid(
    turfPolygon(toGeoJSON(points).coordinates),
  ).geometry.coordinates;

  return { latitude, longitude };
}

/** Bounding box of a boundary, for fitting the map to a saved farm. */
export function bounds(points: LatLng[]) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

/**
 * Project a boundary into a unit square (0–1) so it can be drawn as an SVG
 * thumbnail at any size. Latitude is flipped because SVG y grows downward.
 */
export function normalizeForThumbnail(points: LatLng[]): { x: number; y: number }[] {
  if (points.length === 0) return [];

  const { minLat, maxLat, minLng, maxLng } = bounds(points);
  const spanLat = maxLat - minLat;
  const spanLng = maxLng - minLng;
  // Keep the shape square-ish rather than stretching a thin plot to fill the box.
  const span = Math.max(spanLat, spanLng) || 1e-9;
  const offsetX = (span - spanLng) / 2;
  const offsetY = (span - spanLat) / 2;

  return points.map((p) => ({
    x: (p.longitude - minLng + offsetX) / span,
    y: 1 - (p.latitude - minLat + offsetY) / span,
  }));
}
