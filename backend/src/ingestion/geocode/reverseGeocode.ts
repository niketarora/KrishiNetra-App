import { getEnv } from '../../config/env.js';

/**
 * Resolves a farm centroid to a district and state.
 *
 * IMPLEMENTATION_PHASE2_5.md §3.3 says: do not guess a district from incomplete
 * coordinates. This is the difference between a guess and a resolution — the
 * coordinate is looked up against a real gazetteer (OpenStreetMap Nominatim),
 * and what comes back is stored with the source that produced it.
 *
 * When the lookup fails or returns no district, the answer is null. A null
 * district means the weather endpoint reports "not connected" for that farm,
 * which is honest. Nothing here ever falls back to a nearest-guess.
 */

export type ResolvedLocation = {
  district: string;
  state: string;
  /** Provider and date, stored on the farm so the resolution is traceable. */
  source: string;
};

type NominatimAddress = {
  state_district?: string;
  district?: string;
  county?: string;
  state?: string;
};

/**
 * Nominatim names the district differently by country and zoom level. In India
 * it is usually `state_district`; `county` is the common fallback.
 */
export function districtFromAddress(address: NominatimAddress | undefined): string | null {
  if (!address) return null;

  const candidate = address.state_district ?? address.district ?? address.county;
  if (!candidate) return null;

  const trimmed = String(candidate).trim();
  if (trimmed === '') return null;

  // Nominatim returns "Alwar District" in places; the mandis table stores "Alwar".
  return trimmed.replace(/\s+district$/i, '');
}

export function stateFromAddress(address: NominatimAddress | undefined): string | null {
  if (!address?.state) return null;
  const trimmed = String(address.state).trim();
  return trimmed === '' ? null : trimmed;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  options: { timeoutMs?: number } = {},
): Promise<ResolvedLocation | null> {
  const env = getEnv();

  const url = new URL(env.GEOCODE_API_URL);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');
  // Roughly county/district level. Asking for more detail returns a village
  // name where a district is wanted.
  url.searchParams.set('zoom', '8');
  url.searchParams.set('addressdetails', '1');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        // Nominatim's usage policy requires an identifying User-Agent.
        'User-Agent': 'KrishiNetra/1.0 (agricultural market linkage app)',
      },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { address?: NominatimAddress };

    const district = districtFromAddress(payload.address);
    const state = stateFromAddress(payload.address);
    if (!district || !state) return null;

    return {
      district,
      state,
      source: `OpenStreetMap Nominatim, ${new Date().toISOString().slice(0, 10)}`,
    };
  } catch {
    // A geocode failure must never block a farm being saved, so this is a null
    // rather than a throw. The caller stores the farm with no district.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
