import { calculateArea, centroid, toGeoJSON, type LatLng } from '@/utils/geo';

import { apiFetch, asNumber } from './api';
import type { FarmRow } from './database.types';

export type Farm = FarmRow;

export type SaveFarmInput = {
  userId: string;
  points: LatLng[];
  name?: string | null;
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
  };
}

/**
 * The farmer's field, or null if they haven't drawn one yet.
 *
 * `userId` is no longer used to filter — the access token identifies the caller
 * and the API only ever returns that farmer's own rows. It stays in the
 * signature so every calling context is untouched.
 */
export async function getCurrentFarm(_userId: string): Promise<Farm | null> {
  const farms = await apiFetch<Farm[]>('/api/v1/farms?limit=1', {
    fallbackKey: 'home.loadError',
  });

  const farm = farms[0];
  return farm ? normalise(farm) : null;
}

/**
 * Derive every stored measurement from the drawn points in one place.
 *
 * The server recomputes all of this from the boundary and rejects the request
 * if the two disagree by more than 1%, so these numbers are what the map showed
 * the farmer rather than what the database ends up trusting.
 */
function toFarmValues({ points, name }: SaveFarmInput) {
  const area = calculateArea(points);
  const centre = centroid(points);

  return {
    name: name?.trim() ? name.trim() : null,
    boundary: toGeoJSON(points),
    area_sq_meters: area.squareMeters,
    area_acres: area.acres,
    area_hectares: area.hectares,
    centroid_lat: centre.latitude,
    centroid_lng: centre.longitude,
  };
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
