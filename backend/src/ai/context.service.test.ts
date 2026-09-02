import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockProfile = {
  id: 'user-123',
  full_name: 'Niket Arora',
  phone: '+919876543210',
  email: 'niket@example.com',
  language: 'hi',
  location_city: 'Pratapgarh',
  location_district: 'Pratapgarh',
  location_state: 'Rajasthan',
  location_source: 'gps' as const,
  in_app_alerts: true,
  sms_alerts: true,
  voice_alerts: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockFarm = {
  id: 'farm-123',
  user_id: 'user-123',
  name: 'My Main Farm',
  boundary: { type: 'Polygon' as const, coordinates: [[[74.78, 24.03], [74.79, 24.03], [74.79, 24.04], [74.78, 24.04], [74.78, 24.03]]] },
  area_sq_meters: 20841,
  area_acres: 5.15,
  area_hectares: 2.08,
  centroid_lat: 24.035,
  centroid_lng: 74.785,
  district: 'Pratapgarh',
  state: 'Rajasthan',
  location_source: 'gps',
  location_accuracy: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPlanting = {
  id: 'planting-123',
  farm_id: 'farm-123',
  user_id: 'user-123',
  crop_id: 'crop-barley',
  variety: 'RD 2552',
  sown_on: '2026-06-01',
  expected_harvest_on: '2026-10-15',
  area_acres: 5.15,
  status: 'growing' as const,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockCropCatalog = [
  { id: 'crop-barley', code: 'barley', name_en: 'Barley', name_hi: 'जौ', category: 'cereal', default_unit: 'quintal', created_at: '', updated_at: '' },
];

const mockSoilHealth = {
  id: 'sh-1',
  state: 'Rajasthan',
  district: 'Pratapgarh',
  soil_type: 'Medium Black Loam',
  soil_ph: 7.4,
  organic_matter: 0.62,
  source: 'ICAR Baseline',
};

const mockPrediction = {
  prediction: {
    volumetric_moisture_m3_m3: 0.3403,
    soil_moisture_percent: 34.03,
    category: 'optimal',
    irrigation_recommendation: 'optimal_monitor',
    confidence: 0.96,
    model_version: 'oassm-10-transformer-v4',
    sensor_resolution_m: 10,
    sar_backscatter_db: { vv: -12.5, vh: -19.8, vh_minus_vv: -7.3, incidence_angle_deg: 38.5 },
    topographic_wetness_index: 7.8,
    is_production_grade: true,
  },
  features: {} as any,
  cropName: 'Barley',
};

const mockSchemes = [
  { row_id: 'pm-kisan', name: 'PM-KISAN', short_title: 'PM-KISAN', category: 'Income Support', scheme_scope: 'CENTRAL' as const, summary: '₹6000 annual payment', reasonKey: 'schemes.reasons.broadlyApplicable' },
];

jest.unstable_mockModule('../services/profiles.service.js', () => ({
  getProfile: jest.fn<any>().mockResolvedValue(mockProfile),
}));

jest.unstable_mockModule('../services/farms.service.js', () => ({
  listFarms: jest.fn<any>().mockResolvedValue([mockFarm]),
}));

jest.unstable_mockModule('../services/farmCrops.service.js', () => ({
  listFarmCrops: jest.fn<any>().mockResolvedValue([mockPlanting]),
}));

jest.unstable_mockModule('../services/reference.service.js', () => ({
  listCrops: jest.fn<any>().mockResolvedValue(mockCropCatalog),
  latestWeatherForGridCell: jest.fn<any>().mockResolvedValue({
    observed_on: '2026-09-01',
    temperature_c: 32.5,
    rainfall_mm: 5.0,
    humidity_pct: 60,
    source: 'Open-Meteo',
  }),
  listMsp: jest.fn<any>().mockResolvedValue([{ price_per_quintal: 1980, marketing_year: '2025-26', source: 'CACP' }]),
  listMarketPrices: jest.fn<any>().mockResolvedValue([{ mandi_id: 'm-1', crop_id: 'crop-barley', modal_price: 2150, min_price: 2000, max_price: 2250, price_date: '2026-08-29', source: 'AGMARKNET' }]),
}));

jest.unstable_mockModule('../services/soilHealth.service.js', () => ({
  getSoilHealthByDistrict: jest.fn<any>().mockResolvedValue(mockSoilHealth),
}));

jest.unstable_mockModule('../services/farmPredictions.service.js', () => ({
  getFarmSoilMoisturePrediction: jest.fn<any>().mockResolvedValue(mockPrediction),
}));

jest.unstable_mockModule('../services/schemes.service.js', () => ({
  listSchemes: jest.fn<any>().mockResolvedValue(mockSchemes),
}));

const { buildFarmerContext } = await import('./context.service.js');

describe('buildFarmerContext', () => {
  it('assembles complete profile, multi-land, soil health, satellite soil moisture, and schemes', async () => {
    const ctx = await buildFarmerContext('fake-token', 'user-123');

    expect(ctx.farmerName).toBe('Niket Arora');
    expect(ctx.phone).toBe('+919876543210');
    expect(ctx.location?.district).toBe('Pratapgarh');
    expect(ctx.location?.state).toBe('Rajasthan');

    expect(ctx.field?.name).toBe('My Main Farm');
    expect(ctx.field?.areaAcres).toBe(5.15);
    expect(ctx.fields).toHaveLength(1);

    expect(ctx.crop?.name).toBe('Barley');
    expect(ctx.crop?.variety).toBe('RD 2552');
    expect(ctx.crop?.growthStage).toBeDefined();

    expect(ctx.soilHealth?.soilType).toBe('Medium Black Loam');
    expect(ctx.soilHealth?.soilPh).toBe(7.4);

    expect(ctx.soilMoisture?.moisturePercent).toBe(34.03);
    expect(ctx.soilMoisture?.category).toBe('optimal');

    expect(ctx.schemes).toHaveLength(1);
    expect(ctx.schemes?.[0].name).toBe('PM-KISAN');

    expect(ctx.msp?.pricePerQuintal).toBe(1980);
    expect(ctx.marketPrice?.modalPrice).toBe(2150);
  });
});
