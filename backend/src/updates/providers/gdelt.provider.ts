import { createHash } from 'node:crypto';

import { getEnv } from '../../config/env.js';
import { cached } from '../cache.js';
import { AGRICULTURE_TERMS, MARKET_TERMS, RISK_TERMS, TECHNOLOGY_TERMS, matchKeywords, orClause } from '../keywords.js';
import type { KrishiUpdate, UpdateCategory, UpdatesQueryContext } from '../types.js';

/**
 * GDELT DOC 2.0 (news article search). P0 provider — see
 * https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/.
 *
 * The actual response shape was confirmed with a real request during
 * development rather than assumed:
 *
 *   GET https://api.gdeltproject.org/api/v2/doc/doc
 *       ?query=...&mode=artlist&format=json&maxrecords=15&timespan=7d&sort=datedesc
 *
 *   { "articles": [ { "url", "url_mobile", "title", "seendate"
 *                      ("20260829T094500Z" — no separators), "socialimage",
 *                      "domain", "language", "sourcecountry" } ] }
 *
 * There is no summary/description field and no per-article coordinates —
 * DOC 2.0 is a text search, not the separate GEO 2.0 API (which returns
 * point geometry for a map, not a clean article feed, and was not usable
 * here for that reason — see the file comment on `scoreUpdate` for how this
 * shapes the location-relevance rules). That is why `near:LAT,LON,radius`
 * geo semantics are not used below: instead, the farm's own district/state
 * names are searched for directly in each query, and matched again against
 * each returned title to say honestly which geographic tier (district,
 * state, national) actually applies — never a fabricated distance.
 */

const TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RECORDS = 15;
const TIMESPAN = '7d';

type GdeltArticle = {
  url?: unknown;
  title?: unknown;
  seendate?: unknown;
  domain?: unknown;
  sourcecountry?: unknown;
};

type GdeltResponse = { articles?: unknown };

export class GdeltProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'GdeltProviderError';
  }
}

function quoted(term: string): string {
  return term.includes(' ') ? `"${term}"` : term;
}

/** "20260829T094500Z" -> "2026-08-29T09:45:00Z". Falls back to now on anything unexpected, rather than throwing. */
function parseSeenDate(seendate: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate);
  if (!match) return new Date().toISOString();
  const [, y, mo, d, h, mi, s] = match;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

function isFiniteRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Keeps only the fields this provider actually uses, from an otherwise-untyped JSON body. */
function readArticles(payload: unknown): GdeltArticle[] {
  if (!isFiniteRecord(payload)) return [];
  const articles = (payload as GdeltResponse).articles;
  if (!Array.isArray(articles)) return [];
  return articles.filter(isFiniteRecord) as GdeltArticle[];
}

async function fetchGdelt(query: string, apiUrl: string): Promise<GdeltArticle[]> {
  const url = new URL(apiUrl);
  url.searchParams.set('query', query);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxrecords', String(MAX_RECORDS));
  url.searchParams.set('timespan', TIMESPAN);
  url.searchParams.set('sort', 'datedesc');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    } catch (cause) {
      throw new GdeltProviderError('Could not reach GDELT', cause);
    }

    if (!response.ok) {
      throw new GdeltProviderError(`GDELT returned HTTP ${response.status}`);
    }

    // GDELT occasionally answers a bad query with an HTTP-200 HTML/plaintext
    // error page rather than JSON — treated as "no results" rather than a hard
    // failure, since a partial feed beats no feed.
    const text = await response.text();
    if (!text.trim()) return [];

    try {
      return readArticles(JSON.parse(text));
    } catch {
      return [];
    }
  } finally {
    clearTimeout(timeout);
  }
}

function categoryFor(matched: string[]): UpdateCategory {
  if (matched.some((term) => RISK_TERMS.includes(term))) return 'risk';
  // Agritech/innovation: the dedicated query (see `buildQueries`) already ANDs
  // a technology term with an agriculture-context term server-side, so a
  // title matching one of these here is never a false positive from an
  // unrelated "AI"/"drone" story outside farming.
  if (matched.some((term) => TECHNOLOGY_TERMS.some((m) => m.toLowerCase() === term.toLowerCase()))) return 'technology';
  if (matched.some((term) => MARKET_TERMS.some((m) => m.toLowerCase() === term.toLowerCase()))) return 'market';
  return 'agriculture';
}

function severityFor(category: UpdateCategory, matched: string[]): KrishiUpdate['severity'] | undefined {
  if (category !== 'risk') return undefined;
  const HIGH = ['flood', 'cyclone', 'landslide', 'cloudburst'];
  return matched.some((term) => HIGH.includes(term.toLowerCase())) ? 'high' : 'moderate';
}

/** Which geographic tier the article's *text* actually supports — never invented. */
function geoTierFor(
  title: string,
  ctx: UpdatesQueryContext,
): { district?: string; state?: string } {
  const lower = title.toLowerCase();
  if (ctx.district && lower.includes(ctx.district.toLowerCase())) return { district: ctx.district };
  if (ctx.state && lower.includes(ctx.state.toLowerCase())) return { state: ctx.state };
  return {};
}

function toKrishiUpdate(article: GdeltArticle, ctx: UpdatesQueryContext): KrishiUpdate | null {
  const url = typeof article.url === 'string' ? article.url : null;
  const title = typeof article.title === 'string' ? article.title : null;
  const seendate = typeof article.seendate === 'string' ? article.seendate : null;
  const domain = typeof article.domain === 'string' ? article.domain : 'GDELT';
  const sourcecountry = typeof article.sourcecountry === 'string' ? article.sourcecountry : undefined;

  // A result missing its own identity or link cannot be shown or deduplicated.
  if (!url || !title || !seendate) return null;

  const matchedTerms = [
    ...matchKeywords(title, RISK_TERMS),
    ...matchKeywords(title, TECHNOLOGY_TERMS),
    ...matchKeywords(title, AGRICULTURE_TERMS),
    ...(ctx.cropName ? matchKeywords(title, [ctx.cropName]) : []),
  ];
  const category = categoryFor(matchedTerms);
  const geo = geoTierFor(title, ctx);

  return {
    id: `gdelt:${createHash('sha1').update(url).digest('hex').slice(0, 20)}`,
    title,
    category,
    source: { name: domain, type: 'reported' },
    sourceUrl: url,
    publishedAt: parseSeenDate(seendate),
    location: {
      country: sourcecountry,
      district: geo.district,
      state: geo.state,
    },
    severity: severityFor(category, matchedTerms),
    relevance: { score: 0, reasons: [] },
    tags: [...new Set(matchedTerms.map((term) => term.toLowerCase()))],
  };
}

/** Agriculture/farming context terms an agritech story must also carry — kept separate from `AGRICULTURE_TERMS` so this stays a short, deliberate clause rather than the whole (much larger) list. */
const AGRITECH_CONTEXT_TERMS = ['agriculture', 'farming', 'farmer', 'crop'];

/**
 * Builds the small, fixed set of queries this provider runs per farm
 * request: one scoped to the farm's district/state (when known), one
 * national-scope query for agriculture/crop/policy news that is not tied to
 * a locality, and one national agritech/innovation query. Three requests,
 * not twenty — kept small and cacheable per the product brief.
 *
 * The agritech query ANDs a technology term with an agriculture-context term
 * (GDELT's query syntax is an implicit AND between space-separated clauses) —
 * this is what keeps a generic "AI"/"drone" story with no farming connection
 * out of the feed entirely, rather than relying on classification alone.
 */
function buildQueries(ctx: UpdatesQueryContext): string[] {
  const topicTerms = [...RISK_TERMS, ...AGRICULTURE_TERMS, ...(ctx.cropName ? [ctx.cropName] : [])];
  const topicClause = orClause(topicTerms);

  const queries: string[] = [];

  const localityTerms = [ctx.district, ctx.state].filter((v): v is string => !!v);
  if (localityTerms.length > 0) {
    const localityClause = `(${localityTerms.map(quoted).join(' OR ')})`;
    queries.push(`${localityClause} ${topicClause} sourcecountry:India`);
  }

  const nationalTerms = [...AGRICULTURE_TERMS, ...(ctx.cropName ? [ctx.cropName] : [])];
  queries.push(`${orClause(nationalTerms)} sourcecountry:India`);

  queries.push(`${orClause(TECHNOLOGY_TERMS)} ${orClause(AGRITECH_CONTEXT_TERMS)} sourcecountry:India`);

  return queries;
}

function cacheKeyFor(query: string): string {
  return `gdelt:${createHash('sha1').update(query).digest('hex')}`;
}

export async function fetchGdeltUpdates(ctx: UpdatesQueryContext): Promise<KrishiUpdate[]> {
  const env = getEnv();
  const queries = buildQueries(ctx);

  const results = await Promise.allSettled(
    queries.map((query) => cached(cacheKeyFor(query), TTL_MS, () => fetchGdelt(query, env.GDELT_API_URL))),
  );

  const updates: KrishiUpdate[] = [];
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const article of result.value) {
      const update = toKrishiUpdate(article, ctx);
      if (update) updates.push(update);
    }
  }

  return updates;
}
