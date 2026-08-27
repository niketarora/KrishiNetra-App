import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { HistoryScreen } from './HistoryScreen';

const mockDemo = { enabled: false };

jest.mock('@/features/demo/demoMode', () => {
  const actual = jest.requireActual('@/features/demo/demoMode');
  return { ...actual, isDemoMode: () => mockDemo.enabled };
});

jest.mock('@/features/avatar/AvatarContext', () => ({
  useAvatar: () => ({ open: jest.fn() }),
}));

beforeEach(() => {
  mockDemo.enabled = false;
});

describe('HistoryScreen', () => {
  describe('with demo mode off — the shipped behaviour', () => {
    it('shows the empty state, because nothing records history yet', async () => {
      await renderWithProviders(<HistoryScreen />);

      expect(screen.getByTestId('history-empty')).toBeTruthy();
    });

    it('shows no sample entries and no sample badge at all', async () => {
      await renderWithProviders(<HistoryScreen />);

      expect(screen.queryByTestId('sample-banner')).toBeNull();
      expect(screen.queryByText('SAMPLE DATA')).toBeNull();
      expect(screen.queryByText('Offer received')).toBeNull();
    });
  });

  describe('with demo mode on', () => {
    beforeEach(() => {
      mockDemo.enabled = true;
    });

    it('shows the sample timeline', async () => {
      await renderWithProviders(<HistoryScreen />);

      expect(screen.getByText('Field mapped')).toBeTruthy();
      expect(screen.getByText('Offer received')).toBeTruthy();
      expect(screen.queryByTestId('history-empty')).toBeNull();
    });

    it('warns at the top of the screen that values are made up', async () => {
      await renderWithProviders(<HistoryScreen />);

      expect(screen.getByTestId('sample-banner')).toBeTruthy();
    });

    it('badges every single entry', async () => {
      // The invariant that makes demo mode safe: no fabricated row is ever
      // rendered without its label. One unbadged entry undoes the whole idea.
      await renderWithProviders(<HistoryScreen />);

      const entries = screen.getAllByText(/Field mapped|Wheat sown|Mandi price checked|Offer received/);
      const badges = screen.getAllByText('SAMPLE DATA');

      // One badge per entry, plus the one inside the banner heading.
      expect(badges.length).toBeGreaterThanOrEqual(entries.length);
    });
  });
});
