import type { IconName } from '@/components/ui';

import type { FarmEventType } from './types';

/** Shared between the calendar list and its detail screen. */
export const EVENT_TYPE_ICONS: Record<FarmEventType, IconName> = {
  sowing: 'plant',
  irrigation: 'droplet',
  fertilizer: 'flask',
  cropHealth: 'alert',
  harvest: 'field',
  weather: 'sun',
};
