import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import type { Farm } from '@/services/farms';

import { UpdatesScreen } from './UpdatesScreen';
import { useUpdatesData, type UpdatesData } from './useUpdatesData';

jest.mock('./useUpdatesData');

// The static demo feed is never actually empty in production, but the screen
// must still render correctly rather than blank if it ever were.
jest.mock('@/features/updates/demoUpdates', () => ({
  ...jest.requireActual('@/features/updates/demoUpdates'),
  UPDATES: [],
}));

const mockedUseUpdatesData = useUpdatesData as jest.MockedFunction<typeof useUpdatesData>;

function farm(): Farm {
  return {
    id: 'farm-1',
    user_id: 'user-1',
    name: 'North Field',
    boundary: { type: 'Polygon', coordinates: [] },
    area_sq_meters: 1000,
    area_acres: 0.25,
    area_hectares: 0.1,
    centroid_lat: 26.76,
    centroid_lng: 83.37,
    district: 'Gorakhpur',
    state: 'Uttar Pradesh',
    location_source: 'geocode',
    location_accuracy: null,
    created_at: 'now',
    updated_at: 'now',
  };
}

const props = { onBack: jest.fn(), onOpenUpdate: jest.fn() };

describe('UpdatesScreen with an empty demo feed', () => {
  it('shows the empty state instead of a broken list, even in the demo fallback path', async () => {
    mockedUseUpdatesData.mockReturnValue({
      farms: [farm()],
      selectedFarmId: 'farm-1',
      selectFarm: jest.fn(),
      updates: [],
      loading: false,
      errorKey: null,
      demoFallback: true,
      refresh: jest.fn(),
    } satisfies UpdatesData);

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByTestId('updates-empty')).toBeTruthy();
    // Still labelled as sample content even though there is nothing to show.
    expect(screen.getByTestId('sample-banner')).toBeTruthy();
  });
});
