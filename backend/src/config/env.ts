import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

/**
 * A server that starts with half its configuration is worse than one that
 * refuses to start, so every required variable is validated here at boot and a
 * missing one exits with a message naming it.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be a full URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  CORS_ORIGINS: z.string().default('http://localhost:8081'),

  // --- Phase 2.5 ingestion ---------------------------------------------------
  // Optional, because the API must still boot and serve farm data on a machine
  // that has no ingestion credentials. A missing key fails the ingest script
  // with a clear message rather than the server at startup.
  MARKET_API_KEY: z.string().optional(),
  MARKET_API_URL: z
    .string()
    .url()
    .default('https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070'),
  // Open-Meteo needs no key. The URLs are overridable so a test can point them
  // at a local fixture server.
  WEATHER_API_URL: z.string().url().default('https://archive-api.open-meteo.com/v1/archive'),
  GEOCODE_API_URL: z.string().url().default('https://nominatim.openstreetmap.org/reverse'),

  // --- Krishi Updates (farm-location-aware information feed) -----------------
  // None of these need a key. Defaults point at the real public endpoints
  // named in the product brief; overridable so a test can point them at a
  // local fixture server instead of the real network.
  GDELT_API_URL: z.string().url().default('https://api.gdeltproject.org/api/v2/doc/doc'),
  SACHET_CAP_URL: z.string().url().default('https://sachet.ndma.gov.in/CapFeed'),
  PIB_RSS_URL: z
    .string()
    .url()
    .default('https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1'),

  // --- Phase 2.5 avatar ------------------------------------------------------
  // Optional for the same reason as the ingestion keys: the API must boot and
  // serve farm data without them. The avatar routes report the service as
  // unavailable when a key is missing, rather than the server refusing to start.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  SARVAM_API_KEY: z.string().optional(),
  SARVAM_API_URL: z.string().url().default('https://api.sarvam.ai/speech-to-text'),
  SARVAM_MODEL: z.string().default('saarika:v2.5'),
  // The same subscription key speaks as well as listens. The avatar is drawn
  // as an older farmer, so the default voice is one of the provider's male
  // ones; changing it is a config edit, not a code change.
  SARVAM_TTS_API_URL: z.string().url().default('https://api.sarvam.ai/text-to-speech'),
  SARVAM_TTS_MODEL: z.string().default('bulbul:v2'),
  SARVAM_TTS_SPEAKER: z.string().default('abhilash'),

  // --- Phase 3 ML service ---------------------------------------------------
  // Optional so the rest of the API can run independently. Prediction routes
  // return SERVICE_NOT_CONNECTED until the Python service is configured.
  ML_SERVICE_URL: z.string().url().optional(),
  ML_SERVICE_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema> & { corsOrigins: string[] };

function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid backend environment:\n${lines.join('\n')}`);
  }

  return {
    ...result.data,
    corsOrigins: result.data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}

let cached: Env | null = null;

/** Parsed once, then reused. Throws on the first call if anything is missing. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test seam: forget the cached copy so a test can vary process.env. */
export function resetEnvCache(): void {
  cached = null;
}
