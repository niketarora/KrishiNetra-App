import {
  areaSquareMeters,
  calculateArea,
  centroid,
  fromGeoJSON,
  isValidPolygon,
  normalizeForThumbnail,
  SQ_METERS_PER_ACRE,
  toAcres,
  toGeoJSON,
  toHectares,
  type LatLng,
} from './geo';

/**
 * A reference square near Karnal, Haryana (29.69°N) — wheat country, and the
 * mandi the design's sample data quotes. At this latitude one degree of
 * longitude is about 96.9 km, so a 0.001° × 0.001° box is roughly 96.9m ×
 * 111.3m ≈ 10,785 m². Anything wildly off that means the projection is wrong.
 */
const KARNAL: LatLng = { latitude: 29.6857, longitude: 76.9905 };

const square = (origin: LatLng, delta: number): LatLng[] => [
  { latitude: origin.latitude, longitude: origin.longitude },
  { latitude: origin.latitude, longitude: origin.longitude + delta },
  { latitude: origin.latitude + delta, longitude: origin.longitude + delta },
  { latitude: origin.latitude + delta, longitude: origin.longitude },
];

describe('isValidPolygon', () => {
  it('rejects boundaries with fewer than three corners', () => {
    expect(isValidPolygon([])).toBe(false);
    expect(isValidPolygon([KARNAL])).toBe(false);
    expect(isValidPolygon([KARNAL, { ...KARNAL, latitude: 29.69 }])).toBe(false);
  });

  it('accepts a triangle', () => {
    expect(isValidPolygon(square(KARNAL, 0.001).slice(0, 3))).toBe(true);
  });
});

describe('toGeoJSON', () => {
  it('emits [longitude, latitude] order, not the map order', () => {
    const geojson = toGeoJSON(square(KARNAL, 0.001));
    const [first] = geojson.coordinates[0];

    // Longitude first. Swapping these silently produces a plausible but wrong
    // area, so this assertion is the guard on the whole area pipeline.
    expect(first[0]).toBeCloseTo(KARNAL.longitude, 6);
    expect(first[1]).toBeCloseTo(KARNAL.latitude, 6);
  });

  it('closes the ring by repeating the first position', () => {
    const ring = toGeoJSON(square(KARNAL, 0.001)).coordinates[0];

    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('does not double-close an already closed ring', () => {
    const points = square(KARNAL, 0.001);
    const closed = [...points, points[0]];

    expect(toGeoJSON(closed).coordinates[0]).toHaveLength(5);
  });

  it('refuses a boundary that cannot enclose an area', () => {
    expect(() => toGeoJSON([KARNAL, { ...KARNAL, latitude: 29.69 }])).toThrow();
  });
});

describe('fromGeoJSON', () => {
  it('round-trips a boundary back to map coordinates', () => {
    const points = square(KARNAL, 0.001);
    const restored = fromGeoJSON(toGeoJSON(points));

    expect(restored).toHaveLength(points.length);
    restored.forEach((point, i) => {
      expect(point.latitude).toBeCloseTo(points[i].latitude, 9);
      expect(point.longitude).toBeCloseTo(points[i].longitude, 9);
    });
  });
});

describe('areaSquareMeters', () => {
  it('measures a known plot to within 1%', () => {
    const area = areaSquareMeters(square(KARNAL, 0.001));

    expect(area).toBeGreaterThan(10_700);
    expect(area).toBeLessThan(10_900);
  });

  it('is geodesic, not planar — a planar shoelace would be badly wrong here', () => {
    const points = square(KARNAL, 0.001);

    // Planar shoelace over raw degrees, treating 1° as 111,320 m in both axes.
    // It ignores the cos(latitude) narrowing of longitude, so at 29.7°N it
    // overstates the area by roughly 15%.
    const planar = 0.001 * 111_320 * (0.001 * 111_320);
    const geodesic = areaSquareMeters(points);

    expect(geodesic).toBeLessThan(planar * 0.92);
  });

  it('returns zero for a boundary with too few corners', () => {
    expect(areaSquareMeters([KARNAL])).toBe(0);
  });

  it('does not depend on the winding direction', () => {
    const points = square(KARNAL, 0.001);
    const reversed = [...points].reverse();

    expect(areaSquareMeters(reversed)).toBeCloseTo(areaSquareMeters(points), 6);
  });

  it('scales with the square of the side length', () => {
    const small = areaSquareMeters(square(KARNAL, 0.001));
    const double = areaSquareMeters(square(KARNAL, 0.002));

    expect(double / small).toBeCloseTo(4, 1);
  });
});

describe('unit conversion', () => {
  it('converts to acres using the international acre', () => {
    expect(toAcres(SQ_METERS_PER_ACRE)).toBeCloseTo(1, 9);
    expect(toAcres(10_000)).toBeCloseTo(2.4710538, 5);
  });

  it('converts to hectares', () => {
    expect(toHectares(10_000)).toBeCloseTo(1, 9);
  });

  it('keeps all three units describing the same plot', () => {
    const area = calculateArea(square(KARNAL, 0.001));

    expect(area.acres).toBeCloseTo(area.squareMeters / SQ_METERS_PER_ACRE, 6);
    expect(area.hectares).toBeCloseTo(area.squareMeters / 10_000, 6);
    // A ~1.08 hectare plot is about 2.67 acres.
    expect(area.acres).toBeGreaterThan(2.6);
    expect(area.acres).toBeLessThan(2.75);
  });
});

describe('centroid', () => {
  it('finds the middle of a square', () => {
    const centre = centroid(square(KARNAL, 0.002));

    expect(centre.latitude).toBeCloseTo(KARNAL.latitude + 0.001, 5);
    expect(centre.longitude).toBeCloseTo(KARNAL.longitude + 0.001, 5);
  });

  it('averages the points when there is no polygon yet', () => {
    const centre = centroid([KARNAL, { latitude: 29.6877, longitude: 76.9905 }]);

    expect(centre.latitude).toBeCloseTo(29.6867, 4);
  });

  it('throws on an empty boundary rather than returning NaN coordinates', () => {
    expect(() => centroid([])).toThrow();
  });
});

describe('normalizeForThumbnail', () => {
  it('maps every point into the unit square', () => {
    const normalized = normalizeForThumbnail(square(KARNAL, 0.001));

    normalized.forEach((point) => {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    });
  });

  it('flips the vertical axis, because SVG y grows downward', () => {
    const points: LatLng[] = [
      { latitude: 29.68, longitude: 76.99 }, // southernmost
      { latitude: 29.69, longitude: 76.99 }, // northernmost
      { latitude: 29.685, longitude: 77.0 },
    ];
    const [south, north] = normalizeForThumbnail(points);

    expect(north.y).toBeLessThan(south.y);
  });

  it('preserves aspect ratio instead of stretching a thin plot', () => {
    // A strip ten times wider than it is tall.
    const strip: LatLng[] = [
      { latitude: 29.685, longitude: 76.99 },
      { latitude: 29.685, longitude: 77.0 },
      { latitude: 29.686, longitude: 77.0 },
      { latitude: 29.686, longitude: 76.99 },
    ];
    const normalized = normalizeForThumbnail(strip);
    const ySpan = Math.max(...normalized.map((p) => p.y)) - Math.min(...normalized.map((p) => p.y));

    // If it were stretched to fill, ySpan would be 1.
    expect(ySpan).toBeLessThan(0.2);
  });

  it('returns nothing for an empty boundary', () => {
    expect(normalizeForThumbnail([])).toEqual([]);
  });
});
