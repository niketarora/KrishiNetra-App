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
  volumetric_moisture_m3_m3: 0.221,
  soil_moisture_percent: 22.1,
  category: 'moderate',
  irrigation_recommendation: 'irrigate_soon',
  confidence: 0.95,
  model_version: 'oassm-10-transformer-v4',
  sensor_resolution_m: 10,
  sar_backscatter_db: {
    vv: -11.2,
    vh: -17.8,
    vh_minus_vv: -6.6,
    incidence_angle_deg: 38.5,
  },
  topographic_wetness_index: 7.8,
  is_production_grade: true,
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

  it('aggregates OASSM-10 multi-sensor features and returns prediction with crop context', async () => {
    const result = await getFarmSoilMoisturePrediction('token', 'user-123', 'farm-123');

    expect(result.cropName).toBe('Wheat');
    expect(result.prediction).toEqual(mockPrediction);
    expect(result.features.crop_type).toBe('wheat');
    expect(result.features.climate_zone).toBe('BSh');
    expect(result.features.dsm).toBe(431.0);
    expect(result.features.spatial_resolution).toBe(10.0);
    expect(result.features.vv).toBeLessThan(0);
    expect(result.features.vh).toBeLessThan(0);
    expect(mockPredictSoilMoisture).toHaveBeenCalledWith(
      expect.objectContaining({
        crop_type: 'wheat',
        spatial_resolution: 10.0,
      }),
    );
  });
});
