import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Wraps `expo-location`'s own GPS + compass APIs for the AR Moisture
 * Guidance screen — no new native module or dependency: `watchHeadingAsync`
 * already exists in this Expo SDK (confirmed in its own type
 * definitions), unlike the mic-streaming problem a separate feature in this
 * repo genuinely needed a new native module for.
 *
 * Heading updates are throttled (time + minimum-delta gate) because
 * `watchHeadingAsync` is known, in some environments, to fire fast enough
 * to stall the JS thread if every update triggers a re-render.
 */

const HEADING_THROTTLE_MS = 200;
const HEADING_MIN_DELTA_DEG = 2;

export type LocationState = {
  latitude: number | null;
  longitude: number | null;
  /** Meters. Null when unknown — never assume precision that wasn't reported. */
  accuracy: number | null;
};

export type HeadingState = {
  /** Degrees, 0-360, or null if no compass reading has arrived yet. */
  degrees: number | null;
  /** expo-location's 0-3 calibration scale: 3=high(<20°), 2=medium(<35°), 1=low(<50°), 0/null=unavailable. */
  accuracy: number | null;
};

export type PermissionState = 'unknown' | 'granted' | 'denied';

export type HeadingAndLocation = {
  location: LocationState;
  heading: HeadingState;
  locationPermission: PermissionState;
  headingAvailable: boolean;
  requestLocationPermission: () => Promise<boolean>;
};

/** `active` gates the whole subscription lifecycle — pass false while the screen isn't focused/live to avoid burning battery/GPS in the background. */
export function useHeadingAndLocation(active: boolean): HeadingAndLocation {
  const [locationPermission, setLocationPermission] = useState<PermissionState>('unknown');
  const [location, setLocation] = useState<LocationState>({ latitude: null, longitude: null, accuracy: null });
  const [heading, setHeading] = useState<HeadingState>({ degrees: null, accuracy: null });
  const [headingAvailable, setHeadingAvailable] = useState(true);

  const lastHeadingUpdateMsRef = useRef(0);
  const lastHeadingValueRef = useRef<number | null>(null);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setLocationPermission(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  useEffect(() => {
    if (!active) return;

    let positionSub: Location.LocationSubscription | null = null;
    let headingSub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const granted = await requestLocationPermission();
      if (!granted || cancelled) return;

      positionSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1, timeInterval: 1000 },
        (pos) => {
          if (cancelled) return;
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
          });
        },
      );

      try {
        headingSub = await Location.watchHeadingAsync((h) => {
          if (cancelled) return;
          const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          const now = Date.now();
          const last = lastHeadingValueRef.current;
          const delta = last == null ? 999 : Math.abs(((value - last + 540) % 360) - 180);
          if (now - lastHeadingUpdateMsRef.current < HEADING_THROTTLE_MS && delta < HEADING_MIN_DELTA_DEG) {
            return;
          }
          lastHeadingUpdateMsRef.current = now;
          lastHeadingValueRef.current = value;
          setHeading({ degrees: value, accuracy: h.accuracy });
        });
      } catch {
        // Device has no usable compass — guidance falls back to distance-only, handled by the screen.
        setHeadingAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      positionSub?.remove();
      headingSub?.remove();
    };
  }, [active, requestLocationPermission]);

  return { location, heading, locationPermission, headingAvailable, requestLocationPermission };
}
