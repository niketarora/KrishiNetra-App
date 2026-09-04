import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import * as notificationsService from '@/services/notifications';

import { AlertDetailScreen } from './AlertDetailScreen';

describe('AlertDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('dispatches SMS notification when Send SMS button is pressed', async () => {
    const sendSmsSpy = jest.spyOn(notificationsService, 'sendAlertSms').mockResolvedValueOnce({
      id: 'sms-123',
      channel: 'sms',
      phone: '+91 98765 43210',
      status: 'sent',
      simulated: true,
    });

    await renderWithProviders(
      <AlertDetailScreen alertId="alert-rainfall-warning" onBack={jest.fn()} />,
    );

    const smsButton = screen.getByTestId('send-alert-sms-button');
    expect(smsButton).toBeTruthy();

    await fireEvent.press(smsButton);

    await waitFor(() => {
      expect(sendSmsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+91 98765 43210',
          alertId: 'alert-rainfall-warning',
        }),
      );
      expect(screen.getByTestId('alert-feedback-banner')).toBeTruthy();
    });
  });

  it('initiates Voice Call notification when Place Voice Call button is pressed', async () => {
    const makeCallSpy = jest.spyOn(notificationsService, 'makeAlertCall').mockResolvedValueOnce({
      id: 'call-123',
      channel: 'voice',
      phone: '+91 98765 43210',
      status: 'initiated',
      simulated: true,
    });

    await renderWithProviders(
      <AlertDetailScreen alertId="alert-rainfall-warning" onBack={jest.fn()} />,
    );

    const callButton = screen.getByTestId('make-alert-call-button');
    expect(callButton).toBeTruthy();

    await fireEvent.press(callButton);

    await waitFor(() => {
      expect(makeCallSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+91 98765 43210',
          alertId: 'alert-rainfall-warning',
        }),
      );
      expect(screen.getByTestId('alert-feedback-banner')).toBeTruthy();
    });
  });

  it('allows customizing target phone number before dispatch', async () => {
    const sendSmsSpy = jest.spyOn(notificationsService, 'sendAlertSms').mockResolvedValueOnce({
      id: 'sms-456',
      channel: 'sms',
      phone: '+91 99999 88888',
      status: 'sent',
      simulated: true,
    });

    await renderWithProviders(
      <AlertDetailScreen alertId="alert-rainfall-warning" onBack={jest.fn()} />,
    );

    const phoneInput = screen.getByTestId('alert-phone-input');
    await fireEvent.changeText(phoneInput, '+91 99999 88888');

    await fireEvent.press(screen.getByTestId('send-alert-sms-button'));

    await waitFor(() => {
      expect(sendSmsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+91 99999 88888',
        }),
      );
    });
  });
});
