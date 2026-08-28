/**
 * DEMO_MODE — labelled sample data for the surfaces that have no data source.
 *
 * A growing list of things in this app cannot be filled with real values yet:
 * crop health and growth stage need the satellite analysis of Phase 3, the
 * sell-or-wait recommendation needs the price prediction model, and the
 * Krishi Memory timeline (Feature #10) needs the irrigation, fertilizer and
 * crop-health engines other phases will eventually connect — its own Smart
 * Farm Calendar counterpart lives in `features/calendar/demoEvents.ts` and is
 * gated by the same flag.
 *
 * IMPLEMENTATION.md rule 13 forbids presenting mock data as real. This module
 * does not break that rule; it takes the other route out of it. Every value
 * here is fabricated, and every value here is rendered in a colour that is
 * deliberately outside the product's palette, behind a "SAMPLE DATA" badge,
 * under a banner that says the screen is showing sample data. A farmer — or a
 * judge — can tell at a glance which numbers the app actually knows.
 *
 * Three properties make that safe:
 *
 *   1. It is OFF unless EXPO_PUBLIC_DEMO_MODE is exactly 'true'.
 *   2. It never touches the database. Nothing here is written anywhere; it is
 *      presentation-layer only, so no fabricated row can outlive the session
 *      or reach the assistant, which answers from the database alone.
 *   3. It never substitutes for a real value. Where a real source exists, the
 *      real value always wins and these are not consulted.
 *
 * As each real engine connects, delete the call site(s) that consult it here.
 * Nothing else depends on this module.
 */

import type { IconName } from '@/components/ui';

/**
 * Read once at module load, exactly as Expo inlines it at build time.
 *
 * The comparison is deliberately strict: a truthy check would turn the string
 * 'false' into demo mode, which is the sort of accident that ships.
 */
const ENABLED = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

export function isDemoMode(): boolean {
  return ENABLED;
}

/**
 * Sample values for the four sourceless surfaces.
 *
 * Every string is a translation key, not copy, so the sample data is as
 * localised as the real thing — a demo in Hindi that switches to English for
 * its sample values would look broken.
 */
export const SAMPLE = {
  cropHealth: { valueKey: 'demo.cropHealth.value', noteKey: 'demo.cropHealth.note' },
  growthStage: { valueKey: 'demo.growthStage.value', noteKey: 'demo.growthStage.note' },
  recommendation: {
    verdictKey: 'demo.recommendation.verdict',
    bodyKey: 'demo.recommendation.body',
  },
} as const;

/**
 * One entry in the Krishi Memory timeline (Feature #10). Named for what a
 * future backend/engine feed would eventually fill this with — nothing reads
 * this shape any differently for knowing it is local today.
 */
export type FarmMemoryEntry = {
  id: string;
  icon: IconName;
  titleKey: string;
  detailKey: string;
  /** Days before today, so the timeline never reads as stale. */
  daysAgo: number;
};

/**
 * A plausible season for the demo farmer, dated relative to today, oldest
 * first — a field mapped, a crop sown, tended (irrigated, fed, checked for
 * health), its price checked, and an offer received. Phase 4 records the
 * lot/offer events for real; the tending events are what a future
 * irrigation/fertilizer/crop-health engine would eventually log here.
 */
export const SAMPLE_HISTORY: FarmMemoryEntry[] = [
  { id: 'demo-1', icon: 'map', titleKey: 'demo.history.mapped', detailKey: 'demo.history.mappedDetail', daysAgo: 96 },
  { id: 'demo-2', icon: 'plant', titleKey: 'demo.history.sown', detailKey: 'demo.history.sownDetail', daysAgo: 84 },
  { id: 'demo-5', icon: 'alert', titleKey: 'demo.history.cropHealth', detailKey: 'demo.history.cropHealthDetail', daysAgo: 18 },
  { id: 'demo-6', icon: 'flask', titleKey: 'demo.history.fertilized', detailKey: 'demo.history.fertilizedDetail', daysAgo: 15 },
  { id: 'demo-7', icon: 'droplet', titleKey: 'demo.history.irrigated', detailKey: 'demo.history.irrigatedDetail', daysAgo: 13 },
  { id: 'demo-3', icon: 'market', titleKey: 'demo.history.priced', detailKey: 'demo.history.pricedDetail', daysAgo: 12 },
  { id: 'demo-4', icon: 'check', titleKey: 'demo.history.offer', detailKey: 'demo.history.offerDetail', daysAgo: 3 },
];

/** Resolve a `daysAgo` offset to a real date for display. */
export function sampleDate(daysAgo: number, from = new Date()): Date {
  const date = new Date(from);
  date.setDate(date.getDate() - daysAgo);
  return date;
}
