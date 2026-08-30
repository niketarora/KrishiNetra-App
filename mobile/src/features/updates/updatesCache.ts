import type { KrishiUpdate } from './types';

/**
 * A tiny in-memory lookup from update id -> the last real `KrishiUpdate` the
 * feed fetched for it.
 *
 * `UpdateDetailScreen` is reached by id (`UpdateDetail: { updateId: string }`
 * in `navigation/types.ts`), which was fine when every update lived in the
 * static `demoUpdates.ts` array the detail screen could search. Real updates
 * come from the backend per farm and are not enumerable that way, so
 * `UpdatesScreen` populates this cache as it loads a farm's feed, and the
 * detail screen reads from here first — falling back to the demo array only
 * for a demo-mode id. Nothing here is written anywhere or shared across app
 * restarts; it just bridges one screen's fetch to the next screen's read
 * without changing the navigation param shape.
 */
const cache = new Map<string, KrishiUpdate>();

export function cacheUpdates(updates: KrishiUpdate[]): void {
  for (const update of updates) cache.set(update.id, update);
}

export function getCachedUpdate(id: string): KrishiUpdate | null {
  return cache.get(id) ?? null;
}
