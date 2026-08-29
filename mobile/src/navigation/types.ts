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
  /** Home → Smart Farm Calendar — Feature #10's forward-looking demo UI. */
  Calendar: undefined;
  CalendarEventDetail: { eventId: string };
  /** Tutorial detail → AR Learning Preview, a UI-only prototype. */
  ARGuide: { tutorialId: string };
  /** Home → Government Schemes — local demo scheme directory. */
  Schemes: undefined;
  SchemeDetail: { schemeId: string };
  /** Home → Krishi Updates — local demo agri-news feed. */
  Updates: undefined;
  UpdateDetail: { updateId: string };
  /**
   * Camera-first prototype (not yet wired to the Avatar or a backend — see
   * src/features/visualAssistant/demo.ts).
   */
  VisualAssistant: undefined;
};
