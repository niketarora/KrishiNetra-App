import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Region } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { AreaCard } from '@/components/farm/AreaCard';
import { BoundaryMap } from '@/components/farm/BoundaryMap';
import { Banner, Button, Screen, ScreenHeader, Text } from '@/components/ui';
import { colors, layout } from '@/theme';
import { calculateArea, isValidPolygon, type LatLng } from '@/utils/geo';

type Props = {
  onWalked: (points: LatLng[]) => void;
  onBack: () => void;
};

/** Roughly a 400m box, same framing as the draw screen. */
const DEFAULT_DELTA = 0.004;
const FALLBACK_CENTRE: LatLng = { latitude: 22.9734, longitude: 78.6569 };

/**
 * Below this, a "boundary" is GPS noise from standing still, not a field — a
 * farmer who barely moved should be asked to walk again rather than have a
 * sliver saved as their land. Real fields in this app run to fractions of an
 * acre at minimum (thousands of square metres), so 10 m² only ever rejects a
 * walk that didn't really happen.
 */
const MIN_WALK_AREA_SQ_METERS = 10;

/** How far the farmer must move before a new point is recorded. */
const DISTANCE_INTERVAL_METERS = 3;

/**
 * "Walk around your field" boundary capture — Feature #1's one genuinely new
 * mechanism. Everything else (the map, the polygon, the area maths, the
 * confirm/retry footer) reuses the same pieces `DrawBoundaryScreen` uses; this
 * screen's only job is turning a walk into the same `LatLng[]` that screen
 * already knows how to review.
 */
export function WalkBoundaryScreen({ onWalked, onBack }: Props) {
  const { t } = useTranslation();

  const [points, setPoints] = useState<LatLng[]>([]);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const stopWatching = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setRecording(false);
  }, []);

  // Never leave a location watcher running after the farmer navigates away.
  useEffect(() => stopWatching, [stopWatching]);

  const startWalking = async () => {
    setStarting(true);
    setErrorKey(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorKey('myFarm.locationDenied');
        return;
      }

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: DISTANCE_INTERVAL_METERS },
        (position) => {
          setPoints((current) => [
            ...current,
            { latitude: position.coords.latitude, longitude: position.coords.longitude },
          ]);
        },
      );

      subscriptionRef.current = subscription;
      setRecording(true);
    } catch {
      setErrorKey('myFarm.locationFailed');
    } finally {
      setStarting(false);
    }
  };

  const stopWalking = () => stopWatching();

  const restart = () => {
    stopWatching();
    setPoints([]);
    setErrorKey(null);
  };

  const region = useMemo<Region>(() => {
    const centre = points[0] ?? FALLBACK_CENTRE;
    return {
      latitude: centre.latitude,
      longitude: centre.longitude,
      latitudeDelta: DEFAULT_DELTA,
      longitudeDelta: DEFAULT_DELTA,
    };
  }, [points]);

  const area = useMemo(() => calculateArea(points), [points]);
  const hasEnoughPoints = isValidPolygon(points);
  const hasEnoughArea = area.squareMeters >= MIN_WALK_AREA_SQ_METERS;
  const stoppedWithBoundary = !recording && points.length > 0;
  const canContinue = stoppedWithBoundary && hasEnoughPoints && hasEnoughArea;
  const needsMoreWalking = stoppedWithBoundary && !canContinue;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('myFarm.walkTitle')} onBack={onBack} />

      <View style={styles.introSlot}>
        <Text variant="caption" color={colors.text.secondary}>
          {recording ? t('myFarm.recording') : t('myFarm.walkIntro')}
        </Text>
      </View>

      {errorKey ? (
        <View style={styles.bannerSlot}>
          <Banner title={t(errorKey)} tone="danger" onDismiss={() => setErrorKey(null)} dismissLabel={t('common.cancel')} />
        </View>
      ) : null}

      {needsMoreWalking ? (
        <View style={styles.bannerSlot}>
          <Banner
            title={t(hasEnoughPoints ? 'myFarm.tooSmall' : 'myFarm.needMoreWalking')}
            tone="warning"
          />
        </View>
      ) : null}

      <BoundaryMap region={region} points={points} editable={false} showsUserLocation />

      <View style={styles.footer}>
        {points.length > 0 ? (
          <Text variant="micro" color={colors.text.muted} testID="walk-point-count">
            {t('myFarm.pointsRecorded', { count: points.length })}
          </Text>
        ) : null}

        <AreaCard area={area} enabled={points.length > 0} />

        <View style={styles.controls}>
          {points.length > 0 ? (
            <Button
              label={t('common.retry')}
              onPress={restart}
              variant="secondary"
              icon="restart"
              style={styles.controlButton}
              testID="walk-restart"
            />
          ) : null}

          {recording ? (
            <Button
              label={t('myFarm.stopWalking')}
              onPress={stopWalking}
              variant="secondary"
              style={styles.controlButton}
              testID="walk-stop"
            />
          ) : (
            <Button
              label={
                starting
                  ? t('onboarding.locating')
                  : points.length > 0
                    ? t('myFarm.continueWalking')
                    : t('myFarm.startWalking')
              }
              onPress={startWalking}
              loading={starting}
              icon="pin"
              style={styles.controlButton}
              testID="walk-start"
            />
          )}
        </View>

        {canContinue ? (
          <Button
            label={t('common.continue')}
            onPress={() => onWalked(points)}
            accessibilityLabel={t('common.continue')}
            testID="walk-continue"
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  introSlot: { paddingHorizontal: layout.screenPadding, paddingBottom: 8 },
  bannerSlot: { paddingHorizontal: layout.screenPadding, paddingBottom: 8 },
  footer: { paddingHorizontal: layout.screenPadding, paddingTop: 12, paddingBottom: 16, gap: 12 },
  controls: { flexDirection: 'row', gap: 8 },
  controlButton: { flex: 1 },
});
