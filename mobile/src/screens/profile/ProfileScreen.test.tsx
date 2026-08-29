import { fireEvent, screen } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import { makeFarm, makeProfile, renderWithProviders } from '@/test-utils';

import { ProfileScreen } from './ProfileScreen';

const mockFarmState: { farm: Farm | null } = { farm: null };

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

const mockProfile = makeProfile({ full_name: 'Ramesh Kumar', phone: '+919876543210', email: null });

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: mockProfile,
    signOut: jest.fn(),
  }),
}));

jest.mock('@/features/language/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', setLanguage: jest.fn() }),
}));

const props = {
  onBack: jest.fn(),
  onOpenMyFarm: jest.fn(),
  onOpenSchemes: jest.fn(),
  onOpenAlerts: jest.fn(),
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFarmState.farm = null;
    mockProfile.email = null;
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

  it('opens Alerts from its own row', async () => {
    await renderWithProviders(<ProfileScreen {...props} />);

    await fireEvent.press(screen.getByTestId('profile-alerts'));

    expect(props.onOpenAlerts).toHaveBeenCalled();
  });

  it("shows the signed-in farmer's identity", async () => {
    await renderWithProviders(<ProfileScreen {...props} />);

    expect(screen.getByText('Ramesh Kumar')).toBeTruthy();
  });

  it('masks the phone number rather than showing it in full', async () => {
    await renderWithProviders(<ProfileScreen {...props} />);

    // Shown twice by design — once under the name, once in the info row.
    expect(screen.getAllByText('+91 XXXXX 43210').length).toBeGreaterThan(0);
    expect(screen.queryByText('+919876543210')).toBeNull();
  });

  it('shows "Not added" when the optional email is missing', async () => {
    await renderWithProviders(<ProfileScreen {...props} />);

    expect(screen.getByText('Not added')).toBeTruthy();
  });

  it('shows the real email once the farmer has added one', async () => {
    mockProfile.email = 'ramesh@example.com';

    await renderWithProviders(<ProfileScreen {...props} />);

    expect(screen.getByText('ramesh@example.com')).toBeTruthy();
  });

  it('shows the demo Pratapgarh location', async () => {
    await renderWithProviders(<ProfileScreen {...props} />);

    expect(screen.getByText('Pratapgarh')).toBeTruthy();
  });
});
