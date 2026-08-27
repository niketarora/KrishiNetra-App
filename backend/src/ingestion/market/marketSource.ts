import { getEnv } from '../../config/env.js';

import type { RawMarketRecord } from './marketNormalizer.js';

/**
 * Fetches AGMARKNET daily mandi prices from data.gov.in.
 *
 * This file only fetches. It does no validation and no interpretation — that
 * is marketNormalizer's job — so the two can be tested independently and a
 * provider change touches one of them.
 *
 * If the provider is down, this throws. The caller reports the failure and
 * writes nothing: §2.3 requires that an unavailable source leaves the app in
 * its "not connected" state rather than producing fabricated data.
 */

const PAGE_SIZE = 500;
const MAX_PAGES = 40;

export class MarketSourceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'MarketSourceError';
  }
}

export type MarketFetchFilters = {
  state?: string;
  district?: string;
  commodity?: string;
};

/** Names the run in every stored row, so an observation's origin is traceable. */
export function marketSourceLabel(fetchedAt = new Date()): string {
  return `data.gov.in AGMARKNET, fetched ${fetchedAt.toISOString().slice(0, 10)}`;
}

async function fetchPage(
  offset: number,
  filters: MarketFetchFilters,
  signal: AbortSignal,
): Promise<RawMarketRecord[]> {
  const env = getEnv();

  if (!env.MARKET_API_KEY) {
    throw new MarketSourceError(
      'MARKET_API_KEY is not set. Register free at https://data.gov.in and add it to backend/.env.',
    );
  }

  const url = new URL(env.MARKET_API_URL);
  url.searchParams.set('api-key', env.MARKET_API_KEY);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));

  if (filters.state) url.searchParams.set('filters[state]', filters.state);
  if (filters.district) url.searchParams.set('filters[district]', filters.district);
  if (filters.commodity) url.searchParams.set('filters[commodity]', filters.commodity);

  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (cause) {
    throw new MarketSourceError('Could not reach data.gov.in', cause);
  }

  if (!response.ok) {
    throw new MarketSourceError(`data.gov.in returned HTTP ${response.status}`);
  }

  let payload: { records?: unknown };
  try {
    payload = (await response.json()) as { records?: unknown };
  } catch (cause) {
    throw new MarketSourceError('data.gov.in returned a body that is not JSON', cause);
  }

  if (!Array.isArray(payload.records)) {
    // A valid-but-empty response has `records: []`. A missing array means the
    // shape changed, which must be loud rather than silently ingesting nothing.
    throw new MarketSourceError('data.gov.in response had no `records` array');
  }

  return payload.records as RawMarketRecord[];
}

/** Pages until the provider runs out of records. */
export async function fetchMarketRecords(
  filters: MarketFetchFilters = {},
  options: { timeoutMs?: number } = {},
): Promise<RawMarketRecord[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const all: RawMarketRecord[] = [];

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const records = await fetchPage(page * PAGE_SIZE, filters, controller.signal);
      all.push(...records);
      if (records.length < PAGE_SIZE) break;
    }

    return all;
  } finally {
    clearTimeout(timeout);
  }
}
