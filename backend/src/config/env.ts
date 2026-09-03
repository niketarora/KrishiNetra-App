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
  // The *host*, not the full endpoint — gdelt.provider.ts appends the DOC 2.0
  // path (`/api/v2/doc/doc`) itself, so switching transport (e.g. to plain
  // HTTP on a network where the HTTPS endpoint is unreachable but the same
  // API answers over HTTP) is a one-line env change, not a code change.
  GDELT_BASE_URL: z.string().url().default('https://api.gdeltproject.org'),
  // Google News RSS search — a fallback-only aggregator for agriculture/
  // agritech discovery when GDELT fails or comes back thin, never a
  // replacement for SACHET's official alerts. No key needed.
  GOOGLE_NEWS_RSS_URL: z.string().url().default('https://news.google.com/rss/search'),
  // `https://sachet.ndma.gov.in/CapFeed` (the previous default) is the human
  // documentation/subscription page, not a feed — it serves HTML with no
  // `<info>`/`<item>` tags anywhere, so a provider pointed at it always
  // silently returns zero alerts. This is the real live CAP/RSS feed,
  // confirmed by manual request during investigation.
  SACHET_CAP_URL: z.string().url().default('https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml'),
  // PIB is no longer part of the active Krishi Updates aggregation (see
  // updates.service.ts) — its RSS endpoint returned 403 from every external
  // vantage point tried during investigation and was never validated against
  // a live response. The env var and provider are left in place, unused, in
  // case a validated URL/access path is found later; nothing currently calls
  // `fetchPibUpdates`.
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
  GEMINI_LIVE_API_KEY: z.string().optional(),
  GEMINI_LIVE_MODEL: z.string().default('models/gemini-3.1-flash-live-preview'),
  SARVAM_API_KEY: z.string().optional(),
  SARVAM_API_URL: z.string().url().default('https://api.sarvam.ai/speech-to-text'),
  SARVAM_MODEL: z.string().default('saarika:v2.5'),
  // The same subscription key speaks as well as listens. The avatar is drawn
  // as an older farmer, so the default voice is one of the provider's male
  // ones; changing it is a config edit, not a code change.
  SARVAM_TTS_API_URL: z.string().url().default('https://api.sarvam.ai/text-to-speech'),
  SARVAM_TTS_MODEL: z.string().default('bulbul:v3'),
  SARVAM_TTS_SPEAKER: z.string().default('aditya'),

  // --- In-app guide: intent router, farming expert, deep research ------------
  // Optional on the same principle as the avatar keys above. A missing key
  // makes one branch of the guide report itself unavailable; the other two, and
  // the rest of the API, carry on.
  //
  // The router runs on every request and is tuned for latency, so it gets its
  // own model knob — pointing it at a lighter model than the conversational one
  // is then a config edit rather than a code change. Empty means "use
  // GEMINI_MODEL".
  GEMINI_ROUTER_MODEL: z.string().default(''),
  LYZR_API_KEY: z.string().optional(),
  LYZR_AGENT_ID: z.string().optional(),
  // The Lyzr *account* the agent belongs to, as an email — not the farmer.
  // Farmers are told apart by session id; see lyzr.service.ts.
  LYZR_USER_ID: z.string().email().optional(),
  LYZR_API_URL: z
    .string()
    .url()
    .default('https://agent-prod.studio.lyzr.ai/v3/inference/chat/'),
  TAVILY_API_KEY: z.string().optional(),
  TAVILY_API_URL: z.string().url().default('https://api.tavily.com/search'),

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
