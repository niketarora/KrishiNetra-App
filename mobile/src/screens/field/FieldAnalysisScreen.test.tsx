import { screen } from '@testing-library/react-native';

import type { CurrentCrop, Weather } from '@/services/agronomy';
import type { Farm } from '@/services/farms';
import type { FarmPredictionResult } from '@/services/predictions';
import { makeFarm, renderWithProviders } from '@/test-utils';

import { FieldAnalysisScreen } from './FieldAnalysisScreen';

const mockFarmState: {
  farm: Farm | null;
  lands: Farm[];
  selectedLandId: string | null;
  loading: boolean;
  errorKey: string | null;
  refresh: jest.Mock;
  selectLand: jest.Mock;
} = {
  farm: null,
  lands: [],
  selectedLandId: null,
  loading: false,
  errorKey: null,
  refresh: jest.fn(),
  selectLand: jest.fn(),
};

const mockInsights: {
  crop: CurrentCrop | null;
  weather: Weather | null;
  soilMoisture: FarmPredictionResult | null;
} = { crop: null, weather: null, soilMoisture: null };

jest.mock('@/features/avatar/AvatarContext', () => ({
  useAvatar: () => ({ open: jest.fn() }),
}));

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

jest.mock('@/screens/home/useHomeInsights', () => ({
  useHomeInsights: () => ({
    crop: mockInsights.crop,
    weather: mockInsights.weather,
    soilMoisture: mockInsights.soilMoisture,
    refresh: jest.fn(),
  }),
}));

describe('FieldAnalysisScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const defaultFarm = makeFarm({
      name: 'South Plot',
      area_acres: 3.5,
      area_hectares: 1.42,
    });
    Object.assign(mockFarmState, {
      farm: defaultFarm,
      lands: [defaultFarm],
      selectedLandId: defaultFarm.id,
      loading: false,
      errorKey: null,
    });
    Object.assign(mockInsights, { crop: null, weather: null, soilMoisture: null });
  });

  it('renders farm header card with boundary details', async () => {
    await renderWithProviders(<FieldAnalysisScreen />);

    expect(screen.getByText('South Plot')).toBeTruthy();
    expect(screen.getByText('3.50 acres · 1.42 hectares')).toBeTruthy();
  });

  it('renders live ML soil moisture prediction and parameters when available', async () => {
    mockInsights.soilMoisture = {
      prediction: {
        soil_moisture_percent: 20.53,
        category: 'dry',
        model_version: 'oassm-10-transformer-v4',
        production_ready: true,
        experimental: false,
        recommendation: null,
      },
      features: {
        ndvi: 0.58,
        savi: 0.42,
        temperature_c: 28.0,
        humidity_percent: 60.0,
        rainfall: 15.0,
        wind_speed: 3.5,
        soil_ph: 6.8,
        organic_matter: 2.2,
        leaf_area_index: 2.1,
        water_flow: 25.0,
        elevation: 450.0,
        spatial_resolution: 10.0,
        crop_growth_stage: 2,
        crop_type: 'wheat',
      },
      cropName: 'Wheat',
    };

    await renderWithProviders(<FieldAnalysisScreen />);

    expect(screen.getByTestId('soil-moisture-card')).toBeTruthy();
    expect(screen.getByText('20.53%')).toBeTruthy();
    expect(screen.getByText('Dry')).toBeTruthy();
    expect(screen.getByText('Model: oassm-10-transformer-v4')).toBeTruthy();
    expect(screen.getByTestId('ml-features-card')).toBeTruthy();
    expect(screen.getByText('WHEAT')).toBeTruthy();
  });
});
