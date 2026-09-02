import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import { TutorialFlashcardPager } from './TutorialFlashcardPager';

describe('TutorialFlashcardPager', () => {
  const steps = [
    { en: 'Step 1: Test the soil', hi: 'चरण 1: मिट्टी की जाँच करें' },
    { en: 'Step 2: Clear debris', hi: 'चरण 2: मलबा साफ करें' },
    { en: 'Step 3: Sow the seeds', hi: 'चरण 3: बीज बोएँ' },
  ];

  it('renders the initial step and navigates forward and back', async () => {
    const onComplete = jest.fn();

    await renderWithProviders(
      <TutorialFlashcardPager steps={steps} onComplete={onComplete} />,
    );

    expect(screen.getByText('Step 1 of 3')).toBeTruthy();
    expect(screen.getByText('Step 1: Test the soil')).toBeTruthy();

    // Advance to Step 2
    await fireEvent.press(screen.getByTestId('flashcard-next'));

    await waitFor(() => {
      expect(screen.getByText('Step 2 of 3')).toBeTruthy();
      expect(screen.getByText('Step 2: Clear debris')).toBeTruthy();
    });

    // Go back to Step 1
    await fireEvent.press(screen.getByTestId('flashcard-prev'));

    await waitFor(() => {
      expect(screen.getByText('Step 1 of 3')).toBeTruthy();
      expect(screen.getByText('Step 1: Test the soil')).toBeTruthy();
    });
  });

  it('calls onComplete when advancing past the final step', async () => {
    const onComplete = jest.fn();

    await renderWithProviders(
      <TutorialFlashcardPager steps={steps} onComplete={onComplete} />,
    );

    await fireEvent.press(screen.getByTestId('flashcard-next')); // To Step 2
    await waitFor(() => expect(screen.getByText('Step 2 of 3')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('flashcard-next')); // To Step 3
    await waitFor(() => expect(screen.getByText('Step 3 of 3')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('flashcard-next')); // Complete

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
