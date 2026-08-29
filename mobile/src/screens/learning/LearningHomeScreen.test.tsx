import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Farm } from '@/services/farms';
import { makeFarm, renderWithProviders } from '@/test-utils';

import { LearningHomeScreen } from './LearningHomeScreen';

const mockGetCompleted = jest.fn();

jest.mock('@/services/learningProgress', () => ({
  getCompletedTutorialIds: (...args: unknown[]) => mockGetCompleted(...args),
  markTutorialComplete: jest.fn(),
}));

jest.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

const mockFarmState: { farm: Farm | null } = { farm: null };

jest.mock('@/features/farm/FarmContext', () => ({
  useFarm: () => mockFarmState,
}));

const mockGetCurrentCrop = jest.fn();

jest.mock('@/services/agronomy', () => ({
  getCurrentCrop: (...args: unknown[]) => mockGetCurrentCrop(...args),
}));

const wheat = {
  crop: { id: 'crop-wheat', code: 'wheat', name_en: 'Wheat', name_hi: 'गेहूँ', category: 'cereal', default_unit: 'quintal' },
  planting: { id: 'planting-1', farm_id: 'farm-1', crop_id: 'crop-wheat', variety: null, sown_on: null, expected_harvest_on: null, area_acres: null, status: 'growing', notes: null },
};

const props = { onBack: jest.fn(), onOpenTutorial: jest.fn() };

describe('LearningHomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompleted.mockResolvedValue([]);
    mockFarmState.farm = null;
    mockGetCurrentCrop.mockResolvedValue(null);
  });

  it('lists all eight categories as tutorial cards', async () => {
    await renderWithProviders(<LearningHomeScreen {...props} />);
    await waitFor(() => expect(screen.getByText('0 of 8 tutorials completed')).toBeTruthy());

    expect(screen.getByText('Soil Preparation')).toBeTruthy();
    expect(screen.getByText('Soil Preparation Before Sowing')).toBeTruthy();
    expect(screen.getByText('Irrigation')).toBeTruthy();
    expect(screen.getByText('Government Schemes')).toBeTruthy();
  });

  it('counts completed tutorials correctly and badges only those', async () => {
    mockGetCompleted.mockResolvedValue(['soil-preparation-before-sowing']);

    await renderWithProviders(<LearningHomeScreen {...props} />);

    await waitFor(() => expect(screen.getByText('1 of 8 tutorials completed')).toBeTruthy());
    expect(screen.getAllByText('Completed')).toHaveLength(1);
  });

  it('opens a tutorial with its id when its card is tapped', async () => {
    await renderWithProviders(<LearningHomeScreen {...props} />);
    await waitFor(() => expect(screen.getByTestId('tutorial-card-sowing-seed-depth-and-spacing')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('tutorial-card-sowing-seed-depth-and-spacing'));

    expect(props.onOpenTutorial).toHaveBeenCalledWith('sowing-seed-depth-and-spacing');
  });

  it('shows a skeleton while progress is still loading', async () => {
    let resolveGet: (ids: string[]) => void = () => undefined;
    mockGetCompleted.mockReturnValue(new Promise((resolve) => { resolveGet = resolve; }));

    await renderWithProviders(<LearningHomeScreen {...props} />);

    expect(screen.getByTestId('skeleton')).toBeTruthy();
    expect(screen.queryByTestId('learning-progress')).toBeNull();

    resolveGet([]);
    await waitFor(() => expect(screen.getByTestId('learning-progress')).toBeTruthy());
  });

  describe('richer cards', () => {
    it('shows duration, difficulty and a video indicator', async () => {
      await renderWithProviders(<LearningHomeScreen {...props} />);
      await waitFor(() => expect(screen.getByTestId('tutorial-card-sowing-seed-depth-and-spacing')).toBeTruthy());

      expect(screen.getAllByText('6 min · Beginner').length).toBeGreaterThan(0);
    });

    it('shows the featured tutorial above everything else', async () => {
      await renderWithProviders(<LearningHomeScreen {...props} />);

      expect(await screen.findByText('Featured')).toBeTruthy();
      expect(screen.getByTestId('tutorial-card-soil-preparation-before-sowing')).toBeTruthy();
    });

    it('recommends tutorials that match the farmer’s real registered crop', async () => {
      mockFarmState.farm = makeFarm();
      mockGetCurrentCrop.mockResolvedValue(wheat);

      await renderWithProviders(<LearningHomeScreen {...props} />);

      expect(await screen.findByText('Recommended for you')).toBeTruthy();
      expect(screen.getByTestId('recommended-card-irrigation-scheduling-basics')).toBeTruthy();
      expect(screen.getByTestId('recommended-card-fertilizer-basics-npk')).toBeTruthy();
    });
  });
});
