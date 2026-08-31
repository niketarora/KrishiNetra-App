import { userClient } from '../config/supabase.js';
import type { SoilHealthReferenceRow } from '../types/domain.js';
import { toNumber } from '../types/domain.js';

export type SoilHealthData = {
  soil_ph: number;
  organic_matter: number;
  soil_type: string;
  source: string;
};

const NATIONAL_SOIL_BASELINE: SoilHealthData = {
  soil_ph: 7.2,
  organic_matter: 0.65,
  soil_type: 'Alluvial Loam',
  source: 'ICAR National Baseline',
};

/**
 * Resolves soil pH, organic matter %, and soil classification for a farm
 * from the ICAR / Government of India Soil Health Card (SHC) reference database.
 */
export async function getSoilHealthByDistrict(
  token: string,
  district?: string | null,
  state?: string | null,
): Promise<SoilHealthData> {
  if (!district && !state) {
    return NATIONAL_SOIL_BASELINE;
  }

  try {
    const client = userClient(token);

    // 1. Try exact district match
    if (district) {
      const { data, error } = await client
        .from('soil_health_reference')
        .select('*')
        .ilike('district', district.trim())
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const row = data as unknown as SoilHealthReferenceRow;
        return {
          soil_ph: toNumber(row.soil_ph_mean),
          organic_matter: toNumber(row.organic_matter_pct),
          soil_type: row.soil_type || 'Agricultural Soil',
          source: row.source || 'ICAR Soil Health Card',
        };
      }
    }

    // 2. Try state match fallback
    if (state) {
      const { data, error } = await client
        .from('soil_health_reference')
        .select('*')
        .ilike('state', state.trim())
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const row = data as unknown as SoilHealthReferenceRow;
        return {
          soil_ph: toNumber(row.soil_ph_mean),
          organic_matter: toNumber(row.organic_matter_pct),
          soil_type: row.soil_type || 'Regional Soil',
          source: `${row.state} State SHC Benchmark`,
        };
      }
    }

    return NATIONAL_SOIL_BASELINE;
  } catch (error) {
    console.warn('[soilHealth] Query failed, using national baseline:', error);
    return NATIONAL_SOIL_BASELINE;
  }
}
