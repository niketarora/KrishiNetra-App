import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import { getFarmSoilMoisturePrediction } from '../services/farmPredictions.service.js';
import { latestWeatherForGridCell } from '../services/reference.service.js';
import { sendOk } from '../utils/apiResponse.js';

export async function getIrrigationAdvice(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { farm_id, crop, latitude, longitude } = req.body as {
    farm_id?: string;
    crop?: string;
    latitude?: number;
    longitude?: number;
  };

  let rainProb = 20;
  let soilMoisturePercent = 35;

  // Try checking real farm soil moisture if farm_id is provided
  if (farm_id) {
    try {
      const result = await getFarmSoilMoisturePrediction(token, userId, farm_id);
      if (result?.prediction?.soil_moisture_percent != null) {
        soilMoisturePercent = result.prediction.soil_moisture_percent;
      }
    } catch {
      // Best effort fallback
    }
  }

  // Try checking real weather if coordinates available
  if (latitude && longitude) {
    try {
      const weather = await latestWeatherForGridCell(token, latitude, longitude);
      if (weather?.rainfall_mm && weather.rainfall_mm > 2) {
        rainProb = 80;
      }
    } catch {
      // Best effort fallback
    }
  }

  const irrigate = soilMoisturePercent < 30 && rainProb < 50;
  const reason = !irrigate
    ? rainProb >= 50
      ? `Rain expected soon (${rainProb}% probability). Irrigation should be postponed.`
      : `Soil moisture (${Math.round(soilMoisturePercent)}%) is currently sufficient for ${crop || 'crop'}.`
    : `Soil moisture is low (${Math.round(soilMoisturePercent)}%) and no significant rain is forecast. Recommended to irrigate.`;

  sendOk(
    res,
    {
      irrigate,
      reason,
      soil_moisture: Math.round(soilMoisturePercent),
      rain_probability: rainProb,
      crop: crop || 'General Crop',
    },
    'Irrigation recommendation generated',
  );
}
