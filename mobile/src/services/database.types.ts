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
  created_at: string;
  updated_at: string;
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
