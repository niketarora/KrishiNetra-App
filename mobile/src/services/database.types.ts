import type { BoundaryGeoJSON } from '@/utils/geo';

/**
 * Hand-written to match `supabase/migrations/0001_phase1_schema.sql`.
 * When the schema changes, regenerate or update both together.
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
   * Resolved from the centroid by the API when the boundary is saved (0004).
   * Null when the lookup failed, which is why weather can be unavailable for a
   * field that otherwise looks complete.
   */
  district: string | null;
  state: string | null;
  location_source: string | null;
  location_accuracy: number | null;
  created_at: string;
  updated_at: string;
};

/** The crop catalogue row, as `/api/v1/crops` returns it. */
export type CropRow = {
  id: string;
  code: string;
  name_en: string;
  name_hi: string | null;
  category: string | null;
  default_unit: string;
};

export type FarmCropStatus = 'planned' | 'sown' | 'growing' | 'harvested';

/** A crop planted on a field, from `/api/v1/farms/:farmId/crops`. */
export type FarmCropRow = {
  id: string;
  farm_id: string;
  crop_id: string;
  variety: string | null;
  sown_on: string | null;
  expected_harvest_on: string | null;
  area_acres: number | null;
  status: FarmCropStatus;
  notes: string | null;
};

/** Minimum Support Price, rupees per quintal, from `/api/v1/msp`. */
export type MspRow = {
  id: string;
  crop_id: string;
  season: string;
  marketing_year: string;
  price_per_quintal: number;
  effective_from: string | null;
  source: string;
};

/** One observed daily reading, from `/api/v1/weather`. */
export type WeatherRow = {
  id: string;
  grid_lat: number;
  grid_lng: number;
  district: string | null;
  state: string | null;
  observed_on: string;
  temperature_c: number | null;
  rainfall_mm: number | null;
  humidity_pct: number | null;
  source: string;
};

export type FarmInsert = Omit<FarmRow, 'id' | 'created_at' | 'updated_at'>;
export type FarmUpdate = Partial<Omit<FarmRow, 'id' | 'user_id' | 'created_at'>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<Omit<ProfileRow, 'id'>>;
        Relationships: [];
      };
      farms: {
        Row: FarmRow;
        Insert: FarmInsert;
        Update: FarmUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
