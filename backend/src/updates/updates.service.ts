import { getFarm } from '../services/farms.service.js';
import { listFarmCrops } from '../services/farmCrops.service.js';
import { listCrops } from '../services/reference.service.js';
import type { FarmCropRow, FarmRow } from '../types/domain.js';

import { dedupeUpdates } from './dedupe.js';
import { fetchPibUpdates } from './providers/pib.provider.js';
import { fetchSachetUpdates } from './providers/sachet.provider.js';
import { fetchGdeltUpdates } from './providers/gdelt.provider.js';
import { scoreUpdate } from './relevance.js';
import type { KrishiUpdate, UpdatesQueryContext } from './types.js';

/**
 * Orchestrates Krishi Updates for one farm:
 *
 *   verify ownership (via `getFarm`, same as every other farm-scoped route)
 *     -> resolve centroid/district/state/crop
 *     -> fetch GDELT + SACHET + PIB in parallel, each independently failable
 *     -> normalize (done inside each provider) -> dedupe -> score -> sort
 *     -> return the top slice
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
  };
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
  // unexpected error must never take the others down with it.
  const [gdelt, sachet, pib] = await Promise.allSettled([
    fetchGdeltUpdates(ctx),
    fetchSachetUpdates(ctx),
    fetchPibUpdates(ctx),
  ]);

  const raw: KrishiUpdate[] = [
    ...(gdelt.status === 'fulfilled' ? gdelt.value : []),
    ...(sachet.status === 'fulfilled' ? sachet.value : []),
    ...(pib.status === 'fulfilled' ? pib.value : []),
  ];

  const deduped = dedupeUpdates(raw);

  const scored = deduped.map((update) => ({
    ...update,
    relevance: scoreUpdate(update, {
      district: ctx.district,
      state: ctx.state,
      cropName: ctx.cropName,
      farmLat: ctx.latitude,
      farmLng: ctx.longitude,
    }),
  }));

  scored.sort((a, b) => {
    if (b.relevance.score !== a.relevance.score) return b.relevance.score - a.relevance.score;
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });

  return {
    farm: { id: farm.id, name: farm.name, district: farm.district, state: farm.state },
    crop,
    updates: scored.slice(0, MAX_RESULTS),
  };
}
