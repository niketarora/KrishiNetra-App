import type { BoundaryGeoJSON } from './geo.js';

/** A sample point inside a farm boundary, in WGS84 degrees. */
export type GridPoint = { lat: number; lng: number };

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Ray-casting point-in-polygon test against a single-ring GeoJSON polygon.
 * `farms.boundary` is schema-enforced to a single ring with no holes
 * (`backend/src/schemas/farm.schema.ts`), so only `coordinates[0]` matters.
 * Coordinates are `[lng, lat]` pairs, per GeoJSON.
 */
export function isPointInPolygon(point: GridPoint, boundary: BoundaryGeoJSON): boolean {
  const ring = boundary.coordinates[0] ?? [];
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const [xi, yi] = a;
    const [xj, yj] = b;

    const crossesRay = yi > point.lat !== yj > point.lat;
    if (!crossesRay) continue;

    const xIntersect = ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (point.lng < xIntersect) inside = !inside;
  }

  return inside;
}

export type FarmGridOptions = {
  /** Target spacing between sample points, in meters. Defaults to 20m. */
  spacingMeters?: number;
  /** Hard cap on generated points, so an unusually large boundary cannot balloon into thousands of elevation lookups. */
  maxCells?: number;
};

/**
 * Samples points on a regular lat/lng grid inside a farm's boundary polygon.
 *
 * Dependency-free by design (see docs/PHASE* notes on this prototype): a
 * local equirectangular approximation converting meters to degrees is
 * accurate enough at farm-plot scale (rarely more than a few hundred metres
 * across) — the same assumption `mobile/src/features/arMoisture/demoTargets.ts`
 * already makes for its offsets. No Turf/GIS dependency needed for this.
 */
export function generateFarmGrid(boundary: BoundaryGeoJSON, options: FarmGridOptions = {}): GridPoint[] {
  const spacingMeters = options.spacingMeters ?? 20;
  const maxCells = options.maxCells ?? 150;

  const ring = boundary.coordinates[0] ?? [];
  if (ring.length < 4) return [];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const position of ring) {
    const [lng, lat] = position;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const centerLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(centerLatRad);

  const dLat = spacingMeters / METERS_PER_DEGREE_LAT;
  const dLng = metersPerDegreeLng > 0 ? spacingMeters / metersPerDegreeLng : dLat;

  const points: GridPoint[] = [];

  // Offset the first row/column by half a step so samples fall at cell
  // centers rather than hugging the bounding box's own edge.
  for (let lat = minLat + dLat / 2; lat <= maxLat; lat += dLat) {
    for (let lng = minLng + dLng / 2; lng <= maxLng; lng += dLng) {
      const point = { lat, lng };
      if (isPointInPolygon(point, boundary)) {
        points.push(point);
        if (points.length >= maxCells) return points;
      }
    }
  }

  return points;
}

/** Great-circle distance between two points, in meters. Same formula as `mobile/src/utils/arGeoMath.ts`'s `haversineDistanceMeters`. */
export function haversineDistanceMeters(a: GridPoint, b: GridPoint): number {
  const EARTH_RADIUS_M = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
