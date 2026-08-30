import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { fetchSachetUpdates } = await import('./sachet.provider.js');
const { resetUpdatesCache } = await import('../cache.js');
import type { UpdatesQueryContext } from '../types.js';

const CTX: UpdatesQueryContext = {
  farmId: 'farm-1',
  latitude: 26.76,
  longitude: 83.37,
  district: 'Gorakhpur',
  state: 'Uttar Pradesh',
  cropCode: null,
  cropName: null,
};

const CAP_XML = `<?xml version="1.0"?>
<alerts>
  <alert>
    <info>
      <event>Flood Warning</event>
      <severity>Severe</severity>
      <headline>Flood warning for Gorakhpur district</headline>
      <description>Heavy rainfall expected over the next 48 hours.</description>
      <areaDesc>Gorakhpur, Uttar Pradesh</areaDesc>
      <effective>2026-08-28T10:00:00+05:30</effective>
      <web>https://sachet.ndma.gov.in/alert/123</web>
    </info>
  </alert>
  <alert>
    <info>
      <event>Cyclone Watch</event>
      <severity>Moderate</severity>
      <headline>Cyclone watch for coastal Odisha</headline>
      <areaDesc>Puri, Odisha</areaDesc>
      <effective>2026-08-28T10:00:00+05:30</effective>
      <web>https://sachet.ndma.gov.in/alert/456</web>
    </info>
  </alert>
</alerts>`;

function xmlAlways(body: string, status = 200) {
  return jest.fn<typeof fetch>().mockImplementation(async () => new Response(body, { status }));
}

const originalFetch = global.fetch;

beforeEach(() => {
  resetUpdatesCache();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchSachetUpdates', () => {
  it('parses a CAP alert whose area matches the farm district', async () => {
    global.fetch = xmlAlways(CAP_XML);

    const updates = await fetchSachetUpdates(CTX);

    expect(updates).toHaveLength(1);
    expect(updates[0]?.title).toBe('Flood warning for Gorakhpur district');
    expect(updates[0]?.source).toEqual({ name: 'National Disaster Management Authority (SACHET)', type: 'official' });
    expect(updates[0]?.severity).toBe('high');
    expect(updates[0]?.sourceUrl).toBe('https://sachet.ndma.gov.in/alert/123');
  });

  it('never shows an alert for a district/state the farm is not in', async () => {
    global.fetch = xmlAlways(CAP_XML);

    const updates = await fetchSachetUpdates(CTX);

    expect(updates.some((u) => u.title.includes('Odisha'))).toBe(false);
  });

  it('returns an empty list, not a throw, when SACHET is unreachable', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('down'));

    await expect(fetchSachetUpdates(CTX)).resolves.toEqual([]);
  });

  it('returns an empty list rather than fabricating an alert from malformed XML', async () => {
    global.fetch = xmlAlways('not xml at all');

    await expect(fetchSachetUpdates(CTX)).resolves.toEqual([]);
  });

  it('returns an empty list on a non-2xx response', async () => {
    global.fetch = xmlAlways('', 500);

    await expect(fetchSachetUpdates(CTX)).resolves.toEqual([]);
  });
});
