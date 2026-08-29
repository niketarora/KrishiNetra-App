import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';

import { AvatarOverlay } from '@/components/avatar/AvatarOverlay';
import { AvatarProvider } from '@/features/avatar/AvatarContext';
import { useAuth } from '@/features/auth/AuthContext';
import { FarmProvider } from '@/features/farm/FarmContext';
import { SplashScreen } from '@/screens/SplashScreen';
import { colors } from '@/theme';

import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

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
 * Decides which of the two worlds the farmer is in.
 *
 * Gating on state rather than imperative navigation is what makes the main
 * app actually protected: there is no route to it while `session` is null,
 * so a signed-out user cannot reach it by any navigation action, and signing
 * out anywhere unmounts it immediately.
 *
 * Farm registration is deliberately not part of this gate. Account creation
 * and farm registration are separate steps — a signed-in farmer goes straight
 * to `MainNavigator` whether or not they have registered any land yet, and
 * registers it later, optionally, from Profile → My Farm.
 */
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
          <MainNavigator />
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
