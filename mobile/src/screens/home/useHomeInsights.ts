import { useCallback, useEffect, useState } from 'react';

import {
  getCurrentCrop,
  getLatestMarketPrice,
  getLatestMsp,
  getWeather,
  type CurrentCrop,
  type MarketPrice,
  type Msp,
  type Weather,
} from '@/services/agronomy';
import { getFarmSoilMoisture, type FarmPredictionResult } from '@/services/predictions';

export type HomeInsights = {
  crop: CurrentCrop | null;
  msp: Msp | null;
  weather: Weather | null;
  price: MarketPrice | null;
  soilMoisture: FarmPredictionResult | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

/**
 * Loads the real values the Home dashboard and Field analysis show:
 * the crop in the ground, the MSP for it, latest observed weather, and live ML soil moisture prediction.
 *
 * Every one of them can legitimately be null and each tile renders its established empty state.
 * Nothing here substitutes a placeholder number.
 */
export function useHomeInsights(
  farmId: string | null,
  location?: { latitude: number; longitude: number } | null,
): HomeInsights {
  const [crop, setCrop] = useState<CurrentCrop | null>(null);
  const [msp, setMsp] = useState<Msp | null>(null);
  const [price, setPrice] = useState<MarketPrice | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [soilMoisture, setSoilMoisture] = useState<FarmPredictionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!farmId && !location) {
      setCrop(null);
      setMsp(null);
      setWeather(null);
      setPrice(null);
      setSoilMoisture(null);
      return;
    }

    setLoading(true);

    // Settled, not all: one failing source must not blank the other tiles.
    const [cropResult, weatherResult, soilResult] = await Promise.allSettled([
      farmId ? getCurrentCrop(farmId) : Promise.resolve(null),
      getWeather({
        farmId,
        lat: location?.latitude ?? null,
        lng: location?.longitude ?? null,
      }),
      farmId ? getFarmSoilMoisture(farmId) : Promise.resolve(null),
    ]);

    const currentCrop = cropResult.status === 'fulfilled' ? cropResult.value : null;
    setCrop(currentCrop);
    setWeather(weatherResult.status === 'fulfilled' ? weatherResult.value : null);
    setSoilMoisture(soilResult.status === 'fulfilled' ? soilResult.value : null);

    if (currentCrop) {
      // Both are keyed to the crop, so they can only run once it is known.
      const [mspResult, priceResult] = await Promise.allSettled([
        getLatestMsp(currentCrop.crop.code),
        getLatestMarketPrice(currentCrop.crop.code),
      ]);

      setMsp(mspResult.status === 'fulfilled' ? mspResult.value : null);
      setPrice(priceResult.status === 'fulfilled' ? priceResult.value : null);
    } else {
      setMsp(null);
      setPrice(null);
    }

    setLoading(false);
  }, [farmId, location?.latitude, location?.longitude]);

  useEffect(() => {
    void load();
  }, [load]);

  return { crop, msp, weather, price, soilMoisture, loading, refresh: load };
}
