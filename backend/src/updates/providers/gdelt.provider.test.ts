import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { fetchGdeltUpdates } = await import('./gdelt.provider.js');
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

function gdeltArticle(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://news.example.com/flood-gorakhpur',
    url_mobile: '',
    title: 'Flood alert issued for Gorakhpur district amid heavy rain',
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

    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/flood-gorakhpur');
    expect(update).toBeDefined();
    expect(update!.title).toBe('Flood alert issued for Gorakhpur district amid heavy rain');
    expect(update!.source).toEqual({ name: 'news.example.com', type: 'reported' });
    expect(update!.publishedAt).toBe('2026-08-29T09:45:00Z');
    expect(update!.category).toBe('risk');
  });

  it('reads the farm district out of the article title, never a fabricated one', async () => {
    global.fetch = jsonAlways({ articles: [gdeltArticle()] });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.some((u) => u.location?.district === 'Gorakhpur')).toBe(true);
  });

  it('leaves district/state unset when the title does not mention them', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'MSP for wheat raised nationally', url: 'https://news.example.com/msp' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/msp');

    expect(update).toBeDefined();
    expect(update!.location?.district).toBeUndefined();
    expect(update!.location?.state).toBeUndefined();
    expect(update!.location?.country).toBe('India');
  });

  it('tags the farm crop when the title mentions it', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'Wheat procurement rules changed', url: 'https://news.example.com/wheat' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/wheat');

    expect(update?.tags).toContain('wheat');
  });

  it('drops an article missing a url, title, or date rather than guessing', async () => {
    global.fetch = jsonAlways({ articles: [{ title: 'No url here' }, gdeltArticle()] });

    const updates = await fetchGdeltUpdates(CTX);

    expect(updates.every((u) => u.sourceUrl && u.title)).toBe(true);
    expect(updates.some((u) => u.sourceUrl === 'https://news.example.com/flood-gorakhpur')).toBe(true);
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
      articles: [gdeltArticle({ title: 'Satellite monitoring introduced for irrigation planning', url: 'https://news.example.com/satellite' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/satellite');

    expect(update?.category).toBe('technology');
  });

  it('classifies an ordinary agriculture headline (no tech terms) as agriculture, not technology', async () => {
    global.fetch = jsonAlways({
      articles: [gdeltArticle({ title: 'Irrigation canal repair completed ahead of sowing season', url: 'https://news.example.com/irrigation' })],
    });

    const updates = await fetchGdeltUpdates(CTX);
    const update = updates.find((u) => u.sourceUrl === 'https://news.example.com/irrigation');

    expect(update?.category).toBe('agriculture');
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
