import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils';
import { RegisterFieldMethodScreen } from './RegisterFieldMethodScreen';
import * as locationService from '@/services/location';

jest.mock('@/services/location', () => ({
  ...jest.requireActual('@/services/location'),
  getCurrentFieldFix: jest.fn(),
}));

describe('RegisterFieldMethodScreen', () => {
  const mockGetFix = locationService.getCurrentFieldFix as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays GPS acquisition and navigates to Walk method with coordinates', async () => {
    mockGetFix.mockResolvedValueOnce({
      state: 'ok',
      latitude: 26.9124,
      longitude: 75.7873,
      accuracy: 12,
    });

    const onSelectWalk = jest.fn();
    const onSelectDraw = jest.fn();

    await renderWithProviders(
      <RegisterFieldMethodScreen
        onSelectWalk={onSelectWalk}
        onSelectDraw={onSelectDraw}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/GPS location acquired/i)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('method-walk'));

    expect(onSelectWalk).toHaveBeenCalledWith(
      { latitude: 26.9124, longitude: 75.7873 },
      12,
    );
  });

  it('navigates to Draw method with coordinates on pressing Satellite Map card', async () => {
    mockGetFix.mockResolvedValueOnce({
      state: 'ok',
      latitude: 26.9124,
      longitude: 75.7873,
      accuracy: 8,
    });

    const onSelectWalk = jest.fn();
    const onSelectDraw = jest.fn();

    await renderWithProviders(
      <RegisterFieldMethodScreen
        onSelectWalk={onSelectWalk}
        onSelectDraw={onSelectDraw}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/GPS location acquired/i)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('method-draw'));

    expect(onSelectDraw).toHaveBeenCalledWith(
      { latitude: 26.9124, longitude: 75.7873 },
      8,
    );
  });

  it('shows retry button when location is denied or unavailable', async () => {
    mockGetFix.mockResolvedValueOnce({
      state: 'denied',
    });

    const onSelectWalk = jest.fn();
    const onSelectDraw = jest.fn();

    await renderWithProviders(
      <RegisterFieldMethodScreen
        onSelectWalk={onSelectWalk}
        onSelectDraw={onSelectDraw}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Location permission is off/i)).toBeTruthy();
    });
    expect(screen.getByTestId('retry-location')).toBeTruthy();
  });
});
