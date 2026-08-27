import type { LatLng } from '@/utils/geo';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type OnboardingStackParamList = {
  FieldLocation: undefined;
  DrawBoundary: { centre: LatLng | null; points?: LatLng[]; name?: string | null };
  ConfirmField: { points: LatLng[]; name?: string | null };
};

export type MainTabParamList = {
  Home: undefined;
  Field: undefined;
  Market: undefined;
  History: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  Profile: undefined;
  /** Re-drawing an existing boundary reuses the onboarding screens. */
  EditBoundary: { centre: LatLng | null; points: LatLng[]; name: string | null };
  ConfirmEdit: { points: LatLng[]; name: string | null };
  /**
   * Camera-first prototype (not yet wired to the Avatar or a backend — see
   * src/features/visualAssistant/demo.ts).
   */
  VisualAssistant: undefined;
};
