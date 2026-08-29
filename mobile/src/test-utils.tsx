import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';
import type { Farm } from '@/services/farms';
import type { Profile } from '@/services/profiles';
import type { BoundaryGeoJSON } from '@/utils/geo';

function Providers({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/**
 * Render with i18n wired up, so assertions can use real user-facing copy.
 *
 * Testing Library v14's `render` is async — it awaits an `act` internally — so
 * every call site must await this, or queries will run against an unmounted
 * tree. Import `screen` straight from `@testing-library/react-native` rather
 * than re-exporting it here: Babel's wildcard interop copies the binding at
 * import time, and `render` replaces it afterwards.
 */
export async function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Providers, ...options });
}

/** A square boundary near Karnal, matching the geo tests' reference plot. */
export const testBoundary: BoundaryGeoJSON = {
  type: 'Polygon',
  coordinates: [
    [
      [76.9905, 29.6857],
      [76.9915, 29.6857],
      [76.9915, 29.6867],
      [76.9905, 29.6867],
      [76.9905, 29.6857],
    ],
  ],
};

/** Areas are the real geodesic values for `testBoundary`, not round numbers. */
export function makeFarm(overrides: Partial<Farm> = {}): Farm {
  return {
    id: 'farm-1',
    user_id: 'user-1',
    name: 'North plot',
    boundary: testBoundary,
    area_sq_meters: 10741.54,
    area_acres: 2.6544,
    area_hectares: 1.0742,
    centroid_lat: 29.6862,
    centroid_lng: 76.991,
    // Resolved by the API when the boundary was saved. Override with null to
    // exercise the "weather unavailable" path.
    district: 'Karnal',
    state: 'Haryana',
    location_source: 'OpenStreetMap Nominatim, 2026-08-01',
    created_at: '2026-08-01T06:00:00.000Z',
    updated_at: '2026-08-01T06:00:00.000Z',
    ...overrides,
  };
}

/** The demo Pratapgarh placeholder every new profile is seeded with (0005_farmer_identity.sql). */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    full_name: 'Ramesh Kumar',
    phone: '+919876543210',
    email: null,
    language: 'en',
    location_latitude: 24.031111,
    location_longitude: 74.779444,
    location_city: 'Pratapgarh',
    location_district: 'Pratapgarh',
    location_state: 'Rajasthan',
    location_country: 'India',
    location_source: 'demo',
    in_app_alerts: true,
    sms_alerts: true,
    voice_alerts: true,
    created_at: '2026-08-01T06:00:00.000Z',
    updated_at: '2026-08-01T06:00:00.000Z',
    ...overrides,
  };
}
