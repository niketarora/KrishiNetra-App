/**
 * AR Learning Preview — Feature request Part 4: a *product prototype* of a
 * future AR-assisted field-inspection guide, not real computer vision. No
 * camera image is ever analysed here; steps are a fixed, local script shown
 * over a mocked viewfinder (see `screens/ar/ARLearningScreen.tsx`).
 *
 * The shape is still clean enough that a real CV/ML step-detection engine
 * could drive `ARLearningStep[]` later without this screen changing.
 */
export type ARLearningStep = {
  id: string;
  /** i18n key for the instruction shown in the step card. */
  instructionKey: string;
  /** i18n key for the short label next to the marker dot, if any. */
  markerLabelKey?: string;
};
