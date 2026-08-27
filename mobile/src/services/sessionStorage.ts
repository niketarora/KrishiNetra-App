import * as SecureStore from 'expo-secure-store';

/**
 * Session storage for supabase-js, backed by expo-secure-store
 * (Android EncryptedSharedPreferences / iOS Keychain) rather than
 * AsyncStorage, so auth tokens are not sitting in plaintext on the device.
 *
 * SecureStore warns above ~2048 bytes per value, and a Supabase session with a
 * populated JWT clears that comfortably. So values are split into fixed-size
 * chunks with a small header record holding the chunk count.
 */
const CHUNK_SIZE = 1800;

const chunkKey = (key: string, index: number) => `${key}__${index}`;
const countKey = (key: string) => `${key}__count`;

/** SecureStore keys must be alphanumeric plus `.`, `-`, `_`. */
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function clearChunks(key: string, count: number): Promise<void> {
  const deletions: Promise<void>[] = [];
  for (let i = 0; i < count; i += 1) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
  }
  await Promise.all(deletions);
}

async function readCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export const secureSessionStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safeKey(rawKey);
    try {
      const count = await readCount(key);
      if (count === 0) return null;

      const parts = await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
      );
      // A missing chunk means the record is torn; treat it as absent rather
      // than handing supabase-js a truncated, unparseable session.
      if (parts.some((p) => p == null)) return null;

      return parts.join('');
    } catch {
      return null;
    }
  },

  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safeKey(rawKey);
    const previousCount = await readCount(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)),
    );
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));

    // Drop chunks left over from a previously longer value.
    for (let i = chunks.length; i < previousCount; i += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
  },

  async removeItem(rawKey: string): Promise<void> {
    const key = safeKey(rawKey);
    const count = await readCount(key);
    await clearChunks(key, count);
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
