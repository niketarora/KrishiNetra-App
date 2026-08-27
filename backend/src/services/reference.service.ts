import { userClient } from '../config/supabase.js';
import {
  type CropRow,
  type MandiRow,
  type MarketPriceRow,
  type MspRow,
  type WeatherRow,
  toNullableNumber,
  toNumber,
} from '../types/domain.js';

/**
 * Reference data: the crop catalogue, mandis, MSP and market prices.
 *
 * Read through the farmer's own client like everything else. These tables carry
 * a select-only RLS policy, so a write attempt from here would be refused by
 * Postgres — reference data is written by the service role alone.
 *
 * Phase 2.5 connected real sources for `market_prices` and `weather`. The
 * queries did not change — ingestion simply gave them rows to return. When a
 * table is still empty for a given filter, they return nothing rather than a
 * fabricated value.
 */

export async function listCrops(token: string): Promise<CropRow[]> {
  const { data, error } = await userClient(token)
    .from('crops')
    .select('*')
    .order('name_en', { ascending: true });

  if (error) throw error;
  return (data ?? []) as CropRow[];
}

export async function listMandis(
  token: string,
  filters: { state?: string; district?: string },
): Promise<MandiRow[]> {
  let query = userClient(token)
    .from('mandis')
    .select('*')
    .order('name', { ascending: true });

  if (filters.state) query = query.eq('state', filters.state);
  if (filters.district) query = query.eq('district', filters.district);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...(row as unknown as MandiRow),
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
  }));
}

export async function listMsp(
  token: string,
  filters: { crop?: string; year?: string },
): Promise<MspRow[]> {
  const client = userClient(token);

  let query = client
    .from('msp')
    .select('*, crops!inner(code, name_en)')
    .order('marketing_year', { ascending: false });

  if (filters.crop) query = query.eq('crops.code', filters.crop);
  if (filters.year) query = query.eq('marketing_year', filters.year);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...(row as unknown as MspRow),
    price_per_quintal: toNumber(row.price_per_quintal),
  }));
}

export async function listMarketPrices(
  token: string,
  filters: { crop?: string; mandi?: string; from?: string; to?: string; limit?: number },
): Promise<MarketPriceRow[]> {
  const client = userClient(token);

  let query = client
    .from('market_prices')
    .select('*, crops!inner(code), mandis!inner(code)')
    .order('price_date', { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.crop) query = query.eq('crops.code', filters.crop);
  if (filters.mandi) query = query.eq('mandis.code', filters.mandi);
  if (filters.from) query = query.gte('price_date', filters.from);
  if (filters.to) query = query.lte('price_date', filters.to);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...(row as unknown as MarketPriceRow),
    min_price: toNullableNumber(row.min_price),
    max_price: toNullableNumber(row.max_price),
    modal_price: toNumber(row.modal_price),
    arrivals_tonnes: toNullableNumber(row.arrivals_tonnes),
  }));
}

/**
 * The most recent observation for a district, or null.
 *
 * Null is a real answer here and the caller turns it into the unavailable
 * state. There is no "nearest district" fallback: serving Jaipur's weather to a
 * farmer in Kota would be a fabricated reading with a plausible number on it.
 */
export async function latestWeatherForDistrict(
  token: string,
  district: string,
  state: string,
): Promise<WeatherRow | null> {
  const { data, error } = await userClient(token)
    .from('weather')
    .select('*')
    .eq('district', district)
    .eq('state', state)
    .order('observed_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...(data as unknown as WeatherRow),
    temperature_c: toNullableNumber(data.temperature_c),
    rainfall_mm: toNullableNumber(data.rainfall_mm),
    humidity_pct: toNullableNumber(data.humidity_pct),
  };
}
