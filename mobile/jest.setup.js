/* eslint-env jest */

// The Supabase client throws at import time when its env vars are missing, and
// tests should never reach a real project regardless.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 29.6857, longitude: 76.9905 },
  })),
  Accuracy: { Balanced: 3 },
}));

// react-native-maps needs a native module; component tests only care that the
// map and its polygon render, not that Google Maps initialises.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockMapView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref }, props.children),
  );

  return {
    __esModule: true,
    default: MockMapView,
    Marker: (props) => React.createElement(View, props, props.children),
    Polygon: (props) => React.createElement(View, props, props.children),
    PROVIDER_GOOGLE: 'google',
  };
});

/**
 * Reanimated 4 ships its own jest mock, but requiring it pulls in
 * react-native-worklets' native module, which is not available under Jest. The
 * animations here are decorative (the waveform, the avatar's breathing), so a
 * minimal hand-mock covering the surface the app uses is enough — tests assert
 * on state and copy, never on interpolated values.
 */
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, Image, ScrollView } = require('react-native');

  const passthrough = (value) => value;

  return {
    __esModule: true,
    default: { View, Text, Image, ScrollView, createAnimatedComponent: (c) => c },
    View,
    Text,
    Image,
    ScrollView,
    createAnimatedComponent: (component) => component,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (factory) => {
      try {
        return factory();
      } catch {
        return {};
      }
    },
    withTiming: passthrough,
    withSpring: passthrough,
    withRepeat: passthrough,
    withDelay: (_delay, animation) => animation,
    cancelAnimation: jest.fn(),
    Easing: {
      ease: passthrough,
      linear: passthrough,
      inOut: () => passthrough,
      out: () => passthrough,
      in: () => passthrough,
    },
    useAnimatedRef: () => React.createRef(),
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
  };
});
