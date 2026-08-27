import { z } from 'zod';

/**
 * Postgres accepts any RFC 4122-shaped uuid, and so does this. Zod's own
 * `.uuid()` additionally enforces the version and variant nibbles, which would
 * reject ids that the database itself considers perfectly valid — a stricter
 * rule than the column it guards.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(message: string) {
  return z.string().trim().regex(UUID_PATTERN, message);
}
