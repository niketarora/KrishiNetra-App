import type { ExpoConfig } from 'expo/config';

/**
 * Expo config as TypeScript so the Google Maps Android key can come from the
 * environment instead of being committed. The key still ships inside the APK
 * (unavoidable for the Maps SDK) and MUST be restricted by package name +
 * SHA-1 fingerprint in Google Cloud Console.
 */
const config: ExpoConfig = {
  name: 'KrishiNetra',
  slug: 'krishinetra',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'krishinetra',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.krishinetra.app',
  },
  android: {
    package: 'com.krishinetra.app',
    adaptiveIcon: {
      backgroundColor: '#F7F8F4',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '',
      },
    },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-secure-store',
    'expo-font',
    'expo-localization',
    [
      'expo-splash-screen',
      {
        image: './assets/icon.png',
        resizeMode: 'contain',
        backgroundColor: '#F7F8F4',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'KrishiNetra uses your location to centre the map on your field.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'KrishiNetra uses your camera so you can show it your crop.',
        // The Visual Assistant prototype doesn't record audio yet (its mic is a
        // scripted UI mock, not real capture) — no RECORD_AUDIO permission until
        // real voice input is implemented.
        recordAudioAndroid: false,
      },
    ],
  ],
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? 'ac8f8beb-0562-4611-a9a4-5090d67e3914',
    },
  },
};

export default config;
