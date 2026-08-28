import type { SupabaseClient } from '@supabase/supabase-js';

import { adminClient } from '../../config/supabase.js';

import {
  normalizeMarketRecords,
  type NormalizedMarketPrice,
  type RawMarketRecord,
} from './marketNormalizer.js';
import { fetchMarketRecords, marketSourceLabel, type MarketFetchFilters } from './marketSource.js';

/**
 * Writes normalized observations into `market_prices`.
 *
 * Reference data, so this is the one place the service-role client is
 * legitimate — see the note in config/supabase.ts. It never reads or writes a
 * farmer-owned row.
 *
 * Two rules shape the whole file:
 *
 *   Map, don't create.  An incoming mandi or commodity that is not already in
 *                       the reference tables is reported and skipped. Ingestion
 *                       never invents a mandi.
 *   Upsert, don't add.  Re-running a day's ingest must not duplicate rows, so
 *                       every write goes through the unique observation key.
 */

export type IngestionReport = {
  fetched: number;
  inserted: number;
  skipped: { reason: string; count: number }[];
};

/** Lower-cased name -> id, for resolving provider names to reference rows. */
type Lookup = Map<string, string>;

async function loadLookups(db: SupabaseClient): Promise<{ mandis: Lookup; crops: Lookup }> {
  const [{ data: mandis, error: mandiError }, { data: crops, error: cropError }] = await Promise.all(
    [db.from('mandis').select('id, name, district'), db.from('crops').select('id, code, name_en')],
  );

  if (mandiError) throw new Error(`Could not read mandis: ${mandiError.message}`);
  if (cropError) throw new Error(`Could not read crops: ${cropError.message}`);

  const mandiLookup: Lookup = new Map();
  for (const mandi of mandis ?? []) {
    // Keyed by both name and district+name: AGMARKNET's `market` is usually the
    // mandi name, but two districts can share one.
    mandiLookup.set(String(mandi.name).toLowerCase(), mandi.id as string);
    mandiLookup.set(`${String(mandi.district)}|${String(mandi.name)}`.toLowerCase(), mandi.id as string);
  }

  const cropLookup: Lookup = new Map();
  for (const crop of crops ?? []) {
    cropLookup.set(String(crop.code).toLowerCase(), crop.id as string);
    cropLookup.set(String(crop.name_en).toLowerCase(), crop.id as string);
  }

  return { mandis: mandiLookup, crops: cropLookup };
}

type ResolvedRow = {
  mandi_id: string;
  crop_id: string;
  variety: string | null;
  grade: string | null;
  price_date: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number;
  arrivals_tonnes: number | null;
  source: string;
};

export function resolveRows(
  rows: NormalizedMarketPrice[],
  lookups: { mandis: Lookup; crops: Lookup },
  source: string,
): { resolved: ResolvedRow[]; skipped: { reason: string; count: number }[] } {
  const resolved: ResolvedRow[] = [];
  const reasons = new Map<string, number>();

  const skip = (reason: string) => reasons.set(reason, (reasons.get(reason) ?? 0) + 1);

  for (const row of rows) {
    const mandi_id =
      lookups.mandis.get(`${row.district}|${row.mandiName}`.toLowerCase()) ??
      lookups.mandis.get(row.mandiName.toLowerCase());

    if (!mandi_id) {
      skip(`mandi not in reference data: ${row.district} / ${row.mandiName}`);
      continue;
    }

    const crop_id = lookups.crops.get(row.cropName.toLowerCase());
    if (!crop_id) {
      skip(`crop not in catalogue: ${row.cropName}`);
      continue;
    }

    resolved.push({
      mandi_id,
      crop_id,
      variety: row.variety,
      grade: row.grade,
      price_date: row.price_date,
      min_price: row.min_price,
      max_price: row.max_price,
      modal_price: row.modal_price,
      arrivals_tonnes: row.arrivals_tonnes,
      source,
    });
  }

  return {
    resolved,
    skipped: [...reasons.entries()].map(([reason, count]) => ({ reason, count })),
  };
}

/** Merge two skip tallies into one report list. */
function mergeSkipped(
  ...lists: { reason: string; count: number }[][]
): { reason: string; count: number }[] {
  const merged = new Map<string, number>();
  for (const list of lists) {
    for (const { reason, count } of list) {
      merged.set(reason, (merged.get(reason) ?? 0) + count);
    }
  }
  return [...merged.entries()].map(([reason, count]) => ({ reason, count }));
}

export async function ingestMarketRecords(
  raws: RawMarketRecord[],
  options: { db?: SupabaseClient; source?: string; today?: Date } = {},
): Promise<IngestionReport> {
  const db = options.db ?? adminClient();
  const source = options.source ?? marketSourceLabel();

  const normalized = normalizeMarketRecords(raws, options.today ? { today: options.today } : {});
  const lookups = await loadLookups(db);
  const { resolved, skipped } = resolveRows(normalized.rows, lookups, source);

  let inserted = 0;
  if (resolved.length > 0) {
    // The unique constraint from 0002 is the idempotency key: a re-run of the
    // same day updates in place instead of adding a second observation.
    const { error, count } = await db
      .from('market_prices')
      .upsert(resolved, {
        onConflict: 'mandi_id,crop_id,variety,grade,price_date',
        count: 'exact',
      });

    if (error) throw new Error(`Could not write market prices: ${error.message}`);
    inserted = count ?? resolved.length;
  }

  return {
    fetched: raws.length,
    inserted,
    skipped: mergeSkipped(normalized.skipped, skipped),
  };
}

/** Fetch from the provider, then ingest. The script entry point. */
export async function runMarketIngestion(
  filters: MarketFetchFilters = {},
): Promise<IngestionReport> {
  const raws = await fetchMarketRecords(filters);
  return ingestMarketRecords(raws);
}
