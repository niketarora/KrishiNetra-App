import * as Location from 'expo-location';

export type FieldFix =
  | { state: 'ok'; latitude: number; longitude: number; accuracy: number | null }
  | { state: 'denied' }
  | { state: 'unavailable' }
  | { state: 'timeout' }
  | { state: 'failed' };

export const ACCURACY_WARN_METERS = 30;

const FIX_TIMEOUT_MS = 10_000;

/**
 * Calculates field zoom level scaled to the GPS fix accuracy.
 * Good fix (<=15m) -> 17.5
 * Moderate (<=50m) -> 16.5
 * Poor (>50m) -> 15.5
 * Unknown -> 16.5
 */
export function zoomForAccuracy(accuracy: number | null | undefined): number {
  if (accuracy === null || accuracy === undefined || Number.isNaN(accuracy)) {
    return 16.5;
  }
  if (accuracy <= 15) return 17.5;
  if (accuracy <= 50) return 16.5;
  return 15.5;
}

/**
 * One-shot high-accuracy device GPS fix with timeout and comprehensive error states.
 */
export async function getCurrentFieldFix(timeoutMs: number = FIX_TIMEOUT_MS): Promise<FieldFix> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
    if (!servicesEnabled) {
      return { state: 'unavailable' };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { state: 'denied' };
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs);
    });

    const fixPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const result = await Promise.race([fixPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);

    if (result === 'timeout') {
      return { state: 'timeout' };
    }

    return {
      state: 'ok',
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      accuracy: result.coords.accuracy ?? null,
    };
  } catch {
    return { state: 'failed' };
  }
}
