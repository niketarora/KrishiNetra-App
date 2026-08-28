import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { LearningHomeScreen } from './LearningHomeScreen';

const mockGetCompleted = jest.fn();

jest.mock('@/services/learningProgress', () => ({
  getCompletedTutorialIds: (...args: unknown[]) => mockGetCompleted(...args),
  markTutorialComplete: jest.fn(),
}));

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const props = { onBack: jest.fn(), onOpenTutorial: jest.fn() };

describe('LearningHomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompleted.mockResolvedValue([]);
  });

  it('lists all eight categories as tutorial cards', async () => {
    await renderWithProviders(<LearningHomeScreen {...props} />);
    await waitFor(() => expect(screen.getByText('0 of 8 tutorials completed')).toBeTruthy());

    expect(screen.getByText('Soil Preparation')).toBeTruthy();
    expect(screen.getByText('Soil Preparation Before Sowing')).toBeTruthy();
    expect(screen.getByText('Irrigation')).toBeTruthy();
    expect(screen.getByText('Government Schemes')).toBeTruthy();
  });

  it('counts completed tutorials correctly and badges only those', async () => {
    mockGetCompleted.mockResolvedValue(['soil-preparation-before-sowing']);

    await renderWithProviders(<LearningHomeScreen {...props} />);

    await waitFor(() => expect(screen.getByText('1 of 8 tutorials completed')).toBeTruthy());
    expect(screen.getAllByText('Completed')).toHaveLength(1);
  });

  it('opens a tutorial with its id when its card is tapped', async () => {
    await renderWithProviders(<LearningHomeScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('tutorial-card-sowing-seed-depth-and-spacing')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tutorial-card-sowing-seed-depth-and-spacing'));

    expect(props.onOpenTutorial).toHaveBeenCalledWith('sowing-seed-depth-and-spacing');
  });

  it('shows a skeleton while progress is still loading', async () => {
    let resolveGet: (ids: string[]) => void = () => undefined;
    mockGetCompleted.mockReturnValue(new Promise((resolve) => { resolveGet = resolve; }));

    await renderWithProviders(<LearningHomeScreen {...props} />);

    expect(screen.getByTestId('skeleton')).toBeTruthy();
    expect(screen.queryByTestId('learning-progress')).toBeNull();

    resolveGet([]);
    await waitFor(() => expect(screen.getByTestId('learning-progress')).toBeTruthy());
  });
});
