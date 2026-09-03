import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { View, Text } from 'react-native';

import { OnboardingTourProvider, useOnboardingTour } from './OnboardingTourContext';
import { OnboardingTourOverlay } from '@/components/onboarding/OnboardingTourOverlay';
import { useTourTarget } from './useTourTarget';

import en from '@/i18n/locales/en.json';

// Mock dependencies
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-i18next', () => {
  const enLocale = require('@/i18n/locales/en.json');
  return {
    useTranslation: () => ({
      t: (key: string) => {
        const parts = key.split('.');
        let val: any = enLocale;
        for (const p of parts) {
          val = val?.[p];
        }
        return val ?? key;
      },
      i18n: { language: 'en' },
    }),
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

let mockUserMetadata: any = { is_new_farmer: true };
jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-farmer-123', user_metadata: mockUserMetadata },
    profile: { full_name: 'Ramesh Patel' },
  }),
}));

let mockFarm: any = null;
jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => ({
    lands: mockFarm ? [mockFarm] : [],
    farm: mockFarm,
  }),
}));

jest.mock('@/navigation/navigationRef', () => ({
  navigateToStackRoute: jest.fn(),
  navigateToTab: jest.fn(),
  navigationRef: { isReady: () => true },
}));

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}));

function TourTestConsumer() {
  const { step, isActive, isLandRegistered, nextStep, markLandRegistered, skipTour, finishTour } = useOnboardingTour();
  const profileRef = useTourTarget('tour-profile-avatar');

  return (
    <View>
      <View ref={profileRef} testID="test-avatar">
        <Text>Avatar</Text>
      </View>
      <Text testID="tour-active">{isActive ? 'ACTIVE' : 'INACTIVE'}</Text>
      <Text testID="tour-step">{step}</Text>
      <Text testID="tour-registered">{isLandRegistered ? 'REGISTERED' : 'UNREGISTERED'}</Text>
      <Text testID="btn-next" onPress={nextStep}>
        Next
      </Text>
      <Text testID="btn-register-land" onPress={markLandRegistered}>
        Register Land
      </Text>
      <Text testID="btn-skip" onPress={() => void skipTour()}>
        Skip
      </Text>
      <Text testID="btn-finish" onPress={() => void finishTour()}>
        Finish
      </Text>
    </View>
  );
}

describe('OnboardingTour', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFarm = null;
    mockUserMetadata = { is_new_farmer: true };
  });

  it('activates for a genuinely first-time farmer logging in for the first time', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    render(
      <OnboardingTourProvider>
        <TourTestConsumer />
        <OnboardingTourOverlay />
      </OnboardingTourProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('ACTIVE');
      expect(screen.getByTestId('tour-step')).toHaveTextContent('1');
    });

    // Should display step 1 title and controls
    expect(screen.getByText('Start by setting up your farm')).toBeTruthy();
    expect(screen.getByText('Next →')).toBeTruthy();
    expect(screen.getAllByText('Skip').length).toBeGreaterThanOrEqual(1);
  });

  it('does not activate for an existing farmer with onboarding_completed in remote metadata', async () => {
    mockUserMetadata = { onboarding_completed: true };
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    render(
      <OnboardingTourProvider>
        <TourTestConsumer />
        <OnboardingTourOverlay />
      </OnboardingTourProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('INACTIVE');
    });

    expect(screen.queryByText('Start by setting up your farm')).toBeNull();
  });

  it('does not activate for an existing farmer who already has registered lands', async () => {
    mockFarm = { id: 'existing-land-1', name: 'Land 1' };
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    render(
      <OnboardingTourProvider>
        <TourTestConsumer />
        <OnboardingTourOverlay />
      </OnboardingTourProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('INACTIVE');
    });

    expect(screen.queryByText('Start by setting up your farm')).toBeNull();
  });

  it('does not activate when user has already completed onboarding', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');

    render(
      <OnboardingTourProvider>
        <TourTestConsumer />
        <OnboardingTourOverlay />
      </OnboardingTourProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('INACTIVE');
    });

    expect(screen.queryByText('Start by setting up your farm')).toBeNull();
  });

  it('blocks advancing past step 4 when land is not registered', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    mockFarm = null;

    render(
      <OnboardingTourProvider>
        <TourTestConsumer />
      </OnboardingTourProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('ACTIVE');
    });

    fireEvent.press(screen.getByTestId('btn-next'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-step')).toHaveTextContent('2');
    });

    fireEvent.press(screen.getByTestId('btn-next'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-step')).toHaveTextContent('3');
    });

    fireEvent.press(screen.getByTestId('btn-next'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-step')).toHaveTextContent('4');
    });

    // In step 4 without registered land, pressing next stays on step 4!
    fireEvent.press(screen.getByTestId('btn-next'));
    expect(screen.getByTestId('tour-step')).toHaveTextContent('4');
  });

  it('advances through all 6 steps after land is registered', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    mockFarm = null;

    render(
      <OnboardingTourProvider>
        <TourTestConsumer />
      </OnboardingTourProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('ACTIVE');
    });

    fireEvent.press(screen.getByTestId('btn-next'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-step')).toHaveTextContent('2');
    });

    fireEvent.press(screen.getByTestId('btn-next'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-step')).toHaveTextContent('3');
    });

    fireEvent.press(screen.getByTestId('btn-next'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-step')).toHaveTextContent('4');
    });

    // Register land during step 4
    fireEvent.press(screen.getByTestId('btn-register-land'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-registered')).toHaveTextContent('REGISTERED');
    });

    // Advancing past step 4 is now permitted!
    fireEvent.press(screen.getByTestId('btn-next'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-step')).toHaveTextContent('5');
    });

    fireEvent.press(screen.getByTestId('btn-next'));
    await waitFor(() => {
      expect(screen.getByTestId('tour-step')).toHaveTextContent('6');
    });
  });

  it('saves completion when skip is pressed', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    render(
      <OnboardingTourProvider>
        <TourTestConsumer />
      </OnboardingTourProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('ACTIVE');
    });

    fireEvent.press(screen.getByTestId('btn-skip'));

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('INACTIVE');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'krishinetra.onboarding.test-farmer-123',
        'true',
      );
    });
  });

  it('saves completion when finish is pressed', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    render(
      <OnboardingTourProvider>
        <TourTestConsumer />
      </OnboardingTourProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('ACTIVE');
    });

    fireEvent.press(screen.getByTestId('btn-finish'));

    await waitFor(() => {
      expect(screen.getByTestId('tour-active')).toHaveTextContent('INACTIVE');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'krishinetra.onboarding.test-farmer-123',
        'true',
      );
    });
  });
});
