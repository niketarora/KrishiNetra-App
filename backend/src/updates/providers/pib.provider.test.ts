import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { fetchPibUpdates } = await import('./pib.provider.js');
const { resetUpdatesCache } = await import('../cache.js');
import type { UpdatesQueryContext } from '../types.js';

const CTX: UpdatesQueryContext = {
  farmId: 'farm-1',
  latitude: 26.76,
  longitude: 83.37,
  district: 'Gorakhpur',
  state: 'Uttar Pradesh',
  cropCode: 'wheat',
  cropName: 'Wheat',
};

const RSS_XML = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Cabinet approves increase in MSP for wheat</title>
    <link>https://pib.gov.in/PressReleasePage.aspx?PRID=1</link>
    <description>The Cabinet Committee on Economic Affairs approved MSP for Rabi crops.</description>
    <pubDate>Fri, 28 Aug 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Ministry of Culture announces new exhibition</title>
    <link>https://pib.gov.in/PressReleasePage.aspx?PRID=2</link>
    <description>A new exhibition opens next month.</description>
    <pubDate>Fri, 28 Aug 2026 09:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

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

describe('fetchPibUpdates', () => {
  it('keeps an agriculture/MSP announcement', async () => {
    global.fetch = xmlAlways(RSS_XML);

    const updates = await fetchPibUpdates(CTX);

    expect(updates.some((u) => u.title.includes('MSP for wheat'))).toBe(true);
  });

  it('filters out an unrelated ministry announcement rather than showing every PIB item', async () => {
    global.fetch = xmlAlways(RSS_XML);

    const updates = await fetchPibUpdates(CTX);

    expect(updates.some((u) => u.title.includes('Culture'))).toBe(false);
  });

  it('marks results as an official government source', async () => {
    global.fetch = xmlAlways(RSS_XML);

    const [update] = await fetchPibUpdates(CTX);

    expect(update?.source.type).toBe('official');
  });

  it('returns an empty list, not a throw, when PIB is unreachable', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('down'));

    await expect(fetchPibUpdates(CTX)).resolves.toEqual([]);
  });

  it('returns an empty list rather than fabricating an announcement from malformed XML', async () => {
    global.fetch = xmlAlways('not xml at all');

    await expect(fetchPibUpdates(CTX)).resolves.toEqual([]);
  });
});
