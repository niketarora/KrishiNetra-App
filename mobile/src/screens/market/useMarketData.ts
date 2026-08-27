import { useCallback, useEffect, useState } from 'react';

import {
  getCurrentCrop,
  getLatestMsp,
  listMarketPrices,
  type CurrentCrop,
  type MarketPrice,
  type Msp,
} from '@/services/agronomy';

export type MarketData = {
  crop: CurrentCrop | null;
  prices: MarketPrice[];
  msp: Msp | null;
  loading: boolean;
  errorKey: string | null;
  refresh: () => Promise<void>;
};

/**
 * Everything the Market screen shows, for the crop the farmer is growing.
 *
 * Prices come back newest-first, so `prices[0]` is the latest observation and
 * the rest are the history the trend needs. Both can legitimately be empty —
 * no crop recorded, or nothing ingested for that crop yet — and the screen
 * says so rather than showing a number from somewhere else.
 */
export function useMarketData(farmId: string | null): MarketData {
  const [crop, setCrop] = useState<CurrentCrop | null>(null);
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [msp, setMsp] = useState<Msp | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!farmId) {
      setCrop(null);
      setPrices([]);
      setMsp(null);
      return;
    }

    setLoading(true);
    setErrorKey(null);

    try {
      const current = await getCurrentCrop(farmId);
      setCrop(current);

      if (!current) {
        setPrices([]);
        setMsp(null);
        return;
      }

      // Settled rather than all: MSP is seeded and reliable, prices depend on
      // ingestion having run. One missing must not blank the other.
      const [priceResult, mspResult] = await Promise.allSettled([
        listMarketPrices(current.crop.code),
        getLatestMsp(current.crop.code),
      ]);

      setPrices(priceResult.status === 'fulfilled' ? priceResult.value : []);
      setMsp(mspResult.status === 'fulfilled' ? mspResult.value : null);
    } catch {
      // A real transport failure, as opposed to an empty result. The farmer is
      // told the screen could not load rather than shown an empty one that
      // implies their crop has no market.
      setErrorKey('market.loadError');
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { crop, prices, msp, loading, errorKey, refresh: load };
}

/**
 * The gap between what the mandi paid and the guaranteed floor.
 *
 * Returned as a signed rupee figure so the caller picks the wording. This is
 * arithmetic on two recorded numbers, not a prediction — it says what the
 * market did, never what it will do.
 */
export function compareToMsp(price: MarketPrice | null, msp: Msp | null): number | null {
  if (!price || !msp) return null;
  return price.modal_price - msp.price_per_quintal;
}
