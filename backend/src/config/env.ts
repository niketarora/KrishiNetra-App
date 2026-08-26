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

  // Phase 3. Declared so the shape is known; unused for now.
  WEATHER_API_KEY: z.string().optional(),
  ML_SERVICE_URL: z.string().url().optional(),
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
