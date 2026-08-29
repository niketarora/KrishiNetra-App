import { fireEvent, screen } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import { makeFarm, renderWithProviders } from '@/test-utils';

import { ProfileScreen } from './ProfileScreen';

const mockFarmState: { farm: Farm | null } = { farm: null };

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'ramesh@example.com' },
    profile: { full_name: 'Ramesh Kumar' },
    signOut: jest.fn(),
  }),
}));

jest.mock('@/features/language/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', setLanguage: jest.fn() }),
}));

const props = { onBack: jest.fn(), onOpenMyFarm: jest.fn(), onOpenSchemes: jest.fn() };

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFarmState.farm = null;
  });

  describe('with no farm registered', () => {
    it('invites the farmer to register their land, not to edit one', async () => {
      await renderWithProviders(<ProfileScreen {...props} />);

      expect(screen.getByText('Register your land')).toBeTruthy();
      expect(screen.queryByText('My Farm')).toBeNull();
    });

    it('opens My Farm from the register-land row', async () => {
      await renderWithProviders(<ProfileScreen {...props} />);

      await fireEvent.press(screen.getByTestId('profile-myFarm'));

      expect(props.onOpenMyFarm).toHaveBeenCalled();
    });
  });

  describe('with a registered farm', () => {
    it('labels the row My Farm instead of Register your land', async () => {
      mockFarmState.farm = makeFarm();

      await renderWithProviders(<ProfileScreen {...props} />);

      expect(screen.getByText('My Farm')).toBeTruthy();
      expect(screen.queryByText('Register your land')).toBeNull();
    });

    it('still opens the same My Farm destination', async () => {
      mockFarmState.farm = makeFarm();

      await renderWithProviders(<ProfileScreen {...props} />);

      await fireEvent.press(screen.getByTestId('profile-myFarm'));

      expect(props.onOpenMyFarm).toHaveBeenCalled();
    });
  });

  it('opens Government Schemes from its own row', async () => {
    await renderWithProviders(<ProfileScreen {...props} />);

    await fireEvent.press(screen.getByTestId('profile-schemes'));

    expect(props.onOpenSchemes).toHaveBeenCalled();
  });

  it('shows the signed-in farmer\'s identity', async () => {
    await renderWithProviders(<ProfileScreen {...props} />);

    expect(screen.getByText('Ramesh Kumar')).toBeTruthy();
    expect(screen.getByText('ramesh@example.com')).toBeTruthy();
  });
});
