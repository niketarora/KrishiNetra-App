import { fireEvent, screen } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import { makeFarm, renderWithProviders } from '@/test-utils';

import { HomeScreen } from './HomeScreen';

const mockFarmState: {
  farm: Farm | null;
  loading: boolean;
  errorKey: string | null;
  refresh: jest.Mock;
} = {
  farm: null,
  loading: false,
  errorKey: null,
  refresh: jest.fn(),
};

const mockOpenAvatar = jest.fn();

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'ramesh@example.com' },
    profile: { full_name: 'Ramesh Kumar' },
  }),
}));

jest.mock('@/features/avatar/AvatarContext', () => ({
  useAvatar: () => ({ open: mockOpenAvatar }),
}));

const props = {
  onOpenProfile: jest.fn(),
  onOpenAnalysis: jest.fn(),
  onOpenMarket: jest.fn(),
  onEditBoundary: jest.fn(),
  onOpenVisualAssistant: jest.fn(),
};

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockFarmState, {
      farm: makeFarm(),
      loading: false,
      errorKey: null,
    });
  });

  describe('what the app genuinely knows', () => {
    it('greets the farmer by their first name', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByText('Ramesh')).toBeTruthy();
      expect(screen.getByText('RK')).toBeTruthy();
    });

    it('shows the saved field with its real area', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByText('North plot')).toBeTruthy();
      expect(screen.getByText('2.65 acres')).toBeTruthy();
    });

    it('names an unnamed field rather than showing a blank card', async () => {
      mockFarmState.farm = makeFarm({ name: null });
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByText('My field')).toBeTruthy();
    });
  });

  describe('what it does not know yet', () => {
    it('leaves growth stage and weather empty instead of inventing readings', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByTestId('growth-card')).toBeTruthy();
      expect(screen.getByTestId('weather-card')).toBeTruthy();
      // Two dashes, two "coming later" notes — one per tile.
      expect(screen.getAllByText('Available in a future update')).toHaveLength(2);
    });

    it('says the market is not connected rather than showing a price', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByText('Market prices are not connected yet')).toBeTruthy();
      // The prototype's sample figures must not appear anywhere.
      expect(screen.queryByText(/2,450/)).toBeNull();
      expect(screen.queryByText(/Partial sell/)).toBeNull();
      expect(screen.queryByText(/Good health/)).toBeNull();
    });

    it('marks the field as not yet analysed', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByText('Not yet analysed')).toBeTruthy();
    });
  });

  describe('states', () => {
    it('shows skeletons on first load', async () => {
      Object.assign(mockFarmState, { farm: null, loading: true });
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.queryByTestId('field-card')).toBeNull();
      expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    });

    it('surfaces a load failure without hiding the rest of the screen', async () => {
      Object.assign(mockFarmState, { errorKey: 'home.loadError' });
      await renderWithProviders(<HomeScreen {...props} />);

      expect(
        screen.getByText("We couldn't load your field. Pull down to try again."),
      ).toBeTruthy();
      expect(screen.getByText('North plot')).toBeTruthy();
    });
  });

  describe('navigation', () => {
    it('opens the profile from the initials chip', async () => {
      await renderWithProviders(<HomeScreen {...props} />);
      await fireEvent.press(screen.getByTestId('open-profile'));

      expect(props.onOpenProfile).toHaveBeenCalled();
    });

    it('edits the boundary from the field card', async () => {
      await renderWithProviders(<HomeScreen {...props} />);
      await fireEvent.press(screen.getByTestId('field-card'));

      expect(props.onEditBoundary).toHaveBeenCalled();
    });

    it('opens the avatar from the companion card', async () => {
      await renderWithProviders(<HomeScreen {...props} />);
      await fireEvent.press(screen.getByTestId('companion-card'));

      expect(mockOpenAvatar).toHaveBeenCalled();
    });

    it('opens the avatar from the floating mic button', async () => {
      await renderWithProviders(<HomeScreen {...props} />);
      await fireEvent.press(screen.getByTestId('avatar-fab'));

      expect(mockOpenAvatar).toHaveBeenCalled();
    });

    it('opens the Visual Assistant from its dashboard card', async () => {
      await renderWithProviders(<HomeScreen {...props} />);
      await fireEvent.press(screen.getByTestId('visual-assistant-card'));

      expect(props.onOpenVisualAssistant).toHaveBeenCalled();
    });
  });

  describe('Visual Assistant entry point', () => {
    it('is visible on the dashboard as a distinct, real (non-preview) action', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByText('Ask KrishiNetra')).toBeTruthy();
      expect(screen.getByText("Show us your crop and ask what's happening.")).toBeTruthy();
    });
  });
});
