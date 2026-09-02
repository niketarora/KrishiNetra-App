import { useMemo } from 'react';

import type { LatLng } from '@/utils/geo';

import { buildDemoTargets } from './demoTargets';
import type { MoistureTarget } from './types';

export type MoistureTargetsResult = {
  targets: MoistureTarget[];
  loading: boolean;
};

/**
 * The single seam between the AR screen and wherever targets come from.
 * Today this always resolves to demo targets (see `demoTargets.ts`) — no
 * `GET /api/v1/farms/:farmId/moisture-zones` endpoint exists yet (KrishiNetra's
 * soil-moisture model only produces one scalar per farm, not spatial zones).
 * When that endpoint exists, only this hook's body needs to change to fetch
 * it (falling back to `buildDemoTargets` on failure/offline, same as
 * today) — `ARMoistureGuidanceScreen.tsx` and all the distance/bearing/
 * heading math consume `MoistureTarget[]` either way and never need to know
 * which source produced it.
 */
export function useMoistureTargets(farmCenter: LatLng | null): MoistureTargetsResult {
  const targets = useMemo(
    () => (farmCenter ? buildDemoTargets(farmCenter) : []),
    [farmCenter?.latitude, farmCenter?.longitude],
  );

  return { targets, loading: false };
}
