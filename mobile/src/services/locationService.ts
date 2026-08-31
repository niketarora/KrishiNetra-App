import * as Location from 'expo-location';

export type GpsLocationResult = {
  latitude: number;
  longitude: number;
  city: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  source: 'gps' | 'manual' | 'demo';
};

/**
 * Reverse-geocode coordinates using open reverse-geocoding fallback if native
 * geocoder returns empty properties on emulators.
 */
async function fallbackReverseGeocode(
  latitude: number,
  longitude: number,
): Promise<Partial<GpsLocationResult>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
      {
        headers: { 'User-Agent': 'KrishiNetra-App/1.0' },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!res.ok) return {};
    const data = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        state_district?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    };
    const addr = data.address || {};
    return {
      city: addr.city || addr.town || addr.village || null,
      district: addr.state_district || addr.county || null,
      state: addr.state || null,
      country: addr.country || 'India',
    };
  } catch {
    return {};
  }
}

/**
 * Requests device GPS permissions and captures current coordinates & location metadata.
 */
export async function detectCurrentLocation(): Promise<GpsLocationResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('LOCATION_PERMISSION_DENIED');
  }

  let position = await Location.getLastKnownPositionAsync();
  if (!position) {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  }

  const { latitude, longitude } = position.coords;

  let city: string | null = null;
  let district: string | null = null;
  let state: string | null = null;
  let country: string | null = 'India';

  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (addresses && addresses.length > 0) {
      const addr = addresses[0];
      city = addr.city || addr.subregion || addr.name || null;
      district = addr.district || addr.subregion || addr.city || null;
      state = addr.region || null;
      country = addr.country || 'India';
    }
  } catch {
    // Native geocoder failed on emulator/device, try online fallback
  }

  if (!state || !district) {
    const fallback = await fallbackReverseGeocode(latitude, longitude);
    city = city || fallback.city || null;
    district = district || fallback.district || null;
    state = state || fallback.state || null;
    country = country || fallback.country || 'India';
  }

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    city: city || 'Pratapgarh',
    district: district || 'Pratapgarh',
    state: state || 'Rajasthan',
    country: country || 'India',
    source: 'gps',
  };
}
