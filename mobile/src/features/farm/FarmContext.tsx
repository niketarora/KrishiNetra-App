import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import { createFarm, getCurrentFarm, updateFarmBoundary, type Farm } from '@/services/farms';
import { DataError } from '@/services/errors';
import type { LatLng } from '@/utils/geo';

type FarmContextValue = {
  farm: Farm | null;
  /** True while the farmer's farm is being fetched for the first time. */
  loading: boolean;
  /** Translation key for a load failure, or null. */
  errorKey: string | null;
  refresh: () => Promise<void>;
  /** Creates the farm, or updates the boundary if one already exists. */
  saveBoundary: (points: LatLng[], name?: string | null) => Promise<Farm>;
};

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setFarm(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorKey(null);
    try {
      setFarm(await getCurrentFarm(userId));
    } catch (error) {
      setErrorKey(error instanceof DataError ? error.translationKey : 'home.loadError');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveBoundary = useCallback<FarmContextValue['saveBoundary']>(
    async (points, name) => {
      if (!userId) throw new DataError('errors.sessionRestore');

      const saved = farm
        ? await updateFarmBoundary(farm.id, { userId, points, name: name ?? farm.name })
        : await createFarm({ userId, points, name });

      setFarm(saved);
      setErrorKey(null);
      return saved;
    },
    [farm, userId],
  );

  const value = useMemo<FarmContextValue>(
    () => ({ farm, loading, errorKey, refresh, saveBoundary }),
    [farm, loading, errorKey, refresh, saveBoundary],
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmContextValue {
  const context = useContext(FarmContext);
  if (!context) throw new Error('useFarm must be used inside a FarmProvider.');
  return context;
}
