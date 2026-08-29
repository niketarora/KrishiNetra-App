import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { TutorialDetailScreen } from './TutorialDetailScreen';

const mockGetCompleted = jest.fn();
const mockMarkComplete = jest.fn();

jest.mock('@/services/learningProgress', () => ({
  getCompletedTutorialIds: (...args: unknown[]) => mockGetCompleted(...args),
  markTutorialComplete: (...args: unknown[]) => mockMarkComplete(...args),
}));

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const onBack = jest.fn();
const onOpenAr = jest.fn();

describe('TutorialDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompleted.mockResolvedValue([]);
  });

  it('renders the title, category, why-it-matters, steps and tips', async () => {
    await renderWithProviders(
      <TutorialDetailScreen tutorialId="soil-preparation-before-sowing" onBack={onBack} onOpenAr={onOpenAr} />,
    );

    expect(await screen.findByText('Soil Preparation Before Sowing')).toBeTruthy();
    expect(screen.getByText('Soil Preparation')).toBeTruthy();
    expect(
      screen.getByText(
        'Well-prepared soil holds air, water and nutrients where young roots can reach them, giving seedlings a strong start.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Clear previous crop residue where appropriate.')).toBeTruthy();
    expect(screen.getByText('Avoid working very wet soil — it damages soil structure.')).toBeTruthy();
  });

  it('shows the common-mistake warning when the tutorial has one', async () => {
    await renderWithProviders(
      <TutorialDetailScreen tutorialId="soil-preparation-before-sowing" onBack={onBack} onOpenAr={onOpenAr} />,
    );

    expect(await screen.findByText('Common mistake')).toBeTruthy();
    expect(
      screen.getByText('Excessive tillage can damage soil structure and long-term fertility.'),
    ).toBeTruthy();
  });

  it('omits the common-mistake section when the tutorial has none', async () => {
    await renderWithProviders(
      <TutorialDetailScreen tutorialId="government-schemes-overview" onBack={onBack} onOpenAr={onOpenAr} />,
    );

    expect(await screen.findByText('Government Schemes: What to Check')).toBeTruthy();
    expect(screen.queryByText('Common mistake')).toBeNull();
  });

  it('marks a tutorial complete and shows the completed state', async () => {
    mockMarkComplete.mockResolvedValue(['soil-preparation-before-sowing']);

    await renderWithProviders(
      <TutorialDetailScreen tutorialId="soil-preparation-before-sowing" onBack={onBack} onOpenAr={onOpenAr} />,
    );

    await waitFor(() => expect(screen.getByTestId('mark-complete')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('mark-complete'));

    expect(mockMarkComplete).toHaveBeenCalledWith('user-1', 'soil-preparation-before-sowing');
    await waitFor(() => expect(screen.getByText('Completed')).toBeTruthy());
    expect(screen.queryByTestId('mark-complete')).toBeNull();
  });

  it('already shows the completed state for a tutorial marked done earlier', async () => {
    mockGetCompleted.mockResolvedValue(['soil-preparation-before-sowing']);

    await renderWithProviders(
      <TutorialDetailScreen tutorialId="soil-preparation-before-sowing" onBack={onBack} onOpenAr={onOpenAr} />,
    );

    expect(await screen.findByText('Completed')).toBeTruthy();
    expect(screen.queryByTestId('mark-complete')).toBeNull();
  });

  it('shows a not-found state for an unknown tutorial id instead of crashing', async () => {
    await renderWithProviders(
      <TutorialDetailScreen tutorialId="does-not-exist" onBack={onBack} onOpenAr={onOpenAr} />,
    );

    expect(screen.getByTestId('tutorial-not-found')).toBeTruthy();
  });

  describe('video', () => {
    it('shows a video thumbnail for a tutorial that has one', async () => {
      await renderWithProviders(
        <TutorialDetailScreen tutorialId="soil-preparation-before-sowing" onBack={onBack} onOpenAr={onOpenAr} />,
      );

      expect(await screen.findByTestId('video-thumbnail')).toBeTruthy();
    });

    it('swaps to the player when the thumbnail is tapped', async () => {
      await renderWithProviders(
        <TutorialDetailScreen tutorialId="soil-preparation-before-sowing" onBack={onBack} onOpenAr={onOpenAr} />,
      );

      await fireEvent.press(await screen.findByTestId('video-thumbnail'));

      expect(screen.getByTestId('video-webview')).toBeTruthy();
    });

    it('renders every other section normally for a tutorial with no video', async () => {
      await renderWithProviders(
        <TutorialDetailScreen tutorialId="crop-care-through-growth-stages" onBack={onBack} onOpenAr={onOpenAr} />,
      );

      expect(screen.queryByTestId('video-thumbnail')).toBeNull();
      expect(await screen.findByText('Crop Care Through the Growth Stages')).toBeTruthy();
      expect(screen.getByText('Why it matters')).toBeTruthy();
    });
  });

  describe('AR guidance', () => {
    it('shows the Try AR guidance button only for a tutorial that supports it', async () => {
      await renderWithProviders(
        <TutorialDetailScreen tutorialId="soil-preparation-before-sowing" onBack={onBack} onOpenAr={onOpenAr} />,
      );

      expect(await screen.findByTestId('try-ar-guidance')).toBeTruthy();
    });

    it('hides the Try AR guidance button for a tutorial without one', async () => {
      await renderWithProviders(
        <TutorialDetailScreen tutorialId="sowing-seed-depth-and-spacing" onBack={onBack} onOpenAr={onOpenAr} />,
      );

      expect(await screen.findByText('Sowing: Seed Depth and Spacing')).toBeTruthy();
      expect(screen.queryByTestId('try-ar-guidance')).toBeNull();
    });

    it('opens the AR guide with this tutorial’s id', async () => {
      await renderWithProviders(
        <TutorialDetailScreen tutorialId="soil-preparation-before-sowing" onBack={onBack} onOpenAr={onOpenAr} />,
      );

      await fireEvent.press(await screen.findByTestId('try-ar-guidance'));

      expect(onOpenAr).toHaveBeenCalledWith('soil-preparation-before-sowing');
    });
  });
});
