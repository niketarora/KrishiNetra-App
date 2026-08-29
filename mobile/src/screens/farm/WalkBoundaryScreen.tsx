import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AreaCard } from '@/components/farm/AreaCard';
import { BoundaryMap } from '@/components/farm/BoundaryMap';
import { Banner, Button, Screen, ScreenHeader, Text } from '@/components/ui';
import { colors, layout } from '@/theme';
import { calculateArea, isValidPolygon, type LatLng } from '@/utils/geo';

type Props = {
  initialCentre?: LatLng | null;
  onWalked: (points: LatLng[], accuracy: number | null) => void;
  onBack: () => void;
};

const MIN_WALK_AREA_SQ_METERS = 10;
const DISTANCE_INTERVAL_METERS = 3;

export function WalkBoundaryScreen({ initialCentre, onWalked, onBack }: Props) {
  const { t } = useTranslation();

  const [points, setPoints] = useState<LatLng[]>([]);
  const [accuracies, setAccuracies] = useState<number[]>([]);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const stopWatching = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setRecording(false);
  }, []);

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
          if (position.coords.accuracy !== null && position.coords.accuracy !== undefined) {
            setAccuracies((prev) => [...prev, position.coords.accuracy!]);
          }
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
    setAccuracies([]);
    setErrorKey(null);
  };

  const area = useMemo(() => calculateArea(points), [points]);
  const hasEnoughPoints = isValidPolygon(points);
  const hasEnoughArea = area.squareMeters >= MIN_WALK_AREA_SQ_METERS;
  const stoppedWithBoundary = !recording && points.length > 0;
  const canContinue = stoppedWithBoundary && hasEnoughPoints && hasEnoughArea;
  const needsMoreWalking = stoppedWithBoundary && !canContinue;

  const averageAccuracy = useMemo(() => {
    if (accuracies.length === 0) return null;
    const sum = accuracies.reduce((a, b) => a + b, 0);
    return Math.round((sum / accuracies.length) * 10) / 10;
  }, [accuracies]);

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

      <BoundaryMap
        points={points}
        initialCentre={points[0] ?? initialCentre ?? null}
        editable={false}
        showsUserLocation
      />

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
            onPress={() => onWalked(points, averageAccuracy)}
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
