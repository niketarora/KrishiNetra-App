import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { LoginScreen } from './LoginScreen';

// jest.mock is hoisted above the imports, so the factory may only close over
// variables whose names start with "mock".
const mockSignIn = jest.fn();

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockSignIn.mockResolvedValue({ ok: true });
  });

  it('will not call Supabase with an empty form', async () => {
    await renderWithProviders(<LoginScreen onGoToRegister={jest.fn()} />);

    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(await screen.findByText('Please enter your email')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('rejects a malformed email before hitting the network', async () => {
    await renderWithProviders(<LoginScreen onGoToRegister={jest.fn()} />);

    await fireEvent.changeText(screen.getByTestId('login-email'), 'ramesh@');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'password123');
    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('signs in with a valid form', async () => {
    await renderWithProviders(<LoginScreen onGoToRegister={jest.fn()} />);

    await fireEvent.changeText(screen.getByTestId('login-email'), 'ramesh@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'password123');
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'ramesh@example.com',
        password: 'password123',
      }),
    );
  });

  it('shows a readable message for wrong credentials, not the raw Supabase text', async () => {
    mockSignIn.mockResolvedValue({ ok: false, errorKey: 'auth.errors.invalidCredentials' });

    await renderWithProviders(<LoginScreen onGoToRegister={jest.fn()} />);

    await fireEvent.changeText(screen.getByTestId('login-email'), 'ramesh@example.com');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'wrongpassword');
    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(await screen.findByText('Wrong email or password')).toBeTruthy();
    expect(screen.queryByText(/Invalid login credentials/i)).toBeNull();
  });

  it('offers a way to register', async () => {
    const onGoToRegister = jest.fn();
    await renderWithProviders(<LoginScreen onGoToRegister={onGoToRegister} />);

    await fireEvent.press(screen.getByText('Create an account'));

    expect(onGoToRegister).toHaveBeenCalled();
  });
});


