import { getFarm } from '../services/farms.service.js';
import { listFarmCrops } from '../services/farmCrops.service.js';
import { listCrops } from '../services/reference.service.js';
import type { FarmCropRow, FarmRow } from '../types/domain.js';

import { dedupeUpdates } from './dedupe.js';
import { fetchSachetUpdates } from './providers/sachet.provider.js';
import { fetchGdeltUpdatesDetailed } from './providers/gdelt.provider.js';
import { fetchGoogleNewsUpdates } from './providers/google-news.provider.js';
import { scoreUpdate } from './relevance.js';
import type { KrishiUpdate, UpdatesQueryContext } from './types.js';

/**
 * Orchestrates Krishi Updates for one farm:
 *
 *   verify ownership (via `getFarm`, same as every other farm-scoped route)
 *     -> resolve centroid/district/state/crop
 *     -> fetch SACHET + (GDELT, then conditionally Google News RSS) in parallel
 *     -> normalize (done inside each provider) -> dedupe -> score -> sort
 *     -> return the top slice
 *
 * PIB is deliberately not called here — its RSS endpoint returned HTTP 403
 * from every external vantage point tried during investigation and was never
 * validated against a live response (see `pib.provider.ts`'s own header
 * comment). The provider function still exists and is independently correct
 * and tested, but nothing wires it into this feed.
 *
 * Google News RSS (`google-news.provider.ts`) is a fallback-only aggregator,
 * never called unconditionally — see `shouldUseGoogleNewsFallback`. It is
 * never an official source and never substitutes for SACHET.
 *
 * The initial max result count keeps this a short, scannable feed rather
 * than a firehose — the product brief is explicit that 100 articles is the
 * wrong shape for this feature.
 */
const MAX_RESULTS = 15;

/**
 * Below this many *already-filtered* GDELT results, the feed is thin enough
 * that Google News RSS is worth the extra request — chosen so a farmer never
 * sees an obviously sparse agriculture/agritech section when a second free
 * aggregator could fill it in, without calling that aggregator on every
 * request regardless of need (GDELT has demonstrated rate-limit sensitivity;
 * Google News gets the same courtesy of not being called needlessly).
 */
const MIN_USEFUL_GDELT_RESULTS = 3;

export type FarmUpdatesResult = {
  farm: {
    id: string;
    name: string | null;
    district: string | null;
    state: string | null;
  } | null;
  crop: { code: string; name: string } | null;
  updates: KrishiUpdate[];
};

/** Same "newest non-harvested planting" rule `mobile/src/services/agronomy.ts` uses, so both surfaces agree on "the current crop". */
function selectCurrentPlanting(plantings: FarmCropRow[]): FarmCropRow | null {
  const active = plantings.filter((planting) => planting.status !== 'harvested');
  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) => (b.sown_on ?? '').localeCompare(a.sown_on ?? ''));
  return sorted[0] ?? null;
}

async function resolveCurrentCrop(
  token: string,
  userId: string,
  farm: FarmRow,
): Promise<{ code: string; name: string } | null> {
  try {
    const [plantings, catalogue] = await Promise.all([
      listFarmCrops(token, userId, farm.id),
      listCrops(token),
    ]);

    const planting = selectCurrentPlanting(plantings);
    if (!planting) return null;

    const crop = catalogue.find((entry) => entry.id === planting.crop_id);
    if (!crop) return null;

    return { code: crop.code, name: crop.name_en };
  } catch {
    // A crop lookup failure must not stop the feed from loading — it just
    // means crop-relevance scoring is skipped for this request.
    return null;
  }
}

type NewsResult = { updates: KrishiUpdate[]; gdeltCount: number; googleNewsCount: number };

/**
 * GDELT first, then Google News RSS only when GDELT actually needs the
 * help — either it failed a query outright, or it came back with fewer than
 * `MIN_USEFUL_GDELT_RESULTS` *already-filtered* results. Both conditions are
 * logged explicitly so a thin feed is always traceable to a specific cause.
 */
async function fetchAgricultureNews(ctx: UpdatesQueryContext): Promise<NewsResult> {
  const gdelt = await fetchGdeltUpdatesDetailed(ctx).catch((err: unknown) => {
    console.log(`[updates:gdelt] unexpected provider error: ${String(err)}`);
    return { updates: [] as KrishiUpdate[], hadFailure: true, usefulCount: 0 };
  });

  const reason = gdelt.hadFailure
    ? 'gdelt-query-failure'
    : gdelt.usefulCount < MIN_USEFUL_GDELT_RESULTS
      ? 'gdelt-thin-results'
      : 'not-needed';
  const shouldFallback = reason !== 'not-needed';

  console.log(`[updates:google-news] fallbackTriggered=${shouldFallback} reason=${reason} gdeltUsefulCount=${gdelt.usefulCount}`);

  let googleNewsUpdates: KrishiUpdate[] = [];
  if (shouldFallback) {
    try {
      const googleNews = await fetchGoogleNewsUpdates(ctx);
      googleNewsUpdates = googleNews.updates;
    } catch (err) {
      console.log(`[updates:google-news] unexpected provider error: ${String(err)}`);
    }
  }

  return { updates: [...gdelt.updates, ...googleNewsUpdates], gdeltCount: gdelt.updates.length, googleNewsCount: googleNewsUpdates.length };
}

export async function getUpdatesForFarm(
  token: string,
  userId: string,
  farmId: string,
): Promise<FarmUpdatesResult> {
  // Ownership check happens here, exactly like `weather` and `farm_crops` —
  // a farm belonging to someone else is reported as not found, not forbidden.
  const farm = await getFarm(token, userId, farmId);
  const crop = await resolveCurrentCrop(token, userId, farm);

  const ctx: UpdatesQueryContext = {
    farmId: farm.id,
    latitude: farm.centroid_lat,
    longitude: farm.centroid_lng,
    district: farm.district,
    state: farm.state,
    cropCode: crop?.code ?? null,
    cropName: crop?.name ?? null,
  };

  // Each provider already resolves to `[]` internally on failure, but
  // `allSettled` is a second line of defence: one provider throwing an
  // unexpected error must never take the other down with it.
  const [news, sachet] = await Promise.allSettled([fetchAgricultureNews(ctx), fetchSachetUpdates(ctx)]);

  const newsResult = news.status === 'fulfilled' ? news.value : { updates: [], gdeltCount: 0, googleNewsCount: 0 };
  const sachetCount = sachet.status === 'fulfilled' ? sachet.value.length : 0;
  if (news.status === 'rejected') console.log(`[updates] gdelt/google-news pipeline rejected: ${String(news.reason)}`);
  if (sachet.status === 'rejected') console.log(`[updates] sachet provider rejected: ${String(sachet.reason)}`);

  const raw: KrishiUpdate[] = [...newsResult.updates, ...(sachet.status === 'fulfilled' ? sachet.value : [])];

  const updates = rankUpdates(raw, {
    district: ctx.district,
    state: ctx.state,
    cropName: ctx.cropName,
    farmLat: ctx.latitude,
    farmLng: ctx.longitude,
  });

  console.log(
    `[updates] farm=${farm.id} sachet=${sachetCount} gdelt=${newsResult.gdeltCount} googleNews=${newsResult.googleNewsCount} final=${updates.length}`,
  );

  return {
    farm: { id: farm.id, name: farm.name, district: farm.district, state: farm.state },
    crop,
    updates,
  };
}

type RankContext = {
  district: string | null;
  state: string | null;
  cropName: string | null;
  farmLat: number;
  farmLng: number;
};

/** Shared by the farm-scoped feed and the farmless national feed below. */
function rankUpdates(raw: KrishiUpdate[], ctx: RankContext): KrishiUpdate[] {
  const deduped = dedupeUpdates(raw);
  console.log(`[updates] raw=${raw.length} deduped=${deduped.length}`);

  const scored = deduped.map((update) => ({
    ...update,
    relevance: scoreUpdate(update, ctx),
  }));

  scored.sort((a, b) => {
    if (b.relevance.score !== a.relevance.score) return b.relevance.score - a.relevance.score;
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });

  return scored.slice(0, MAX_RESULTS);
}

/**
 * A farmer with no registered field yet still gets a feed — national
 * agriculture/agritech news, per the product brief's "show national updates
 * rather than crashing" rule. SACHET is skipped entirely here: it only ever
 * shows an alert that names a specific district/state (see
 * `sachet.provider.ts`), and there is no farm location to match against, so
 * calling it would only waste a request for a guaranteed `[]`.
 */
export async function getNationalUpdates(): Promise<FarmUpdatesResult> {
  const ctx: UpdatesQueryContext = {
    farmId: '',
    latitude: 0,
    longitude: 0,
    district: null,
    state: null,
    cropCode: null,
    cropName: null,
  };

  const news = await fetchAgricultureNews(ctx).catch(() => ({ updates: [], gdeltCount: 0, googleNewsCount: 0 }) as NewsResult);

  return {
    farm: null,
    crop: null,
    updates: rankUpdates(news.updates, { district: null, state: null, cropName: null, farmLat: 0, farmLng: 0 }),
  };
}
