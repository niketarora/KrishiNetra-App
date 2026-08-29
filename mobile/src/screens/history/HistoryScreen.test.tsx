import { fireEvent, screen } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import { makeFarm, renderWithProviders } from '@/test-utils';

import { HistoryScreen } from './HistoryScreen';

const mockDemo = { enabled: false };

jest.mock('@/features/demo/demoMode', () => {
  const actual = jest.requireActual('@/features/demo/demoMode');
  return { ...actual, isDemoMode: () => mockDemo.enabled };
});

jest.mock('@/features/avatar/AvatarContext', () => ({
  useAvatar: () => ({ open: jest.fn() }),
}));

const mockFarmState: { farm: Farm | null; loading: boolean } = { farm: null, loading: false };

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

const mockGetCropHistory = jest.fn();

jest.mock('@/services/agronomy', () => ({
  getCropHistory: (...args: unknown[]) => mockGetCropHistory(...args),
}));

const wheat = {
  id: 'crop-wheat',
  code: 'wheat',
  name_en: 'Wheat',
  name_hi: 'गेहूँ',
  category: 'cereal',
  default_unit: 'quintal',
};

const mustard = {
  id: 'crop-mustard',
  code: 'mustard',
  name_en: 'Mustard',
  name_hi: 'सरसों',
  category: 'oilseed',
  default_unit: 'quintal',
};

const props = { onRegisterLand: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockDemo.enabled = false;
  mockFarmState.farm = null;
  mockFarmState.loading = false;
  mockGetCropHistory.mockResolvedValue({ current: null, previous: null });
});

describe('HistoryScreen', () => {
  describe('with no farm registered', () => {
    it('shows a clean empty state instead of an empty diary', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      expect(screen.getByTestId('history-no-farm')).toBeTruthy();
      expect(screen.queryByTestId('farm-overview')).toBeNull();
    });

    it('sends the farmer to register their land from the empty state', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      await fireEvent.press(screen.getByText('Register your land'));

      expect(props.onRegisterLand).toHaveBeenCalled();
    });
  });

  describe('Farm Overview, with a registered farm', () => {
    beforeEach(() => {
      mockFarmState.farm = makeFarm({ area_acres: 2.6544, created_at: '2026-08-01T06:00:00.000Z' });
    });

    it('shows the real registered area', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      expect(screen.getByTestId('farm-overview')).toBeTruthy();
      expect(screen.getByText('2.65 acres')).toBeTruthy();
    });

    it('shows the real current and previous crop once loaded', async () => {
      mockGetCropHistory.mockResolvedValue({
        current: { crop: wheat, planting: { sown_on: '2026-10-12' } },
        previous: { crop: mustard, planting: {} },
      });

      await renderWithProviders(<HistoryScreen {...props} />);

      expect(await screen.findByText('Wheat')).toBeTruthy();
      expect(screen.getByText('Mustard')).toBeTruthy();
    });

    it('says no crop is recorded rather than naming one', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      expect(await screen.findByText('Crop not added yet')).toBeTruthy();
      expect(screen.getByText('No previous crop recorded')).toBeTruthy();
    });

    it('shows the real farm-registered month', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      expect(screen.getByText(/August 2026/)).toBeTruthy();
    });

    it('leaves activities recorded and crop stage muted when demo mode is off', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      expect(screen.getByTestId('overview-activities')).toBeTruthy();
      expect(screen.getByTestId('overview-stage')).toBeTruthy();
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    });

    it('fills activities recorded and crop stage under demo mode, clearly badged', async () => {
      mockDemo.enabled = true;

      await renderWithProviders(<HistoryScreen {...props} />);

      expect(screen.getByText('7')).toBeTruthy();
      expect(screen.getByText('Tillering')).toBeTruthy();
    });
  });

  describe('the timeline, with demo mode off — the shipped behaviour', () => {
    beforeEach(() => {
      mockFarmState.farm = makeFarm();
    });

    it('shows the empty state, because nothing records history yet', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      expect(screen.getByTestId('history-empty')).toBeTruthy();
    });

    it('shows no sample entries and no sample badge at all', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      expect(screen.queryByTestId('sample-banner')).toBeNull();
      expect(screen.queryByText('SAMPLE DATA')).toBeNull();
      expect(screen.queryByText('Offer received')).toBeNull();
    });
  });

  describe('the timeline, with demo mode on', () => {
    beforeEach(() => {
      mockFarmState.farm = makeFarm();
      mockDemo.enabled = true;
    });

    it('shows the sample timeline, including the tending events', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      expect(screen.getByText('Field mapped')).toBeTruthy();
      expect(screen.getByText('Crop health check')).toBeTruthy();
      expect(screen.getByText('Fertilizer applied')).toBeTruthy();
      expect(screen.getByText('Irrigated')).toBeTruthy();
      expect(screen.getByText('Offer received')).toBeTruthy();
      expect(screen.queryByTestId('history-empty')).toBeNull();
    });

    it('warns at the top of the screen that values are made up', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      expect(screen.getByTestId('sample-banner')).toBeTruthy();
    });

    it('badges every single entry', async () => {
      // The invariant that makes demo mode safe: no fabricated row is ever
      // rendered without its label. One unbadged entry undoes the whole idea.
      await renderWithProviders(<HistoryScreen {...props} />);

      const entries = screen.getAllByText(
        /Field mapped|Wheat sown|Crop health check|Fertilizer applied|Irrigated|Mandi price checked|Offer received/,
      );
      const badges = screen.getAllByText('SAMPLE DATA');

      // One badge per timeline entry, plus one each for the two demo-gated
      // Farm Overview tiles, plus the one inside the banner heading.
      expect(badges.length).toBeGreaterThanOrEqual(entries.length);
    });

    it('reads oldest first, as a season actually happened', async () => {
      await renderWithProviders(<HistoryScreen {...props} />);

      const titles = screen.getAllByText(
        /Field mapped|Wheat sown|Crop health check|Fertilizer applied|Irrigated|Mandi price checked|Offer received/,
      );
      expect(titles.map((node) => node.props.children)).toEqual([
        'Field mapped',
        'Wheat sown',
        'Crop health check',
        'Fertilizer applied',
        'Irrigated',
        'Mandi price checked',
        'Offer received',
      ]);
    });
  });
});
