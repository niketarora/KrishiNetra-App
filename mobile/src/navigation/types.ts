import type { LatLng } from '@/utils/geo';

export type AuthStackParamList = {
  PhoneEntry: undefined;
  OtpVerify: { normalizedPhone: string; devCode: string };
};

export type OnboardingStackParamList = {
  RegisterFieldMethod: undefined;
  FieldLocation: undefined;
  WalkBoundary: { centre: LatLng | null; accuracy?: number | null };
  DrawBoundary: { centre: LatLng | null; points?: LatLng[]; name?: string | null; accuracy?: number | null };
  ConfirmField: { points: LatLng[]; name?: string | null; accuracy?: number | null };
};

export type MainTabParamList = {
  Home: undefined;
  Field: undefined;
  Market: undefined;
  Calendar: undefined;
  More: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  /** History / Krishi Memory stack route kept for backward compatibility */
  History: undefined;
  More: undefined;
  Profile: undefined;
  /** Re-drawing an existing boundary reuses the onboarding screens. */
  EditBoundary: { centre: LatLng | null; points: LatLng[]; name: string | null; accuracy?: number | null };
  ConfirmEdit: { points: LatLng[]; name: string | null; accuracy?: number | null };
  /** Profile → My Lands — overview and management of all registered lands. */
  MyLands: undefined;
  /** Selected land detail view. */
  MyFarm: undefined;
  RegisterLandMethod: undefined;
  RegisterLand: { centre?: LatLng | null; accuracy?: number | null } | undefined;
  /** Boundary review after a GPS walk, reusing the onboarding draw screen. */
  RegisterBoundary: { centre: LatLng | null; points: LatLng[]; accuracy?: number | null };
  RegisterCropInfo: { points: LatLng[]; accuracy?: number | null };
  /** Home → Krishi Academy — Feature #14's local tutorial library. */
  Learning: undefined;
  TutorialDetail: { tutorialId: string };
  TutorialFlashcard: { tutorialId: string };
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
  /** Home/Profile → Alerts — demo communication history (weather, disaster, scheme, advisory). */
  Alerts: undefined;
  AlertDetail: { alertId: string };
  /**
   * Camera-first prototype (not yet wired to the Avatar or a backend — see
   * src/features/visualAssistant/demo.ts).
   */
  VisualAssistant: undefined;
  /**
   * Home → AR Moisture Guidance — camera + GPS/compass directional
   * navigation toward demo-labelled moisture *sampling targets*, not
   * measured moisture zones (see `features/arMoisture/types.ts`). A
   * separate route from the unrelated mock `ARGuide` (tutorial-linked,
   * no real camera/location).
   */
  ARMoistureGuidance: undefined;
};
