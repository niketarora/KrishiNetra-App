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
  district: 'Jaipur',
  state: 'Rajasthan',
  cropCode: null,
  cropName: null,
};

/**
 * The real, live shape of `https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml`
 * as confirmed by manual request during investigation: plain RSS 2.0 `<item>`s
 * whose district/state appear only in prose (title/description), not a
 * structured `<area>` block.
 */
const REAL_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Heavy rainfall warning issued for Jaipur District, Rajasthan</title>
    <link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=111</link>
    <guid>111</guid>
    <category>Met</category>
    <description>Heavy to very heavy rainfall likely over Jaipur district, Rajasthan in the next 24 hours.</description>
    <pubDate>Tue, 01 Sep 2026 04:56:17 GMT</pubDate>
  </item>
  <item>
    <title>Cyclone watch for coastal Odisha</title>
    <link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=222</link>
    <guid>222</guid>
    <category>Met</category>
    <description>A cyclonic circulation is likely to affect Puri, Odisha.</description>
    <pubDate>Tue, 01 Sep 2026 03:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

/** A full CAP 1.2 document, namespaced the way SACHET's per-alert `FetchXMLFile` record is — kept parseable in case the feed ever serves this shape directly. */
const NAMESPACED_CAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
  <cap:identifier>333</cap:identifier>
  <cap:sent>2026-08-28T10:00:00+05:30</cap:sent>
  <cap:info>
    <cap:event>Flood Warning</cap:event>
    <cap:severity>Severe</cap:severity>
    <cap:urgency>Immediate</cap:urgency>
    <cap:certainty>Observed</cap:certainty>
    <cap:headline>Flood warning for Jaipur district</cap:headline>
    <cap:description>River levels rising above danger mark near Jaipur.</cap:description>
    <cap:instruction>Move to higher ground if near the riverbank.</cap:instruction>
    <cap:effective>2026-08-28T10:00:00+05:30</cap:effective>
    <cap:expires>2026-08-29T10:00:00+05:30</cap:expires>
    <cap:area>
      <cap:areaDesc>Jaipur District, Rajasthan</cap:areaDesc>
    </cap:area>
  </cap:info>
</cap:alert>`;

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

describe('fetchSachetUpdates — real RSS feed shape', () => {
  it('parses an item whose title/description name the farm district', async () => {
    global.fetch = xmlAlways(REAL_RSS_XML);

    const updates = await fetchSachetUpdates(CTX);

    expect(updates).toHaveLength(1);
    expect(updates[0]?.title).toBe('Heavy rainfall warning issued for Jaipur District, Rajasthan');
    expect(updates[0]?.source).toEqual({ name: 'National Disaster Management Authority (SACHET)', type: 'official' });
    expect(updates[0]?.category).toBe('risk');
  });

  it('never shows an alert for a district/state the farm is not in', async () => {
    global.fetch = xmlAlways(REAL_RSS_XML);

    const updates = await fetchSachetUpdates(CTX);

    expect(updates.some((u) => u.title.includes('Odisha'))).toBe(false);
  });

  it('matches "Jaipur District, Rajasthan" text against farm.district="Jaipur" (normalized, tolerant match)', async () => {
    global.fetch = xmlAlways(REAL_RSS_XML);

    const updates = await fetchSachetUpdates(CTX);

    expect(updates[0]?.location?.district).toBe('Jaipur');
  });

  it('never invents a distance — SACHET carries no coordinates', async () => {
    global.fetch = xmlAlways(REAL_RSS_XML);

    const updates = await fetchSachetUpdates(CTX);

    expect(updates[0]?.location?.latitude).toBeUndefined();
    expect(updates[0]?.location?.longitude).toBeUndefined();
    expect(updates[0]?.relevance.distanceKm).toBeUndefined();
  });

  it('matches on state alone when the district is not mentioned', async () => {
    const ctx: UpdatesQueryContext = { ...CTX, district: 'Alwar' };
    global.fetch = xmlAlways(REAL_RSS_XML);

    const updates = await fetchSachetUpdates(ctx);

    expect(updates).toHaveLength(1);
    expect(updates[0]?.location?.district).toBeUndefined();
    expect(updates[0]?.location?.state).toBe('Rajasthan');
  });
});

describe('fetchSachetUpdates — namespaced CAP shape', () => {
  it('parses a namespaced <cap:info>/<cap:area> document', async () => {
    global.fetch = xmlAlways(NAMESPACED_CAP_XML);

    const updates = await fetchSachetUpdates(CTX);

    expect(updates).toHaveLength(1);
    expect(updates[0]?.title).toBe('Flood warning for Jaipur district');
    expect(updates[0]?.severity).toBe('high');
    expect(updates[0]?.summary).toBe('River levels rising above danger mark near Jaipur.');
    expect(updates[0]?.sourceUrl).toContain('333');
  });
});

describe('fetchSachetUpdates — failure handling', () => {
  it('returns an empty list, not a throw, when SACHET is unreachable', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('down'));

    await expect(fetchSachetUpdates(CTX)).resolves.toEqual([]);
  });

  it('returns an empty list rather than fabricating an alert from malformed XML', async () => {
    global.fetch = xmlAlways('not xml at all');

    await expect(fetchSachetUpdates(CTX)).resolves.toEqual([]);
  });

  it('returns an empty list when the configured URL serves the HTML documentation page (the historical misconfiguration)', async () => {
    global.fetch = xmlAlways('<html><body>Subscribe to our RSS feed. Download the user guide.</body></html>');

    await expect(fetchSachetUpdates(CTX)).resolves.toEqual([]);
  });

  it('returns an empty list on a non-2xx response', async () => {
    global.fetch = xmlAlways('', 500);

    await expect(fetchSachetUpdates(CTX)).resolves.toEqual([]);
  });
});
