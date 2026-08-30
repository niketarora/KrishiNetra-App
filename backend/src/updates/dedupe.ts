import type { KrishiUpdate } from './types.js';

/**
 * News aggregators frequently syndicate the same story across several
 * domains, and GDELT's regional and national queries can both surface the
 * same article. Deduplicate before an update ever reaches scoring, so a
 * repeated story cannot occupy two slots in the farmer's 10-20 item feed.
 *
 * No ML/vector similarity — just canonical URL equality, then a normalized
 * exact-title match, in that order. Keeps whichever copy was seen first.
 */

function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function normalizedTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function dedupeUpdates(updates: KrishiUpdate[]): KrishiUpdate[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: KrishiUpdate[] = [];

  for (const update of updates) {
    const url = canonicalUrl(update.sourceUrl);
    if (seenUrls.has(url)) continue;

    const title = normalizedTitle(update.title);
    if (title && seenTitles.has(title)) continue;

    seenUrls.add(url);
    if (title) seenTitles.add(title);
    result.push(update);
  }

  return result;
}
