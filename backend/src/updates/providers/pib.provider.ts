import { createHash } from 'node:crypto';

import { getEnv } from '../../config/env.js';
import { cached } from '../cache.js';
import { GOVERNMENT_TERMS, MARKET_TERMS, matchKeywords } from '../keywords.js';
import type { KrishiUpdate, UpdatesQueryContext } from '../types.js';

/**
 * Press Information Bureau RSS (https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1)
 * — official government announcements. P1 in the product brief; build after
 * GDELT is solid.
 *
 * Same status note as `sachet.provider.ts`: this is a real fetch-and-parse
 * implementation, not canned data, but it has not been exercised against a
 * live response in this environment (no outbound network access here — see
 * the final report). RSS/XML is parsed with a small regex-based `<item>`
 * extractor rather than pulling in an XML parser dependency, matching the
 * "no heavy new dependency for a small job" rule the brief applies to the
 * Haversine distance calculation. Any parse failure yields `[]`, never a
 * fabricated government announcement.
 *
 * Only items whose title/description mention an agriculture or scheme term
 * are kept — PIB's ModId=6 feed is India-wide across every ministry, and the
 * product brief is explicit that Krishi Updates must not become a generic
 * news reader.
 */

const TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6_000;
const MAX_ITEMS = 10;

export class PibProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'PibProviderError';
  }
}

async function fetchRss(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
    } catch (cause) {
      throw new PibProviderError('Could not reach PIB', cause);
    }
    if (!response.ok) throw new PibProviderError(`PIB returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function tagValue(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
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

const RELEVANT_TERMS = ['agriculture', 'farmer', 'crop', 'MSP', 'procurement', 'fertilizer', 'irrigation', ...GOVERNMENT_TERMS];

function parseItems(xml: string, ctx: UpdatesQueryContext): KrishiUpdate[] {
  const itemBlocks = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  const updates: KrishiUpdate[] = [];

  for (const block of itemBlocks) {
    const title = tagValue(block, 'title');
    const link = tagValue(block, 'link');
    const description = tagValue(block, 'description');
    const pubDate = tagValue(block, 'pubDate');

    if (!title || !link) continue;

    const haystack = `${title} ${description ?? ''}`;
    const matchedTerms = [
      ...matchKeywords(haystack, RELEVANT_TERMS),
      ...(ctx.cropName ? matchKeywords(haystack, [ctx.cropName]) : []),
    ];
    if (matchedTerms.length === 0) continue; // Not agriculture/farmer relevant — PIB covers every ministry.

    const category = matchedTerms.some((t) => MARKET_TERMS.some((m) => m.toLowerCase() === t.toLowerCase()))
      ? 'market'
      : 'government';

    const publishedAt = pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : new Date().toISOString();

    updates.push({
      id: `pib:${createHash('sha1').update(link).digest('hex').slice(0, 20)}`,
      title,
      summary: description ?? undefined,
      category,
      source: { name: 'Press Information Bureau, Government of India', type: 'official' },
      sourceUrl: link,
      publishedAt,
      location: { country: 'India' },
      relevance: { score: 0, reasons: [] },
      tags: [...new Set(matchedTerms.map((t) => t.toLowerCase()))],
    });

    if (updates.length >= MAX_ITEMS) break;
  }

  return updates;
}

function cacheKeyFor(): string {
  // The feed itself is not farm-scoped (it is filtered client-side after
  // fetching), so one cached copy serves every farm — the crop/geo filter
  // that keeps one farm from seeing another's *result set* happens in
  // parseItems, applied fresh per call, not baked into the cached XML.
  return 'pib:rss';
}

export async function fetchPibUpdates(ctx: UpdatesQueryContext): Promise<KrishiUpdate[]> {
  const env = getEnv();

  try {
    const xml = await cached(cacheKeyFor(), TTL_MS, () => fetchRss(env.PIB_RSS_URL));
    if (!xml || !xml.includes('<item')) return [];
    return parseItems(xml, ctx);
  } catch {
    return [];
  }
}
