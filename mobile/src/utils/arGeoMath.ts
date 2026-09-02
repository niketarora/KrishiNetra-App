import type { LatLng } from '@/utils/geo';

/**
 * Deterministic distance/bearing math for the AR Moisture Guidance MVP —
 * no external geospatial dependency, deliberately, matching the same
 * "just Haversine, no library" precedent already used in this codebase for
 * an equivalent "how far is X from the farmer" problem (see
 * `backend/src/updates/relevance.ts`'s `haversineKm`). This file is the
 * mobile/meters counterpart, kept separate from `utils/geo.ts` because that
 * file is about a single farm's own boundary/area, not farmer-to-target
 * navigation between two arbitrary points.
 */

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Great-circle distance between two points, in meters. */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from `a` to `b`, in degrees, 0-360 (0 = true north). */
export function initialBearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLng = toRadians(b.longitude - a.longitude);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Bearing to the target relative to where the phone is currently pointed,
 * in degrees, range -180..+180. 0 = target is straight ahead; positive =
 * target is to the right; negative = to the left; near ±180 = behind.
 */
export function relativeBearingDegrees(targetBearing: number, deviceHeading: number): number {
  return ((targetBearing - deviceHeading + 540) % 360) - 180;
}

export type DirectionHint = 'ahead' | 'left' | 'right' | 'behind';

/** Coarse LEFT/RIGHT/AHEAD/BEHIND bucket for the overlay's arrow/label — never a false claim of exact heading. */
export function directionHintFor(relativeBearing: number): DirectionHint {
  const abs = Math.abs(relativeBearing);
  if (abs >= 150) return 'behind';
  if (abs <= 20) return 'ahead';
  return relativeBearing > 0 ? 'right' : 'left';
}

export type GpsQuality = 'good' | 'fair' | 'poor' | 'unknown';

/** Buckets raw GPS accuracy (meters, smaller = better) into a farmer-facing quality label — never shown as a number implying false precision. */
export function gpsQualityFromAccuracy(accuracyMeters: number | null | undefined): GpsQuality {
  if (accuracyMeters == null || !Number.isFinite(accuracyMeters)) return 'unknown';
  if (accuracyMeters <= 8) return 'good';
  if (accuracyMeters <= 20) return 'fair';
  return 'poor';
}

export type HeadingQuality = 'good' | 'fair' | 'poor' | 'unavailable';

/** expo-location's LocationHeadingObject.accuracy: 3=high(<20°), 2=medium(<35°), 1=low(<50°), 0=none(>50°). */
export function headingQualityFromAccuracy(accuracy: number | null | undefined): HeadingQuality {
  if (accuracy == null) return 'unavailable';
  if (accuracy >= 3) return 'good';
  if (accuracy === 2) return 'fair';
  if (accuracy === 1) return 'poor';
  return 'unavailable';
}

/**
 * Rounds a distance for display to a precision that never claims more
 * accuracy than the underlying GPS fix actually has — e.g. a farmer 24.3m
 * away with a ±15m GPS fix should see "~25 m", never "~24.3 m". Mirrors the
 * product brief's explicit "GPS ±15m, do not pretend target exactly 2.3m
 * away" requirement.
 */
export function roundDistanceForDisplay(distanceMeters: number, gpsAccuracyMeters: number | null | undefined): number {
  const accuracy = gpsAccuracyMeters ?? 25; // Unknown accuracy is treated as poor, not as precise.
  let step: number;
  if (accuracy <= 5) step = 1;
  else if (accuracy <= 10) step = 5;
  else step = 10;
  return Math.round(distanceMeters / step) * step;
}
