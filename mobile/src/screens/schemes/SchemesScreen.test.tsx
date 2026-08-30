import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import type { SchemeCard } from '@/services/schemes';
import { makeFarm, renderWithProviders } from '@/test-utils';
import { SchemesScreen } from './SchemesScreen';

const mockFarmState: { farm: Farm | null } = { farm: null };
const mockProfileState: { profile: { id: string; location_state: string | null } | null } = {
  profile: { id: 'user-1', location_state: 'Rajasthan' },
};

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    profile: mockProfileState.profile,
    refreshProfile: jest.fn(),
  }),
}));

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

const mockGetCurrentCrop = jest.fn();
jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: (...args: unknown[]) => mockGetCurrentCrop(...args),
}));

const mockSchemes: SchemeCard[] = [
  {
    row_id: 'pm-kisan-1',
    name: 'PM-KISAN Income Support',
    short_title: 'PM-KISAN',
    category: 'Direct Benefit Transfer',
    scheme_scope: 'CENTRAL',
    summary: 'Direct income support of 6000 rupees per year.',
    reasonKey: 'schemes.reasons.broadlyApplicable',
  },
  {
    row_id: 'raj-tarbandi-1',
    name: 'Rajasthan Tarbandi Yojana',
    short_title: 'Tarbandi Yojana',
    category: 'Fencing Subsidy',
    scheme_scope: 'STATE',
    summary: 'Subsidy for wire fencing of farm boundaries.',
    reasonKey: 'schemes.reasons.cropMatch',
  },
];

const mockListSchemes = jest.fn();
const mockListSchemeStates = jest.fn();

jest.mock('@/services/schemes', () => ({
  listSchemes: (...args: unknown[]) => mockListSchemes(...args),
  listSchemeStates: (...args: unknown[]) => mockListSchemeStates(...args),
}));

const props = { onBack: jest.fn(), onOpenScheme: jest.fn() };

describe('SchemesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFarmState.farm = null;
    mockProfileState.profile = { id: 'user-1', location_state: 'Rajasthan' };
    mockGetCurrentCrop.mockResolvedValue(null);
    mockListSchemes.mockResolvedValue(mockSchemes);
    mockListSchemeStates.mockResolvedValue(['Rajasthan', 'Punjab']);
  });

  it('renders schemes filtered by state', async () => {
    await renderWithProviders(<SchemesScreen {...props} />);

    await waitFor(() => {
      expect(screen.getByText('PM-KISAN')).toBeTruthy();
      expect(screen.getByText('Tarbandi Yojana')).toBeTruthy();
      expect(screen.getByText('Rajasthan')).toBeTruthy();
    });
  });

  it('opens a scheme with its row_id when card is tapped', async () => {
    await renderWithProviders(<SchemesScreen {...props} />);

    await waitFor(() => expect(screen.getByTestId('scheme-card-pm-kisan-1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('scheme-card-pm-kisan-1'));

    expect(props.onOpenScheme).toHaveBeenCalledWith('pm-kisan-1');
  });

  it('shows empty state when no schemes returned for state', async () => {
    mockListSchemes.mockResolvedValue([]);

    await renderWithProviders(<SchemesScreen {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-schemes-state')).toBeTruthy();
    });
  });
});
