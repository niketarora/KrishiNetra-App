import { useCallback, useEffect, useState } from 'react';

import { isDemoMode } from '@/features/demo/demoMode';
import type { KrishiUpdate } from '@/features/updates/types';
import { cacheUpdates } from '@/features/updates/updatesCache';
import { DataError } from '@/services/errors';
import { listFarms, type Farm } from '@/services/farms';
import { getUpdates } from '@/services/updates';

export type UpdatesData = {
  farms: Farm[];
  selectedFarmId: string | null;
  selectFarm: (farmId: string) => void;
  updates: KrishiUpdate[];
  loading: boolean;
  errorKey: string | null;
  /**
   * True only when the real feed could not load *and* `EXPO_PUBLIC_DEMO_MODE`
   * is on — the one case the product brief allows the old local sample feed
   * to appear, always behind `SampleBanner`. It is never true just because
   * the real feed came back empty; an honest empty state is not a failure.
   */
  demoFallback: boolean;
  refresh: () => Promise<void>;
};

/**
 * Everything Krishi Updates shows, for one farm at a time.
 *
 * This screen intentionally does not use `FarmContext` — for this feature
 * the farm is only a geographic anchor (its district/state/centroid), not
 * the multi-farm-aware "which field am I managing" concept the rest of the
 * app uses. It keeps its own small, local farm selection here instead:
 * `listFarms()`, first entry, same as before. Changing `selectedFarmId`
 * (via the in-screen farm chips) reloads the feed for that field.
 */
export function useUpdatesData(): UpdatesData {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<KrishiUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [demoFallback, setDemoFallback] = useState(false);

  const loadUpdatesFor = useCallback(async (farmId?: string) => {
    setLoading(true);
    setErrorKey(null);
    setDemoFallback(false);

    try {
      const data = await getUpdates(farmId);
      setUpdates(data);
      cacheUpdates(data);
    } catch (error) {
      setUpdates([]);
      if (isDemoMode()) {
        // Real mode failed; demo mode is on, so fall back to the local
        // sample feed rather than a bare error — always clearly labelled by
        // `SampleBanner` in the screen, never mixed with real results.
        setDemoFallback(true);
      } else {
        setErrorKey(error instanceof DataError ? error.translationKey : 'updates.loadError');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);
    setDemoFallback(false);

    try {
      const list = await listFarms();
      setFarms(list);

      // No registered field yet: still show a feed (national agriculture/
      // agritech updates from the backend) rather than a bare empty state —
      // `getUpdates(undefined)` hits `/api/v1/updates` with no farmId.
      const first = list[0];
      setSelectedFarmId(first?.id ?? null);
      await loadUpdatesFor(first?.id);
    } catch (error) {
      setFarms([]);
      setUpdates([]);
      setLoading(false);
      if (isDemoMode()) {
        setDemoFallback(true);
      } else {
        setErrorKey(error instanceof DataError ? error.translationKey : 'updates.loadError');
      }
    }
  }, [loadUpdatesFor]);

  useEffect(() => {
    void load();
    // Deliberately runs once on mount only — `load` is stable across
    // re-renders (see its own and `loadUpdatesFor`'s dependency arrays).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectFarm = useCallback(
    (farmId: string) => {
      if (farmId === selectedFarmId) return;
      setSelectedFarmId(farmId);
      void loadUpdatesFor(farmId);
    },
    [selectedFarmId, loadUpdatesFor],
  );

  const refresh = useCallback(async () => {
    if (selectedFarmId) {
      await loadUpdatesFor(selectedFarmId);
    } else {
      await load();
    }
  }, [selectedFarmId, loadUpdatesFor, load]);

  return { farms, selectedFarmId, selectFarm, updates, loading, errorKey, demoFallback, refresh };
}
