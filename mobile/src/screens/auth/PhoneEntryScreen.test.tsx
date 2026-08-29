import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { PhoneEntryScreen } from './PhoneEntryScreen';

const mockRequestPhoneOtp = jest.fn();

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ requestPhoneOtp: mockRequestPhoneOtp }),
}));

describe('PhoneEntryScreen', () => {
  beforeEach(() => {
    mockRequestPhoneOtp.mockReset();
    mockRequestPhoneOtp.mockResolvedValue({ ok: true, devCode: '482913' });
  });

  it('will not request an OTP for an empty number', async () => {
    await renderWithProviders(<PhoneEntryScreen onOtpSent={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('phone-submit'));

    expect(await screen.findByText('Please enter your mobile number')).toBeTruthy();
    expect(mockRequestPhoneOtp).not.toHaveBeenCalled();
  });

  it('rejects a number that is not a valid 10-digit mobile number', async () => {
    await renderWithProviders(<PhoneEntryScreen onOtpSent={jest.fn()} />);

    await fireEvent.changeText(screen.getByTestId('phone-input'), '12345');
    await fireEvent.press(screen.getByTestId('phone-submit'));

    expect(await screen.findByText('Enter a valid 10-digit mobile number')).toBeTruthy();
    expect(mockRequestPhoneOtp).not.toHaveBeenCalled();
  });

  it('requests an OTP for a valid number and hands the caller the normalized digits', async () => {
    const onOtpSent = jest.fn();
    await renderWithProviders(<PhoneEntryScreen onOtpSent={onOtpSent} />);

    await fireEvent.changeText(screen.getByTestId('phone-input'), '9876543210');
    await fireEvent.press(screen.getByTestId('phone-submit'));

    await waitFor(() => expect(mockRequestPhoneOtp).toHaveBeenCalledWith('9876543210'));
    await waitFor(() => expect(onOtpSent).toHaveBeenCalledWith('9876543210', '482913'));
  });
});
