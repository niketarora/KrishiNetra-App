import { createHash } from 'node:crypto';

import { getEnv } from '../../config/env.js';
import { cached } from '../cache.js';
import { RISK_TERMS, matchKeywords } from '../keywords.js';
import type { KrishiUpdate, UpdatesQueryContext } from '../types.js';

/**
 * NDMA SACHET — India's official Common Alerting Protocol (CAP) disaster
 * feed. The sole disaster/natural-risk source for Krishi Updates.
 *
 * The configured URL is the real, verified-live feed:
 * `https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml` — an RSS
 * 2.0 feed whose `<item>` entries describe current alerts in prose (no
 * `<info>`/`<area>` block inline). SACHET also publishes a full per-alert CAP
 * 1.2 record at `.../FetchXMLFile?identifier=<id>`, reachable from an
 * `<item>`'s `<guid>`, whose tags are namespaced (`<cap:info>`, `<cap:area>`,
 * `<cap:areaDesc>`) — this provider does not fetch that second document per
 * alert (an extra network round-trip per item was judged not worth the
 * added latency/failure surface for a prototype), but is namespace-tolerant
 * and structured to parse a full CAP `<alert>/<info>` document directly if
 * SACHET ever serves one at this URL instead of (or alongside) the RSS list.
 *
 * Either shape is only ever kept when its own text (title/description/
 * areaDesc, whichever exists) names the farm's own district or state — an
 * unrelated state's disaster alert is never shown as farm-relevant. Because
 * the RSS shape has no coordinates or structured area geometry at all, this
 * provider never invents a distance; the "why this matters" reason is always
 * a plain district/state name match — see relevance.ts.
 */

const TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6_000;
const MAX_ALERTS = 10;
const FETCH_XML_BASE = 'https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile';

/** Events whose real-world impact on a farm is severe enough to rank as `high`. */
const HIGH_SEVERITY_EVENTS = ['flood', 'cyclone', 'landslide', 'cloudburst'];

export class SachetProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'SachetProviderError';
  }
}

async function fetchCapFeed(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/xml, text/xml, application/rss+xml' } });
    } catch (cause) {
      throw new SachetProviderError('Could not reach SACHET', cause);
    }
    if (!response.ok) throw new SachetProviderError(`SACHET returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/** Namespace-tolerant tag read: matches `<tag>`, `<cap:tag>`, `<ns2:tag ...>`, etc. */
function tagValue(block: string, tag: string): string | null {
  const match = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i').exec(block);
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

/**
 * Namespace-tolerant block extraction: `<(?:ns:)?tag ...>...</(?:ns:)?tag>`,
 * using a backreference so a namespaced opening tag only matches its own
 * (identically namespaced) closing tag rather than any tag with the same
 * local name.
 */
function extractBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<((?:[\\w-]+:)?${tag})(?:\\s[^>]*)?>[\\s\\S]*?<\\/\\1>`, 'gi');
  return xml.match(re) ?? [];
}

function hasTag(xml: string, tag: string): boolean {
  return new RegExp(`<(?:[\\w-]+:)?${tag}[\\s>]`, 'i').test(xml);
}

/** Lowercase, trim, and drop the word "district" so "Jaipur District, Rajasthan" matches farm.district="Jaipur". */
function normalizeLocationName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bdistrict\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchLocation(text: string, ctx: UpdatesQueryContext): { matchesDistrict: boolean; matchesState: boolean } {
  const normalizedText = normalizeLocationName(text);
  const matchesDistrict = !!ctx.district && normalizedText.includes(normalizeLocationName(ctx.district));
  const matchesState = !!ctx.state && normalizedText.includes(normalizeLocationName(ctx.state));
  return { matchesDistrict, matchesState };
}

function severityFromCapValue(value: string | null): KrishiUpdate['severity'] {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'extreme' || normalized === 'severe') return 'high';
  if (normalized === 'moderate') return 'moderate';
  return 'info';
}

/** No explicit CAP `<severity>` tag (the RSS shape) — infer from the hazard word itself, same tiering GDELT uses. */
function severityFromText(text: string): KrishiUpdate['severity'] {
  const lower = text.toLowerCase();
  if (HIGH_SEVERITY_EVENTS.some((event) => lower.includes(event))) return 'high';
  if (matchKeywords(lower, RISK_TERMS).length > 0) return 'moderate';
  return 'info';
}

function buildFetchXmlUrl(identifier: string): string {
  return `${FETCH_XML_BASE}?identifier=${encodeURIComponent(identifier)}`;
}

/** Full CAP `<alert>/<info>` documents — namespaced or not. Not the shape the configured feed serves today, but kept ready in case that changes. */
function parseCapAlerts(xml: string, ctx: UpdatesQueryContext): KrishiUpdate[] {
  const alertBlocks = extractBlocks(xml, 'alert');
  const updates: KrishiUpdate[] = [];

  for (const alertBlock of alertBlocks) {
    const infoBlocks = extractBlocks(alertBlock, 'info');
    const infoBlock = infoBlocks[0] ?? alertBlock;

    const identifier = tagValue(alertBlock, 'identifier');
    const sent = tagValue(alertBlock, 'sent');

    const event = tagValue(infoBlock, 'event');
    const headline = tagValue(infoBlock, 'headline');
    const description = tagValue(infoBlock, 'description');
    const instruction = tagValue(infoBlock, 'instruction');
    const severity = tagValue(infoBlock, 'severity');
    const effective = tagValue(infoBlock, 'effective') ?? sent;
    const areaDesc = tagValue(infoBlock, 'areaDesc') ?? '';
    const web = tagValue(infoBlock, 'web');

    const title = headline ?? event;
    const sourceUrl = web ?? (identifier ? buildFetchXmlUrl(identifier) : null);
    if (!title || !sourceUrl) continue; // No stable source link, no headline: nothing safe to show.

    const { matchesDistrict, matchesState } = matchLocation(`${areaDesc} ${title} ${description ?? ''}`, ctx);
    if (!matchesDistrict && !matchesState) continue; // Never show an alert for a district/state the farm is not in.

    const publishedAt = effective && !Number.isNaN(Date.parse(effective)) ? new Date(effective).toISOString() : new Date().toISOString();

    updates.push({
      id: `sachet:${createHash('sha1').update(sourceUrl + title).digest('hex').slice(0, 20)}`,
      title,
      summary: description ?? instruction ?? undefined,
      category: 'risk',
      source: { name: 'National Disaster Management Authority (SACHET)', type: 'official' },
      sourceUrl,
      publishedAt,
      location: {
        country: 'India',
        district: matchesDistrict ? (ctx.district ?? undefined) : undefined,
        state: ctx.state ?? undefined,
      },
      severity: severityFromCapValue(severity),
      relevance: { score: 0, reasons: [] },
      tags: event ? [event.toLowerCase()] : undefined,
    });

    if (updates.length >= MAX_ALERTS) break;
  }

  return updates;
}

/** The shape the configured feed actually serves today: plain RSS 2.0 `<item>`s, with the hazard/district/state named in prose (title/description), not a structured area block. */
function parseRssItems(xml: string, ctx: UpdatesQueryContext): KrishiUpdate[] {
  const itemBlocks = extractBlocks(xml, 'item');
  const updates: KrishiUpdate[] = [];

  for (const block of itemBlocks) {
    const title = tagValue(block, 'title');
    const link = tagValue(block, 'link');
    const description = tagValue(block, 'description');
    const pubDate = tagValue(block, 'pubDate');
    const category = tagValue(block, 'category');
    const guid = tagValue(block, 'guid') ?? tagValue(block, 'identifier');

    if (!title) continue;

    const haystack = `${title} ${description ?? ''}`;
    const sourceUrl = link ?? (guid ? buildFetchXmlUrl(guid) : null);
    if (!sourceUrl) continue; // No stable source link: nothing safe to show.

    const { matchesDistrict, matchesState } = matchLocation(haystack, ctx);
    if (!matchesDistrict && !matchesState) continue; // Never show an alert for a district/state the farm is not in.

    const matchedHazards = matchKeywords(haystack, RISK_TERMS);
    const event = category ?? matchedHazards[0] ?? null;

    const publishedAt = pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : new Date().toISOString();

    updates.push({
      id: `sachet:${createHash('sha1').update(sourceUrl + title).digest('hex').slice(0, 20)}`,
      title,
      summary: description ?? undefined,
      category: 'risk',
      source: { name: 'National Disaster Management Authority (SACHET)', type: 'official' },
      sourceUrl,
      publishedAt,
      location: {
        country: 'India',
        district: matchesDistrict ? (ctx.district ?? undefined) : undefined,
        state: ctx.state ?? undefined,
      },
      severity: severityFromText(haystack),
      relevance: { score: 0, reasons: [] },
      tags: event ? [event.toLowerCase()] : undefined,
    });

    if (updates.length >= MAX_ALERTS) break;
  }

  return updates;
}

function parseAlerts(xml: string, ctx: UpdatesQueryContext): KrishiUpdate[] {
  const capAlerts = parseCapAlerts(xml, ctx);
  if (capAlerts.length > 0) return capAlerts;
  return parseRssItems(xml, ctx);
}

function cacheKeyFor(ctx: UpdatesQueryContext): string {
  return `sachet:${ctx.district ?? ''}:${ctx.state ?? ''}`;
}

export async function fetchSachetUpdates(ctx: UpdatesQueryContext): Promise<KrishiUpdate[]> {
  const env = getEnv();

  try {
    const xml = await cached(cacheKeyFor(ctx), TTL_MS, () => fetchCapFeed(env.SACHET_CAP_URL));
    if (!xml || (!hasTag(xml, 'alert') && !hasTag(xml, 'item'))) return [];
    return parseAlerts(xml, ctx);
  } catch {
    // Any failure — network, timeout, malformed XML — is a "nothing to show",
    // never a fabricated official alert.
    return [];
  }
}
