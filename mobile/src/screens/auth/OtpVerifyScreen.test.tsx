import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { OtpVerifyScreen } from './OtpVerifyScreen';

const mockRequestPhoneOtp = jest.fn();
const mockVerifyPhoneOtp = jest.fn();

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ requestPhoneOtp: mockRequestPhoneOtp, verifyPhoneOtp: mockVerifyPhoneOtp }),
}));

const props = { normalizedPhone: '9876543210', initialDevCode: '482913', onBack: jest.fn() };

describe('OtpVerifyScreen', () => {
  beforeEach(() => {
    mockRequestPhoneOtp.mockReset();
    mockVerifyPhoneOtp.mockReset();
    mockVerifyPhoneOtp.mockResolvedValue({ ok: true });
  });

  it('shows the demo code so the flow works with no real SMS', async () => {
    await renderWithProviders(<OtpVerifyScreen {...props} />);

    expect(screen.getByTestId('demo-otp-code')).toBeTruthy();
    expect(screen.getByText(/482913/)).toBeTruthy();
  });

  it('will not verify an incomplete code', async () => {
    await renderWithProviders(<OtpVerifyScreen {...props} />);

    await fireEvent.press(screen.getByTestId('otp-submit'));

    expect(await screen.findByText("Please enter the OTP")).toBeTruthy();
    expect(mockVerifyPhoneOtp).not.toHaveBeenCalled();
  });

  it('verifies a well-formed code', async () => {
    await renderWithProviders(<OtpVerifyScreen {...props} />);

    await fireEvent.changeText(screen.getByTestId('otp-input'), '482913');
    await fireEvent.press(screen.getByTestId('otp-submit'));

    await waitFor(() => expect(mockVerifyPhoneOtp).toHaveBeenCalledWith('9876543210', '482913'));
  });

  it('shows a readable message for a wrong code', async () => {
    mockVerifyPhoneOtp.mockResolvedValue({ ok: false, errorKey: 'auth.errors.otpInvalid' });

    await renderWithProviders(<OtpVerifyScreen {...props} />);

    await fireEvent.changeText(screen.getByTestId('otp-input'), '000000');
    await fireEvent.press(screen.getByTestId('otp-submit'));

    expect(await screen.findByText("That code isn't right. Please try again.")).toBeTruthy();
  });

  it('requests a fresh code on resend, once the cooldown has elapsed', async () => {
    jest.useFakeTimers();
    mockRequestPhoneOtp.mockResolvedValue({ ok: true, devCode: '111222' });

    await renderWithProviders(<OtpVerifyScreen {...props} />);

    // Resend is disabled immediately after the OTP screen opens, to stop
    // reflexive re-tapping — it only becomes available once the cooldown ends.
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    await fireEvent.press(screen.getByTestId('resend-otp'));

    await waitFor(() => expect(mockRequestPhoneOtp).toHaveBeenCalledWith('9876543210'));
    expect(await screen.findByText(/111222/)).toBeTruthy();

    jest.useRealTimers();
  });

  it('offers a way back to change the number', async () => {
    const onBack = jest.fn();
    await renderWithProviders(<OtpVerifyScreen {...props} onBack={onBack} />);

    await fireEvent.press(screen.getByText('Change number'));

    expect(onBack).toHaveBeenCalled();
  });
});
