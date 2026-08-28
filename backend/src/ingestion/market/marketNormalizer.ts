/**
 * Turns one AGMARKNET record from data.gov.in into a row this database will
 * accept — or rejects it with a reason.
 *
 * This file is pure and has no network, which is deliberate: every rule in
 * IMPLEMENTATION_PHASE2_5.md §2.3 ("never generate synthetic market prices",
 * "never fill missing values with guessed values") is enforceable here and
 * testable without a provider key.
 *
 * The single most important rule: a field the provider did not send stays
 * null. It is never inferred from the other fields, never carried over from a
 * neighbouring row, and never defaulted to zero.
 */

/** One record as data.gov.in sends it. Field names vary in case across versions. */
export type RawMarketRecord = Record<string, unknown>;

export type NormalizedMarketPrice = {
  /** Provider names, resolved to reference-table ids later by the ingester. */
  mandiName: string;
  district: string;
  state: string;
  cropName: string;

  variety: string | null;
  grade: string | null;
  price_date: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number;
  arrivals_tonnes: number | null;
};

export type NormalizeResult =
  | { ok: true; value: NormalizedMarketPrice }
  | { ok: false; reason: string };

/**
 * AGMARKNET has shipped `State`, `state` and `state_name` for the same field
 * across versions, so every lookup is case-insensitive over a list of aliases.
 */
function pick(raw: RawMarketRecord, ...names: string[]): unknown {
  const lowered = new Map(Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value]));
  for (const name of names) {
    const value = lowered.get(name.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  // AGMARKNET uses these for "no value recorded". Treat them as absent rather
  // than storing the literal string.
  if (/^(na|n\/a|null|-|--)$/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Prices arrive as strings, in rupees per quintal, sometimes with separators.
 * A value that is not a positive finite number is absent, not zero.
 */
export function parsePrice(value: unknown): number | null {
  const raw = text(value);
  if (raw === null) return null;

  const cleaned = raw.replace(/[,\s₹]/g, '');
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * AGMARKNET dates are `DD/MM/YYYY`. ISO is accepted too, because the provider
 * has used it on some resources and a silent misparse would shift every
 * observation by months.
 */
export function parseObservationDate(value: unknown): string | null {
  const raw = text(value);
  if (raw === null) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return isRealDate(iso[1]!, iso[2]!, iso[3]!) ? raw : null;

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (dmy) {
    const day = dmy[1]!.padStart(2, '0');
    const month = dmy[2]!.padStart(2, '0');
    const year = dmy[3]!;
    return isRealDate(year, month, day) ? `${year}-${month}-${day}` : null;
  }

  return null;
}

function isRealDate(year: string, month: string, day: string): boolean {
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  // Rejects 31 February, which Date would roll forward into March.
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  );
}

export function normalizeMarketRecord(
  raw: RawMarketRecord,
  options: { today?: Date } = {},
): NormalizeResult {
  const mandiName = text(pick(raw, 'market', 'market_name', 'mandi'));
  const district = text(pick(raw, 'district', 'district_name'));
  const state = text(pick(raw, 'state', 'state_name'));
  const cropName = text(pick(raw, 'commodity', 'commodity_name', 'crop'));

  if (!mandiName) return { ok: false, reason: 'missing market name' };
  if (!district) return { ok: false, reason: 'missing district' };
  if (!state) return { ok: false, reason: 'missing state' };
  if (!cropName) return { ok: false, reason: 'missing commodity' };

  const price_date = parseObservationDate(pick(raw, 'arrival_date', 'Arrival_Date', 'price_date'));
  if (!price_date) return { ok: false, reason: 'missing or unparseable arrival date' };

  // An observation dated in the future is a provider error, not a forecast.
  // Storing it would put a price in market_prices that has not happened.
  const today = options.today ?? new Date();
  const todayIso = today.toISOString().slice(0, 10);
  if (price_date > todayIso) return { ok: false, reason: 'observation dated in the future' };

  const modal_price = parsePrice(pick(raw, 'modal_price', 'modal_x0020_price'));
  if (modal_price === null) return { ok: false, reason: 'missing or invalid modal price' };

  const min_price = parsePrice(pick(raw, 'min_price', 'min_x0020_price'));
  const max_price = parsePrice(pick(raw, 'max_price', 'max_x0020_price'));

  // The database has the same check constraint. Rejecting here means a bad
  // batch is reported per-row rather than failing the whole insert.
  if (min_price !== null && min_price > modal_price) {
    return { ok: false, reason: 'min price above modal price' };
  }
  if (max_price !== null && max_price < modal_price) {
    return { ok: false, reason: 'max price below modal price' };
  }

  // This resource does not carry arrivals. It stays null rather than being
  // invented — §2.3 forbids filling a missing value with a guess.
  const arrivalsRaw = pick(raw, 'arrivals_tonnes', 'arrivals', 'arrival_quantity');
  const arrivals = arrivalsRaw === undefined ? null : Number(String(arrivalsRaw).replace(/,/g, ''));
  const arrivals_tonnes = arrivals !== null && Number.isFinite(arrivals) && arrivals >= 0 ? arrivals : null;

  return {
    ok: true,
    value: {
      mandiName,
      district,
      state,
      cropName,
      variety: text(pick(raw, 'variety')),
      grade: text(pick(raw, 'grade')),
      price_date,
      min_price,
      max_price,
      modal_price,
      arrivals_tonnes,
    },
  };
}

export type NormalizeBatchResult = {
  rows: NormalizedMarketPrice[];
  /** Why records were dropped, so an ingest run can report it rather than hide it. */
  skipped: { reason: string; count: number }[];
};

export function normalizeMarketRecords(
  raws: RawMarketRecord[],
  options: { today?: Date } = {},
): NormalizeBatchResult {
  const rows: NormalizedMarketPrice[] = [];
  const reasons = new Map<string, number>();

  for (const raw of raws) {
    const result = normalizeMarketRecord(raw, options);
    if (result.ok) {
      rows.push(result.value);
    } else {
      reasons.set(result.reason, (reasons.get(result.reason) ?? 0) + 1);
    }
  }

  return {
    rows,
    skipped: [...reasons.entries()].map(([reason, count]) => ({ reason, count })),
  };
}
