import type { LocalizedText } from '@/utils/localizedText';

/**
 * Krishi Updates — local/demo feed for this version. A real version would
 * aggregate official government sources, agricultural institutions and
 * verified APIs/RSS feeds server-side (never scraped or fetched directly
 * from the mobile app, and never with an API key in mobile source) — see
 * `demoUpdates.ts`'s file comment. This shape is what that backend feed
 * would eventually fill.
 */
export type UpdateCategory = 'agriculture' | 'weather' | 'government' | 'market' | 'technology';

export type AgriUpdate = {
  id: string;
  title: LocalizedText;
  category: UpdateCategory;
  summary: LocalizedText;
  body: LocalizedText;
  /** Days before today, so the feed never reads as stale — same trick as `demoMode.ts`. */
  publishedDaysAgo: number;
  source: string;
  sourceUrl?: string;
  relatedTopic?: string;
};
