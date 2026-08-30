import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resetEnvCache } from '../config/env.js';
import type { ExperimentalSoilMoistureBody } from '../schemas/prediction.schema.js';
import { predictSoilMoisture } from './soilMoisturePrediction.service.js';

const features: ExperimentalSoilMoistureBody = {
  ndvi: 0.55,
  savi: 0.4,
  temperature_c: 28,
  humidity_percent: 65,
  rainfall: 18,
  wind_speed: 3,
  soil_ph: 6.5,
  organic_matter: 2,
  leaf_area_index: 1.8,
  water_flow: 20,
  elevation: 550,
  spatial_resolution: 10,
  crop_growth_stage: 2,
  crop_type: 'wheat',
};

const prediction = {
  soil_moisture_percent: 20.04,
  category: 'dry',
  model_version: 'test-experimental-v1',
  production_ready: false,
  experimental: true,
  recommendation: null,
  warning: 'Experimental baseline only. Do not use for irrigation decisions.',
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

  it('forwards the exact feature contract and internal key', async () => {
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

  it('rejects a response that tries to promote the experimental artifact', async () => {
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:8000';
    resetEnvCache();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { ...prediction, production_ready: true, experimental: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(predictSoilMoisture(features)).rejects.toMatchObject({
      code: 'SERVICE_NOT_CONNECTED',
    });
  });

  it('maps upstream failures to the safe service-not-connected error', async () => {
    process.env.ML_SERVICE_URL = 'http://127.0.0.1:8000';
    resetEnvCache();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));

    await expect(predictSoilMoisture(features)).rejects.toMatchObject({
      code: 'SERVICE_NOT_CONNECTED',
      status: 503,
    });
  });
});
