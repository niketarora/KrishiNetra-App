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
  /** Profile → My Farm — optional land registration, reachable any time. */
  MyFarm: undefined;
  RegisterLand: undefined;
  /** Boundary review after a GPS walk, reusing the onboarding draw screen. */
  RegisterBoundary: { centre: LatLng | null; points: LatLng[] };
  RegisterCropInfo: { points: LatLng[] };
  /** Home → Krishi Academy — Feature #14's local tutorial library. */
  Learning: undefined;
  TutorialDetail: { tutorialId: string };
};
