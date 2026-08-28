import { fireEvent, screen } from '@testing-library/react-native';

import type { CurrentCrop, MarketPrice, Msp, Weather } from '@/services/agronomy';
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

/**
 * The three Phase 2.5 sources. Each can legitimately be null, and the tests
 * below cover both a real reading and the empty state for every one of them.
 */
const mockInsights: {
  crop: CurrentCrop | null;
  msp: Msp | null;
  weather: Weather | null;
  price: MarketPrice | null;
} = { crop: null, msp: null, weather: null, price: null };

jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: jest.fn(async () => mockInsights.crop),
  getLatestMsp: jest.fn(async () => mockInsights.msp),
  getWeather: jest.fn(async () => mockInsights.weather),
  getLatestMarketPrice: jest.fn(async () => mockInsights.price),
}));

const wheat: CurrentCrop = {
  crop: {
    id: 'crop-wheat',
    code: 'wheat',
    name_en: 'Wheat',
    name_hi: 'गेहूँ',
    category: 'cereal',
    default_unit: 'quintal',
  },
  planting: {
    id: 'planting-1',
    farm_id: 'farm-1',
    crop_id: 'crop-wheat',
    variety: 'Sharbati',
    sown_on: '2026-11-15',
    expected_harvest_on: '2027-04-05',
    area_acres: 2.65,
    status: 'sown',
    notes: null,
  },
};

const wheatMsp: Msp = {
  id: 'msp-1',
  crop_id: 'crop-wheat',
  season: 'rabi',
  marketing_year: '2025-26',
  price_per_quintal: 2425,
  effective_from: '2025-04-01',
  source: 'Government of India MSP, RMS 2025-26 (CACP/CCEA)',
};

const mandiPrice: MarketPrice = {
  id: 'price-1',
  price_date: '2026-08-24',
  min_price: 2380,
  max_price: 2560,
  modal_price: 2480,
  arrivals_tonnes: null,
  source: 'data.gov.in AGMARKNET, fetched 2026-08-26',
  mandis: { code: 'RJ-ALWAR' },
};

const observation: Weather = {
  id: 'weather-1',
  district: 'Karnal',
  state: 'Haryana',
  observed_on: '2026-08-21',
  temperature_c: 30.1,
  rainfall_mm: 12.5,
  humidity_pct: 62,
  source: 'Open-Meteo ERA5 archive, fetched 2026-08-26',
};

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
  onOpenLearning: jest.fn(),
};

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockFarmState, {
      farm: makeFarm(),
      loading: false,
      errorKey: null,
    });
    // Default to knowing nothing, so a tile only shows a value when a test
    // deliberately supplies one.
    Object.assign(mockInsights, { crop: null, msp: null, weather: null, price: null });
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

  describe('the agricultural tiles', () => {
    it('shows the crop in the ground and its support price', async () => {
      Object.assign(mockInsights, { crop: wheat, msp: wheatMsp });
      await renderWithProviders(<HomeScreen {...props} />);

      expect(await screen.findByText('Wheat')).toBeTruthy();
      expect(screen.getByText('Sharbati')).toBeTruthy();
      // The real published rate, rendered per quintal.
      expect(screen.getByText('₹2425/qtl')).toBeTruthy();
      expect(screen.getByText('Support price 2025-26')).toBeTruthy();
    });

    it('shows a real observed temperature with the date it was recorded', async () => {
      Object.assign(mockInsights, { weather: observation });
      await renderWithProviders(<HomeScreen {...props} />);

      expect(await screen.findByText('30°C')).toBeTruthy();
      expect(screen.getByText(/Observed/)).toBeTruthy();
    });

    it('shows the latest recorded mandi price with the date it was recorded', async () => {
      Object.assign(mockInsights, { crop: wheat, price: mandiPrice });
      await renderWithProviders(<HomeScreen {...props} />);

      expect(await screen.findByText('₹2480')).toBeTruthy();
      // The date travels with the number: a price read as today's when it is a
      // week old is the exact mistake this guards against.
      expect(screen.getByText(/Recorded/)).toBeTruthy();
    });

    it('says the market is not connected when nothing has been ingested', async () => {
      Object.assign(mockInsights, { crop: wheat, price: null });
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByText('Market prices are not connected yet')).toBeTruthy();
    });

    it('says no crop is recorded rather than naming one', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByTestId('crop-card')).toBeTruthy();
      expect(screen.getByText('Crop not added yet')).toBeTruthy();
    });

    it('leaves MSP empty when there is no crop to price', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByTestId('msp-card')).toBeTruthy();
      expect(screen.getByText('No support price recorded')).toBeTruthy();
      // No rupee figure may appear anywhere when nothing is known.
      expect(screen.queryByText(/₹/)).toBeNull();
    });

    it('says weather is unavailable rather than showing a temperature', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByTestId('weather-card')).toBeTruthy();
      expect(screen.getByText('Weather data unavailable')).toBeTruthy();
      expect(screen.queryByText(/°C/)).toBeNull();
    });

    it('keeps a reading out of the tile when the observation has no temperature', async () => {
      // A row can exist with only rainfall. The tile must not render "NaN°C".
      Object.assign(mockInsights, { weather: { ...observation, temperature_c: null } });
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.queryByText(/°C/)).toBeNull();
      expect(screen.queryByText(/NaN/)).toBeNull();
    });
  });

  describe('what it does not know yet', () => {
    it('leaves growth stage empty instead of inventing a reading', async () => {
      await renderWithProviders(<HomeScreen {...props} />);

      expect(screen.getByTestId('growth-card')).toBeTruthy();
      // Growth stage still has no source — that arrives with Phase 3 analysis.
      expect(screen.getAllByText('Available in a future update')).toHaveLength(1);
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

    it('opens Krishi Academy from the learning card', async () => {
      await renderWithProviders(<HomeScreen {...props} />);
      await fireEvent.press(screen.getByTestId('learning-card'));

      expect(props.onOpenLearning).toHaveBeenCalled();
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
  });
});
