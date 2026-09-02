import { createHash } from 'node:crypto';

import { getEnv } from '../../config/env.js';
import { cached } from '../cache.js';
import { isAgricultureHeadline, isAgritechHeadline, isSchemeArticle } from '../filters.js';
import { AGRICULTURE_TERMS, matchKeywords } from '../keywords.js';
import type { KrishiUpdate, UpdateCategory, UpdatesQueryContext } from '../types.js';

/**
 * Google News RSS search — an aggregator/fallback for agriculture and
 * agritech discovery, used ONLY when GDELT fails outright (network/timeout)
 * or comes back with too few useful items after filtering (see
 * `updates.service.ts`'s `shouldUseGoogleNewsFallback`). It is never an
 * authoritative source and never used for official disaster alerts — SACHET
 * remains the sole `source.type: 'official'` provider; every Google News
 * result normalizes to `source.type: 'reported'`, same as GDELT.
 *
 * Endpoint: `https://news.google.com/rss/search?q=<query>&hl=en-IN&gl=IN&ceid=IN:en`
 * (India-locale search results, India edition, English). No API key. The
 * response is plain RSS 2.0: each `<item>` carries `<title>`, `<link>`,
 * `<pubDate>`, `<description>` (an HTML snippet, generally not useful as
 * prose and not surfaced as `summary`), and a `<source url="...">Publisher
 * Name</source>` tag — the one field this provider trusts for the visible
 * source name, since `<link>` itself is a `news.google.com` redirect, not
 * the publisher's own URL. When `<source>` is missing, the publisher name
 * falls back to the redirect link's own hostname rather than "Google News",
 * so the card still shows something more specific than the aggregator.
 *
 * Same shared filters as GDELT (`filters.ts`): a scheme-discovery article is
 * dropped entirely, and every kept article must pass
 * `isAgricultureHeadline`/`isAgritechHeadline` — Google News's own search
 * ranking is no more trustworthy than GDELT's for headline relevance.
 */

const TTL_MS = 18 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

type GoogleNewsFailureKind = 'timeout' | 'network' | 'http';

export class GoogleNewsProviderError extends Error {
  readonly kind: GoogleNewsFailureKind;

  constructor(message: string, kind: GoogleNewsFailureKind, cause?: unknown) {
    super(message, { cause });
    this.name = 'GoogleNewsProviderError';
    this.kind = kind;
  }
}

/** Namespace-tolerant tag read — same small pattern `sachet.provider.ts` uses, duplicated locally rather than shared so this file never has to touch (or risk) the now-working SACHET provider. */
function tagValue(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  if (!match || !match[1]) return null;
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractItems(xml: string): string[] {
  return xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

type GoogleNewsResult = { status: number; items: string[] };

async function fetchGoogleNewsRss(query: string, baseUrl: string): Promise<GoogleNewsResult> {
  const url = new URL(baseUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-IN');
  url.searchParams.set('gl', 'IN');
  url.searchParams.set('ceid', 'IN:en');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new GoogleNewsProviderError(`Google News RSS request timed out after ${REQUEST_TIMEOUT_MS}ms`, 'timeout', cause);
      }
      throw new GoogleNewsProviderError('Could not reach Google News RSS', 'network', cause);
    }

    if (!response.ok) {
      throw new GoogleNewsProviderError(`Google News RSS returned HTTP ${response.status}`, 'http');
    }

    const xml = await response.text();
    if (!xml || !xml.includes('<item')) return { status: response.status, items: [] };
    return { status: response.status, items: extractItems(xml) };
  } finally {
    clearTimeout(timeout);
  }
}

/** Same three-tier labels GDELT uses, so diagnostics and the fallback decision line up 1:1. */
export type GoogleNewsQueryLabel = 'regional' | 'national' | 'agritech';
type LabeledQuery = { label: GoogleNewsQueryLabel; query: string };

/**
 * Three short, plain-text searches — never a per-keyword request. Mirrors
 * GDELT's own query tiers so the two providers are directly interchangeable
 * from the aggregator's point of view.
 */
function buildQueries(ctx: UpdatesQueryContext): LabeledQuery[] {
  const queries: LabeledQuery[] = [];

  const locality = ctx.district ?? ctx.state;
  if (locality) {
    queries.push({ label: 'regional', query: `${locality} agriculture farming` });
  }

  queries.push({ label: 'national', query: 'India agriculture farmers' });
  queries.push({ label: 'agritech', query: 'India agritech precision farming' });

  return queries;
}

/** Which geographic tier the article's *text* actually supports — only ever consulted for a `regional`-query result, same rule GDELT applies. */
function geoTierFor(title: string, ctx: UpdatesQueryContext): { district?: string; state?: string } {
  const lower = title.toLowerCase();
  if (ctx.district && lower.includes(ctx.district.toLowerCase())) return { district: ctx.district };
  if (ctx.state && lower.includes(ctx.state.toLowerCase())) return { state: ctx.state };
  return {};
}

function toKrishiUpdate(itemXml: string, ctx: UpdatesQueryContext, queryLabel: GoogleNewsQueryLabel): KrishiUpdate | null {
  const title = tagValue(itemXml, 'title');
  const link = tagValue(itemXml, 'link');
  const pubDate = tagValue(itemXml, 'pubDate');
  const sourceName = tagValue(itemXml, 'source');

  if (!title || !link) return null; // No stable link, no headline: nothing safe to show.

  if (isSchemeArticle(title)) return null; // Government Schemes is a separate feature.

  const isTech = isAgritechHeadline(title);
  if (!isTech && !isAgricultureHeadline(title)) return null;

  const category: UpdateCategory = isTech ? 'technology' : 'agriculture';
  const geo = queryLabel === 'regional' ? geoTierFor(title, ctx) : {};

  const publishedAt = pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : new Date().toISOString();

  // The redirect link's own hostname is the best available "which publisher"
  // fallback when Google News omits <source> — never invent a name.
  const publisher = sourceName ?? hostnameOf(link) ?? 'Google News';

  const matchedTerms = [
    ...matchKeywords(title, AGRICULTURE_TERMS),
    ...(ctx.cropName ? matchKeywords(title, [ctx.cropName]) : []),
  ];

  return {
    id: `googlenews:${createHash('sha1').update(link).digest('hex').slice(0, 20)}`,
    title,
    category,
    source: { name: publisher, type: 'reported' },
    sourceUrl: link,
    publishedAt,
    location: {
      country: 'India',
      district: geo.district,
      state: geo.state,
    },
    relevance: { score: 0, reasons: [] },
    tags: [...new Set(matchedTerms.map((term) => term.toLowerCase()))],
  };
}

function cacheKeyFor(query: string): string {
  return `google-news:${createHash('sha1').update(query).digest('hex')}`;
}

export type GoogleNewsFetchResult = {
  updates: KrishiUpdate[];
  usefulCount: number;
};

/**
 * Fires its (small, fixed) set of queries concurrently, exactly like GDELT —
 * never called on every request (see `updates.service.ts`), and never more
 * than 3 requests when it is. A per-query failure never drops the others.
 */
export async function fetchGoogleNewsUpdates(ctx: UpdatesQueryContext): Promise<GoogleNewsFetchResult> {
  const env = getEnv();
  const queries = buildQueries(ctx);

  const settled = await Promise.allSettled(
    queries.map(({ query }) => cached(cacheKeyFor(query), TTL_MS, () => fetchGoogleNewsRss(query, env.GOOGLE_NEWS_RSS_URL))),
  );

  const updates: KrishiUpdate[] = [];
  let received = 0;

  settled.forEach((result, i) => {
    // `settled` is produced by mapping `queries` 1:1, so the index always exists.
    const label = queries[i]!.label;

    if (result.status === 'fulfilled') {
      received += result.value.items.length;
      console.log(`[updates:google-news] query=${label} status=${result.value.status} received=${result.value.items.length}`);
      for (const item of result.value.items) {
        const update = toKrishiUpdate(item, ctx, label);
        if (update) updates.push(update);
      }
      return;
    }

    const kind = result.reason instanceof GoogleNewsProviderError ? result.reason.kind : 'network';
    console.log(`[updates:google-news] query=${label} failed=${kind}`);
  });

  console.log(`[updates:google-news] received=${received} usefulAfterFilter=${updates.length}`);

  return { updates, usefulCount: updates.length };
}
