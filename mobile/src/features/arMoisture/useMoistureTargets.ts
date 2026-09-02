import { useEffect, useState } from 'react';

import type { LatLng } from '@/utils/geo';
import { getFarmMoistureZones, type MoistureZoneTarget } from '@/services/predictions';
import { isDemoMode } from '@/features/demo/demoMode';

import { buildDemoTargets } from './demoTargets';
import type { MoistureTarget } from './types';

export type MoistureTargetsResult = {
  targets: MoistureTarget[];
  loading: boolean;
  /**
   * True once a real fetch attempt has finished (successfully or not) with no
   * usable spatial targets. The screen uses this to show an honest "estimate
   * unavailable" state instead of silently falling back to anything —
   * `demoTargets.ts` only ever appears when `EXPO_PUBLIC_DEMO_MODE` is on,
   * never automatically for a real farmer in a real build.
   */
  unavailable: boolean;
};

function toMoistureTarget(target: MoistureZoneTarget, index: number): MoistureTarget {
  const isLower = target.relativeStatus === 'LOWER_THAN_FARM_AVERAGE';
  return {
    id: target.id,
    label: isLower ? 'Lower moisture area' : 'Sampling point',
    latitude: target.center.lat,
    longitude: target.center.lng,
    provenance: { source: 'api', type: 'sampling_target' },
    note: 'Navigate to this area',
    estimatedMoisturePercent: target.estimatedMoisturePercent,
    relativeStatus: target.relativeStatus,
  };
}

/**
 * The single seam between the AR screen and wherever targets come from.
 *
 * Calls `GET /api/v1/farms/:farmId/moisture-zones` (see
 * `backend/src/services/moistureZones.service.ts`) — the same prototype
 * deterministic engine that powers Field Analysis, run once per grid cell
 * instead of once at the farm centroid. On any failure, or when the farm has
 * no valid spatial cells, this deliberately does NOT fall back to fabricated
 * targets: `unavailable` is set instead, and the screen shows an honest
 * "estimate unavailable" state. `buildDemoTargets` only runs when
 * `EXPO_PUBLIC_DEMO_MODE` is explicitly on — a developer/demo escape hatch,
 * never automatic in a normal build (same rule as the rest of the app's demo
 * surfaces, see `features/demo/demoMode.ts`).
 */
export function useMoistureTargets(farmId: string | null, farmCenter: LatLng | null): MoistureTargetsResult {
  const [targets, setTargets] = useState<MoistureTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!farmId || !farmCenter) {
      setTargets([]);
      setLoading(false);
      setUnavailable(false);
      return;
    }

    setLoading(true);
    setUnavailable(false);

    getFarmMoistureZones(farmId)
      .then((zones) => {
        if (cancelled) return;

        if (zones && zones.targets.length > 0) {
          setTargets(zones.targets.map(toMoistureTarget));
          setUnavailable(false);
          return;
        }

        // Real fetch succeeded (or failed) but produced nothing usable.
        if (isDemoMode()) {
          setTargets(buildDemoTargets(farmCenter));
          setUnavailable(false);
        } else {
          setTargets([]);
          setUnavailable(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // farmCenter changes trigger this too (a different farm), but only its
    // identity matters for the request, not object referential equality.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, farmCenter?.latitude, farmCenter?.longitude]);

  return { targets, loading, unavailable };
}
