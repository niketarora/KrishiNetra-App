import type { CurrentCrop } from '@/services/agronomy';
import { buildCropScheduleEvents, getCropScheduleEvent } from './cropSchedule';

const makeCurrentCrop = (overrides: Partial<CurrentCrop['planting']> = {}): CurrentCrop => ({
  crop: {
    id: 'crop-wheat',
    code: 'wheat',
    name_en: 'Wheat',
    name_hi: 'गेहूँ',
    category: 'cereal',
    default_unit: 'quintal',
  },
  planting: {
    id: 'planting-1',
    farm_id: 'farm-1',
    crop_id: 'crop-wheat',
    variety: 'HD-2967',
    sown_on: '2026-08-01',
    expected_harvest_on: null,
    area_acres: 2.5,
    status: 'growing',
    notes: null,
    ...overrides,
  },
});

describe('cropSchedule', () => {
  const referenceDate = new Date('2026-08-25T12:00:00Z'); // 24 days after sowing

  it('returns empty array when crop has no sown_on date', () => {
    const cropWithoutSowing = makeCurrentCrop({ sown_on: null });
    expect(buildCropScheduleEvents('farm-1', cropWithoutSowing, referenceDate)).toEqual([]);
  });

  it('builds milestone schedule from sowing date with correct completion statuses', () => {
    const crop = makeCurrentCrop({ sown_on: '2026-08-01' });
    const events = buildCropScheduleEvents('farm-1', crop, referenceDate);

    expect(events).toHaveLength(9);

    // Sowing (Day 0) -> 2026-08-01: completed
    expect(events[0]).toMatchObject({
      id: 'crop-schedule-planting-1-sowing',
      date: '2026-08-01',
      eventType: 'sowing',
      status: 'completed',
    });

    // Irrigation 1 (Day +10) -> 2026-08-11: completed
    expect(events[1]).toMatchObject({
      id: 'crop-schedule-planting-1-irrigation-1',
      date: '2026-08-11',
      eventType: 'irrigation',
      status: 'completed',
    });

    // Fertilizer 1 (Day +21) -> 2026-08-22: completed
    expect(events[2]).toMatchObject({
      id: 'crop-schedule-planting-1-fertilizer-1',
      date: '2026-08-22',
      eventType: 'fertilizer',
      status: 'completed',
    });

    // Irrigation 2 (Day +35) -> 2026-09-05: upcoming
    expect(events[3]).toMatchObject({
      id: 'crop-schedule-planting-1-irrigation-2',
      date: '2026-09-05',
      eventType: 'irrigation',
      status: 'upcoming',
    });

    // Crop Health (Day +50) -> 2026-09-20: upcoming
    expect(events[4]).toMatchObject({
      id: 'crop-schedule-planting-1-crop-health',
      date: '2026-09-20',
      eventType: 'cropHealth',
      status: 'upcoming',
    });

    // Fertilizer 2 (Day +65) -> 2026-10-05: upcoming
    expect(events[5]).toMatchObject({
      id: 'crop-schedule-planting-1-fertilizer-2',
      date: '2026-10-05',
      eventType: 'fertilizer',
      status: 'upcoming',
    });

    // Irrigation 3 (Day +80) -> 2026-10-20: upcoming
    expect(events[6]).toMatchObject({
      id: 'crop-schedule-planting-1-irrigation-3',
      date: '2026-10-20',
      eventType: 'irrigation',
      status: 'upcoming',
    });

    // Irrigation 4 (Day +95) -> 2026-11-04: upcoming
    expect(events[7]).toMatchObject({
      id: 'crop-schedule-planting-1-irrigation-4',
      date: '2026-11-04',
      eventType: 'irrigation',
      status: 'upcoming',
    });

    // Harvest (Day +115) -> 2026-11-24: upcoming
    expect(events[8]).toMatchObject({
      id: 'crop-schedule-planting-1-harvest',
      date: '2026-11-24',
      eventType: 'harvest',
      status: 'upcoming',
    });
  });

  it('uses expected_harvest_on if specified on the planting', () => {
    const crop = makeCurrentCrop({
      sown_on: '2026-08-01',
      expected_harvest_on: '2026-12-05',
    });
    const events = buildCropScheduleEvents('farm-1', crop, referenceDate);
    const harvestEvent = events.find((e) => e.eventType === 'harvest');
    expect(harvestEvent?.date).toBe('2026-12-05');
  });

  it('fetches a specific schedule event by ID', () => {
    const crop = makeCurrentCrop({ sown_on: '2026-08-01' });
    const event = getCropScheduleEvent(
      'crop-schedule-planting-1-irrigation-1',
      'farm-1',
      crop,
      referenceDate,
    );

    expect(event).toBeTruthy();
    expect(event?.eventType).toBe('irrigation');
    expect(event?.date).toBe('2026-08-11');
  });

  it('returns null for an unknown event id or null crop', () => {
    const crop = makeCurrentCrop({ sown_on: '2026-08-01' });
    expect(getCropScheduleEvent('non-existent', 'farm-1', crop, referenceDate)).toBeNull();
    expect(getCropScheduleEvent('crop-schedule-planting-1-irrigation-1', 'farm-1', null, referenceDate)).toBeNull();
  });
});
