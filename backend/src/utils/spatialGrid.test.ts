import { describe, expect, it } from '@jest/globals';

import type { BoundaryGeoJSON } from './geo.js';
import { generateFarmGrid, haversineDistanceMeters, isPointInPolygon } from './spatialGrid.js';

// Roughly 111m (lat) x 99m (lng) at this latitude — the same rectangle
// `farmPredictions.service.test.ts` uses for its mock farm, so grid sizes
// stay consistent with what the rest of the suite already assumes.
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

describe('isPointInPolygon', () => {
  it('reports true for a point inside the rectangle', () => {
    expect(isPointInPolygon({ lat: 26.9125, lng: 75.7875 }, boundary)).toBe(true);
  });

  it('reports false for a point clearly outside the rectangle', () => {
    expect(isPointInPolygon({ lat: 26.95, lng: 75.9 }, boundary)).toBe(false);
  });

  it('reports false for a point just past the eastern edge', () => {
    expect(isPointInPolygon({ lat: 26.9125, lng: 75.789 }, boundary)).toBe(false);
  });
});

describe('generateFarmGrid', () => {
  it('produces only points that are genuinely inside the polygon', () => {
    const points = generateFarmGrid(boundary, { spacingMeters: 20 });

    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(isPointInPolygon(point, boundary)).toBe(true);
    }
  });

  it('spaces points roughly at the requested interval', () => {
    const points = generateFarmGrid(boundary, { spacingMeters: 20 });
    // ~111m x ~99m at ~20m spacing should yield a handful of rows/columns,
    // not one point and not hundreds.
    expect(points.length).toBeGreaterThanOrEqual(4);
    expect(points.length).toBeLessThan(50);
  });

  it('respects maxCells even when the polygon could fit more', () => {
    const points = generateFarmGrid(boundary, { spacingMeters: 5, maxCells: 10 });
    expect(points.length).toBeLessThanOrEqual(10);
  });

  it('returns no points for a degenerate (too-short) ring', () => {
    const degenerate: BoundaryGeoJSON = { type: 'Polygon', coordinates: [[[75.787, 26.912]]] };
    expect(generateFarmGrid(degenerate)).toEqual([]);
  });
});

describe('haversineDistanceMeters', () => {
  it('returns ~0 for the same point', () => {
    const point = { lat: 26.9125, lng: 75.7875 };
    expect(haversineDistanceMeters(point, point)).toBeCloseTo(0, 3);
  });

  it('returns a plausible distance for two known points ~111m apart in latitude', () => {
    const a = { lat: 26.9120, lng: 75.7875 };
    const b = { lat: 26.9130, lng: 75.7875 };
    const distance = haversineDistanceMeters(a, b);
    // 0.001 degrees of latitude is ~111m.
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(125);
  });
});
