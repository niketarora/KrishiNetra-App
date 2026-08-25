import { calculateArea, centroid, toGeoJSON, type LatLng } from '@/utils/geo';

import type { FarmRow } from './database.types';
import { toDataError } from './errors';
import { supabase } from './supabase';

export type Farm = FarmRow;

export type SaveFarmInput = {
  userId: string;
  points: LatLng[];
  name?: string | null;
};

/**
 * Every farm read/write in the app goes through this module. Screens never
 * touch `supabase` directly, so Phase 2 can swap these bodies for calls to the
 * Node/Express API without touching a single component.
 */

/** The farmer's field, or null if they haven't drawn one yet. */
export async function getCurrentFarm(userId: string): Promise<Farm | null> {
  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw toDataError(error, 'home.loadError');
  return data ?? null;
}

/** Derive every stored measurement from the drawn points in one place. */
function toFarmValues({ userId, points, name }: SaveFarmInput) {
  const area = calculateArea(points);
  const centre = centroid(points);

  return {
    user_id: userId,
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
  const { data, error } = await supabase
    .from('farms')
    .insert(toFarmValues(input))
    .select()
    .single();

  if (error) throw toDataError(error, 'onboarding.saveError');
  return data;
}

export async function updateFarmBoundary(farmId: string, input: SaveFarmInput): Promise<Farm> {
  const { user_id: _userId, ...values } = toFarmValues(input);

  const { data, error } = await supabase
    .from('farms')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', farmId)
    .select()
    .single();

  if (error) throw toDataError(error, 'onboarding.saveError');
  return data;
}
