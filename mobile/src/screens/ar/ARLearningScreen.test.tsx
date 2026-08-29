import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { ARLearningScreen } from './ARLearningScreen';

describe('ARLearningScreen', () => {
  it('labels itself clearly as a preview, never as real analysis', async () => {
    await renderWithProviders(
      <ARLearningScreen tutorialId="soil-preparation-before-sowing" onBack={jest.fn()} />,
    );

    expect(screen.getByText('AR Learning Preview')).toBeTruthy();
    expect(
      screen.getByText(/does not analyse|does not identify|preview only/i),
    ).toBeTruthy();
  });

  it('shows the first step of the guide', async () => {
    await renderWithProviders(
      <ARLearningScreen tutorialId="soil-preparation-before-sowing" onBack={jest.fn()} />,
    );

    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    expect(screen.getByText('Point here')).toBeTruthy();
  });

  it('advances through steps and finishes on the last one', async () => {
    const onBack = jest.fn();
    await renderWithProviders(
      <ARLearningScreen tutorialId="soil-preparation-before-sowing" onBack={onBack} />,
    );

    await fireEvent.press(screen.getByTestId('ar-next-step'));
    expect(screen.getByText('Step 2 of 4')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('ar-next-step'));
    await fireEvent.press(screen.getByTestId('ar-next-step'));
    expect(screen.getByText('Step 4 of 4')).toBeTruthy();
    expect(screen.getByText('Finish')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('ar-next-step'));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows a not-available state for a tutorial with no AR guide', async () => {
    await renderWithProviders(<ARLearningScreen tutorialId="sowing-seed-depth-and-spacing" onBack={jest.fn()} />);

    expect(screen.getByTestId('ar-not-available')).toBeTruthy();
  });
});
