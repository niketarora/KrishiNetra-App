import { calculateArea, centroid, toGeoJSON, type LatLng } from '@/utils/geo';

import { apiFetch, asNumber } from './api';
import type { FarmRow } from './database.types';

export type Farm = FarmRow;

export type SaveFarmInput = {
  userId: string;
  points: LatLng[];
  name?: string | null;
  location_accuracy?: number | null;
};

/**
 * Every farm read/write in the app goes through this module. Screens never
 * touch the network directly.
 *
 * Since Phase 2 these call the Node/Express API rather than Supabase. The
 * exported signatures are unchanged, so no screen or context needed editing.
 */

/** The backend returns numbers, but coerce anyway — a screen must never divide a string. */
function normalise(farm: Farm): Farm {
  return {
    ...farm,
    area_sq_meters: asNumber(farm.area_sq_meters),
    area_acres: asNumber(farm.area_acres),
    area_hectares: asNumber(farm.area_hectares),
    centroid_lat: asNumber(farm.centroid_lat),
    centroid_lng: asNumber(farm.centroid_lng),
    location_accuracy:
      farm.location_accuracy !== null && farm.location_accuracy !== undefined
        ? asNumber(farm.location_accuracy)
        : null,
  };
}

/**
 * Every field the farmer has registered, newest first.
 *
 * `getCurrentFarm` above stays `limit=1` for every screen that only ever
 * concerns itself with "the" farm (Home, Field, Market — the app has no
 * global active-farm switcher). Krishi Updates is the first surface that
 * genuinely needs to know about more than one field, so it calls this
 * instead rather than the whole app growing a multi-farm concept it does not
 * need yet.
 */
export async function listFarms(): Promise<Farm[]> {
  const farms = await apiFetch<Farm[]>('/api/v1/farms', { fallbackKey: 'home.loadError' });
  return farms.map(normalise);
}

/**
 * Derive every stored measurement from the drawn points in one place.
 *
 * The server recomputes all of this from the boundary and rejects the request
 * if the two disagree by more than 1%, so these numbers are what the map showed
 * the farmer rather than what the database ends up trusting.
 */
function toFarmValues({ points, name, location_accuracy }: SaveFarmInput) {
  const area = calculateArea(points);
  const centre = centroid(points);

  const values: Record<string, unknown> = {
    name: name?.trim() ? name.trim() : null,
    boundary: toGeoJSON(points),
    area_sq_meters: area.squareMeters,
    area_acres: area.acres,
    area_hectares: area.hectares,
    centroid_lat: centre.latitude,
    centroid_lng: centre.longitude,
  };

  if (location_accuracy !== undefined) {
    values.location_accuracy = location_accuracy;
  }

  return values;
}

export async function createFarm(input: SaveFarmInput): Promise<Farm> {
  const farm = await apiFetch<Farm>('/api/v1/farms', {
    method: 'POST',
    body: toFarmValues(input),
    fallbackKey: 'onboarding.saveError',
  });

  return normalise(farm);
}

export async function updateFarmBoundary(farmId: string, input: SaveFarmInput): Promise<Farm> {
  const farm = await apiFetch<Farm>(`/api/v1/farms/${farmId}`, {
    method: 'PATCH',
    body: toFarmValues(input),
    fallbackKey: 'onboarding.saveError',
  });

  return normalise(farm);
}

export async function updateLandName(farmId: string, name: string | null): Promise<Farm> {
  const farm = await apiFetch<Farm>(`/api/v1/farms/${farmId}`, {
    method: 'PATCH',
    body: { name: name?.trim() ? name.trim() : null },
    fallbackKey: 'onboarding.saveError',
  });

  return normalise(farm);
}

export async function deleteFarm(farmId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/farms/${farmId}`, {
    method: 'DELETE',
    fallbackKey: 'home.loadError',
  });
}
