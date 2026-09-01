import type { KrishiUpdate } from '@/features/updates/types';

import { apiFetch } from './api';

/**
 * Krishi Updates — the real feed. Every field this app can show (title,
 * category, source, "why this matters") comes straight from the backend's
 * already-normalized `KrishiUpdate` shape; nothing here calls GDELT/SACHET
 * directly or holds an API key, matching every other service in this file's
 * rule that only the backend talks to the outside world (backend/src/updates/).
 *
 * `farmId` is optional: a farmer with no registered field yet still gets a
 * feed — the backend falls back to national agriculture/agritech updates
 * (`updates.service.ts::getNationalUpdates`) rather than requiring one.
 */
export async function getUpdates(farmId?: string): Promise<KrishiUpdate[]> {
  const path = farmId ? `/api/v1/updates?farmId=${encodeURIComponent(farmId)}` : '/api/v1/updates';
  return apiFetch<KrishiUpdate[]>(path, { fallbackKey: 'updates.loadError' });
}
