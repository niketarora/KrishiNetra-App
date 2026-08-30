import type { KrishiUpdate } from '@/features/updates/types';

import { apiFetch } from './api';

/**
 * Krishi Updates — the real, farm-scoped feed. Every field this app can show
 * (title, category, source, "why this matters") comes straight from the
 * backend's already-normalized `KrishiUpdate` shape; nothing here calls
 * GDELT/SACHET/PIB directly or holds an API key, matching every other
 * service in this file's rule that only the backend talks to the outside
 * world (backend/src/updates/).
 */
export async function getUpdates(farmId: string): Promise<KrishiUpdate[]> {
  return apiFetch<KrishiUpdate[]>(`/api/v1/updates?farmId=${encodeURIComponent(farmId)}`, {
    fallbackKey: 'updates.loadError',
  });
}
