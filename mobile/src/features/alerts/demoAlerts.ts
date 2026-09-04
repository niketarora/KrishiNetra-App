import type { AlertEvent } from './types';

/**
 * Alert & Communication History feed.
 *
 * Demo data has been backed up to `demoAlerts.backup.ts`.
 * Cleared for trial to test real data retrieval and empty state behavior.
 */
export const ALERTS: AlertEvent[] = [];

export function getAlert(id: string): AlertEvent | null {
  return ALERTS.find((alert) => alert.id === id) ?? null;
}
