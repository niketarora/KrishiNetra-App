/**
 * A plain in-memory TTL cache — the same "acceptable for the hackathon"
 * pattern `controllers/reference.controller.ts` already uses for weather's
 * negative-result cache. No Redis: nothing else in this repo runs one.
 *
 * Callers are responsible for building a cache key with enough geographic
 * and crop context that one farm never receives another farm's cached
 * result by mistake (see each provider's `cacheKeyFor`). A farm's exact
 * identity is deliberately *not* part of the key: two farms in the same
 * district growing the same crop should share one GDELT/SACHET/PIB fetch —
 * that is the whole point of the cache.
 */

type Entry<T> = { expiresAt: number; value: T };

const store = new Map<string, Entry<unknown>>();

/**
 * Returns the cached value for `key` if still fresh, otherwise calls `load`,
 * caches its result for `ttlMs`, and returns that. A rejected `load` is
 * never cached — a transient provider failure must not poison the cache for
 * the whole TTL window.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }

  const value = await load();
  store.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

/** Test seam: forget everything cached so a test can start from a clean slate. */
export function resetUpdatesCache(): void {
  store.clear();
}
