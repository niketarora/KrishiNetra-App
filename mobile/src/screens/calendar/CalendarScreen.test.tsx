import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import { makeFarm, renderWithProviders } from '@/test-utils';

import { toIsoDate } from '@/utils/calendar';

import { CalendarScreen } from './CalendarScreen';

function isoOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

const mockDemo = { enabled: false };

jest.mock('@/features/demo/demoMode', () => ({
  isDemoMode: () => mockDemo.enabled,
}));

const mockFarmState: { farm: Farm | null } = { farm: null };

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

const mockGetCurrentCrop = jest.fn();

jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: (...args: unknown[]) => mockGetCurrentCrop(...args),
}));

const props = { onBack: jest.fn(), onRegisterLand: jest.fn(), onOpenEvent: jest.fn() };

describe('CalendarScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    mockDemo.enabled = false;
    mockFarmState.farm = null;
    mockGetCurrentCrop.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('with no farm registered', () => {
    it('shows a clean empty state instead of an empty calendar', async () => {
      await renderWithProviders(<CalendarScreen {...props} />);

      expect(screen.getByTestId('calendar-no-farm')).toBeTruthy();
      expect(screen.queryByTestId('month-grid')).toBeNull();
    });

    it('sends the farmer to register their land', async () => {
      await renderWithProviders(<CalendarScreen {...props} />);

      await fireEvent.press(screen.getByText('Register your land'));

      expect(props.onRegisterLand).toHaveBeenCalled();
    });
  });

  describe('with a farm, demo mode off — the shipped behaviour', () => {
    beforeEach(() => {
      mockFarmState.farm = makeFarm();
    });

    it('renders the month grid, functional either way', async () => {
      await renderWithProviders(<CalendarScreen {...props} />);

      expect(screen.getByTestId('month-grid')).toBeTruthy();
    });

    it('shows the honest empty-events state, not fabricated activities', async () => {
      await renderWithProviders(<CalendarScreen {...props} />);

      expect(screen.getByTestId('calendar-no-events')).toBeTruthy();
      expect(screen.queryByTestId('sample-banner')).toBeNull();
      expect(screen.queryByText('Irrigation')).toBeNull();
    });
  });

  describe('with a farm, demo mode on', () => {
    beforeEach(() => {
      mockFarmState.farm = makeFarm();
    });

    it('warns that the schedule below is illustrative', async () => {
      mockDemo.enabled = true;
      await renderWithProviders(<CalendarScreen {...props} />);

      expect(screen.getByTestId('sample-banner')).toBeTruthy();
    });

    it('lists the upcoming demo activities', async () => {
      mockDemo.enabled = true;
      await renderWithProviders(<CalendarScreen {...props} />);

      expect(screen.getByTestId('calendar-event-demo-cal-irrigation')).toBeTruthy();
      expect(screen.getByTestId('calendar-event-demo-cal-fertilizer')).toBeTruthy();
      expect(screen.getByTestId('calendar-event-demo-cal-harvest')).toBeTruthy();
      // The one completed demo event (sowing, 30 days ago) is not "upcoming".
      expect(screen.queryByTestId('calendar-event-demo-cal-sowing')).toBeNull();
    });

    it('opens an event with its id when its card is tapped', async () => {
      mockDemo.enabled = true;
      await renderWithProviders(<CalendarScreen {...props} />);

      await fireEvent.press(screen.getByTestId('calendar-event-demo-cal-irrigation'));

      expect(props.onOpenEvent).toHaveBeenCalledWith('demo-cal-irrigation');
    });

    it('shows a day’s activity again when that date is selected', async () => {
      mockDemo.enabled = true;
      await renderWithProviders(<CalendarScreen {...props} />);

      // Only the "Upcoming" list shows it before the day itself is selected.
      expect(screen.getAllByTestId('calendar-event-demo-cal-irrigation')).toHaveLength(1);

      await fireEvent.press(screen.getByTestId(`calendar-day-${isoOffset(1)}`));

      await waitFor(() =>
        expect(screen.getAllByTestId('calendar-event-demo-cal-irrigation')).toHaveLength(2),
      );
    });
  });
});
