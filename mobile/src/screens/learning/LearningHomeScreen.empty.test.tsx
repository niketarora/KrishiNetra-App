import { screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { LearningHomeScreen } from './LearningHomeScreen';

// Exercises the structurally-possible "no tutorials" state in isolation — the
// static content array is never actually empty in production, but the screen
// must still render correctly rather than blank if it ever were.
jest.mock('@/features/learning/tutorials', () => ({
  ...jest.requireActual('@/features/learning/tutorials'),
  TUTORIALS: [],
}));

jest.mock('@/services/learningProgress', () => ({
  getCompletedTutorialIds: jest.fn(async () => []),
  markTutorialComplete: jest.fn(),
}));

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const props = { onBack: jest.fn(), onOpenTutorial: jest.fn() };

describe('LearningHomeScreen with no tutorials', () => {
  it('shows the empty state instead of a progress count or card list', async () => {
    await renderWithProviders(<LearningHomeScreen {...props} />);

    await waitFor(() => expect(screen.getByTestId('learning-empty')).toBeTruthy());
    expect(screen.queryByText(/tutorials completed/)).toBeNull();
  });
});
