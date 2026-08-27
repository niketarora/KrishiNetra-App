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

export type HomeInsights = {
  crop: CurrentCrop | null;
  msp: Msp | null;
  weather: Weather | null;
  price: MarketPrice | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

/**
 * Loads the three real values the Home dashboard shows beside the field card:
 * the crop in the ground, the MSP for it, and the latest observed weather.
 *
 * Every one of them can legitimately be null — no crop recorded, no MSP
 * published, no observation ingested for the district — and each tile renders
 * its empty state for that. Nothing here substitutes a placeholder number.
 *
 * MSP depends on the crop, so it is fetched second. Weather does not, so it
 * runs alongside and a slow crop lookup never delays it.
 */
export function useHomeInsights(farmId: string | null): HomeInsights {
  const [crop, setCrop] = useState<CurrentCrop | null>(null);
  const [msp, setMsp] = useState<Msp | null>(null);
  const [price, setPrice] = useState<MarketPrice | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!farmId) {
      setCrop(null);
      setMsp(null);
      setWeather(null);
      setPrice(null);
      return;
    }

    setLoading(true);

    // Settled, not all: one failing source must not blank the other tiles.
    const [cropResult, weatherResult] = await Promise.allSettled([
      getCurrentCrop(farmId),
      getWeather(farmId),
    ]);

    const currentCrop = cropResult.status === 'fulfilled' ? cropResult.value : null;
    setCrop(currentCrop);
    setWeather(weatherResult.status === 'fulfilled' ? weatherResult.value : null);

    if (currentCrop) {
      // Both are keyed to the crop, so they can only run once it is known.
      const [mspResult, priceResult] = await Promise.allSettled([
        getLatestMsp(currentCrop.crop.code),
        getLatestMarketPrice(currentCrop.crop.code),
      ]);

      // Neither falls back to a previous crop's figure: that would be the
      // wrong number for this field, wearing the right label.
      setMsp(mspResult.status === 'fulfilled' ? mspResult.value : null);
      setPrice(priceResult.status === 'fulfilled' ? priceResult.value : null);
    } else {
      setMsp(null);
      setPrice(null);
    }

    setLoading(false);
  }, [farmId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { crop, msp, weather, price, loading, refresh: load };
}
