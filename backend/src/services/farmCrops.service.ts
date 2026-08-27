import { userClient } from '../config/supabase.js';
import type { CreateFarmCropBody, UpdateFarmCropBody } from '../schemas/farmCrop.schema.js';
import { type FarmCropRow, toNullableNumber } from '../types/domain.js';
import { ApiError } from '../utils/ApiError.js';

import { getFarm } from './farms.service.js';

/**
 * No mobile screen reads these in Phase 2. They exist so Phase 3 has somewhere
 * to read the farmer's crop and variety from when it builds a price-prediction
 * request.
 */

function normalise(row: Record<string, unknown>): FarmCropRow {
  return {
    ...(row as unknown as FarmCropRow),
    area_acres: toNullableNumber(row.area_acres),
  };
}

export async function listFarmCrops(
  token: string,
  userId: string,
  farmId: string,
): Promise<FarmCropRow[]> {
  // Establishes that the field is the caller's before anything is returned.
  await getFarm(token, userId, farmId);

  const { data, error } = await userClient(token)
    .from('farm_crops')
    .select('*')
    .eq('farm_id', farmId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalise);
}

export async function createFarmCrop(
  token: string,
  userId: string,
  farmId: string,
  body: CreateFarmCropBody,
): Promise<FarmCropRow> {
  await getFarm(token, userId, farmId);

  const { data, error } = await userClient(token)
    .from('farm_crops')
    // farm_id from the path, user_id from the token. Neither is accepted in
    // the body — the schema is strict.
    .insert({ farm_id: farmId, user_id: userId, ...body })
    .select()
    .single();

  if (error) throw error;
  return normalise(data);
}

export async function updateFarmCrop(
  token: string,
  userId: string,
  farmId: string,
  farmCropId: string,
  body: UpdateFarmCropBody,
): Promise<FarmCropRow> {
  await getFarm(token, userId, farmId);

  const { data, error } = await userClient(token)
    .from('farm_crops')
    .update(body)
    .eq('id', farmCropId)
    .eq('farm_id', farmId)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw ApiError.notFound('No such crop on that field.');

  return normalise(data);
}
