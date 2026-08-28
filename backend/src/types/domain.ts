import type { BoundaryGeoJSON } from '../utils/geo.js';

/**
 * Hand-written to match `supabase/migrations/0001_phase1_schema.sql` and
 * `0002_phase2_schema.sql`.
 *
 * There is no monorepo, so this is a second copy of the row shapes that
 * `mobile/src/services/database.types.ts` also declares. When the schema
 * changes, update the migration, this file and the mobile copy together — the
 * same rule that file already carries.
 */

export type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  language: string;
  created_at: string;
  updated_at: string;
};

export type FarmRow = {
  id: string;
  user_id: string;
  name: string | null;
  boundary: BoundaryGeoJSON;
  area_sq_meters: number;
  area_acres: number;
  area_hectares: number;
  centroid_lat: number;
  centroid_lng: number;
  /**
   * Resolved from the centroid by reverse geocoding (0004). Null when the
   * lookup failed or the farm predates it — which keeps weather unavailable
   * for that farm rather than guessing a district for it.
   */
  district: string | null;
  state: string | null;
  location_source: string | null;
  created_at: string;
  updated_at: string;
};

export type CropRow = {
  id: string;
  code: string;
  name_en: string;
  name_hi: string | null;
  category: string | null;
  default_unit: string;
  created_at: string;
  updated_at: string;
};

export type FarmCropStatus = 'planned' | 'sown' | 'growing' | 'harvested';

export type FarmCropRow = {
  id: string;
  farm_id: string;
  user_id: string;
  crop_id: string;
  variety: string | null;
  sown_on: string | null;
  expected_harvest_on: string | null;
  area_acres: number | null;
  status: FarmCropStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MandiRow = {
  id: string;
  code: string;
  name: string;
  district: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketPriceRow = {
  id: string;
  mandi_id: string;
  crop_id: string;
  variety: string | null;
  grade: string | null;
  price_date: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number;
  arrivals_tonnes: number | null;
  source: string;
  created_at: string;
};

export type MspRow = {
  id: string;
  crop_id: string;
  season: string;
  marketing_year: string;
  price_per_quintal: number;
  effective_from: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type WeatherRow = {
  id: string;
  district: string;
  state: string;
  observed_on: string;
  temperature_c: number | null;
  rainfall_mm: number | null;
  humidity_pct: number | null;
  source: string;
  created_at: string;
};

/**
 * PostgREST returns `numeric` columns as strings. Every numeric field is
 * normalised on the way out so a client never has to guess which it got.
 */
export function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return toNumber(value);
}
