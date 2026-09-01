import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resetEnvCache } from '../config/env.js';
import type { OASSMSoilMoistureBody } from '../schemas/prediction.schema.js';
import { predictSoilMoisture } from './soilMoisturePrediction.service.js';

const features: OASSMSoilMoistureBody = {
  angle: 38.5,
  vv: -11.2,
  vh: -17.8,
  vh_minus_vv: -6.6,
  sentinel2_b2: 0.045,
  sentinel2_b8a: 0.280,
  sentinel2_b11: 0.195,
  sentinel2_b12: 0.110,
  landsat_b2: 0.050,
  landsat_b7: 0.120,
  landsat_b10: 298.5,
  ndvi: 0.55,
  ndmi: 0.22,
  savi: 0.40,
  s2_lag: 2.0,
  landsat_lag: 4.0,
  day_sin: 0.5,
  day_cos: 0.866,
  dsm: 350.0,
  slope: 2.5,
  twi_proxy: 7.8,
  aspect_sin: 0.0,
  aspect_cos: 1.0,
  temperature_c: 28.0,
  humidity_percent: 65.0,
  rainfall: 18.0,
  wind_speed: 3.0,
  soil_ph: 6.5,
  organic_matter: 2.0,
  leaf_area_index: 1.8,
  spatial_resolution: 10.0,
  crop_growth_stage: 2,
  crop_type: 'wheat',
  climate_zone: 'BSh',
  soil_texture: 'loam',
  land_cover: 'cropland',
};

const prediction = {
  volumetric_moisture_m3_m3: 0.225,
  soil_moisture_percent: 22.5,
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

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  delete process.env.ML_SERVICE_URL;
  delete process.env.ML_SERVICE_API_KEY;
  resetEnvCache();
  jest.restoreAllMocks();
});

describe('predictSoilMoisture', () => {
  it('reports an unconfigured service honestly without making a request', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(predictSoilMoisture(features)).rejects.toMatchObject({
      code: 'SERVICE_NOT_CONNECTED',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards the multi-sensor feature contract and internal key', async () => {
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:8000/';
    process.env.ML_SERVICE_API_KEY = 'shared-secret';
    resetEnvCache();
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: prediction }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(predictSoilMoisture(features)).resolves.toEqual(prediction);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/predict/soil-moisture',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Internal-Key': 'shared-secret' }),
        body: JSON.stringify(features),
      }),
    );
  });

  it('maps upstream failures to the safe service-not-connected error', async () => {
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:8000';
    resetEnvCache();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));

    await expect(predictSoilMoisture(features)).rejects.toMatchObject({
      code: 'SERVICE_NOT_CONNECTED',
    });
  });
});
