import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import { makeFarm, renderWithProviders } from '@/test-utils';

import { SchemesScreen } from './SchemesScreen';

const mockFarmState: { farm: Farm | null } = { farm: null };

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

const mockGetCurrentCrop = jest.fn();

jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: (...args: unknown[]) => mockGetCurrentCrop(...args),
}));

const props = { onBack: jest.fn(), onOpenScheme: jest.fn() };

describe('SchemesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFarmState.farm = null;
    mockGetCurrentCrop.mockResolvedValue(null);
  });

  it('shows every scheme even with no farm registered', async () => {
    await renderWithProviders(<SchemesScreen {...props} />);

    expect(screen.getByText('PM-KISAN')).toBeTruthy();
    expect(screen.getByText('Pradhan Mantri Fasal Bima Yojana')).toBeTruthy();
    expect(screen.getByText('Kisan Credit Card')).toBeTruthy();
  });

  it('hints at registering land for a more personalised list', async () => {
    await renderWithProviders(<SchemesScreen {...props} />);

    expect(
      screen.getByText('Register your land to see schemes that may be more relevant to you.'),
    ).toBeTruthy();
  });

  it('shows a hedged match summary and a recommended section once a farm exists', async () => {
    mockFarmState.farm = makeFarm();

    await renderWithProviders(<SchemesScreen {...props} />);

    await waitFor(() => expect(screen.getByText(/schemes may be relevant to your farm/)).toBeTruthy());
    expect(screen.getByText('⭐ Recommended')).toBeTruthy();
  });

  it('opens a scheme with its id when its card is tapped', async () => {
    await renderWithProviders(<SchemesScreen {...props} />);

    await fireEvent.press(screen.getByTestId('scheme-card-pm-kisan'));

    expect(props.onOpenScheme).toHaveBeenCalledWith('pm-kisan');
  });

  it('always warns that the list is sample data', async () => {
    await renderWithProviders(<SchemesScreen {...props} />);

    expect(screen.getByTestId('sample-banner')).toBeTruthy();
  });
});
