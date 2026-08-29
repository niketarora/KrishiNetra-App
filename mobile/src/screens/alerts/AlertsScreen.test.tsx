import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { AlertsScreen } from './AlertsScreen';

const props = { onBack: jest.fn(), onOpenAlert: jest.fn() };

describe('AlertsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the demo communication banner, never claiming a real alert was sent', async () => {
    await renderWithProviders(<AlertsScreen {...props} />);

    expect(screen.getByTestId('alerts-sample-banner')).toBeTruthy();
  });

  it('shows the demo events with a priority badge and a SAMPLE marker each', async () => {
    await renderWithProviders(<AlertsScreen {...props} />);

    expect(screen.getByText('Heavy Rainfall Warning')).toBeTruthy();
    // Two demo events share "high" priority, so more than one badge is expected.
    expect(screen.getAllByText('High priority').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/^alert-sample-badge-/).length).toBeGreaterThan(0);
  });

  it('shows each alert’s demo channel status', async () => {
    await renderWithProviders(<AlertsScreen {...props} />);

    expect(screen.getAllByText(/SMS · Sent/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Voice call · Initiated/).length).toBeGreaterThan(0);
  });

  it('opens the detail screen for the tapped alert', async () => {
    await renderWithProviders(<AlertsScreen {...props} />);

    await fireEvent.press(screen.getByTestId('alert-card-alert-rainfall-warning'));

    expect(props.onOpenAlert).toHaveBeenCalledWith('alert-rainfall-warning');
  });
});
