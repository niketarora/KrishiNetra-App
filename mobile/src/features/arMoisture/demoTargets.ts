import type { LatLng } from '@/utils/geo';

import type { MoistureTarget } from './types';

/**
 * NOT measured soil-moisture zones — see `types.ts`'s header comment.
 * These are placeholder navigation targets ("go look here"), generated as
 * small offsets from the selected farm's own centroid, never derived from
 * any moisture value. `provenance.source: 'demo'` on every entry is how
 * `ARMoistureGuidanceScreen.tsx` knows to show its "DEMO DATA" banner
 * instead of the "AI ESTIMATE" one.
 *
 * Since the spatial-moisture-zones extension, `useMoistureTargets.ts` calls
 * the real `GET /api/v1/farms/:farmId/moisture-zones` endpoint first and
 * only reaches this file as an explicitly-gated developer/demo fallback
 * (`EXPO_PUBLIC_DEMO_MODE === 'true'`) when that call fails or returns no
 * usable cells — never automatically in a normal build. The screen and all
 * the distance/bearing/heading math are written against `MoistureTarget[]`
 * either way and never need to know which source produced it.
 */

const EARTH_RADIUS_M = 6_371_000;

/** Offsets `center` by a small distance north/east, in meters — simple local-flat approximation, fine at farm-plot scale. */
function offset(center: LatLng, metersNorth: number, metersEast: number): LatLng {
  const dLat = (metersNorth / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng =
    (metersEast / (EARTH_RADIUS_M * Math.cos((center.latitude * Math.PI) / 180))) * (180 / Math.PI);
  return { latitude: center.latitude + dLat, longitude: center.longitude + dLng };
}

export function buildDemoTargets(farmCenter: LatLng): MoistureTarget[] {
  const a = offset(farmCenter, 30, 15);
  const b = offset(farmCenter, -18, 24);

  return [
    {
      id: 'demo-target-1',
      label: 'Sampling point A',
      latitude: a.latitude,
      longitude: a.longitude,
      provenance: { source: 'demo', type: 'sampling_target' },
      note: 'Walk here and inspect the soil — no measured reading yet.',
    },
    {
      id: 'demo-target-2',
      label: 'Sampling point B',
      latitude: b.latitude,
      longitude: b.longitude,
      provenance: { source: 'demo', type: 'sampling_target' },
      note: 'Walk here and inspect the soil — no measured reading yet.',
    },
  ];
}
