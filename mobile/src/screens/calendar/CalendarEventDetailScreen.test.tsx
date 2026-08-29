import { screen } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import { makeFarm, renderWithProviders } from '@/test-utils';

import { CalendarEventDetailScreen } from './CalendarEventDetailScreen';

const mockFarmState: { farm: Farm | null } = { farm: makeFarm() };

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

const mockGetCurrentCrop = jest.fn();

jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: (...args: unknown[]) => mockGetCurrentCrop(...args),
}));

const wheat = {
  crop: { id: 'crop-wheat', code: 'wheat', name_en: 'Wheat', name_hi: 'गेहूँ', category: 'cereal', default_unit: 'quintal' },
  planting: { id: 'planting-1', farm_id: 'farm-1', crop_id: 'crop-wheat', variety: null, sown_on: null, expected_harvest_on: null, area_acres: null, status: 'growing', notes: null },
};

describe('CalendarEventDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFarmState.farm = makeFarm();
    mockGetCurrentCrop.mockResolvedValue(wheat);
  });

  it('renders field, crop, schedule and the reason it is shown', async () => {
    await renderWithProviders(
      <CalendarEventDetailScreen eventId="demo-cal-irrigation" onBack={jest.fn()} />,
    );

    expect((await screen.findAllByText('Irrigation')).length).toBeGreaterThan(0);
    expect(screen.getByText('North plot')).toBeTruthy();
    expect(screen.getByText('Wheat')).toBeTruthy();
    expect(
      screen.getByText(
        'Illustration of what a connected irrigation engine will one day recommend, based on soil moisture and crop stage.',
      ),
    ).toBeTruthy();
  });

  it('marks the illustrative schedule with a sample badge', async () => {
    await renderWithProviders(
      <CalendarEventDetailScreen eventId="demo-cal-irrigation" onBack={jest.fn()} />,
    );

    expect(await screen.findByTestId('calendar-demo-notice')).toBeTruthy();
    expect(screen.getByText('SAMPLE DATA')).toBeTruthy();
  });

  it('shows Upcoming for a scheduled event and Completed for a past one', async () => {
    await renderWithProviders(
      <CalendarEventDetailScreen eventId="demo-cal-irrigation" onBack={jest.fn()} />,
    );
    expect(await screen.findByText('Upcoming')).toBeTruthy();
  });

  it('shows Completed for the past sowing event', async () => {
    await renderWithProviders(
      <CalendarEventDetailScreen eventId="demo-cal-sowing" onBack={jest.fn()} />,
    );
    expect(await screen.findByText('Completed')).toBeTruthy();
  });

  it('says no crop is recorded rather than naming one', async () => {
    mockGetCurrentCrop.mockResolvedValue(null);

    await renderWithProviders(
      <CalendarEventDetailScreen eventId="demo-cal-irrigation" onBack={jest.fn()} />,
    );

    expect(await screen.findByText('Crop not added yet')).toBeTruthy();
  });

  it('shows a not-found state for an unknown event id instead of crashing', async () => {
    await renderWithProviders(
      <CalendarEventDetailScreen eventId="does-not-exist" onBack={jest.fn()} />,
    );

    expect(screen.getByTestId('calendar-event-not-found')).toBeTruthy();
  });

  it('shows a not-found state when there is no farm at all', async () => {
    mockFarmState.farm = null;

    await renderWithProviders(
      <CalendarEventDetailScreen eventId="demo-cal-irrigation" onBack={jest.fn()} />,
    );

    expect(screen.getByTestId('calendar-event-not-found')).toBeTruthy();
  });
});
