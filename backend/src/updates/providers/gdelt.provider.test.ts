import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { fetchGdeltUpdates, fetchGdeltUpdatesDetailed } = await import('./gdelt.provider.js');
const { resetUpdatesCache } = await import('../cache.js');
const { resetEnvCache } = await import('../../config/env.js');
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

function gdeltArticle(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://news.example.com/mandi-gorakhpur',
    url_mobile: '',
    title: 'Gorakhpur mandi reports strong wheat crop arrivals this week',
    seendate: '20260829T094500Z',
    socialimage: '',
    domain: 'news.example.com',
    language: 'English',
    sourcecountry: 'India',
    ...overrides,
  };
}

/**
 * The provider fires its (small, fixed) set of GDELT queries concurrently, so
 * a mock must hand back a *fresh* Response per call — a Fetch API Response
 * body can only be read once, and `mockResolvedValue(sameInstance)` would
 * have two concurrent `.text()` reads race over one body.
 */
function jsonAlways(body: unknown, status = 200): jest.Mock<typeof fetch> {
  return jest.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

const originalFetch = global.fetch;

beforeEach(() => {
  resetUpdatesCache();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchGdeltUpdates', () => {
  it('normalizes a real-shaped GDELT DOC 2.0 response into KrishiUpdate', async () => {
    global.fetch = jsonAlways({ articles: [gdeltArticle()] });

    const updates = await fetchGdeltUpdates(CTX);

    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/mandi-gorakhpur');
    expect(update).toBeDefined();
    expect(update!.title).toBe('Gorakhpur mandi reports strong wheat crop arrivals this week');
    expect(update!.source).toEqual({ name: 'news.example.com', type: 'reported' });
    expect(update!.publishedAt).toBe('2026-08-29T09:45:00Z');
    expect(update!.category).toBe('agriculture');
  });

  it('tags a regional-query result with the farm district only when the title itself names it', async () => {
    global.fetch = jsonAlways({ articles: [gdeltArticle()] });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.some((u) => u.location?.district === 'Gorakhpur')).toBe(true);
  });

  it('leaves district/state unset when the title does not mention them', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'MSP for wheat raised nationally to benefit farmers', url: 'https://news.example.com/msp' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/msp');

    expect(update).toBeDefined();
    expect(update!.location?.district).toBeUndefined();
    expect(update!.location?.state).toBeUndefined();
  });

  it('tags the farm crop when the title mentions it', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'Wheat procurement rules changed for the coming harvest', url: 'https://news.example.com/wheat' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/wheat');

    expect(update?.tags).toContain('wheat');
  });

  it('drops an article missing a url, title, or date rather than guessing', async () => {
    global.fetch = jsonAlways({ articles: [{ title: 'No url here' }, gdeltArticle()] });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.every((u) => u.sourceUrl && u.title)).toBe(true);
    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/mandi-gorakhpur')).toBe(true);
  });

  it('returns an empty list, not a throw, when GDELT is unreachable', async () => {
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('network down'));

    await expect(fetchGdeltUpdates(CTX)).resolves.toEqual([]);
  });

  it('returns an empty list when GDELT answers with a non-JSON body', async () => {
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => new Response('<html>error</html>', { status: 200 }));

    await expect(fetchGdeltUpdates(CTX)).resolves.toEqual([]);
  });

  it('returns an empty list on a non-2xx response instead of throwing', async () => {
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => new Response('rate limited', { status: 429 }));

    await expect(fetchGdeltUpdates(CTX)).resolves.toEqual([]);
  });

  it('caches identical queries rather than refetching', async () => {
    const fetchMock = jsonAlways({ articles: [gdeltArticle()] });
    global.fetch = fetchMock;

    await fetchGdeltUpdates(CTX);
    const callsAfterFirst = fetchMock.mock.calls.length;
    await fetchGdeltUpdates(CTX);

    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('fetchGdeltUpdates — query composition (regional/national/agritech, 3 requests max)', () => {
  it('builds exactly 3 queries for a farm with a district and state', async () => {
    const fetchMock = jsonAlways({ articles: [] });
    global.fetch = fetchMock;

    await fetchGdeltUpdates(CTX);

    expect(fetchMock.mock.calls.length).toBe(3);
  });

  it('keeps the regional query agriculture-only — no disaster/risk terms (SACHET owns those)', async () => {
    const fetchMock = jsonAlways({ articles: [] });
    global.fetch = fetchMock;

    await fetchGdeltUpdates(CTX);

    const queries = fetchMock.mock.calls.map((call) => decodeURIComponent(new URL(String(call[0])).searchParams.get('query') ?? ''));
    const regionalQuery = queries.find((q) => q.includes('Gorakhpur'));
    expect(regionalQuery).toBeDefined();
    expect(regionalQuery).not.toMatch(/flood|cyclone|drought|hailstorm|heatwave|landslide/i);
    expect(regionalQuery).toMatch(/agriculture/i);
  });

  it('keeps the agritech query short (no 20-term list) while still ANDing a technology term with an agriculture-context clause', async () => {
    const fetchMock = jsonAlways({ articles: [] });
    global.fetch = fetchMock;

    await fetchGdeltUpdates(CTX);

    const queries = fetchMock.mock.calls.map((call) => decodeURIComponent(new URL(String(call[0])).searchParams.get('query') ?? ''));
    const agritechQuery = queries.find((q) => q.includes('agritech'));
    expect(agritechQuery).toBeDefined();
    // The old (removed) 20-term technology list alone ran past 400 characters
    // before even adding the context clause — this just needs to stay well
    // short of that, not hit an exact number.
    expect(agritechQuery!.length).toBeLessThan(400);
    expect(agritechQuery).toMatch(/agriculture|farming|farmer|crop/);
  });
});

describe('fetchGdeltUpdates — regional vs national classification', () => {
  it('classifies a Rajasthan-state-mentioning agriculture headline from the regional query as regional', async () => {
    const ctx: UpdatesQueryContext = { ...CTX, district: 'Jaipur', state: 'Rajasthan', cropCode: null, cropName: null };
    let call = 0;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      call += 1;
      // 1st query fired is the regional one (locality present).
      if (call === 1) {
        return new Response(
          JSON.stringify({ articles: [gdeltArticle({ title: 'Rajasthan farmers report strong mandi crop prices this week', url: 'https://news.example.com/rj-1' })] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ articles: [] }), { status: 200 });
    });

    const updates = await fetchGdeltUpdates(ctx);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/rj-1');

    expect(update?.location?.state).toBe('Rajasthan');
  });

  it('classifies a Jaipur-district-mentioning agriculture headline from the regional query as regional (district)', async () => {
    const ctx: UpdatesQueryContext = { ...CTX, district: 'Jaipur', state: 'Rajasthan', cropCode: null, cropName: null };
    let call = 0;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return new Response(
          JSON.stringify({ articles: [gdeltArticle({ title: 'Jaipur farmers welcome irrigation canal repair ahead of sowing', url: 'https://news.example.com/jaipur-1' })] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ articles: [] }), { status: 200 });
    });

    const updates = await fetchGdeltUpdates(ctx);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/jaipur-1');

    expect(update?.location?.district).toBe('Jaipur');
  });

  it('classifies a national-query agriculture headline as national, without a regional/state badge', async () => {
    const ctx: UpdatesQueryContext = { ...CTX, district: 'Jaipur', state: 'Rajasthan', cropCode: null, cropName: null };
    let call = 0;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      call += 1;
      // 2nd query fired is national.
      if (call === 2) {
        return new Response(
          JSON.stringify({ articles: [gdeltArticle({ title: 'India raises MSP for wheat and other crops nationally', url: 'https://news.example.com/national-1' })] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ articles: [] }), { status: 200 });
    });

    const updates = await fetchGdeltUpdates(ctx);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/national-1');

    expect(update).toBeDefined();
    expect(update?.location?.district).toBeUndefined();
    expect(update?.location?.state).toBeUndefined();
  });

  it('does NOT tag a national-query result as regional even when its title happens to also mention the farm state', async () => {
    const ctx: UpdatesQueryContext = { ...CTX, district: 'Jaipur', state: 'Rajasthan', cropCode: null, cropName: null };
    let call = 0;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      call += 1;
      if (call === 2) {
        return new Response(
          JSON.stringify({
            articles: [
              gdeltArticle({
                title: 'National crop insurance scheme expands coverage from Rajasthan to Assam',
                url: 'https://news.example.com/national-2',
              }),
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ articles: [] }), { status: 200 });
    });

    const updates = await fetchGdeltUpdates(ctx);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/national-2');

    // (This particular headline also happens to read as scheme-discovery content and may be filtered
    // out entirely — either way, it must never appear tagged "regional".)
    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/national-2' && (u.location?.district || u.location?.state))).toBe(false);
  });
});

describe('fetchGdeltUpdates — headline relevance filter', () => {
  it('rejects "farmer\'s son becomes kabaddi captain" — a bare "farmer" mention is not agriculture news', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: "Farmer's son becomes kabaddi captain for state team", url: 'https://news.example.com/kabaddi' })],
    });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/kabaddi')).toBe(false);
  });

  it('rejects a hospital story about an agriculture minister', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'Agriculture minister hospitalized after brief illness', url: 'https://news.example.com/minister-health' })],
    });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/minister-health')).toBe(false);
  });

  it('accepts an actual mandi-price article', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'Fatehnagar mandi reports rising crop prices this week', url: 'https://news.example.com/mandi-price' })],
    });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/mandi-price')).toBe(true);
  });

  it('accepts a relevant irrigation article', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'New irrigation canal to benefit thousands of farmers ahead of sowing season', url: 'https://news.example.com/irrigation' })],
    });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/irrigation')).toBe(true);
  });
});

describe('fetchGdeltUpdates — government scheme exclusion', () => {
  it('rejects an obvious "how to apply" scheme-discovery article', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'PM-KISAN Yojana: eligibility and how to apply online', url: 'https://news.example.com/scheme' })],
    });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/scheme')).toBe(false);
  });

  it('does not reject a legitimate agriculture policy article that mentions subsidy/MSP/procurement', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'Government raises fertilizer subsidy and MSP for wheat procurement', url: 'https://news.example.com/policy' })],
    });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/policy')).toBe(true);
  });
});

describe('fetchGdeltUpdates — agritech classification', () => {
  it('classifies a drone/precision-agriculture headline as technology', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'New agricultural drone spraying platform launched for farmers', url: 'https://news.example.com/drone' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/drone');

    expect(update?.category).toBe('technology');
  });

  it('classifies an AI-in-agriculture headline as technology', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'Artificial intelligence model predicts crop disease early for wheat farmers', url: 'https://news.example.com/ai-crop' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/ai-crop');

    expect(update?.category).toBe('technology');
  });

  it('classifies satellite crop-monitoring coverage as technology', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'Satellite monitoring introduced for irrigation planning on farms', url: 'https://news.example.com/satellite' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/satellite');

    expect(update?.category).toBe('technology');
  });

  it('classifies an ordinary agriculture headline (no tech terms) as agriculture, not technology', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'Irrigation canal repair completed ahead of sowing season for farmers', url: 'https://news.example.com/irrigation-canal' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/irrigation-canal');

    expect(update?.category).toBe('agriculture');
  });

  it('rejects an unrelated AI/drone article with no agriculture context at all', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'New AI chip startup unveils drone for delivery logistics', url: 'https://news.example.com/unrelated-drone' })],
    });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/unrelated-drone')).toBe(false);
  });

  it("builds a dedicated agritech query that ANDs technology terms with an agriculture-context clause — so an unrelated 'AI'/'drone' story never reaches the results", async () => {
    const fetchMock = jsonAlways({ articles: [] });
    global.fetch = fetchMock;

    await fetchGdeltUpdates(CTX);

    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    const agritechCall = calledUrls.find((url) => url.includes('agritech'));
    expect(agritechCall).toBeDefined();
    const query = decodeURIComponent(agritechCall!);
    expect(query).toMatch(/agriculture|farming|farmer|crop/);
  });
});

describe('fetchGdeltUpdates — GDELT_BASE_URL configuration', () => {
  const originalBaseUrl = process.env.GDELT_BASE_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.GDELT_BASE_URL;
    else process.env.GDELT_BASE_URL = originalBaseUrl;
    resetEnvCache();
  });

  it('defaults to https://api.gdeltproject.org and appends the DOC 2.0 path', async () => {
    delete process.env.GDELT_BASE_URL;
    resetEnvCache();
    const fetchMock = jsonAlways({ articles: [gdeltArticle()] });
    global.fetch = fetchMock;

    await fetchGdeltUpdates(CTX);

    const calledUrls = fetchMock.mock.calls.map((call) => new URL(String(call[0])));
    expect(calledUrls.length).toBe(3);
    for (const url of calledUrls) {
      expect(url.origin).toBe('https://api.gdeltproject.org');
      expect(url.pathname).toBe('/api/v2/doc/doc');
    }
  });

  it('honors a configured GDELT_BASE_URL (e.g. the plain-HTTP fallback), still hitting /api/v2/doc/doc', async () => {
    process.env.GDELT_BASE_URL = 'http://api.gdeltproject.org';
    resetEnvCache();
    const fetchMock = jsonAlways({ articles: [gdeltArticle()] });
    global.fetch = fetchMock;

    await fetchGdeltUpdates(CTX);

    const calledUrls = fetchMock.mock.calls.map((call) => new URL(String(call[0])));
    expect(calledUrls.length).toBe(3);
    for (const url of calledUrls) {
      expect(url.protocol).toBe('http:');
      expect(url.origin).toBe('http://api.gdeltproject.org');
      expect(url.pathname).toBe('/api/v2/doc/doc');
    }
  });

  it('preserves query params and a configured base URL with a trailing slash / sub-path alike', async () => {
    process.env.GDELT_BASE_URL = 'https://gdelt.fixture.test/proxy/';
    resetEnvCache();
    const fetchMock = jsonAlways({ articles: [] });
    global.fetch = fetchMock;

    await fetchGdeltUpdates(CTX);

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe('/api/v2/doc/doc');
    expect(url.searchParams.get('mode')).toBe('artlist');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('query')).toBeTruthy();
  });
});

describe('fetchGdeltUpdates — failure diagnostics', () => {
  it('logs status=200 and the received count for a successful query', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch = jsonAlways({ articles: [gdeltArticle()] });

    await fetchGdeltUpdates(CTX);

    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines.some((l) => /^\[updates:gdelt\] query=regional status=200 received=\d+$/.test(l))).toBe(true);
    expect(lines.some((l) => l.startsWith('[updates:gdelt] successfulQueries=3 failedQueries=0'))).toBe(true);
    logSpy.mockRestore();
  });

  it('logs a real HTTP-200-with-zero-articles response as a success with received=0, not a failure', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch = jsonAlways({ articles: [] });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates).toEqual([]);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines.some((l) => /status=200 received=0$/.test(l))).toBe(true);
    expect(lines.some((l) => l.includes('failed='))).toBe(false);
    logSpy.mockRestore();
  });

  it('distinguishes a DNS/network failure from an HTTP error and a timeout', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates).toEqual([]);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines.filter((l) => l.includes('failed=network')).length).toBe(3);
    expect(lines.some((l) => l.startsWith('[updates:gdelt] successfulQueries=0 failedQueries=3'))).toBe(true);
    logSpy.mockRestore();
  });

  it('logs failed=http for a non-2xx response, distinct from network/timeout', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => new Response('rate limited', { status: 429 }));

    await fetchGdeltUpdates(CTX);

    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines.filter((l) => l.includes('failed=http')).length).toBe(3);
    logSpy.mockRestore();
  });

  it('marks a request that exceeds the request-timeout bound as failed=timeout, not failed=network', async () => {
    jest.useFakeTimers();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    global.fetch = jest.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          signal?.addEventListener('abort', () => {
            const err = new Error('This operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const resultPromise = fetchGdeltUpdates(CTX);
    await jest.advanceTimersByTimeAsync(5_000);
    const updates = await resultPromise;

    expect(updates).toEqual([]);
    const lines = logSpy.mock.calls.map((call) => String(call[0]));
    expect(lines.filter((l) => l.includes('failed=timeout')).length).toBe(3);
    expect(lines.some((l) => l.includes('failed=network'))).toBe(false);

    logSpy.mockRestore();
    jest.useRealTimers();
  }, 15_000);

  it('keeps the two other queries when only one of the three GDELT queries fails', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    let call = 0;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      call += 1;
      // The 2nd query (of 3, fired in the same tick) fails; the other two succeed.
      if (call === 2) throw new TypeError('fetch failed');
      return new Response(
        JSON.stringify({ articles: [gdeltArticle({ url: `https://news.example.com/${call}` })] }),
        { status: 200 },
      );
    });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.length).toBeGreaterThan(0);
    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.startsWith('[updates:gdelt] successfulQueries=2 failedQueries=1'))).toBe(true);
    logSpy.mockRestore();
  });
});

describe('fetchGdeltUpdatesDetailed — fallback-decision fields', () => {
  it('reports hadFailure=true when at least one query fails', async () => {
    let call = 0;
    global.fetch = jest.fn<typeof fetch>().mockImplementation(async () => {
      call += 1;
      if (call === 1) throw new TypeError('fetch failed');
      return new Response(JSON.stringify({ articles: [] }), { status: 200 });
    });

    const result = await fetchGdeltUpdatesDetailed(CTX);

    expect(result.hadFailure).toBe(true);
  });

  it('reports hadFailure=false and the correct usefulCount when every query succeeds', async () => {
    global.fetch = jsonAlways({ articles: [gdeltArticle()] });

    const result = await fetchGdeltUpdatesDetailed(CTX);

    expect(result.hadFailure).toBe(false);
    expect(result.usefulCount).toBe(result.updates.length);
    expect(result.usefulCount).toBeGreaterThan(0);
  });
});
