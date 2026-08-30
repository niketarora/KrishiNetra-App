import { createHash } from 'node:crypto';

import { getEnv } from '../../config/env.js';
import { cached } from '../cache.js';
import type { KrishiUpdate, UpdatesQueryContext } from '../types.js';

/**
 * NDMA SACHET — India's official Common Alerting Protocol (CAP) disaster
 * feed (https://sachet.ndma.gov.in/CapFeed). P0/P1 in the product brief.
 *
 * Status: this is a real, wired provider (not a stub returning canned
 * data), but it has not been validated against a live response the way
 * `gdelt.provider.ts` was — the sandbox this was built in could not reach
 * the public network to inspect SACHET's actual feed shape (its `format`
 * flag, the exact CAP field names it emits, or whether an unauthenticated
 * GET even returns a body). Per the product brief — "If the RSS/CAP
 * structure cannot be implemented cleanly in the first pass, keep the
 * provider interface ready and implement GDELT fully first" — the parser
 * below follows the standard OASIS CAP 1.2 `<alert><info>...</info></alert>`
 * shape, and every step is defensive: a request that fails, times out, or
 * returns anything that does not parse as CAP resolves to `[]`, never to
 * fabricated alert data. This needs a live request against the real feed
 * before it can be trusted in production — see the final report's "what
 * should be done next" note.
 *
 * Alerts are only kept when their `areaDesc` names the farm's own district
 * or state, so an unrelated state's disaster alert is never shown as
 * farm-relevant — the same rule GDELT's provider applies to its own
 * district/state text matching.
 */

const TTL_MS = 8 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6_000;
const MAX_ALERTS = 10;

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
      response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/xml, text/xml' } });
    } catch (cause) {
      throw new SachetProviderError('Could not reach SACHET', cause);
    }
    if (!response.ok) throw new SachetProviderError(`SACHET returned HTTP ${response.status}`);
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

function severityFromCap(value: string | null): KrishiUpdate['severity'] {
  const normalized = (value ?? '').toLowerCase();
  if (normalized === 'extreme' || normalized === 'severe') return 'high';
  if (normalized === 'moderate') return 'moderate';
  return 'info';
}

function parseAlerts(xml: string, ctx: UpdatesQueryContext): KrishiUpdate[] {
  const infoBlocks = xml.match(/<info[^>]*>[\s\S]*?<\/info>/gi) ?? [];
  const updates: KrishiUpdate[] = [];

  for (const block of infoBlocks) {
    const areaDesc = tagValue(block, 'areaDesc') ?? '';
    const event = tagValue(block, 'event');
    const headline = tagValue(block, 'headline');
    const description = tagValue(block, 'description');
    const web = tagValue(block, 'web');
    const effective = tagValue(block, 'effective') ?? tagValue(block, 'sent');
    const severity = tagValue(block, 'severity');

    const title = headline ?? event;
    if (!title || !web) continue; // No stable source link, no headline: nothing safe to show.

    const lowerArea = areaDesc.toLowerCase();
    const matchesDistrict = !!ctx.district && lowerArea.includes(ctx.district.toLowerCase());
    const matchesState = !!ctx.state && lowerArea.includes(ctx.state.toLowerCase());
    // Never show an alert for a district/state the farm is not in.
    if (!matchesDistrict && !matchesState) continue;

    const publishedAt = effective && !Number.isNaN(Date.parse(effective)) ? new Date(effective).toISOString() : new Date().toISOString();

    updates.push({
      id: `sachet:${createHash('sha1').update(web + title).digest('hex').slice(0, 20)}`,
      title,
      summary: description ?? undefined,
      category: 'risk',
      source: { name: 'National Disaster Management Authority (SACHET)', type: 'official' },
      sourceUrl: web,
      publishedAt,
      location: {
        country: 'India',
        district: matchesDistrict ? (ctx.district ?? undefined) : undefined,
        state: ctx.state ?? undefined,
      },
      severity: severityFromCap(severity),
      relevance: { score: 0, reasons: [] },
      tags: event ? [event.toLowerCase()] : undefined,
    });

    if (updates.length >= MAX_ALERTS) break;
  }

  return updates;
}

function cacheKeyFor(ctx: UpdatesQueryContext): string {
  return `sachet:${ctx.district ?? ''}:${ctx.state ?? ''}`;
}

export async function fetchSachetUpdates(ctx: UpdatesQueryContext): Promise<KrishiUpdate[]> {
  const env = getEnv();

  try {
    const xml = await cached(cacheKeyFor(ctx), TTL_MS, () => fetchCapFeed(env.SACHET_CAP_URL));
    if (!xml || !xml.includes('<info')) return [];
    return parseAlerts(xml, ctx);
  } catch {
    // Any failure — network, timeout, malformed XML — is a "nothing to show",
    // never a fabricated official alert.
    return [];
  }
}
