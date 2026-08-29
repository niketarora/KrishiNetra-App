import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import type { LatLng } from '@/utils/geo';

import { DrawBoundaryScreen } from './DrawBoundaryScreen';

const KARNAL: LatLng = { latitude: 29.6857, longitude: 76.9905 };

const squarePoints: LatLng[] = [
  KARNAL,
  { latitude: 29.6857, longitude: 76.9915 },
  { latitude: 29.6867, longitude: 76.9915 },
  { latitude: 29.6867, longitude: 76.9905 },
];

const props = {
  initialCentre: KARNAL,
  onConfirm: jest.fn(),
  onBack: jest.fn(),
};

describe('DrawBoundaryScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('before a valid boundary exists', () => {
    it('blocks confirmation and says why', async () => {
      await renderWithProviders(<DrawBoundaryScreen {...props} />);

      const confirm = screen.getByTestId('confirm-boundary');
      expect(screen.getByText('Place at least 3 corners')).toBeTruthy();

      await fireEvent.press(confirm);
      expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it('disables undo and restart when there is nothing to undo', async () => {
      await renderWithProviders(<DrawBoundaryScreen {...props} />);

      await fireEvent.press(screen.getByText('Undo point'));
      await fireEvent.press(screen.getByText('Restart'));

      // Nothing to assert on the map, but neither press may crash or enable
      // confirmation.
      expect(screen.getByText('Place at least 3 corners')).toBeTruthy();
    });

    it('shows a zeroed area card', async () => {
      await renderWithProviders(<DrawBoundaryScreen {...props} />);

      expect(screen.getByTestId('area-card')).toBeTruthy();
      expect(screen.getAllByText('0.00').length).toBeGreaterThan(0);
    });
  });

  describe('with a boundary loaded for editing', () => {
    it('allows confirmation and hands back the points', async () => {
      await renderWithProviders(<DrawBoundaryScreen {...props} initialPoints={squarePoints} />);

      await fireEvent.press(screen.getByTestId('confirm-boundary'));

      expect(props.onConfirm).toHaveBeenCalledWith(squarePoints, null);
    });

    it('shows the calculated area in all three units', async () => {
      await renderWithProviders(<DrawBoundaryScreen {...props} initialPoints={squarePoints} />);

      // ~10,742 m² ≈ 2.65 acres ≈ 1.07 hectares at this latitude.
      expect(screen.getByText('2.65')).toBeTruthy();
      expect(screen.getByText('1.07')).toBeTruthy();
      expect(screen.getByText('10,742')).toBeTruthy();
      expect(screen.getByText('acres')).toBeTruthy();
      expect(screen.getByText('hectares')).toBeTruthy();
      expect(screen.getByText('sq metres')).toBeTruthy();
    });

    it('drops back below the threshold when corners are undone', async () => {
      await renderWithProviders(
        <DrawBoundaryScreen {...props} initialPoints={squarePoints.slice(0, 3)} />,
      );

      expect(screen.getByText('Confirm field boundary')).toBeTruthy();

      await fireEvent.press(screen.getByText('Undo point'));

      expect(screen.getByText('Place at least 3 corners')).toBeTruthy();
    });

    it('clears every corner on restart', async () => {
      await renderWithProviders(<DrawBoundaryScreen {...props} initialPoints={squarePoints} />);

      await fireEvent.press(screen.getByText('Restart'));

      expect(screen.getByText('Place at least 3 corners')).toBeTruthy();
    });
  });

  it('offers a way back out', async () => {
    await renderWithProviders(<DrawBoundaryScreen {...props} />);

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(props.onBack).toHaveBeenCalled();
  });
});
