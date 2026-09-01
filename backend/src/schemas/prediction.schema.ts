import { z } from 'zod';

/**
 * Multi-sensor feature schema for OASSM-10 10m Soil Moisture Transformer model.
 */
export const oassmSoilMoistureSchema = z.object({
  angle: z.number().min(10).max(60).default(38.5),
  vv: z.number().min(-40).max(5).default(-11.2),
  vh: z.number().min(-45).max(5).default(-17.8),
  vh_minus_vv: z.number().optional(),

  sentinel2_b2: z.number().min(0).max(1).default(0.045),
  sentinel2_b8a: z.number().min(0).max(1).default(0.280),
  sentinel2_b11: z.number().min(0).max(1).default(0.195),
  sentinel2_b12: z.number().min(0).max(1).default(0.110),
  landsat_b2: z.number().min(0).max(1).default(0.050),
  landsat_b7: z.number().min(0).max(1).default(0.120),
  landsat_b10: z.number().min(200).max(360).default(298.5),

  ndvi: z.number().min(-1).max(1),
  ndmi: z.number().min(-1).max(1).default(0.18),
  savi: z.number().min(-1).max(1),
  s2_lag: z.number().min(0).max(60).default(2.0),
  landsat_lag: z.number().min(0).max(60).default(4.0),

  day_sin: z.number().min(-1).max(1).default(0.5),
  day_cos: z.number().min(-1).max(1).default(0.866),

  dsm: z.number().min(-500).max(9000).default(350.0),
  slope: z.number().min(0).max(90).default(2.5),
  twi_proxy: z.number().min(0).max(30).default(7.8),
  aspect_sin: z.number().min(-1).max(1).default(0.0),
  aspect_cos: z.number().min(-1).max(1).default(1.0),

  temperature_c: z.number().min(-20).max(60),
  humidity_percent: z.number().min(0).max(100),
  rainfall: z.number().min(0).max(2000),
  wind_speed: z.number().min(0).max(250),

  soil_ph: z.number().min(0).max(14),
  organic_matter: z.number().min(0).max(100),
  leaf_area_index: z.number().min(0).max(20),
  water_flow: z.number().min(0).max(10_000).optional(),
  elevation: z.number().min(-500).max(9000).optional(),
  spatial_resolution: z.number().positive().max(10_000).default(10.0),
  crop_growth_stage: z.number().int().min(0).max(20).default(2),
  crop_type: z.string().trim().toLowerCase().pipe(z.enum(['maize', 'rice', 'wheat'])).default('wheat'),

  climate_zone: z.string().default('BSh'),
  soil_texture: z.string().default('loam'),
  land_cover: z.string().default('cropland'),
});

export const experimentalSoilMoistureSchema = oassmSoilMoistureSchema;

export type OASSMSoilMoistureBody = z.infer<typeof oassmSoilMoistureSchema>;
export type ExperimentalSoilMoistureBody = OASSMSoilMoistureBody;
