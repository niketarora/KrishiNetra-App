import { createHash } from 'node:crypto';

import { getEnv } from '../../config/env.js';
import { cached } from '../cache.js';
import { isAgricultureHeadline, isAgritechHeadline, isSchemeArticle } from '../filters.js';
import { AGRICULTURE_TERMS, AGRITECH_CONTEXT_TERMS, AGRITECH_QUERY_TERMS, matchKeywords, orClause } from '../keywords.js';
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
 * here for that reason). That is why `near:LAT,LON,radius` geo semantics
 * are not used below: instead, only the *regional* query's own results are
 * ever checked for the farm's district/state name in the title (see
 * `geoTierFor` and `toKrishiUpdate`) — a national/agritech-query result is
 * never retagged "regional" just because its title happens to also mention
 * the state, which is what previously caused national articles to carry a
 * "Regional News" badge.
 *
 * The host is configurable via `GDELT_BASE_URL` (`config/env.ts`), not
 * hardcoded — confirmed during investigation that `https://api.gdeltproject.org`
 * is unreachable from some Windows/network environments while the identical
 * DOC 2.0 API answers over plain `http://api.gdeltproject.org`. This file
 * only ever appends the fixed `/api/v2/doc/doc` path to whatever host that
 * variable names (see `buildDocUrl`); it never hardcodes the scheme or host
 * itself. `sourcecountry:India` (used as-is, not a FIPS code) was confirmed
 * live-working against this same API and is deliberately left alone.
 *
 * GDELT itself was also confirmed, live, to return real regional content for
 * Rajasthan/Jaipur — the earlier "regional query returns 0" symptom was a
 * retrieval/relevance problem, not a data-availability one: mixing disaster
 * terms into the regional query (SACHET already owns disasters) made it
 * needlessly complex, and GDELT's full-text search matches terms outside the
 * visible headline, so a raw match is not enough evidence of real relevance.
 * `isAgricultureHeadline`/`isAgritechHeadline`/`isSchemeArticle` (see
 * `filters.ts`) are the deterministic headline-level filter this file now
 * applies after retrieval, and the regional query itself was simplified back
 * to `(district OR state) (agriculture-only terms) sourcecountry:India` —
 * still exactly 3 requests total (regional, national, agritech), never more,
 * respecting GDELT's demonstrated rate-limit sensitivity during live testing.
 */

const TTL_MS = 15 * 60 * 1000;
// The three queries below run concurrently (see `fetchGdeltUpdatesDetailed`),
// so this is the entire worst-case latency this provider can add to
// /updates, not a per-query addend — kept tight so one unreachable GDELT
// endpoint can't push the whole feed response close to double digits of
// seconds.
const REQUEST_TIMEOUT_MS = 5_000;
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

/** What actually went wrong, kept distinct so diagnostics can tell a slow/unreachable network apart from GDELT itself rejecting the query. */
type GdeltFailureKind = 'timeout' | 'network' | 'http';

export class GdeltProviderError extends Error {
  readonly kind: GdeltFailureKind;

  constructor(message: string, kind: GdeltFailureKind, cause?: unknown) {
    super(message, { cause });
    this.name = 'GdeltProviderError';
    this.kind = kind;
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

type GdeltQueryResult = { status: number; articles: GdeltArticle[] };

/** GDELT DOC 2.0's fixed endpoint path, appended to whichever host `GDELT_BASE_URL` names. */
const DOC_ENDPOINT_PATH = '/api/v2/doc/doc';

/** `new URL(path, base)` replaces `base`'s own path entirely (per the WHATWG URL spec) regardless of a trailing slash on `baseUrl`, so this is safe with or without one. */
function buildDocUrl(baseUrl: string): URL {
  return new URL(DOC_ENDPOINT_PATH, baseUrl);
}

/**
 * A single GDELT request. Never resolves to "no results" by swallowing a
 * real failure — a genuine network/timeout/HTTP failure always throws a
 * `GdeltProviderError` carrying which of the three it was, so the caller can
 * log (and the cache can refuse to remember) an honest failure rather than a
 * false "zero articles". Only an actual HTTP success with an empty/malformed
 * body is treated as "zero articles" — GDELT occasionally answers a bad query
 * with an HTTP-200 HTML/plaintext error page rather than JSON, and that is a
 * real "no results", not a transport failure.
 */
async function fetchGdelt(query: string, baseUrl: string): Promise<GdeltQueryResult> {
  const url = buildDocUrl(baseUrl);
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
      // `controller.signal.aborted` is only ever true here because our own
      // timer fired — any other fetch failure (DNS, connection refused, TLS,
      // …) leaves it false. That's the one reliable way to tell "GDELT is
      // just slow" apart from "GDELT is unreachable" without inspecting
      // engine-specific error names/codes, which differ across Node versions.
      if (controller.signal.aborted) {
        throw new GdeltProviderError(`GDELT request timed out after ${REQUEST_TIMEOUT_MS}ms`, 'timeout', cause);
      }
      throw new GdeltProviderError('Could not reach GDELT', 'network', cause);
    }

    if (!response.ok) {
      throw new GdeltProviderError(`GDELT returned HTTP ${response.status}`, 'http');
    }

    const text = await response.text();
    if (!text.trim()) return { status: response.status, articles: [] };

    try {
      return { status: response.status, articles: readArticles(JSON.parse(text)) };
    } catch {
      return { status: response.status, articles: [] };
    }
  } finally {
    clearTimeout(timeout);
  }
}

/** Which geographic tier the article's *text* actually supports — never invented, and only ever consulted for a `regional`-query result (see `toKrishiUpdate`). */
function geoTierFor(title: string, ctx: UpdatesQueryContext): { district?: string; state?: string } {
  const lower = title.toLowerCase();
  if (ctx.district && lower.includes(ctx.district.toLowerCase())) return { district: ctx.district };
  if (ctx.state && lower.includes(ctx.state.toLowerCase())) return { state: ctx.state };
  return {};
}

/** Short, fixed labels for the three queries — used for diagnostics AND to decide whether an article is eligible for district/state ("regional") tagging. Never sent to GDELT. */
export type GdeltQueryLabel = 'regional' | 'national' | 'agritech';
type LabeledGdeltQuery = { label: GdeltQueryLabel; query: string };

/**
 * Normalizes one GDELT article into a `KrishiUpdate`, or `null` if it should
 * not be shown at all — a scheme-discovery article (Government Schemes is a
 * separate feature), or a headline with no real agriculture/agritech signal
 * (GDELT's full-text search can match terms outside the visible headline, so
 * a raw query hit is not itself evidence of relevance — see `filters.ts`).
 * District/state ("regional") tagging is only ever attempted for a result
 * from the `regional` query, and even then only when the title itself names
 * the district/state — a `national`/`agritech`-query result is always
 * national scope, regardless of what its title happens to mention.
 */
function toKrishiUpdate(article: GdeltArticle, ctx: UpdatesQueryContext, queryLabel: GdeltQueryLabel): KrishiUpdate | null {
  const url = typeof article.url === 'string' ? article.url : null;
  const title = typeof article.title === 'string' ? article.title : null;
  const seendate = typeof article.seendate === 'string' ? article.seendate : null;
  const domain = typeof article.domain === 'string' ? article.domain : 'GDELT';
  const sourcecountry = typeof article.sourcecountry === 'string' ? article.sourcecountry : undefined;

  // A result missing its own identity or link cannot be shown or deduplicated.
  if (!url || !title || !seendate) return null;

  if (isSchemeArticle(title)) return null; // Government Schemes is a separate feature.

  const isTech = isAgritechHeadline(title);
  if (!isTech && !isAgricultureHeadline(title)) return null; // No real agriculture/agritech signal in the headline itself.

  const category: UpdateCategory = isTech ? 'technology' : 'agriculture';
  const geo = queryLabel === 'regional' ? geoTierFor(title, ctx) : {};

  const matchedTerms = [
    ...matchKeywords(title, AGRICULTURE_TERMS),
    ...(ctx.cropName ? matchKeywords(title, [ctx.cropName]) : []),
  ];

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
    relevance: { score: 0, reasons: [] },
    tags: [...new Set(matchedTerms.map((term) => term.toLowerCase()))],
  };
}

/**
 * Builds exactly 3 queries — one regional, one national agriculture, one
 * agritech — never more, per GDELT's demonstrated rate-limit sensitivity.
 * The regional query deliberately no longer mixes in disaster terms: SACHET
 * already owns official disaster alerts, so folding `RISK_TERMS` in here
 * only made the query more complex without adding anything this feed needs
 * from GDELT specifically.
 */
function buildQueries(ctx: UpdatesQueryContext): LabeledGdeltQuery[] {
  const queries: LabeledGdeltQuery[] = [];

  const agricultureTerms = [...AGRICULTURE_TERMS, ...(ctx.cropName ? [ctx.cropName] : [])];
  const agricultureClause = orClause(agricultureTerms);

  const localityTerms = [ctx.district, ctx.state].filter((v): v is string => !!v);
  if (localityTerms.length > 0) {
    const localityClause = `(${localityTerms.map(quoted).join(' OR ')})`;
    queries.push({ label: 'regional', query: `${localityClause} ${agricultureClause} sourcecountry:India` });
  }

  queries.push({ label: 'national', query: `${agricultureClause} sourcecountry:India` });

  queries.push({
    label: 'agritech',
    query: `${orClause(AGRITECH_QUERY_TERMS)} ${orClause(AGRITECH_CONTEXT_TERMS)} sourcecountry:India`,
  });

  return queries;
}

function cacheKeyFor(query: string): string {
  return `gdelt:${createHash('sha1').update(query).digest('hex')}`;
}

export type GdeltFetchResult = {
  updates: KrishiUpdate[];
  /** True when at least one of the 3 queries failed (network/timeout/HTTP) — used by `updates.service.ts` to decide whether the Google News fallback should run. */
  hadFailure: boolean;
  /** === `updates.length`; named separately so the fallback-trigger threshold reads clearly at the call site. */
  usefulCount: number;
};

/**
 * Fires the (small, fixed) set of GDELT queries concurrently — `Promise.allSettled`
 * over an array built by `.map()` starts every request in the same tick, so
 * three queries never accumulate latency serially; the bound on total added
 * latency is `REQUEST_TIMEOUT_MS` for whichever one is slowest, not the sum.
 * One query's failure (network/timeout/HTTP) never drops the other two —
 * this is the provider-internal mirror of the SACHET/GDELT isolation
 * `updates.service.ts` already does one level up via its own `allSettled`.
 */
export async function fetchGdeltUpdatesDetailed(ctx: UpdatesQueryContext): Promise<GdeltFetchResult> {
  const env = getEnv();
  const queries = buildQueries(ctx);

  const settled = await Promise.allSettled(
    queries.map(({ query }) => cached(cacheKeyFor(query), TTL_MS, () => fetchGdelt(query, env.GDELT_BASE_URL))),
  );

  const updates: KrishiUpdate[] = [];
  let received = 0;
  let successfulQueries = 0;
  let failedQueries = 0;

  settled.forEach((result, i) => {
    // `settled` is produced by mapping `queries` 1:1, so the index always exists.
    const label = queries[i]!.label;

    if (result.status === 'fulfilled') {
      successfulQueries += 1;
      received += result.value.articles.length;
      console.log(`[updates:gdelt] query=${label} status=${result.value.status} received=${result.value.articles.length}`);
      for (const article of result.value.articles) {
        const update = toKrishiUpdate(article, ctx, label);
        if (update) updates.push(update);
      }
      return;
    }

    failedQueries += 1;
    const kind = result.reason instanceof GdeltProviderError ? result.reason.kind : 'network';
    console.log(`[updates:gdelt] query=${label} failed=${kind}`);
  });

  console.log(
    `[updates:gdelt] successfulQueries=${successfulQueries} failedQueries=${failedQueries} received=${received} usefulAfterFilter=${updates.length}`,
  );

  return { updates, hadFailure: failedQueries > 0, usefulCount: updates.length };
}

/** Thin wrapper matching the plain `UpdateProvider` shape (`types.ts`) other callers/tests expect. `updates.service.ts` calls `fetchGdeltUpdatesDetailed` directly when it needs the fallback-decision fields. */
export async function fetchGdeltUpdates(ctx: UpdatesQueryContext): Promise<KrishiUpdate[]> {
  const result = await fetchGdeltUpdatesDetailed(ctx);
  return result.updates;
}
