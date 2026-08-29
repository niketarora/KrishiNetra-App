import * as Location from 'expo-location';

import { getCurrentFieldFix, zoomForAccuracy, ACCURACY_WARN_METERS } from './location';

describe('zoomForAccuracy', () => {
  it('returns high zoom for precise fix (<= 15m)', () => {
    expect(zoomForAccuracy(5)).toBe(17.5);
    expect(zoomForAccuracy(15)).toBe(17.5);
  });

  it('returns moderate zoom for fix between 15m and 50m', () => {
    expect(zoomForAccuracy(20)).toBe(16.5);
    expect(zoomForAccuracy(50)).toBe(16.5);
  });

  it('returns lower zoom for coarse fix (> 50m)', () => {
    expect(zoomForAccuracy(60)).toBe(15.5);
    expect(zoomForAccuracy(500)).toBe(15.5);
  });

  it('returns default 16.5 for null/undefined/NaN accuracy', () => {
    expect(zoomForAccuracy(null)).toBe(16.5);
    expect(zoomForAccuracy(undefined)).toBe(16.5);
    expect(zoomForAccuracy(NaN)).toBe(16.5);
  });
});

describe('getCurrentFieldFix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ok state when location fix is granted and successful', async () => {
    const fix = await getCurrentFieldFix();
    expect(fix).toEqual({
      state: 'ok',
      latitude: 29.6857,
      longitude: 76.9905,
      accuracy: 10,
    });
  });

  it('returns denied when permission is not granted', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    const fix = await getCurrentFieldFix();
    expect(fix).toEqual({ state: 'denied' });
  });

  it('returns unavailable when services are disabled', async () => {
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValueOnce(false);

    const fix = await getCurrentFieldFix();
    expect(fix).toEqual({ state: 'unavailable' });
  });

  it('returns timeout when fix takes too long', async () => {
    (Location.getCurrentPositionAsync as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 500)),
    );

    const fix = await getCurrentFieldFix(50);
    expect(fix).toEqual({ state: 'timeout' });
  });
});
