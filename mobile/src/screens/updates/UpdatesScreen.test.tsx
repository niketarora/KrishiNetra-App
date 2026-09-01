import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import type { KrishiUpdate } from '@/features/updates/types';
import type { Farm } from '@/services/farms';

import { UpdatesScreen } from './UpdatesScreen';
import { useUpdatesData, type UpdatesData } from './useUpdatesData';

jest.mock('./useUpdatesData');

const mockedUseUpdatesData = useUpdatesData as jest.MockedFunction<typeof useUpdatesData>;

function farm(overrides: Partial<Farm> = {}): Farm {
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
    ...overrides,
  };
}

function update(overrides: Partial<KrishiUpdate> = {}): KrishiUpdate {
  return {
    id: 'update-1',
    title: 'Flood alert issued for Gorakhpur district',
    category: 'risk',
    source: { name: 'news.example.com', type: 'reported' },
    sourceUrl: 'https://news.example.com/a',
    publishedAt: new Date().toISOString(),
    relevance: { score: 40, reasons: ['Relevant to Gorakhpur'] },
    ...overrides,
  };
}

function data(overrides: Partial<UpdatesData> = {}): UpdatesData {
  return {
    farms: [farm()],
    selectedFarmId: 'farm-1',
    selectFarm: jest.fn(),
    updates: [],
    loading: false,
    errorKey: null,
    demoFallback: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

const props = { onBack: jest.fn(), onOpenUpdate: jest.fn() };

beforeEach(() => jest.clearAllMocks());

describe('UpdatesScreen — the selected field context', () => {
  it('shows the selected field name and district/state', async () => {
    mockedUseUpdatesData.mockReturnValue(data({ updates: [update()] }));

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByText('North Field')).toBeTruthy();
    expect(screen.getByText('Gorakhpur, Uttar Pradesh')).toBeTruthy();
  });
});

describe('UpdatesScreen — loading', () => {
  it('shows a loading state rather than an empty list while the feed is fetching', async () => {
    mockedUseUpdatesData.mockReturnValue(data({ loading: true }));

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByTestId('updates-loading')).toBeTruthy();
    expect(screen.queryByTestId('updates-empty')).toBeNull();
  });
});

describe('UpdatesScreen — real updates', () => {
  it('renders a real update with its category, source, and why-relevant reason', async () => {
    mockedUseUpdatesData.mockReturnValue(
      data({ updates: [update({ relevance: { score: 40, reasons: ['Relevant to Gorakhpur'] } })] }),
    );

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByText('Flood alert issued for Gorakhpur district')).toBeTruthy();
    expect(screen.getByText('Relevant to Gorakhpur')).toBeTruthy();
  });

  it('marks an official source distinctly from a reported one', async () => {
    mockedUseUpdatesData.mockReturnValue(
      data({
        updates: [
          update({ id: 'official-1', source: { name: 'NDMA SACHET', type: 'official' }, category: 'risk' }),
        ],
      }),
    );

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByText('Official Alert')).toBeTruthy();
  });

  it('labels an ordinary GDELT article naming the farm district as regional news, never "Verified"', async () => {
    mockedUseUpdatesData.mockReturnValue(
      data({
        updates: [
          update({ source: { name: 'news.example.com', type: 'reported' }, location: { district: 'Gorakhpur' } }),
        ],
      }),
    );

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByText('Regional News')).toBeTruthy();
    expect(screen.queryByText(/verified/i)).toBeNull();
  });

  it('labels a national-scope article "National News", never "Regional News"', async () => {
    mockedUseUpdatesData.mockReturnValue(
      data({
        updates: [
          update({
            source: { name: 'news.example.com', type: 'reported' },
            category: 'agriculture',
            title: 'India raises MSP for wheat nationally',
            location: { country: 'India' },
          }),
        ],
      }),
    );

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByText('National News')).toBeTruthy();
    expect(screen.queryByText('Regional News')).toBeNull();
  });

  it('opens the real update when its card is tapped', async () => {
    mockedUseUpdatesData.mockReturnValue(data({ updates: [update({ id: 'update-xyz' })] }));

    await renderWithProviders(<UpdatesScreen {...props} />);
    await fireEvent.press(screen.getByTestId('update-card-update-xyz'));

    expect(props.onOpenUpdate).toHaveBeenCalledWith('update-xyz');
  });
});

describe('UpdatesScreen — empty state', () => {
  it('shows the honest empty state when the backend returns nothing, not an error and not demo content', async () => {
    mockedUseUpdatesData.mockReturnValue(data({ updates: [] }));

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByTestId('updates-empty')).toBeTruthy();
    expect(screen.queryByTestId('sample-banner')).toBeNull();
  });
});

describe('UpdatesScreen — backend error', () => {
  it('shows an error banner rather than an empty list', async () => {
    mockedUseUpdatesData.mockReturnValue(data({ errorKey: 'updates.loadError', updates: [] }));

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByText("We couldn't load updates. Pull down to try again.")).toBeTruthy();
  });
});

describe('UpdatesScreen — demo fallback', () => {
  it('shows the sample banner and the demo feed, clearly labelled, never silently', async () => {
    mockedUseUpdatesData.mockReturnValue(data({ demoFallback: true, updates: [] }));

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByTestId('sample-banner')).toBeTruthy();
    expect(screen.getByText('New drought-resistant wheat variety announced')).toBeTruthy();
  });

  it('never shows demo content alongside a real update from the backend', async () => {
    mockedUseUpdatesData.mockReturnValue(data({ demoFallback: false, updates: [update()] }));

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.queryByTestId('sample-banner')).toBeNull();
  });
});

describe('UpdatesScreen — multi-field selector', () => {
  it('shows no selector for a farmer with a single field', async () => {
    mockedUseUpdatesData.mockReturnValue(data({ farms: [farm()] }));

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.queryByTestId('updates-farm-selector')).toBeNull();
  });

  it('shows a selector for a farmer with multiple fields', async () => {
    mockedUseUpdatesData.mockReturnValue(
      data({ farms: [farm({ id: 'farm-1' }), farm({ id: 'farm-2', name: 'South Field' })] }),
    );

    await renderWithProviders(<UpdatesScreen {...props} />);

    expect(screen.getByTestId('updates-farm-selector')).toBeTruthy();
    expect(screen.getByTestId('updates-farm-option-farm-2')).toBeTruthy();
  });

  it('reloads the feed for the newly selected field when a farm chip is tapped', async () => {
    const selectFarm = jest.fn();
    mockedUseUpdatesData.mockReturnValue(
      data({ farms: [farm({ id: 'farm-1' }), farm({ id: 'farm-2', name: 'South Field' })], selectFarm }),
    );

    await renderWithProviders(<UpdatesScreen {...props} />);
    await fireEvent.press(screen.getByTestId('updates-farm-option-farm-2'));

    expect(selectFarm).toHaveBeenCalledWith('farm-2');
  });
});
