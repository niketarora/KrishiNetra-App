import type { ExpoConfig } from 'expo/config';

/**
 * Expo config as TypeScript.
 *
 * Mapbox public token comes from EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN at runtime.
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
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'RECORD_AUDIO', 'CAMERA'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    '@rnmapbox/maps',
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
        locationWhenInUsePermission:
          'KrishiNetra uses your location to place you on the field boundary map and centre satellite imagery on your land.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission:
          'KrishiNetra uses your microphone so you can ask your farmer companion questions out loud.',
        recordAudioAndroid: true,
        // The avatar only listens while the farmer holds the mic button, so
        // there is no reason to keep recording in the background.
        enableBackgroundRecording: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'KrishiNetra uses your camera so you can show it your crop.',
        // The Visual Assistant prototype doesn't record audio yet (its mic is a
        // scripted UI mock, not real capture) — the avatar owns real voice input.
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
