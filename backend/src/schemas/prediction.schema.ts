import { z } from 'zod';

/**
 * Exact feature contract of the delivered experimental XGBoost artifact.
 *
 * These are measurements, not values the backend can safely infer from a farm
 * record. The caller must supply the complete observation until a trusted
 * satellite/field-data pipeline is connected.
 */
export const experimentalSoilMoistureSchema = z
  .object({
    ndvi: z.number().min(-1).max(1),
    savi: z.number().min(-1).max(1),
    temperature_c: z.number().min(-20).max(60),
    humidity_percent: z.number().min(0).max(100),
    rainfall: z.number().min(0).max(2000),
    wind_speed: z.number().min(0).max(250),
    soil_ph: z.number().min(0).max(14),
    organic_matter: z.number().min(0).max(100),
    leaf_area_index: z.number().min(0).max(20),
    water_flow: z.number().min(0).max(10_000),
    elevation: z.number().min(-500).max(9000),
    spatial_resolution: z.number().positive().max(10_000),
    crop_growth_stage: z.number().int().min(0).max(20),
    crop_type: z.string().trim().toLowerCase().pipe(z.enum(['maize', 'rice', 'wheat'])),
  })
  .strict();

export type ExperimentalSoilMoistureBody = z.infer<
  typeof experimentalSoilMoistureSchema
>;
