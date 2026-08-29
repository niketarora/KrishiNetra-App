/* eslint-env jest */

// The Supabase client throws at import time when its env vars are missing, and
// tests should never reach a real project regardless.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test-token';

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
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 29.6857, longitude: 76.9905, accuracy: 10 },
  })),
  // WalkBoundaryScreen streams points through this instead of a one-shot fix.
  // The default never calls back — tests that need points drive it by
  // grabbing the callback off `.mock.calls` and invoking it themselves.
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
}));

jest.mock('@rnmapbox/maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockMapView = React.forwardRef((props, ref) => {
    React.useEffect(() => {
      props.onDidFinishLoadingMap?.();
    }, []);
    return React.createElement(View, { ...props, ref, testID: props.testID ?? 'boundary-map' }, props.children);
  });

  const MockCamera = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      setCamera: jest.fn(),
      fitBounds: jest.fn(),
      flyTo: jest.fn(),
    }));
    return React.createElement(View, { testID: 'mapbox-camera', ...props });
  });

  return {
    __esModule: true,
    default: {
      setAccessToken: jest.fn(),
      StyleURL: {
        Satellite: 'mapbox://styles/mapbox/satellite-v9',
        SatelliteStreet: 'mapbox://styles/mapbox/satellite-streets-v12',
        Street: 'mapbox://styles/mapbox/streets-v12',
      },
    },
    MapView: MockMapView,
    Camera: MockCamera,
    ShapeSource: (props) => React.createElement(View, { testID: 'mapbox-shape-source', ...props }, props.children),
    FillLayer: (props) => React.createElement(View, { testID: 'mapbox-fill-layer', ...props }),
    LineLayer: (props) => React.createElement(View, { testID: 'mapbox-line-layer', ...props }),
    PointAnnotation: (props) => React.createElement(View, { testID: 'mapbox-point-annotation', ...props }, props.children),
    LocationPuck: (props) => React.createElement(View, { testID: 'mapbox-location-puck', ...props }),
    StyleURL: {
      Satellite: 'mapbox://styles/mapbox/satellite-v9',
      SatelliteStreet: 'mapbox://styles/mapbox/satellite-streets-v12',
      Street: 'mapbox://styles/mapbox/streets-v12',
    },
  };
});

// The 3D avatar's WebView needs a native module. Component tests care that the
// stage renders and falls back correctly, not that three.js boots.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockWebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ postMessage: jest.fn() }));
    return React.createElement(View, { testID: 'webview', ...props });
  });

  return { __esModule: true, WebView: MockWebView, default: MockWebView };
});

// expo-audio records through a native module. The avatar tests drive the state
// machine, so the recorder only needs to resolve.
jest.mock('expo-audio', () => ({
  useAudioRecorder: () => ({
    prepareToRecordAsync: jest.fn(async () => undefined),
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
    uri: 'file:///tmp/test-recording.m4a',
  }),
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  setAudioModeAsync: jest.fn(async () => undefined),
  RecordingPresets: { HIGH_QUALITY: {}, LOW_QUALITY: {} },
  // useVoiceRecorder spells its own recording options out rather than using a
  // preset, so the enums those options reference have to exist here too.
  IOSOutputFormat: { MPEG4AAC: 'aac ' },
  AudioQuality: { MIN: 0, LOW: 32, MEDIUM: 64, HIGH: 96, MAX: 127 },
  // Playback for the avatar's spoken answers. The fake finishes as soon as it
  // is played, so a test never waits on real audio.
  createAudioPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    addListener: (_event, listener) => {
      setImmediate(() => listener({ didJustFinish: true, playing: false, isLoaded: true }));
      return { remove: jest.fn() };
    },
  }),
}));

// The spoken answer is written to a cache file before it is played. Nothing in
// a test needs the bytes to land anywhere.
jest.mock('expo-file-system', () => ({
  Paths: { cache: '/tmp' },
  File: class {
    constructor() {
      this.uri = 'file:///tmp/avatar-reply.wav';
      this.exists = false;
    }
    create() {}
    write() {}
    delete() {}
  },
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({
      downloadAsync: jest.fn(async () => undefined),
      localUri: 'file:///tmp/asset',
      uri: 'file:///tmp/asset',
    }),
  },
}));

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
