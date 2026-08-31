import { createNavigationContainerRef } from '@react-navigation/native';

import type { MainStackParamList, MainTabParamList } from './types';

/**
 * The one handle on navigation that lives outside the navigator.
 *
 * Screens still take their navigation as callback props — that pattern is what
 * makes them testable and is not being changed. This exists for the guide
 * alone: `AvatarPeek` and the Navigation Controller are rendered *outside*
 * `NavigationContainer` (see RootNavigator), because they are an interaction
 * layer over the app rather than a route in it, and so they have no navigation
 * prop and no `useNavigation` to reach for.
 *
 * Everything here no-ops rather than throwing when the container is not ready.
 * The guide can be asked to move while the app is still mounting, and a
 * navigation attempt that arrives a moment early should be a step that does
 * nothing, not a crash in an assistant.
 */
export const navigationRef = createNavigationContainerRef<MainStackParamList>();

export function navigateToStackRoute(route: keyof MainStackParamList): boolean {
  if (!navigationRef.isReady()) return false;

  // Params are deliberately not accepted. Every route the guide can reach takes
  // no arguments; the ones that need them (EditBoundary, TutorialDetail) are
  // reached by the farmer tapping through, not by the AI deciding for them.
  navigationRef.navigate(route as never);
  return true;
}

/**
 * Switch tabs.
 *
 * The four tabs live in a navigator nested under `Tabs`, so they are not
 * reachable by name from the root stack. Popping back to `Tabs` first also
 * covers the case where the farmer is several pushed screens deep when they
 * ask for something that lives on a tab.
 */
export function navigateToTab(tab: keyof MainTabParamList): boolean {
  if (!navigationRef.isReady()) return false;

  // `MainStackParamList` types `Tabs` as taking no params, which is true of the
  // route itself — the second argument here is React Navigation's nested-screen
  // form, and the typed overload cannot express it. The tab name is validated
  // against MainTabParamList by the signature above, so nothing is unchecked.
  const navigate = navigationRef.navigate as (name: string, params?: object) => void;
  navigate('Tabs', { screen: tab });
  return true;
}

export function goBack(): boolean {
  if (!navigationRef.isReady() || !navigationRef.canGoBack()) return false;

  navigationRef.goBack();
  return true;
}

/** The active route name, used to skip a navigation the farmer is already on. */
export function currentRouteName(): string | null {
  if (!navigationRef.isReady()) return null;
  return navigationRef.getCurrentRoute()?.name ?? null;
}
