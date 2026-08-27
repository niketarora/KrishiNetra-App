import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';

import { AvatarOverlay } from '@/components/avatar/AvatarOverlay';
import { AvatarProvider } from '@/features/avatar/AvatarContext';
import { useAuth } from '@/features/auth/AuthContext';
import { FarmProvider, useFarm } from '@/features/farm/FarmContext';
import { SplashScreen } from '@/screens/SplashScreen';
import { colors } from '@/theme';

import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text.primary,
    border: colors.border,
  },
};

/**
 * Decides which of the three worlds the farmer is in.
 *
 * Gating on state rather than imperative navigation is what makes protected
 * screens actually protected: there is no route to the main app while
 * `session` is null, so a signed-out user cannot reach it by any navigation
 * action, and signing out anywhere unmounts it immediately.
 */
function SignedInApp() {
  const { farm, loading } = useFarm();

  // Hold the splash while the farm loads, so a farmer who already has a field
  // never sees field setup flash past on the way to Home.
  if (loading && !farm) return <SplashScreen />;

  return farm ? <MainNavigator /> : <OnboardingNavigator />;
}

export function RootNavigator() {
  const { initializing, session } = useAuth();

  if (initializing) return <SplashScreen />;

  if (!session) {
    return (
      <NavigationContainer theme={navigationTheme}>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  return (
    <FarmProvider>
      <AvatarProvider>
        <NavigationContainer theme={navigationTheme}>
          <SignedInApp />
        </NavigationContainer>
        {/*
          Rendered outside the NavigationContainer so the avatar can be opened
          from any screen and covers the tab bar — it is an interaction layer
          over the app, not a destination in it.
        */}
        <AvatarOverlay />
      </AvatarProvider>
    </FarmProvider>
  );
}
