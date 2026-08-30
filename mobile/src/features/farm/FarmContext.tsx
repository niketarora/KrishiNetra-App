import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import {
  createFarm,
  deleteFarm as apiDeleteFarm,
  listFarms,
  updateFarmBoundary,
  updateLandName as apiUpdateLandName,
  type Farm,
} from '@/services/farms';
import { DataError } from '@/services/errors';
import type { LatLng } from '@/utils/geo';

const STORE_KEY_PREFIX = 'krishinetra.selectedLand.';

type FarmContextValue = {
  /** All registered lands for this farmer, ordered newest first. */
  lands: Farm[];
  /** The currently selected land — keeps all existing screen consumers working. */
  farm: Farm | null;
  /** The id of the currently selected land, or null if no lands exist. */
  selectedLandId: string | null;
  /** True while lands are being fetched for the first time. */
  loading: boolean;
  /** Translation key for a load failure, or null. */
  errorKey: string | null;
  refresh: () => Promise<void>;
  /** Switch the active land selection. */
  selectLand: (id: string) => Promise<void>;
  /** Add a new land and select it. */
  addLand: (
    points: LatLng[],
    name?: string | null,
    accuracy?: number | null,
  ) => Promise<Farm>;
  /** Update the name of a specific land. */
  updateLandName: (id: string, name: string | null) => Promise<Farm>;
  /** Delete a land and its cascaded crop records, selecting another land if available. */
  removeLand: (id: string) => Promise<void>;
  /** Edits the SELECTED land's boundary/name, or creates a new one if none selected. */
  saveBoundary: (
    points: LatLng[],
    name?: string | null,
    accuracy?: number | null,
  ) => Promise<Farm>;
};

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [lands, setLands] = useState<Farm[]>([]);
  const [selectedLandId, setSelectedLandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const farm = useMemo(() => {
    if (!selectedLandId) return lands[0] ?? null;
    return lands.find((l) => l.id === selectedLandId) ?? lands[0] ?? null;
  }, [lands, selectedLandId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLands([]);
      setSelectedLandId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorKey(null);
    try {
      const fetchedLands = await listFarms();
      setLands(fetchedLands);

      const storeKey = `${STORE_KEY_PREFIX}${userId}`;
      let targetId: string | null = null;
      try {
        targetId = await SecureStore.getItemAsync(storeKey);
      } catch {
        // SecureStore read failure is non-fatal
      }

      if (targetId && fetchedLands.some((l) => l.id === targetId)) {
        setSelectedLandId(targetId);
      } else {
        const defaultId = fetchedLands[0]?.id ?? null;
        setSelectedLandId(defaultId);
        if (defaultId) {
          try {
            await SecureStore.setItemAsync(storeKey, defaultId);
          } catch {
            // Non-fatal
          }
        }
      }
    } catch (error) {
      setErrorKey(error instanceof DataError ? error.translationKey : 'home.loadError');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectLand = useCallback(
    async (id: string) => {
      setSelectedLandId(id);
      if (userId) {
        try {
          await SecureStore.setItemAsync(`${STORE_KEY_PREFIX}${userId}`, id);
        } catch {
          // Non-fatal
        }
      }
    },
    [userId],
  );

  const addLand = useCallback<FarmContextValue['addLand']>(
    async (points, name, accuracy) => {
      if (!userId) throw new DataError('errors.sessionRestore');

      const saved = await createFarm({
        userId,
        points,
        name: name?.trim() || null,
        location_accuracy: accuracy,
      });

      const nextLands = [saved, ...lands];
      setLands(nextLands);
      setSelectedLandId(saved.id);
      setErrorKey(null);

      if (userId) {
        try {
          await SecureStore.setItemAsync(`${STORE_KEY_PREFIX}${userId}`, saved.id);
        } catch {
          // Non-fatal
        }
      }

      return saved;
    },
    [lands, userId],
  );

  const updateLandName = useCallback<FarmContextValue['updateLandName']>(
    async (id, name) => {
      const updated = await apiUpdateLandName(id, name);
      setLands((prev) => prev.map((l) => (l.id === id ? updated : l)));
      return updated;
    },
    [],
  );

  const removeLand = useCallback<FarmContextValue['removeLand']>(
    async (id) => {
      await apiDeleteFarm(id);
      const nextLands = lands.filter((l) => l.id !== id);
      setLands(nextLands);

      if (selectedLandId === id) {
        const nextSelected = nextLands[0]?.id ?? null;
        setSelectedLandId(nextSelected);
        if (userId) {
          try {
            if (nextSelected) {
              await SecureStore.setItemAsync(`${STORE_KEY_PREFIX}${userId}`, nextSelected);
            } else {
              await SecureStore.deleteItemAsync(`${STORE_KEY_PREFIX}${userId}`);
            }
          } catch {
            // Non-fatal
          }
        }
      }
    },
    [lands, selectedLandId, userId],
  );

  const saveBoundary = useCallback<FarmContextValue['saveBoundary']>(
    async (points, name, accuracy) => {
      if (!userId) throw new DataError('errors.sessionRestore');

      if (!farm) {
        return addLand(points, name, accuracy);
      }

      const resolvedAccuracy = accuracy ?? farm.location_accuracy;
      const updated = await updateFarmBoundary(farm.id, {
        userId,
        points,
        name: name ?? farm.name,
        location_accuracy: resolvedAccuracy,
      });

      setLands((prev) => prev.map((l) => (l.id === farm.id ? updated : l)));
      setErrorKey(null);
      return updated;
    },
    [addLand, farm, userId],
  );

  const value = useMemo<FarmContextValue>(
    () => ({
      lands,
      farm,
      selectedLandId,
      loading,
      errorKey,
      refresh,
      selectLand,
      addLand,
      updateLandName,
      removeLand,
      saveBoundary,
    }),
    [
      lands,
      farm,
      selectedLandId,
      loading,
      errorKey,
      refresh,
      selectLand,
      addLand,
      updateLandName,
      removeLand,
      saveBoundary,
    ],
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmContextValue {
  const context = useContext(FarmContext);
  if (!context) throw new Error('useFarm must be used inside a FarmProvider.');
  return context;
}
