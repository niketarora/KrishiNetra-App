/**
 * Feature #10, v1: the Smart Farm Calendar's data shape.
 *
 * This is deliberately the shape a real engine's event feed (irrigation
 * scheduling, weather alerts, crop-health checks, …) could fill later —
 * `CalendarScreen`/`CalendarEventDetailScreen` only ever read this shape, not
 * how it was produced. For this version every event comes from
 * `demoEvents.ts` and is always local, fabricated, and clearly labelled as
 * such — see `isDemoMode()` in `features/demo/demoMode.ts`.
 */
export type FarmEventType = 'sowing' | 'irrigation' | 'fertilizer' | 'cropHealth' | 'harvest' | 'weather';

export type FarmEventStatus = 'upcoming' | 'completed';

export type FarmCalendarEvent = {
  id: string;
  farmId: string | null;
  cropId: string | null;
  /** ISO yyyy-mm-dd. */
  date: string;
  eventType: FarmEventType;
  status: FarmEventStatus;
  /** i18n key for the event's short title, e.g. 'calendar.events.irrigation.title'. */
  titleKey: string;
  /** i18n key for the "why it is shown" explanation. */
  reasonKey: string;
};
