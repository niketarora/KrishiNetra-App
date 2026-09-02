import type { Ref } from 'react';
import { screen } from '@testing-library/react-native';

import { makeFarm, renderWithProviders } from '@/test-utils';
import type { Farm } from '@/services/farms';

import { ARMoistureGuidanceScreen } from './ARMoistureGuidanceScreen';

type MockCameraPermission = { granted: boolean; canAskAgain: boolean } | null;

let mockCameraPermission: MockCameraPermission = { granted: true, canAskAgain: true };
const mockRequestCameraPermission = jest.fn();

// Same reasoning/pattern as VisualAssistantScreen.test.tsx: expo-camera needs
// a native module, these tests only care that the screen reads permission
// state and renders accordingly.
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    CameraView: React.forwardRef((props: Record<string, unknown>, ref: Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({}));
      return React.createElement(View, props);
    }),
    useCameraPermissions: () => [mockCameraPermission, mockRequestCameraPermission],
  };
});

let mockFarm: Farm | null = makeFarm();
jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => ({ farm: mockFarm }),
}));

const mockLocationPermission = { status: 'granted' };
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => mockLocationPermission),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  watchHeadingAsync: jest.fn(async () => ({ remove: jest.fn() })),
  Accuracy: { High: 4 },
}));

const onBack = jest.fn();

describe('ARMoistureGuidanceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCameraPermission = { granted: true, canAskAgain: true };
    mockFarm = makeFarm();
    mockLocationPermission.status = 'granted';
  });

  it('shows the live camera once camera+location permissions are granted and a farm is selected', async () => {
    await renderWithProviders(<ARMoistureGuidanceScreen onBack={onBack} />);

    expect(screen.getByTestId('ar-moisture-camera')).toBeTruthy();
  });

  it('shows a camera-permission banner, never the camera, when camera permission is denied', async () => {
    mockCameraPermission = { granted: false, canAskAgain: true };

    await renderWithProviders(<ARMoistureGuidanceScreen onBack={onBack} />);

    expect(screen.getByText('Camera access needed')).toBeTruthy();
    expect(screen.queryByTestId('ar-moisture-camera')).toBeNull();
  });

  it('shows a "no field registered" state rather than guiding toward nothing when there is no selected farm', async () => {
    mockFarm = null;

    await renderWithProviders(<ARMoistureGuidanceScreen onBack={onBack} />);

    expect(screen.getByText('No field registered')).toBeTruthy();
    expect(screen.queryByTestId('ar-moisture-camera')).toBeNull();
  });

  it('shows an acquiring-fix state before any GPS position has arrived, never a fabricated distance', async () => {
    await renderWithProviders(<ARMoistureGuidanceScreen onBack={onBack} />);

    // watchPositionAsync's mock never calls back, so the screen should stay
    // in "finding your location" rather than showing 0m/undefined as a real reading.
    expect(screen.getByTestId('ar-moisture-acquiring')).toBeTruthy();
  });
});
