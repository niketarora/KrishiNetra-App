import { getFarm } from '../services/farms.service.js';
import { listFarmCrops } from '../services/farmCrops.service.js';
import { listCrops } from '../services/reference.service.js';
import type { FarmCropRow, FarmRow } from '../types/domain.js';

import { dedupeUpdates } from './dedupe.js';
import { fetchSachetUpdates } from './providers/sachet.provider.js';
import { fetchGdeltUpdates } from './providers/gdelt.provider.js';
import { scoreUpdate } from './relevance.js';
import type { KrishiUpdate, UpdatesQueryContext } from './types.js';

/**
 * Orchestrates Krishi Updates for one farm:
 *
 *   verify ownership (via `getFarm`, same as every other farm-scoped route)
 *     -> resolve centroid/district/state/crop
 *     -> fetch GDELT + SACHET in parallel, each independently failable
 *     -> normalize (done inside each provider) -> dedupe -> score -> sort
 *     -> return the top slice
 *
 * PIB is deliberately not called here — its RSS endpoint returned HTTP 403
 * from every external vantage point tried during investigation and was never
 * validated against a live response (see `pib.provider.ts`'s own header
 * comment). The provider function still exists and is independently correct
 * and tested, but nothing wires it into this feed; SACHET + GDELT are the
 * two reliable MVP providers.
 *
 * The initial max result count keeps this a short, scannable feed rather
 * than a firehose — the product brief is explicit that 100 articles is the
 * wrong shape for this feature.
 */
const MAX_RESULTS = 15;

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
  const [gdelt, sachet] = await Promise.allSettled([fetchGdeltUpdates(ctx), fetchSachetUpdates(ctx)]);

  const raw: KrishiUpdate[] = [
    ...(gdelt.status === 'fulfilled' ? gdelt.value : []),
    ...(sachet.status === 'fulfilled' ? sachet.value : []),
  ];

  return {
    farm: { id: farm.id, name: farm.name, district: farm.district, state: farm.state },
    crop,
    updates: rankUpdates(raw, {
      district: ctx.district,
      state: ctx.state,
      cropName: ctx.cropName,
      farmLat: ctx.latitude,
      farmLng: ctx.longitude,
    }),
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

  const gdelt = await fetchGdeltUpdates(ctx).catch(() => []);

  return {
    farm: null,
    crop: null,
    updates: rankUpdates(gdelt, { district: null, state: null, cropName: null, farmLat: 0, farmLng: 0 }),
  };
}
