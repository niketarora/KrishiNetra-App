import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

const mockAuthState: {
  initializing: boolean;
  session: { user: { id: string } } | null;
} = { initializing: false, session: { user: { id: 'user-1' } } };

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// FarmContext/AvatarContext no longer gate anything the root navigator
// renders — they're mocked as pass-throughs so this file tests only the
// signed-out/signed-in split, not the providers' own behaviour.
jest.mock('@/features/farm/FarmContext', () => ({
  FarmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/avatar/AvatarContext', () => ({
  AvatarProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/avatar/AvatarOverlay', () => ({
  AvatarOverlay: () => null,
}));

jest.mock('./AuthNavigator', () => {
  const { Text } = require('react-native');
  return { AuthNavigator: () => <Text>auth-world</Text> };
});

jest.mock('./MainNavigator', () => {
  const { Text } = require('react-native');
  return { MainNavigator: () => <Text>main-world</Text> };
});

jest.mock('./OnboardingNavigator', () => {
  const { Text } = require('react-native');
  return { OnboardingNavigator: () => <Text>onboarding-world</Text> };
});

import { RootNavigator } from './RootNavigator';

describe('RootNavigator', () => {
  beforeEach(() => {
    mockAuthState.initializing = false;
    mockAuthState.session = { user: { id: 'user-1' } };
  });

  it('sends a signed-out farmer to auth, never to the main app', async () => {
    mockAuthState.session = null;
    await renderWithProviders(<RootNavigator />);

    expect(screen.getByText('auth-world')).toBeTruthy();
    expect(screen.queryByText('main-world')).toBeNull();
  });

  it('sends a signed-in farmer straight to the main app with no farm registered', async () => {
    // Account creation must not imply farm registration: a farmer with zero
    // farms on record still lands on the main app, not an onboarding gate.
    await renderWithProviders(<RootNavigator />);

    expect(screen.getByText('main-world')).toBeTruthy();
    expect(screen.queryByText('onboarding-world')).toBeNull();
  });

  it('never renders the onboarding flow from the root navigator', async () => {
    await renderWithProviders(<RootNavigator />);

    expect(screen.queryByText('onboarding-world')).toBeNull();
  });
});
