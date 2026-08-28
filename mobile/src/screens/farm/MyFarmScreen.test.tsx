import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { CurrentCrop } from '@/services/agronomy';
import type { Farm } from '@/services/farms';
import { makeFarm, renderWithProviders } from '@/test-utils';

import { MyFarmScreen } from './MyFarmScreen';

const mockFarmState: { farm: Farm | null; loading: boolean } = { farm: null, loading: false };

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

const mockCrop: { current: CurrentCrop | null } = { current: null };

jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: jest.fn(async () => mockCrop.current),
}));

const props = {
  onBack: jest.fn(),
  onRegisterLand: jest.fn(),
  onEditBoundary: jest.fn(),
};

describe('MyFarmScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFarmState.farm = null;
    mockFarmState.loading = false;
    mockCrop.current = null;
  });

  describe('with no farm registered', () => {
    it('shows the honest empty state with a way to start', async () => {
      await renderWithProviders(<MyFarmScreen {...props} />);

      expect(screen.getByTestId('my-farm-empty')).toBeTruthy();
      expect(
        screen.getByText("You haven't registered any land yet"),
      ).toBeTruthy();
    });

    it('starts registration from the empty state action', async () => {
      await renderWithProviders(<MyFarmScreen {...props} />);

      await fireEvent.press(screen.getByText('Register your land'));

      expect(props.onRegisterLand).toHaveBeenCalled();
    });

    it('never shows a farm summary when there is no farm', async () => {
      await renderWithProviders(<MyFarmScreen {...props} />);

      expect(screen.queryByTestId('my-farm-summary')).toBeNull();
    });
  });

  describe('while the farm is still loading for the first time', () => {
    it('shows a loading placeholder, not the empty state', async () => {
      mockFarmState.loading = true;

      await renderWithProviders(<MyFarmScreen {...props} />);

      expect(screen.getByTestId('skeleton')).toBeTruthy();
      expect(screen.queryByTestId('my-farm-empty')).toBeNull();
    });
  });

  describe('with a registered farm', () => {
    it('shows the farm summary with its name and area', async () => {
      mockFarmState.farm = makeFarm({ name: 'North plot' });

      await renderWithProviders(<MyFarmScreen {...props} />);

      expect(screen.getByTestId('my-farm-summary')).toBeTruthy();
      expect(screen.getByText('North plot')).toBeTruthy();
      expect(screen.getByText('2.65')).toBeTruthy();
    });

    it('opens boundary editing from the manage button', async () => {
      mockFarmState.farm = makeFarm();

      await renderWithProviders(<MyFarmScreen {...props} />);

      await fireEvent.press(screen.getByTestId('my-farm-edit-boundary'));

      expect(props.onEditBoundary).toHaveBeenCalled();
    });

    it('shows the crop once it loads', async () => {
      mockFarmState.farm = makeFarm();
      mockCrop.current = {
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
          expected_harvest_on: null,
          area_acres: null,
          status: 'sown',
          notes: null,
        },
      };

      await renderWithProviders(<MyFarmScreen {...props} />);

      await waitFor(() => expect(screen.getByText('Wheat')).toBeTruthy());
    });

    it('says no crop is recorded rather than leaving the row blank', async () => {
      mockFarmState.farm = makeFarm();

      await renderWithProviders(<MyFarmScreen {...props} />);

      await waitFor(() => expect(screen.getByText('Crop not added yet')).toBeTruthy());
    });
  });
});
