import * as Location from 'expo-location';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';

import { WalkBoundaryScreen } from './WalkBoundaryScreen';

const props = { onWalked: jest.fn(), onBack: jest.fn() };

/** A small square, well above the near-zero-area floor. */
const SQUARE = [
  { latitude: 29.6857, longitude: 76.9905 },
  { latitude: 29.6857, longitude: 76.9915 },
  { latitude: 29.6867, longitude: 76.9915 },
  { latitude: 29.6867, longitude: 76.9905 },
];

async function pressStart() {
  await act(async () => {
    await fireEvent.press(screen.getByTestId('walk-start'));
  });
}

/** Feeds the points a farmer would produce by walking the square above. */
async function walkSquare() {
  const watch = Location.watchPositionAsync as jest.Mock;
  const callback = watch.mock.calls[watch.mock.calls.length - 1][1];

  for (const point of SQUARE) {
    await act(async () => {
      callback({ coords: { latitude: point.latitude, longitude: point.longitude } });
    });
  }
}

describe('WalkBoundaryScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts idle, asking the farmer to begin', async () => {
    await renderWithProviders(<WalkBoundaryScreen {...props} />);

    expect(screen.getByText(/Walk slowly around the edge/)).toBeTruthy();
    expect(screen.getByTestId('walk-start')).toBeTruthy();
    expect(screen.queryByTestId('walk-stop')).toBeNull();
  });

  it('requests permission and starts recording on Start', async () => {
    await renderWithProviders(<WalkBoundaryScreen {...props} />);

    await pressStart();

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(Location.watchPositionAsync).toHaveBeenCalled();
    expect(screen.getByTestId('walk-stop')).toBeTruthy();
  });

  it('shows why it cannot record when permission is denied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    await renderWithProviders(<WalkBoundaryScreen {...props} />);
    await pressStart();

    expect(
      screen.getByText("Location permission is off. Turn it on in your phone's settings to walk your field."),
    ).toBeTruthy();
    expect(screen.queryByTestId('walk-stop')).toBeNull();
  });

  it('grows the live point count and area as positions stream in', async () => {
    await renderWithProviders(<WalkBoundaryScreen {...props} />);

    await pressStart();
    await walkSquare();

    expect(screen.getByTestId('walk-point-count')).toHaveTextContent('4 points recorded');
  });

  it('blocks continuing with too few points and says why', async () => {
    await renderWithProviders(<WalkBoundaryScreen {...props} />);

    await pressStart();

    const watch = Location.watchPositionAsync as jest.Mock;
    const callback = watch.mock.calls[0][1];
    await act(async () => {
      callback({ coords: { latitude: SQUARE[0].latitude, longitude: SQUARE[0].longitude } });
    });

    await fireEvent.press(screen.getByTestId('walk-stop'));

    expect(
      screen.getByText('Walk a little further — at least 3 points are needed to make a boundary.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('walk-continue')).toBeNull();
  });

  it('hands the walked boundary back once stopped with enough points', async () => {
    await renderWithProviders(<WalkBoundaryScreen {...props} />);

    await pressStart();
    await walkSquare();
    await fireEvent.press(screen.getByTestId('walk-stop'));

    expect(screen.getByTestId('walk-continue')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('walk-continue'));

    expect(props.onWalked).toHaveBeenCalledWith(SQUARE);
  });

  it('clears everything on restart', async () => {
    await renderWithProviders(<WalkBoundaryScreen {...props} />);

    await pressStart();
    await walkSquare();
    await fireEvent.press(screen.getByTestId('walk-stop'));
    await fireEvent.press(screen.getByTestId('walk-restart'));

    expect(screen.queryByTestId('walk-point-count')).toBeNull();
    expect(screen.queryByTestId('walk-continue')).toBeNull();
  });

  it('offers a way back out', async () => {
    await renderWithProviders(<WalkBoundaryScreen {...props} />);

    await fireEvent.press(screen.getByLabelText('Back'));

    expect(props.onBack).toHaveBeenCalled();
  });
});
