import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { FarmRow } from '../types/domain.js';

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

const mockPrediction = {
  soil_moisture_percent: 20.53,
  category: 'dry',
  model_version: 'agriculture-baseline-xgb-v1',
  production_ready: false,
  experimental: true,
  recommendation: null,
  warning: 'Experimental baseline only.',
};

const mockGetFarm = jest.fn<any>().mockResolvedValue(mockFarm);
const mockListFarmCrops = jest.fn<any>().mockResolvedValue([
  {
    id: 'fc-1',
    farm_id: 'farm-123',
    user_id: 'user-123',
    crop_id: 'crop-1',
    variety: 'Sharbati',
    sown_on: '2026-08-01',
    expected_harvest_on: null,
    area_acres: 2.47,
    status: 'sown',
    notes: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
]);
const mockListCrops = jest.fn<any>().mockResolvedValue([
  {
    id: 'crop-1',
    code: 'wheat',
    name_en: 'Wheat',
    name_hi: 'गेहूँ',
    category: 'cereal',
    default_unit: 'quintal',
  },
]);
const mockLatestWeatherForDistrict = jest.fn<any>().mockResolvedValue({
  id: 'w-1',
  district: 'Jaipur',
  state: 'Rajasthan',
  grid_lat: 26.75,
  grid_lng: 75.75,
  observed_on: '2026-08-28',
  temperature_c: 31.0,
  rainfall_mm: 5.0,
  humidity_pct: 55,
  wind_speed_kmh: 12.4,
  source: 'ERA5',
});
const mockLatestWeatherForGridCell = jest.fn<any>().mockResolvedValue(null);
const mockGetElevation = jest.fn<any>().mockResolvedValue(431.0);
const mockGetSoilHealth = jest.fn<any>().mockResolvedValue({
  soil_ph: 7.8,
  organic_matter: 0.45,
  soil_type: 'Sandy Loam',
  source: 'ICAR / Soil Health Card',
});
const mockPredictSoilMoisture = jest.fn<any>().mockResolvedValue(mockPrediction);

jest.unstable_mockModule('./farms.service.js', () => ({
  getFarm: mockGetFarm,
}));

jest.unstable_mockModule('./farmCrops.service.js', () => ({
  listFarmCrops: mockListFarmCrops,
}));

jest.unstable_mockModule('./reference.service.js', () => ({
  listCrops: mockListCrops,
  latestWeatherForDistrict: mockLatestWeatherForDistrict,
  latestWeatherForGridCell: mockLatestWeatherForGridCell,
}));

jest.unstable_mockModule('./elevation.service.js', () => ({
  getElevationForCoordinates: mockGetElevation,
}));

jest.unstable_mockModule('./soilHealth.service.js', () => ({
  getSoilHealthByDistrict: mockGetSoilHealth,
}));

jest.unstable_mockModule('./soilMoisturePrediction.service.js', () => ({
  predictSoilMoisture: mockPredictSoilMoisture,
}));

const { getFarmSoilMoisturePrediction } = await import('./farmPredictions.service.js');

describe('getFarmSoilMoisturePrediction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gathers all 14 live input features and returns ML prediction', async () => {
    const result = await getFarmSoilMoisturePrediction('test-token', 'user-123', 'farm-123');

    expect(mockGetFarm).toHaveBeenCalledWith('test-token', 'user-123', 'farm-123');
    expect(mockGetElevation).toHaveBeenCalledWith(26.9125, 75.7875);
    expect(mockGetSoilHealth).toHaveBeenCalledWith('test-token', 'Jaipur', 'Rajasthan');

    expect(result.cropName).toBe('Wheat');
    expect(result.features.crop_type).toBe('wheat');
    expect(result.features.temperature_c).toBe(31.0);
    expect(result.features.rainfall).toBe(5.0);
    expect(result.features.humidity_percent).toBe(55);
    expect(result.features.wind_speed).toBe(12.4);
    expect(result.features.elevation).toBe(431.0);
    expect(result.features.soil_ph).toBe(7.8);
    expect(result.features.organic_matter).toBe(0.45);
    expect(result.features.ndvi).toBeGreaterThan(0);
    expect(result.features.savi).toBeGreaterThan(0);
    expect(result.features.leaf_area_index).toBeGreaterThan(0);
    expect(result.features.spatial_resolution).toBe(10.0);
    expect(result.features.crop_growth_stage).toBe(2);
    expect(result.features.water_flow).toBeGreaterThan(0);

    expect(result.prediction.soil_moisture_percent).toBe(20.53);
  });
});
