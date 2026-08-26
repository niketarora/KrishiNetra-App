import { describe, expect, it } from '@jest/globals';

import {
  AREA_TOLERANCE,
  areaFromBoundary,
  centroidFromBoundary,
  deriveAndVerify,
  SQ_METERS_PER_ACRE,
  type BoundaryGeoJSON,
} from './geo.js';

/** A roughly 100m x 100m plot near Jaipur, as GeoJSON [lng, lat]. */
const boundary: BoundaryGeoJSON = {
  type: 'Polygon',
  coordinates: [
    [
      [75.787, 26.912],
      [75.788, 26.912],
      [75.788, 26.913],
      [75.787, 26.913],
      [75.787, 26.912],
    ],
  ],
};

function truthfulClaim() {
  const area = areaFromBoundary(boundary);
  const centre = centroidFromBoundary(boundary);

  return {
    area_sq_meters: area.squareMeters,
    area_acres: area.acres,
    area_hectares: area.hectares,
    centroid_lat: centre.latitude,
    centroid_lng: centre.longitude,
  };
}

describe('areaFromBoundary', () => {
  it('measures a geodesic area, not a planar one', () => {
    const { squareMeters } = areaFromBoundary(boundary);

    // A planar shoelace over raw degrees would give (0.001 * 0.001) in degree
    // units, which is meaningless. The geodesic answer for a 0.001-degree box
    // at 26.9N is roughly 11,000 m2.
    expect(squareMeters).toBeGreaterThan(9_000);
    expect(squareMeters).toBeLessThan(13_000);
  });

  it('converts to acres with the same constant the app uses', () => {
    const area = areaFromBoundary(boundary);
    expect(area.acres).toBeCloseTo(area.squareMeters / SQ_METERS_PER_ACRE, 10);
  });

  it('converts to hectares', () => {
    const area = areaFromBoundary(boundary);
    expect(area.hectares).toBeCloseTo(area.squareMeters / 10_000, 10);
  });
});

describe('deriveAndVerify', () => {
  it('accepts measurements that match the boundary', () => {
    const result = deriveAndVerify(boundary, truthfulClaim());
    expect(result.ok).toBe(true);
  });

  it('returns the server figures, not the ones that were sent', () => {
    const claim = truthfulClaim();
    // Inside tolerance, but not identical.
    const nudged = { ...claim, area_sq_meters: claim.area_sq_meters * 1.001 };

    const result = deriveAndVerify(boundary, nudged);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.values.area_sq_meters).toBeCloseTo(claim.area_sq_meters, 6);
    expect(result.values.area_sq_meters).not.toBe(nudged.area_sq_meters);
  });

  it('rejects an inflated area', () => {
    const claim = truthfulClaim();
    const result = deriveAndVerify(boundary, { ...claim, area_sq_meters: claim.area_sq_meters * 2 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toMatch(/area does not match/i);
  });

  it('absorbs a difference inside the tolerance', () => {
    const claim = truthfulClaim();
    const withinTolerance = claim.area_sq_meters * (1 + AREA_TOLERANCE / 2);

    expect(deriveAndVerify(boundary, { ...claim, area_sq_meters: withinTolerance }).ok).toBe(true);
  });

  it('rejects area units that disagree with each other', () => {
    const claim = truthfulClaim();
    const result = deriveAndVerify(boundary, { ...claim, area_acres: claim.area_acres * 3 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toMatch(/units are inconsistent/i);
  });

  it('rejects a centre that is not inside the boundary', () => {
    const claim = truthfulClaim();
    const result = deriveAndVerify(boundary, { ...claim, centroid_lat: 28.6139 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toMatch(/centre does not match/i);
  });

  it('rejects a degenerate boundary that encloses nothing', () => {
    const flat: BoundaryGeoJSON = {
      type: 'Polygon',
      coordinates: [
        [
          [75.787, 26.912],
          [75.788, 26.912],
          [75.787, 26.912],
          [75.787, 26.912],
        ],
      ],
    };

    const result = deriveAndVerify(flat, {
      area_sq_meters: 1,
      area_acres: 1,
      area_hectares: 1,
      centroid_lat: 26.912,
      centroid_lng: 75.7875,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toMatch(/encloses no area/i);
  });
});
