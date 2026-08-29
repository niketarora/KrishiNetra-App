import type { LocalizedText } from '@/utils/localizedText';

/**
 * Alert / Communication History — local demo feed for this stage (see
 * `demoAlerts.ts`'s file comment). A real version would be produced by a
 * future alert engine (weather warnings, disaster warnings, government
 * scheme matching, agricultural advisories, crop-health emergencies —
 * IMPLEMENTATION.md's next-stage list) and delivered through a real
 * communication provider (`communicationProvider.ts`); this screen only ever
 * reads the `AlertEvent` shape, so nothing here changes when that happens.
 */
export type AlertPriority = 'high' | 'medium' | 'info';

export type AlertCategory = 'weather' | 'disaster' | 'government' | 'advisory' | 'cropHealth';

export type AlertChannel = 'sms' | 'voice';

export type ChannelStatus = 'sent' | 'initiated' | 'notSent';

export type AlertEvent = {
  id: string;
  category: AlertCategory;
  priority: AlertPriority;
  title: LocalizedText;
  body: LocalizedText;
  /** Where the alert applies, e.g. "Pratapgarh, Rajasthan" — the farmer's demo location. */
  location: string;
  /** Which channels this alert went out on, and their demo status. Omit a channel the alert never used. */
  channels: Partial<Record<AlertChannel, ChannelStatus>>;
  /** Days before today, so the feed never reads as stale — same trick as `demoMode.ts`'s `sampleDate`. */
  occurredDaysAgo: number;
  /** 24-hour local hour the demo event occurred at, for the "6:42 PM" style timestamp. */
  occurredHour: number;
  occurredMinute: number;
};
