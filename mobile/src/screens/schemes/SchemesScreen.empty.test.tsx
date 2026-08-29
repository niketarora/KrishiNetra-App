import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { SchemesScreen } from './SchemesScreen';

// Exercises the structurally-possible "no schemes" state in isolation — the
// static demo list is never actually empty in production, but the screen
// must still render correctly rather than blank if it ever were.
jest.mock('@/features/schemes/demoSchemes', () => ({
  ...jest.requireActual('@/features/schemes/demoSchemes'),
  SCHEMES: [],
}));

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => ({ farm: null }),
}));

jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: jest.fn(async () => null),
}));

const props = { onBack: jest.fn(), onOpenScheme: jest.fn() };

describe('SchemesScreen with no schemes', () => {
  it('shows the empty state instead of a broken list', async () => {
    await renderWithProviders(<SchemesScreen {...props} />);

    expect(screen.getByTestId('schemes-empty')).toBeTruthy();
  });
});
