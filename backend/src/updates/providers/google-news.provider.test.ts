import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { fetchGoogleNewsUpdates } = await import('./google-news.provider.js');
const { resetUpdatesCache } = await import('../cache.js');
import type { UpdatesQueryContext } from '../types.js';

const CTX: UpdatesQueryContext = {
  farmId: 'farm-1',
  latitude: 26.92,
  longitude: 75.79,
  district: 'Jaipur',
  state: 'Rajasthan',
  cropCode: null,
  cropName: null,
};

function rssItem(overrides: Partial<{ title: string; link: string; pubDate: string; source: string }> = {}): string {
  const title = overrides.title ?? 'Fatehnagar mandi reports rising crop prices amid strong farmer demand';
  const link = overrides.link ?? 'https://news.google.com/rss/articles/some-id-1';
  const pubDate = overrides.pubDate ?? 'Tue, 01 Sep 2026 04:56:17 GMT';
  const sourceTag = overrides.source === undefined ? '<source url="https://example-publisher.test">Example Publisher</source>' : overrides.source;
  return `<item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate><description>...</description>${sourceTag}</item>`;
}

function rssFeed(items: string[]): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Google News</title>${items.join('')}</channel></rss>`;
}

/** A fresh Response per call — same reasoning as the GDELT provider's own test helper. */
function xmlAlways(body: string, status = 200): jest.Mock<typeof fetch> {
  return jest.fn<typeof fetch>().mockImplementation(async () => new Response(body, { status }));
}

const originalFetch = global.fetch;

beforeEach(() => {
  resetUpdatesCache();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchGoogleNewsUpdates — RSS parsing', () => {
  it('normalizes a real-shaped Google News RSS item into KrishiUpdate', async () => {
    global.fetch = xmlAlways(rssFeed([rssItem()]));

    const result = await fetchGoogleNewsUpdates(CTX);

    const update = result.updates.find((u) => u.sourceUrl === 'https://news.google.com/rss/articles/some-id-1');
    expect(update).toBeDefined();
    expect(update!.title).toBe('Fatehnagar mandi reports rising crop prices amid strong farmer demand');
    expect(update!.source).toEqual({ name: 'Example Publisher', type: 'reported' });
    expect(update!.category).toBe('agriculture');
  });

  it('falls back to the redirect link\'s own hostname when <source> is missing', async () => {
    global.fetch = xmlAlways(
      rssFeed([rssItem({ source: '', link: 'https://news.google.com/rss/articles/no-source-id' })]),
    );

    const result = await fetchGoogleNewsUpdates(CTX);
    const update = result.updates.find((u) => u.sourceUrl === 'https://news.google.com/rss/articles/no-source-id');

    expect(update?.source.name).toBe('news.google.com');
    expect(update?.source.type).toBe('reported');
  });

  it('drops an item missing a title or link rather than guessing', async () => {
    const malformed = '<item><pubDate>Tue, 01 Sep 2026 04:56:17 GMT</pubDate></item>';
    global.fetch = xmlAlways(rssFeed([malformed, rssItem()]));

    const result = await fetchGoogleNewsUpdates(CTX);

    expect(result.updates.every((u) => u.sourceUrl && u.title)).toBe(true);
    expect(result.updates.length).toBeGreaterThan(0);
  });

  it('returns an empty list, not a throw, when the feed is unreachable', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('down'));

    const result = await fetchGoogleNewsUpdates(CTX);

    expect(result.updates).toEqual([]);
    expect(result.usefulCount).toBe(0);
  });

  it('returns an empty list on a non-2xx response instead of throwing', async () => {
    global.fetch = xmlAlways('', 500);

    const result = await fetchGoogleNewsUpdates(CTX);

    expect(result.updates).toEqual([]);
  });
});

describe('fetchGoogleNewsUpdates — query strategy (no per-keyword requests)', () => {
  it('fires at most 3 requests (regional, national, agritech)', async () => {
    const fetchMock = xmlAlways(rssFeed([]));
    global.fetch = fetchMock;

    await fetchGoogleNewsUpdates(CTX);

    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('sets the India-locale params on every request', async () => {
    const fetchMock = xmlAlways(rssFeed([]));
    global.fetch = fetchMock;

    await fetchGoogleNewsUpdates(CTX);

    for (const call of fetchMock.mock.calls) {
      const url = new URL(String(call[0]));
      expect(url.searchParams.get('hl')).toBe('en-IN');
      expect(url.searchParams.get('gl')).toBe('IN');
      expect(url.searchParams.get('ceid')).toBe('IN:en');
    }
  });

  it('skips the regional query entirely when the farm has no district/state', async () => {
    const fetchMock = xmlAlways(rssFeed([]));
    global.fetch = fetchMock;

    await fetchGoogleNewsUpdates({ ...CTX, district: null, state: null });

    expect(fetchMock.mock.calls.length).toBe(2);
  });
});

describe('fetchGoogleNewsUpdates — regional vs national classification', () => {
  it('tags a regional-query result with the farm district only when the title names it', async () => {
    let call = 0;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return new Response(
          rssFeed([rssItem({ title: 'Jaipur farmers report strong mandi crop demand this week', link: 'https://news.google.com/rss/articles/regional-1' })]),
          { status: 200 },
        );
      }
      return new Response(rssFeed([]), { status: 200 });
    });

    const result = await fetchGoogleNewsUpdates(CTX);
    const update = result.updates.find((u) => u.sourceUrl === 'https://news.google.com/rss/articles/regional-1');

    expect(update?.location?.district).toBe('Jaipur');
  });

  it('does not tag a national-query result as regional', async () => {
    let call = 0;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      call += 1;
      if (call === 2) {
        return new Response(
          rssFeed([rssItem({ title: 'India raises MSP for wheat to benefit farmers nationwide', link: 'https://news.google.com/rss/articles/national-1' })]),
          { status: 200 },
        );
      }
      return new Response(rssFeed([]), { status: 200 });
    });

    const result = await fetchGoogleNewsUpdates(CTX);
    const update = result.updates.find((u) => u.sourceUrl === 'https://news.google.com/rss/articles/national-1');

    expect(update).toBeDefined();
    expect(update?.location?.district).toBeUndefined();
    expect(update?.location?.state).toBeUndefined();
  });
});

describe('fetchGoogleNewsUpdates — shared relevance/scheme filters', () => {
  it('rejects a scheme-discovery article', async () => {
    global.fetch = xmlAlways(
      rssFeed([rssItem({ title: 'PM-KISAN Yojana: eligibility and how to apply online', link: 'https://news.google.com/rss/articles/scheme-1' })]),
    );

    const result = await fetchGoogleNewsUpdates(CTX);

    expect(result.updates.some((u) => u.sourceUrl === 'https://news.google.com/rss/articles/scheme-1')).toBe(false);
  });

  it('rejects a headline with no real agriculture signal', async () => {
    global.fetch = xmlAlways(
      rssFeed([rssItem({ title: "Farmer's son becomes kabaddi captain", link: 'https://news.google.com/rss/articles/kabaddi-1' })]),
    );

    const result = await fetchGoogleNewsUpdates(CTX);

    expect(result.updates.some((u) => u.sourceUrl === 'https://news.google.com/rss/articles/kabaddi-1')).toBe(false);
  });

  it('classifies a precision-farming headline as agritech', async () => {
    global.fetch = xmlAlways(
      rssFeed([rssItem({ title: 'Precision farming drone adoption grows among Indian farmers', link: 'https://news.google.com/rss/articles/agritech-1' })]),
    );

    const result = await fetchGoogleNewsUpdates(CTX);
    const update = result.updates.find((u) => u.sourceUrl === 'https://news.google.com/rss/articles/agritech-1');

    expect(update?.category).toBe('technology');
  });
});

describe('fetchGoogleNewsUpdates — failure diagnostics', () => {
  it('logs status/received per query and a usefulAfterFilter summary', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch = xmlAlways(rssFeed([rssItem()]));

    await fetchGoogleNewsUpdates(CTX);

    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => /^\[updates:google-news\] query=regional status=200 received=\d+$/.test(l))).toBe(true);
    expect(lines.some((l) => l.startsWith('[updates:google-news] received='))).toBe(true);
    logSpy.mockRestore();
  });

  it('distinguishes network failure from HTTP error', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));

    await fetchGoogleNewsUpdates(CTX);

    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('failed=network'))).toBe(true);
    logSpy.mockRestore();
  });
});
