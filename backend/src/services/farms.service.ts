import { userClient } from '../config/supabase.js';
import type { CreateFarmBody, UpdateFarmBody } from '../schemas/farm.schema.js';
import { type FarmRow, toNumber } from '../types/domain.js';
import { ApiError } from '../utils/ApiError.js';
import { deriveAndVerify } from '../utils/geo.js';

/**
 * Every query here runs through a client carrying the farmer's own token, so
 * RLS scopes it to their rows before any code in this file runs. The explicit
 * `user_id` filters and ownership checks are the second layer, not the first.
 */

/** PostgREST returns numerics as strings; normalise before they leave. */
function normalise(row: Record<string, unknown>): FarmRow {
  return {
    ...(row as unknown as FarmRow),
    area_sq_meters: toNumber(row.area_sq_meters),
    area_acres: toNumber(row.area_acres),
    area_hectares: toNumber(row.area_hectares),
    centroid_lat: toNumber(row.centroid_lat),
    centroid_lng: toNumber(row.centroid_lng),
  };
}

export async function listFarms(
  token: string,
  userId: string,
  limit?: number,
): Promise<FarmRow[]> {
  let query = userClient(token)
    .from('farms')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map(normalise);
}

export async function getFarm(token: string, userId: string, farmId: string): Promise<FarmRow> {
  const { data, error } = await userClient(token)
    .from('farms')
    .select('*')
    .eq('id', farmId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  // A farm belonging to someone else is indistinguishable from one that does
  // not exist. A 403 here would confirm the row is real.
  if (!data) throw ApiError.notFound('No such field.');

  return normalise(data);
}

/**
 * Re-derive the geometry and reject a payload whose numbers do not match the
 * polygon. The stored row always carries the server's figures, never the
 * client's, even when the two agree.
 */
function verifiedValues(body: CreateFarmBody | UpdateFarmBody) {
  const check = deriveAndVerify(body.boundary, {
    area_sq_meters: body.area_sq_meters,
    area_acres: body.area_acres,
    area_hectares: body.area_hectares,
    centroid_lat: body.centroid_lat,
    centroid_lng: body.centroid_lng,
  });

  if (!check.ok) throw ApiError.invalidRequest(check.reason);

  return {
    name: body.name?.trim() ? body.name.trim() : null,
    boundary: body.boundary,
    ...check.values,
  };
}

export async function createFarm(
  token: string,
  userId: string,
  body: CreateFarmBody,
): Promise<FarmRow> {
  const { data, error } = await userClient(token)
    .from('farms')
    // user_id comes from the verified token. The schema refuses it in the body.
    .insert({ user_id: userId, ...verifiedValues(body) })
    .select()
    .single();

  if (error) throw error;
  return normalise(data);
}

export async function updateFarm(
  token: string,
  userId: string,
  farmId: string,
  body: UpdateFarmBody,
): Promise<FarmRow> {
  // Confirms ownership before the write, so a missing row is reported as a 404
  // rather than as an update that silently affected nothing.
  await getFarm(token, userId, farmId);

  const { data, error } = await userClient(token)
    .from('farms')
    .update(verifiedValues(body))
    .eq('id', farmId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return normalise(data);
}
