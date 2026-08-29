import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { AlertsScreen } from './AlertsScreen';

// The static demo feed is never actually empty in production, but the screen
// must still render correctly rather than blank if it ever were.
jest.mock('@/features/alerts/communicationProvider', () => ({
  demoCommunicationProvider: { getHistory: () => [], getEvent: () => null },
}));

const props = { onBack: jest.fn(), onOpenAlert: jest.fn() };

describe('AlertsScreen with no alerts', () => {
  it('shows the empty state instead of a broken list', async () => {
    await renderWithProviders(<AlertsScreen {...props} />);

    expect(screen.getByTestId('alerts-empty')).toBeTruthy();
  });
});
