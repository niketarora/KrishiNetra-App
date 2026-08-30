import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { makeFarm, renderWithProviders } from '@/test-utils';
import { MyLandsScreen } from './MyLandsScreen';

const mockSelectLand = jest.fn();
const mockRemoveLand = jest.fn();
let mockLands: ReturnType<typeof makeFarm>[] = [];
let mockSelectedLandId: string | null = 'farm-1';
let mockLoading = false;

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => ({
    lands: mockLands,
    selectedLandId: mockSelectedLandId,
    selectLand: mockSelectLand,
    removeLand: mockRemoveLand,
    loading: mockLoading,
  }),
}));

jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: jest.fn(async () => null),
}));

describe('MyLandsScreen', () => {
  const onBack = jest.fn();
  const onOpenMyFarm = jest.fn();
  const onAddLand = jest.fn();
  const onEditLand = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLands = [
      makeFarm({ id: 'farm-1', name: 'North Field', area_acres: 2.5 }),
      makeFarm({ id: 'farm-2', name: 'South Field', area_acres: 1.8 }),
    ];
    mockSelectedLandId = 'farm-1';
    mockLoading = false;
  });

  it('renders all lands with their names and selected indicator', async () => {
    await renderWithProviders(
      <MyLandsScreen
        onBack={onBack}
        onOpenMyFarm={onOpenMyFarm}
        onAddLand={onAddLand}
        onEditLand={onEditLand}
      />,
    );

    expect(screen.getByText('North Field')).toBeTruthy();
    expect(screen.getByText('South Field')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByTestId('land-card-farm-1')).toBeTruthy();
    expect(screen.getByTestId('land-card-farm-2')).toBeTruthy();
  });

  it('selects land and opens details when tapped', async () => {
    await renderWithProviders(
      <MyLandsScreen
        onBack={onBack}
        onOpenMyFarm={onOpenMyFarm}
        onAddLand={onAddLand}
        onEditLand={onEditLand}
      />,
    );

    await fireEvent.press(screen.getByTestId('land-card-farm-2'));

    await waitFor(() => {
      expect(mockSelectLand).toHaveBeenCalledWith('farm-2');
      expect(onOpenMyFarm).toHaveBeenCalledWith(mockLands[1]);
    });
  });

  it('triggers delete confirmation dialog on delete press', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    await renderWithProviders(
      <MyLandsScreen
        onBack={onBack}
        onOpenMyFarm={onOpenMyFarm}
        onAddLand={onAddLand}
        onEditLand={onEditLand}
      />,
    );

    await fireEvent.press(screen.getByTestId('delete-land-farm-2'));

    expect(alertSpy).toHaveBeenCalled();
  });

  it('triggers edit callback when edit pressed', async () => {
    await renderWithProviders(
      <MyLandsScreen
        onBack={onBack}
        onOpenMyFarm={onOpenMyFarm}
        onAddLand={onAddLand}
        onEditLand={onEditLand}
      />,
    );

    await fireEvent.press(screen.getByTestId('edit-land-farm-1'));
    expect(onEditLand).toHaveBeenCalledWith(mockLands[0]);
  });

  it('shows empty state when no lands exist', async () => {
    mockLands = [];
    mockSelectedLandId = null;

    await renderWithProviders(
      <MyLandsScreen
        onBack={onBack}
        onOpenMyFarm={onOpenMyFarm}
        onAddLand={onAddLand}
        onEditLand={onEditLand}
      />,
    );

    expect(screen.getByTestId('empty-lands-state')).toBeTruthy();
  });
});
