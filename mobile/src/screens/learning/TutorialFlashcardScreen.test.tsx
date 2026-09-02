import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import { TutorialFlashcardScreen } from './TutorialFlashcardScreen';

const mockMarkComplete = jest.fn();

jest.mock('@/services/learningProgress', () => ({
  getCompletedTutorialIds: jest.fn().mockResolvedValue([]),
  markTutorialComplete: (...args: unknown[]) => mockMarkComplete(...args),
}));

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

describe('TutorialFlashcardScreen', () => {
  const onBack = jest.fn();
  const onComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the tutorial title and flashcard steps', async () => {
    await renderWithProviders(
      <TutorialFlashcardScreen
        tutorialId="soil-preparation-before-sowing"
        onBack={onBack}
        onComplete={onComplete}
      />,
    );

    expect(await screen.findByText('Soil Preparation Before Sowing')).toBeTruthy();
    expect(screen.getByText(/Step 1 of/)).toBeTruthy();
  });

  it('completes the tutorial on finishing all flashcards', async () => {
    await renderWithProviders(
      <TutorialFlashcardScreen
        tutorialId="soil-preparation-before-sowing"
        onBack={onBack}
        onComplete={onComplete}
      />,
    );

    await screen.findByText('Soil Preparation Before Sowing');

    // Tap next until completion
    const nextBtn = screen.getByTestId('flashcard-next');
    // soil-preparation-before-sowing has 4 steps, so 4 presses completes it
    await fireEvent.press(nextBtn);
    await fireEvent.press(nextBtn);
    await fireEvent.press(nextBtn);
    await fireEvent.press(nextBtn);

    await waitFor(() => {
      expect(mockMarkComplete).toHaveBeenCalledWith('user-1', 'soil-preparation-before-sowing');
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('shows empty state for non-existent tutorial', async () => {
    await renderWithProviders(
      <TutorialFlashcardScreen
        tutorialId="non-existent-id"
        onBack={onBack}
        onComplete={onComplete}
      />,
    );

    expect(screen.getByTestId('tutorial-not-found')).toBeTruthy();
  });
});
