import type { MainStackParamList, MainTabParamList } from '@/navigation/types';

/**
 * What a step's `target` means on this device.
 *
 * The backend registry decides *where* the farmer should end up; this decides
 * what that name resolves to here. Keeping the two apart is what lets the app's
 * navigation change — a screen moving from a tab to a pushed route, say —
 * without the AI needing to be retrained or the server redeployed.
 *
 * Anything not listed here is not reachable by the guide. That is the point:
 * an unrecognised target is dropped rather than guessed at.
 */

const TABS: readonly (keyof MainTabParamList)[] = ['Home', 'Field', 'Market', 'History'];

/**
 * Stack routes the guide may open.
 *
 * Deliberately a subset of `MainStackParamList`. The routes that take required
 * params (EditBoundary, ConfirmEdit, TutorialDetail, the detail screens) are
 * absent: they describe one specific record, and the AI choosing which record
 * the farmer meant is a decision it should not be making.
 */
const STACK_ROUTES: readonly (keyof MainStackParamList)[] = [
  'Profile',
  'MyLands',
  'MyFarm',
  'RegisterLandMethod',
  'Learning',
  'Calendar',
  'Schemes',
  'Updates',
  'Alerts',
  'VisualAssistant',
];

export type NavigationTarget =
  | { kind: 'tab'; route: keyof MainTabParamList }
  | { kind: 'stack'; route: keyof MainStackParamList };

export function resolveNavigationTarget(target: string): NavigationTarget | null {
  const tab = TABS.find((name) => name === target);
  if (tab) return { kind: 'tab', route: tab };

  const route = STACK_ROUTES.find((name) => name === target);
  if (route) return { kind: 'stack', route };

  return null;
}

/**
 * Elements a screen can register itself as, for SCROLL, HIGHLIGHT and POINT.
 *
 * These match the `testID`s the screens already carry, so the ids the AI
 * spotlights and the ids the tests assert on are the same strings — one
 * vocabulary for both, rather than a parallel set that can drift.
 */
export const HIGHLIGHT_TARGETS = [
  // Home
  'field-card',
  'crop-card',
  'msp-card',
  'moisture-card',
  'weather-card',
  'market-card',
  'farmer-resources',
  // Field Analysis
  'soil-moisture-card',
  'ml-features-card',
  // Market
  'price-card',
  'price-trend',
  'recommendation-card',
  // Farm
  'my-farm-summary',
  'my-farm-edit-boundary',
  // Calendar
  'calendar-events',
] as const;

export type HighlightTarget = (typeof HIGHLIGHT_TARGETS)[number];

export function isHighlightTarget(target: string): target is HighlightTarget {
  return (HIGHLIGHT_TARGETS as readonly string[]).includes(target);
}

/** What the farmer can be asked to pick between. Only lands, for now. */
export function isSelectTarget(target: string): target is 'land' {
  return target === 'land';
}
