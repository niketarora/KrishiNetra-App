import { toIsoDate } from '@/utils/calendar';

import type { FarmCalendarEvent } from './types';

function addDays(base: Date, days: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * A plausible season of calendar activity for the demo farm, dated relative
 * to today so the demo never looks stale — the same trick `sampleDate()` uses
 * for the History timeline in `features/demo/demoMode.ts`.
 *
 * Covers all six activity types the product brief calls out, and both an
 * upcoming and a completed status, without pretending any of it came from a
 * connected engine. Callers gate this behind `isDemoMode()`.
 */
export function buildDemoCalendarEvents(
  farmId: string | null,
  cropId: string | null,
  from: Date = new Date(),
): FarmCalendarEvent[] {
  const base = { farmId, cropId };

  return [
    {
      ...base,
      id: 'demo-cal-sowing',
      date: toIsoDate(addDays(from, -30)),
      eventType: 'sowing',
      status: 'completed',
      titleKey: 'calendar.events.sowing.title',
      reasonKey: 'calendar.events.sowing.reason',
    },
    {
      ...base,
      id: 'demo-cal-irrigation',
      date: toIsoDate(addDays(from, 1)),
      eventType: 'irrigation',
      status: 'upcoming',
      titleKey: 'calendar.events.irrigation.title',
      reasonKey: 'calendar.events.irrigation.reason',
    },
    {
      ...base,
      id: 'demo-cal-fertilizer',
      date: toIsoDate(addDays(from, 3)),
      eventType: 'fertilizer',
      status: 'upcoming',
      titleKey: 'calendar.events.fertilizer.title',
      reasonKey: 'calendar.events.fertilizer.reason',
    },
    {
      ...base,
      id: 'demo-cal-weather',
      date: toIsoDate(addDays(from, 5)),
      eventType: 'weather',
      status: 'upcoming',
      titleKey: 'calendar.events.weather.title',
      reasonKey: 'calendar.events.weather.reason',
    },
    {
      ...base,
      id: 'demo-cal-crop-health',
      date: toIsoDate(addDays(from, 7)),
      eventType: 'cropHealth',
      status: 'upcoming',
      titleKey: 'calendar.events.cropHealth.title',
      reasonKey: 'calendar.events.cropHealth.reason',
    },
    {
      ...base,
      id: 'demo-cal-harvest',
      date: toIsoDate(addDays(from, 90)),
      eventType: 'harvest',
      status: 'upcoming',
      titleKey: 'calendar.events.harvest.title',
      reasonKey: 'calendar.events.harvest.reason',
    },
  ];
}

export function getDemoCalendarEvent(
  eventId: string,
  farmId: string | null,
  cropId: string | null,
  from: Date = new Date(),
): FarmCalendarEvent | null {
  return buildDemoCalendarEvents(farmId, cropId, from).find((event) => event.id === eventId) ?? null;
}
