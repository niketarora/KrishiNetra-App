import { screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import { SchemesScreen } from './SchemesScreen';

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'user-1', location_state: 'Goa' },
    refreshProfile: jest.fn(),
  }),
}));

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => ({ farm: null }),
}));

jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: jest.fn(async () => null),
}));

jest.mock('@/services/schemes', () => ({
  listSchemes: jest.fn(async () => []),
  listSchemeStates: jest.fn(async () => ['Goa']),
}));

const props = { onBack: jest.fn(), onOpenScheme: jest.fn() };

describe('SchemesScreen with no schemes', () => {
  it('shows the empty state instead of a broken list', async () => {
    await renderWithProviders(<SchemesScreen {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-schemes-state')).toBeTruthy();
    });
  });
});
