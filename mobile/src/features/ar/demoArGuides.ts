import type { ARLearningStep } from './types';

/**
 * One AR guide per tutorial that supports it (`Tutorial.hasArGuide`). Only
 * `soil-preparation-before-sowing` has one in this version, matching the
 * product brief's own example ("How to inspect your field before sowing").
 */
const AR_GUIDES: Record<string, ARLearningStep[]> = {
  'soil-preparation-before-sowing': [
    { id: 'step-1', instructionKey: 'ar.steps.soilPreparation.moisture', markerLabelKey: 'ar.markers.pointHere' },
    { id: 'step-2', instructionKey: 'ar.steps.soilPreparation.residue', markerLabelKey: 'ar.markers.pointHere' },
    { id: 'step-3', instructionKey: 'ar.steps.soilPreparation.drainage', markerLabelKey: 'ar.markers.pointHere' },
    { id: 'step-4', instructionKey: 'ar.steps.soilPreparation.corners', markerLabelKey: 'ar.markers.walkToCorner' },
  ],
};

export function getArSteps(tutorialId: string): ARLearningStep[] | null {
  return AR_GUIDES[tutorialId] ?? null;
}
