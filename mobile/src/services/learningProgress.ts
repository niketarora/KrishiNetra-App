import * as SecureStore from 'expo-secure-store';

/**
 * Tutorial-completion tracking for Feature #14, v1.
 *
 * This is deliberately the simplest thing that works: a JSON array of
 * completed tutorial ids in `expo-secure-store`, the same direct-SecureStore
 * pattern `LanguageContext.tsx` uses for a single small preference (not the
 * chunked `sessionStorage.ts`, which exists specifically for Supabase's own
 * session blob). Keyed per farmer so progress can't leak across accounts on
 * a shared device.
 *
 * Every function fails soft: a farmer's ability to read a tutorial must never
 * depend on progress storage working, and a failed write should not surface
 * as an error — it should just leave progress uncounted until it succeeds
 * next time. This mirrors how a failed language-preference sync is swallowed
 * in `LanguageContext.tsx`.
 *
 * Swapping this for a backend-synced version later only means replacing the
 * bodies of these two functions — nothing that calls them needs to change.
 */
const storageKey = (userId: string) => `krishinetra.learning.completed.${userId}`;

export async function getCompletedTutorialIds(userId: string): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(userId));
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function markTutorialComplete(userId: string, tutorialId: string): Promise<string[]> {
  const existing = await getCompletedTutorialIds(userId);
  if (existing.includes(tutorialId)) return existing;

  const updated = [...existing, tutorialId];
  try {
    await SecureStore.setItemAsync(storageKey(userId), JSON.stringify(updated));
  } catch {
    // The farmer already sees it as complete for this session — see
    // useLearningProgress — so a failed write just means it won't have
    // persisted for next time, not a broken interaction now.
  }
  return updated;
}
