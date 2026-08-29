import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { DataError } from '@/services/errors';
import { renderWithProviders } from '@/test-utils';
import type { LatLng } from '@/utils/geo';

import { RegisterCropScreen } from './RegisterCropScreen';

const points: LatLng[] = [
  { latitude: 29.6857, longitude: 76.9905 },
  { latitude: 29.6857, longitude: 76.9915 },
  { latitude: 29.6867, longitude: 76.9915 },
  { latitude: 29.6867, longitude: 76.9905 },
];

const mockSaveBoundary = jest.fn();

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => ({ saveBoundary: mockSaveBoundary }),
}));

const mockListCrops = jest.fn();
const mockCreateFarmCrop = jest.fn();

jest.mock('@/services/agronomy', () => ({
  listCrops: (...args: unknown[]) => mockListCrops(...args),
  createFarmCrop: (...args: unknown[]) => mockCreateFarmCrop(...args),
}));

const crops = [
  { id: 'crop-wheat', code: 'wheat', name_en: 'Wheat', name_hi: 'गेहूँ', category: 'cereal', default_unit: 'quintal' },
  { id: 'crop-mustard', code: 'mustard', name_en: 'Mustard', name_hi: 'सरसों', category: 'oilseed', default_unit: 'quintal' },
];

const savedFarm = { id: 'farm-1' };

const props = { points, onSaved: jest.fn(), onBack: jest.fn() };

describe('RegisterCropScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCrops.mockResolvedValue(crops);
    mockSaveBoundary.mockResolvedValue(savedFarm);
    mockCreateFarmCrop.mockResolvedValue({});
  });

  it('offers the crop catalogue once it loads', async () => {
    await renderWithProviders(<RegisterCropScreen {...props} />);

    await waitFor(() => expect(screen.getByTestId('crop-option-wheat')).toBeTruthy());
    expect(screen.getByText('Wheat')).toBeTruthy();
    expect(screen.getByText('Mustard')).toBeTruthy();
  });

  it('reveals variety and sowing date only once a crop is picked', async () => {
    await renderWithProviders(<RegisterCropScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('crop-option-wheat')).toBeTruthy());

    expect(screen.queryByTestId('crop-variety')).toBeNull();

    await fireEvent.press(screen.getByTestId('crop-option-wheat'));

    expect(screen.getByTestId('crop-variety')).toBeTruthy();
    expect(screen.getByTestId('crop-sown-on')).toBeTruthy();
  });

  it('saves the field alone when no crop is picked — crop info is optional', async () => {
    await renderWithProviders(<RegisterCropScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('crop-option-wheat')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('crop-field-name'), 'North plot');
    await fireEvent.press(screen.getByTestId('crop-save'));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(mockSaveBoundary).toHaveBeenCalledWith(points, 'North plot', undefined);
    expect(mockCreateFarmCrop).not.toHaveBeenCalled();
  });

  it('saves the crop details together with the field when one is picked', async () => {
    await renderWithProviders(<RegisterCropScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('crop-option-wheat')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('crop-option-wheat'));
    await fireEvent.changeText(screen.getByTestId('crop-variety'), 'Sharbati');
    await fireEvent.press(screen.getByTestId('crop-save'));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(mockCreateFarmCrop).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({ crop_id: 'crop-wheat', variety: 'Sharbati' }),
    );
  });

  it('deselects a crop on a second tap, hiding its extra fields again', async () => {
    await renderWithProviders(<RegisterCropScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('crop-option-wheat')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('crop-option-wheat'));
    await fireEvent.press(screen.getByTestId('crop-option-wheat'));

    expect(screen.queryByTestId('crop-variety')).toBeNull();
  });

  it('flags an invalid sowing date without blocking the save', async () => {
    await renderWithProviders(<RegisterCropScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('crop-option-wheat')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('crop-option-wheat'));
    await fireEvent.changeText(screen.getByTestId('crop-sown-on'), 'not-a-date');

    expect(screen.getByText('Use the format YYYY-MM-DD')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('crop-save'));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(mockCreateFarmCrop).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({ sown_on: null }),
    );
  });

  it('keeps the farmer on the screen with their data intact when the save fails', async () => {
    mockSaveBoundary.mockRejectedValue(new DataError('onboarding.saveError'));

    await renderWithProviders(<RegisterCropScreen {...props} />);
    await fireEvent.changeText(screen.getByTestId('crop-field-name'), 'North plot');
    await fireEvent.press(screen.getByTestId('crop-save'));

    await waitFor(() =>
      expect(screen.getByText("We couldn't save your farm. Please try again.")).toBeTruthy(),
    );
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('North plot')).toBeTruthy();
  });

  it('still counts registration as successful when only the crop write fails', async () => {
    mockCreateFarmCrop.mockRejectedValue(new Error('boom'));

    await renderWithProviders(<RegisterCropScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('crop-option-wheat')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('crop-option-wheat'));
    await fireEvent.press(screen.getByTestId('crop-save'));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(
      screen.getByText(
        "Your field saved, but we couldn't save the crop details. You can add them later from My Farm.",
      ),
    ).toBeTruthy();
  });
});
