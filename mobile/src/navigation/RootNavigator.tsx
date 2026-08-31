import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';

import { AvatarFab } from '@/components/avatar/AvatarFab';
import { AvatarPeek } from '@/components/avatar/AvatarPeek';
import { Spotlight } from '@/components/guide/Spotlight';
import { AvatarProvider } from '@/features/avatar/AvatarContext';
import { useAuth } from '@/features/auth/AuthContext';
import { FarmProvider } from '@/features/farm/FarmContext';
import { GuideProvider } from '@/features/guide/GuideContext';
import { ProfileSetupScreen } from '@/screens/auth/ProfileSetupScreen';
import { SplashScreen } from '@/screens/SplashScreen';
import { colors } from '@/theme';

import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { navigationRef } from './navigationRef';

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
 *
 * One more state-driven tier sits between "session exists" and the farm
 * gate: a farmer who just verified their phone for the first time has a
 * profile row (created by the `handle_new_user` trigger) but no name yet.
 * `ProfileSetupScreen` collects it; saving updates the profile, which flips
 * this condition off and lets the farmer fall through to Onboarding/Main —
 * no imperative navigation call is involved, same as every other tier here.
 */
export function RootNavigator() {
  const { initializing, session, profile } = useAuth();

  if (initializing) return <SplashScreen />;

  if (!session) {
    return (
      <NavigationContainer theme={navigationTheme}>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  if (profile && !profile.full_name?.trim()) {
    return (
      <NavigationContainer theme={navigationTheme}>
        <ProfileSetupScreen />
      </NavigationContainer>
    );
  }

  return (
    <FarmProvider>
      {/*
        GuideProvider sits above AvatarProvider because the avatar drives it:
        a routed answer hands its navigation steps to the guide, and an
        interrupted exchange cancels whatever the guide was doing.
      */}
      <GuideProvider>
        <AvatarProvider>
          {/*
            The ref is how the guide reaches navigation. Screens still take
            their navigation as callback props; this exists only for the three
            siblings below, which are outside the container by design.
          */}
          <NavigationContainer theme={navigationTheme} ref={navigationRef}>
            <MainNavigator />
          </NavigationContainer>

          {/*
            All three are rendered outside the NavigationContainer so they
            survive every navigation the guide performs and are reachable from
            any screen — they are an interaction layer over the app, not
            destinations in it.

            Order matters: the spotlight frames a card on the screen below, and
            the peek must sit above the spotlight rather than be ringed by it.
          */}
          <Spotlight />
          <AvatarPeek />
          <AvatarFab />
        </AvatarProvider>
      </GuideProvider>
    </FarmProvider>
  );
}
