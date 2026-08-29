import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { UpdatesScreen } from './UpdatesScreen';

// The static demo feed is never actually empty in production, but the screen
// must still render correctly rather than blank if it ever were.
jest.mock('@/features/updates/demoUpdates', () => ({
  ...jest.requireActual('@/features/updates/demoUpdates'),
  UPDATES: [],
}));

const props = { onBack: jest.fn(), onOpenUpdate: jest.fn() };

describe('UpdatesScreen with no updates', () => {
  it('shows the empty state instead of a broken list', async () => {
    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByTestId('updates-empty')).toBeTruthy();
  });
});
