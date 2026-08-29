import { ALERTS, getAlert } from './demoAlerts';
import type { AlertEvent } from './types';

/**
 * The abstraction the task's target architecture describes:
 *
 *   Alert Engine → Communication Provider → SMS + Voice
 *
 * For this stage there is no alert engine and no real communication
 * infrastructure (IMPLEMENTATION.md rule 19: no Exotel, no Twilio, no real
 * SMS/calls) — `demoCommunicationProvider` just serves the static feed in
 * `demoAlerts.ts`. Once a real alert engine and a real provider exist, a
 * later `ExotelCommunicationProvider` implements this same interface —
 * `getHistory()` backed by a new `GET /api/v1/communications` backend route
 * that returns each alert's actual delivery status instead of a canned one —
 * and `AlertsScreen`/`AlertDetailScreen` do not need to change at all, since
 * they only ever consume `AlertEvent[]`.
 */
export interface CommunicationProvider {
  /** The farmer's communication history, newest first. */
  getHistory(): AlertEvent[];
  getEvent(id: string): AlertEvent | null;
}

class DemoCommunicationProvider implements CommunicationProvider {
  getHistory(): AlertEvent[] {
    return [...ALERTS].sort((a, b) => a.occurredDaysAgo - b.occurredDaysAgo);
  }

  getEvent(id: string): AlertEvent | null {
    return getAlert(id);
  }
}

export const demoCommunicationProvider: CommunicationProvider = new DemoCommunicationProvider();
