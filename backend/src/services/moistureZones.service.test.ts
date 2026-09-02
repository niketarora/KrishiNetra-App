import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { FarmRow } from '../types/domain.js';

// ---------------------------------------------------------------------------
// Every dependency moistureZones.service.ts pulls in must be mocked BEFORE it
// is imported (ESM static imports execute at module-load time, so importing
// the module under test above these calls would silently use the real
// dependencies instead) — same ordering `farmPredictions.service.test.ts`
// relies on.
// ---------------------------------------------------------------------------

const mockFarm: FarmRow = {
  id: 'farm-123',
  user_id: 'user-123',
  name: 'North Plot',
  boundary: {
    type: 'Polygon',
    coordinates: [[[75.787, 26.912], [75.788, 26.912], [75.788, 26.913], [75.787, 26.913], [75.787, 26.912]]],
  },
  area_sq_meters: 10000,
  area_acres: 2.47,
  area_hectares: 1.0,
  centroid_lat: 26.9125,
  centroid_lng: 75.7875,
  district: 'Jaipur',
  state: 'Rajasthan',
  location_source: 'gps',
  location_accuracy: 10,
  photo_url: null,
  created_at: '2026-08-30T00:00:00Z',
  updated_at: '2026-08-30T00:00:00Z',
};

const mockGetFarm = jest.fn<any>().mockResolvedValue(mockFarm);
const mockListFarmCrops = jest.fn<any>().mockResolvedValue([]);
const mockListCrops = jest.fn<any>().mockResolvedValue([]);
const mockLatestWeatherForDistrict = jest.fn<any>().mockResolvedValue(null);
const mockLatestWeatherForGridCell = jest.fn<any>().mockResolvedValue(null);
const mockGetSoilHealth = jest.fn<any>().mockResolvedValue({
  soil_ph: 7.2,
  organic_matter: 0.65,
  soil_type: 'Alluvial Loam',
  source: 'ICAR Baseline',
});
const mockGetElevationBatch = jest.fn<any>();
// One fixed prediction per call keeps the average trivially predictable —
// the formula itself is already covered by soilMoisturePrediction.service.test.ts.
const mockCalculateLocalOASSM10 = jest.fn<any>(() => ({ soil_moisture_percent: 20 }));
const mockPredictSoilMoisture = jest.fn<any>().mockRejectedValue(new Error('not connected'));

jest.unstable_mockModule('./farms.service.js', () => ({ getFarm: mockGetFarm }));
jest.unstable_mockModule('./farmCrops.service.js', () => ({ listFarmCrops: mockListFarmCrops }));
jest.unstable_mockModule('./reference.service.js', () => ({
  listCrops: mockListCrops,
  latestWeatherForDistrict: mockLatestWeatherForDistrict,
  latestWeatherForGridCell: mockLatestWeatherForGridCell,
}));
jest.unstable_mockModule('./elevation.service.js', () => ({ getElevationBatch: mockGetElevationBatch }));
jest.unstable_mockModule('./soilHealth.service.js', () => ({ getSoilHealthByDistrict: mockGetSoilHealth }));
jest.unstable_mockModule('./soilMoisturePrediction.service.js', () => ({
  predictSoilMoisture: mockPredictSoilMoisture,
  calculateLocalOASSM10: mockCalculateLocalOASSM10,
}));

const { getFarmMoistureZones, selectDriestTargets } = await import('./moistureZones.service.js');
type CellPrediction = Parameters<typeof selectDriestTargets>[0][number];

describe('selectDriestTargets', () => {
  const generatedAt = '2026-09-03T00:00:00.000Z';

  it('returns targets sorted driest-first', () => {
    const cells: CellPrediction[] = [
      { point: { lat: 26.9120, lng: 75.7870 }, moisturePercent: 30 },
      { point: { lat: 26.9128, lng: 75.7878 }, moisturePercent: 12 },
      { point: { lat: 26.9124, lng: 75.7874 }, moisturePercent: 21 },
    ];

    const targets = selectDriestTargets(cells, {
      maxTargets: 3,
      minSeparationMeters: 20,
      farmAverageMoisturePercent: 21,
      generatedAt,
    });

    expect(targets.map((t) => t.estimatedMoisturePercent)).toEqual([12, 21, 30]);
    expect(targets.map((t) => t.priority)).toEqual([1, 2, 3]);
  });

  it('never returns more than maxTargets', () => {
    const cells: CellPrediction[] = Array.from({ length: 10 }, (_, i) => ({
      // Spread far enough apart (~30m of latitude per step) that separation never filters them.
      point: { lat: 26.9100 + i * 0.0003, lng: 75.7870 },
      moisturePercent: 10 + i,
    }));

    const targets = selectDriestTargets(cells, {
      maxTargets: 3,
      minSeparationMeters: 20,
      farmAverageMoisturePercent: 15,
      generatedAt,
    });

    expect(targets).toHaveLength(3);
  });

  it('enforces the minimum separation between chosen targets', () => {
    const cells: CellPrediction[] = [
      // Driest, at the origin.
      { point: { lat: 26.9120, lng: 75.7870 }, moisturePercent: 10 },
      // ~5.5m north of the driest cell — well under a 20m minimum separation, must be skipped.
      { point: { lat: 26.91205, lng: 75.7870 }, moisturePercent: 11 },
      // Far enough away (~55m) to be accepted.
      { point: { lat: 26.9125, lng: 75.7870 }, moisturePercent: 12 },
    ];

    const targets = selectDriestTargets(cells, {
      maxTargets: 3,
      minSeparationMeters: 20,
      farmAverageMoisturePercent: 11,
      generatedAt,
    });

    expect(targets.map((t) => t.estimatedMoisturePercent)).toEqual([10, 12]);
  });

  it('labels each target relative to the farm average, never inventing a fixed threshold', () => {
    const cells: CellPrediction[] = [
      { point: { lat: 26.9120, lng: 75.7870 }, moisturePercent: 15 },
      { point: { lat: 26.9130, lng: 75.7870 }, moisturePercent: 25 },
    ];

    const targets = selectDriestTargets(cells, {
      maxTargets: 2,
      minSeparationMeters: 20,
      farmAverageMoisturePercent: 20,
      generatedAt,
    });

    expect(targets[0]?.relativeStatus).toBe('LOWER_THAN_FARM_AVERAGE');
    expect(targets[1]?.relativeStatus).toBe('NEAR_FARM_AVERAGE');
  });

  it('marks every target with the honest prototype provenance, never a measured-data claim', () => {
    const cells: CellPrediction[] = [{ point: { lat: 26.9120, lng: 75.7870 }, moisturePercent: 10 }];

    const targets = selectDriestTargets(cells, {
      maxTargets: 1,
      minSeparationMeters: 20,
      farmAverageMoisturePercent: 10,
      generatedAt,
    });

    expect(targets[0]?.source).toBe('prototype_spatial_estimate');
    expect(targets[0]?.provenance).toBe('existing_krishinetra_moisture_engine');
  });
});

// ---------------------------------------------------------------------------
// Service-level wiring: farm ownership, and that the farm average matches the
// mean of the (mocked) per-cell predictions. Full weather/crop/soil-health
// resolution is exercised already by farmPredictions.service.test.ts and
// reused unchanged here, so this focuses on what is new.
// ---------------------------------------------------------------------------

describe('getFarmMoistureZones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFarm.mockResolvedValue(mockFarm);
    mockListFarmCrops.mockResolvedValue([]);
    mockListCrops.mockResolvedValue([]);
    mockLatestWeatherForDistrict.mockResolvedValue(null);
    mockLatestWeatherForGridCell.mockResolvedValue(null);
    mockGetSoilHealth.mockResolvedValue({
      soil_ph: 7.2,
      organic_matter: 0.65,
      soil_type: 'Alluvial Loam',
      source: 'ICAR Baseline',
    });
    mockPredictSoilMoisture.mockRejectedValue(new Error('not connected'));
    mockCalculateLocalOASSM10.mockImplementation(() => ({ soil_moisture_percent: 20 }));
    mockGetElevationBatch.mockImplementation((points: Array<{ lat: number; lng: number }>) =>
      Promise.resolve(points.map(() => 350.0)),
    );
  });

  it('propagates a not-found error for a farm the caller does not own, same as the farm-level endpoint', async () => {
    const { ApiError } = await import('../utils/ApiError.js');
    mockGetFarm.mockRejectedValueOnce(ApiError.notFound('No such field.'));

    await expect(getFarmMoistureZones('token', 'user-123', 'someone-elses-farm')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('labels the response as a prototype estimate and computes the farm average from the cells', async () => {
    const result = await getFarmMoistureZones('token', 'user-123', 'farm-123');

    expect(result.farmId).toBe('farm-123');
    expect(result.method).toBe('prototype_spatial_estimate');
    expect(result.provenance).toBe('existing_krishinetra_moisture_engine');
    expect(result.gridSpacingMeters).toBe(20);
    expect(result.cellCount).toBeGreaterThan(0);
    // Every cell resolves to the same mocked 20% prediction, so the average must be exactly 20.
    expect(result.farmAverageMoisturePercent).toBe(20);
    expect(result.targets.length).toBeGreaterThan(0);
    expect(result.targets.length).toBeLessThanOrEqual(3);
  });
});
