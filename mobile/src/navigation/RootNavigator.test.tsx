import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

const mockAuthState: {
  initializing: boolean;
  session: { user: { id: string } } | null;
  profile: { full_name: string | null } | null;
} = { initializing: false, session: { user: { id: 'user-1' } }, profile: { full_name: 'Ramesh Kumar' } };

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@/screens/auth/ProfileSetupScreen', () => {
  const { Text } = require('react-native');
  return { ProfileSetupScreen: () => <Text>profile-setup-world</Text> };
});

// FarmContext/AvatarContext no longer gate anything the root navigator
// renders — they're mocked as pass-throughs so this file tests only the
// signed-out/signed-in split, not the providers' own behaviour.
jest.mock('@/features/farm/FarmContext', () => ({
  FarmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/avatar/AvatarContext', () => ({
  AvatarProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/guide/GuideContext', () => ({
  GuideProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// The three siblings rendered outside NavigationContainer. Stubbed out for the
// same reason as the providers: this file tests the signed-out/signed-in split,
// not the interaction layer that sits over the signed-in half of it.
jest.mock('@/components/avatar/AvatarPeek', () => ({
  AvatarPeek: () => null,
}));

jest.mock('@/components/avatar/AvatarFab', () => ({
  AvatarFab: () => null,
}));

jest.mock('@/components/guide/Spotlight', () => ({
  Spotlight: () => null,
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
    mockAuthState.profile = { full_name: 'Ramesh Kumar' };
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

  it('sends a farmer with no name yet to profile setup, not the main app', async () => {
    // First-time phone verification creates a profile row with no name — the
    // farmer must complete it before reaching Onboarding/Main.
    mockAuthState.profile = { full_name: '' };
    await renderWithProviders(<RootNavigator />);

    expect(screen.getByText('profile-setup-world')).toBeTruthy();
    expect(screen.queryByText('main-world')).toBeNull();
  });

  it('falls through to the main app once the profile has a name', async () => {
    mockAuthState.profile = { full_name: 'Ramesh Kumar' };
    await renderWithProviders(<RootNavigator />);

    expect(screen.getByText('main-world')).toBeTruthy();
    expect(screen.queryByText('profile-setup-world')).toBeNull();
  });

  it('does not gate on profile setup while the profile has not loaded yet', async () => {
    // A transient null profile (still loading, or a fetch error) must not
    // trap the farmer on profile setup — it falls through like Phase 1 did.
    mockAuthState.profile = null;
    await renderWithProviders(<RootNavigator />);

    expect(screen.getByText('main-world')).toBeTruthy();
  });
});
