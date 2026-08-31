import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import { updateProfile } from '@/services/profiles';
import { detectCurrentLocation } from '@/services/locationService';

import { ProfileSetupScreen } from './ProfileSetupScreen';

jest.mock('@/services/profiles', () => ({
  updateProfile: jest.fn(async () => ({ id: 'test-user-id' })),
}));

jest.mock('@/services/locationService', () => ({
  detectCurrentLocation: jest.fn(async () => ({
    latitude: 24.0324,
    longitude: 74.7812,
    city: 'Pratapgarh',
    district: 'Pratapgarh',
    state: 'Rajasthan',
    country: 'India',
    source: 'gps',
  })),
}));

const mockRefreshProfile = jest.fn();

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    refreshProfile: mockRefreshProfile,
  }),
}));

describe('ProfileSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('automatically detects GPS location on mount', async () => {
    await renderWithProviders(<ProfileSetupScreen />);

    expect(detectCurrentLocation).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId('profile-setup-location-card')).toBeTruthy();
      expect(screen.getByText(/Pratapgarh, Rajasthan/)).toBeTruthy();
    });
  });

  it('submits name, language, and detected GPS location', async () => {
    await renderWithProviders(<ProfileSetupScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Pratapgarh, Rajasthan/)).toBeTruthy();
    });

    await fireEvent.changeText(screen.getByTestId('profile-setup-name'), 'Ramesh Kumar');
    await fireEvent.press(screen.getByTestId('profile-setup-submit'));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith('test-user-id', expect.objectContaining({
        full_name: 'Ramesh Kumar',
        language: 'en',
        location_latitude: 24.0324,
        location_longitude: 74.7812,
        location_city: 'Pratapgarh',
        location_district: 'Pratapgarh',
        location_state: 'Rajasthan',
        location_country: 'India',
        location_source: 'gps',
      }));
      expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
    });
  });
});
