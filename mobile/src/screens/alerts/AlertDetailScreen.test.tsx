import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { AlertDetailScreen } from './AlertDetailScreen';

describe('AlertDetailScreen', () => {
  it('shows the alert body and an explicit demo notice', async () => {
    await renderWithProviders(
      <AlertDetailScreen alertId="alert-rainfall-warning" onBack={jest.fn()} />,
    );

    expect(screen.getByText(/Heavy rainfall is expected/)).toBeTruthy();
    expect(screen.getByTestId('alert-demo-notice')).toBeTruthy();
    expect(
      screen.getByText('Demo communication — no real SMS or phone call was sent.'),
    ).toBeTruthy();
  });

  it('shows the per-channel demo status', async () => {
    await renderWithProviders(
      <AlertDetailScreen alertId="alert-rainfall-warning" onBack={jest.fn()} />,
    );

    expect(screen.getByText('SMS')).toBeTruthy();
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(screen.getByText('Voice call')).toBeTruthy();
    expect(screen.getByText('Initiated')).toBeTruthy();
  });

  it('shows a not-found state for an unknown alert id', async () => {
    await renderWithProviders(<AlertDetailScreen alertId="does-not-exist" onBack={jest.fn()} />);

    expect(screen.getByTestId('alert-not-found')).toBeTruthy();
  });
});
