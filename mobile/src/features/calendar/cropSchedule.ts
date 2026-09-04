import type { CurrentCrop } from '@/services/agronomy';
import { toIsoDate } from '@/utils/calendar';

import type { FarmCalendarEvent, FarmEventType } from './types';

function addDaysToDate(baseDate: Date, days: number): Date {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return result;
}

type StageDefinition = {
  key: string;
  dayOffset: number;
  eventType: FarmEventType;
  titleKey: string;
  reasonKey: string;
};

const AGRONOMIC_STAGES: StageDefinition[] = [
  {
    key: 'sowing',
    dayOffset: 0,
    eventType: 'sowing',
    titleKey: 'calendar.events.sowing.title',
    reasonKey: 'calendar.events.sowing.reason',
  },
  {
    key: 'irrigation-1',
    dayOffset: 10,
    eventType: 'irrigation',
    titleKey: 'calendar.events.irrigationStage1.title',
    reasonKey: 'calendar.events.irrigationStage1.reason',
  },
  {
    key: 'fertilizer-1',
    dayOffset: 21,
    eventType: 'fertilizer',
    titleKey: 'calendar.events.fertilizerStage1.title',
    reasonKey: 'calendar.events.fertilizerStage1.reason',
  },
  {
    key: 'irrigation-2',
    dayOffset: 35,
    eventType: 'irrigation',
    titleKey: 'calendar.events.irrigationStage2.title',
    reasonKey: 'calendar.events.irrigationStage2.reason',
  },
  {
    key: 'crop-health',
    dayOffset: 50,
    eventType: 'cropHealth',
    titleKey: 'calendar.events.cropHealthStage.title',
    reasonKey: 'calendar.events.cropHealthStage.reason',
  },
  {
    key: 'fertilizer-2',
    dayOffset: 65,
    eventType: 'fertilizer',
    titleKey: 'calendar.events.fertilizerStage2.title',
    reasonKey: 'calendar.events.fertilizerStage2.reason',
  },
  {
    key: 'irrigation-3',
    dayOffset: 80,
    eventType: 'irrigation',
    titleKey: 'calendar.events.irrigationStage3.title',
    reasonKey: 'calendar.events.irrigationStage3.reason',
  },
  {
    key: 'irrigation-4',
    dayOffset: 95,
    eventType: 'irrigation',
    titleKey: 'calendar.events.irrigationStage4.title',
    reasonKey: 'calendar.events.irrigationStage4.reason',
  },
  {
    key: 'harvest',
    dayOffset: 115,
    eventType: 'harvest',
    titleKey: 'calendar.events.harvest.title',
    reasonKey: 'calendar.events.harvest.reason',
  },
];

/**
 * Derives real calendar events from the crop's sowing date (`crop.planting.sown_on`).
 * Dates earlier than or equal to `from` are marked 'completed', while future milestones are 'upcoming'.
 */
export function buildCropScheduleEvents(
  farmId: string | null,
  currentCrop: CurrentCrop,
  from: Date = new Date(),
): FarmCalendarEvent[] {
  const sownOn = currentCrop.planting?.sown_on;
  if (!sownOn) return [];

  const sownDate = new Date(`${sownOn}T00:00:00Z`);
  if (Number.isNaN(sownDate.getTime())) return [];

  const todayIso = toIsoDate(from);
  const plantingId = currentCrop.planting.id || 'current';
  const cropId = currentCrop.crop.id || null;

  return AGRONOMIC_STAGES.map((stage) => {
    let eventDateIso: string;
    if (stage.key === 'harvest' && currentCrop.planting?.expected_harvest_on) {
      eventDateIso = currentCrop.planting.expected_harvest_on;
    } else {
      eventDateIso = toIsoDate(addDaysToDate(sownDate, stage.dayOffset));
    }

    const isCompleted = eventDateIso <= todayIso;

    return {
      id: `crop-schedule-${plantingId}-${stage.key}`,
      farmId,
      cropId,
      date: eventDateIso,
      eventType: stage.eventType,
      status: isCompleted ? 'completed' : 'upcoming',
      titleKey: stage.titleKey,
      reasonKey: stage.reasonKey,
    };
  });
}

export function getCropScheduleEvent(
  eventId: string,
  farmId: string | null,
  currentCrop: CurrentCrop | null,
  from: Date = new Date(),
): FarmCalendarEvent | null {
  if (!currentCrop) return null;
  const events = buildCropScheduleEvents(farmId, currentCrop, from);
  return events.find((e) => e.id === eventId) ?? null;
}
