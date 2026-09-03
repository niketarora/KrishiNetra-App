import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AreaCard } from '@/components/farm/AreaCard';
import { BoundaryMap } from '@/components/farm/BoundaryMap';
import { Banner, Button, Screen, ScreenHeader } from '@/components/ui';
import { ACCURACY_WARN_METERS, getCurrentFieldFix, zoomForAccuracy, type FieldFix } from '@/services/location';
import { layout } from '@/theme';
import { calculateArea, isValidPolygon, MIN_VERTICES, type LatLng } from '@/utils/geo';

type Props = {
  /** Where to open the map — the farmer's GPS fix, or their saved farm. */
  initialCentre: LatLng | null;
  /** Vertices to load for an edit, empty for a fresh draw. */
  initialPoints?: LatLng[];
  onConfirm: (points: LatLng[], accuracy?: number | null) => void;
  onBack: () => void;
};

const EMPTY_POINTS: LatLng[] = [];
const FALLBACK_CENTRE: LatLng = { latitude: 22.9734, longitude: 78.6569 };
const MAP_READY_TIMEOUT_MS = 12000;

export function DrawBoundaryScreen({
  initialCentre,
  initialPoints = EMPTY_POINTS,
  onConfirm,
  onBack,
}: Props) {
  const { t } = useTranslation();

  const [points, setPoints] = useState<LatLng[]>(initialPoints);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [centre, setCentre] = useState<LatLng>(initialPoints[0] ?? initialCentre ?? FALLBACK_CENTRE);
  const [zoom, setZoom] = useState<number>(initialCentre ? 17.5 : 16.5);
  const [gpsFixState, setGpsFixState] = useState<FieldFix['state'] | 'idle'>('idle');

  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initialPoints.length >= 3) {
      setCentre(initialPoints[0]!);
      setZoom(16.5);
      return;
    }

    let active = true;
    async function acquireFix() {
      const fix = await getCurrentFieldFix();
      if (!active || !mountedRef.current) return;

      setGpsFixState(fix.state);
      if (fix.state === 'ok') {
        setCentre({ latitude: fix.latitude, longitude: fix.longitude });
        setZoom(zoomForAccuracy(fix.accuracy));
        setAccuracy(fix.accuracy);
      } else if (initialCentre) {
        setCentre(initialCentre);
        setZoom(16.5);
      }
    }

    void acquireFix();

    return () => {
      active = false;
    };
  }, [initialPoints, initialCentre, mapAttempt]);

  useEffect(() => {
    setMapFailed(false);
    timeoutRef.current = setTimeout(() => {
      setMapReady((ready) => {
        if (!ready) setMapFailed(true);
        return ready;
      });
    }, MAP_READY_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [mapAttempt]);

  const handleReady = useCallback(() => {
    setMapReady(true);
    setMapFailed(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleError = useCallback(() => {
    setMapFailed(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const addPoint = useCallback((point: LatLng) => {
    setPoints((current) => [...current, point]);
  }, []);

  const movePoint = useCallback((index: number, point: LatLng) => {
    setPoints((current) => current.map((p, i) => (i === index ? point : p)));
  }, []);

  const undoPoint = useCallback(() => {
    setPoints((current) => current.slice(0, -1));
  }, []);

  const restart = useCallback(() => setPoints([]), []);

  const generateSampleBoundary = useCallback(() => {
    const lat = centre.latitude;
    const lng = centre.longitude;
    const delta = 0.0015;
    setPoints([
      { latitude: lat + delta, longitude: lng - delta },
      { latitude: lat + delta, longitude: lng + delta },
      { latitude: lat - delta, longitude: lng + delta },
      { latitude: lat - delta, longitude: lng - delta },
    ]);
  }, [centre]);

  const area = useMemo(() => calculateArea(points), [points]);
  const canConfirm = isValidPolygon(points);

  const showAccuracyWarning =
    gpsFixState === 'ok' && accuracy !== null && accuracy > ACCURACY_WARN_METERS && points.length === 0;

  const showLocationDeniedBanner = gpsFixState === 'denied' && points.length === 0;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('onboarding.drawTitle')} onBack={onBack} />

      {showAccuracyWarning ? (
        <View style={styles.bannerSlot}>
          <Banner
            title={t('onboarding.gpsAccuracyWarning', 'GPS accuracy is low. You can still adjust boundary points manually.')}
            tone="warning"
          />
        </View>
      ) : null}

      {showLocationDeniedBanner ? (
        <View style={styles.bannerSlot}>
          <Banner
            title={t('onboarding.locationDeniedBanner', 'Location access is off. Map is centered on default region.')}
            tone="neutral"
          />
        </View>
      ) : null}

      {mapFailed ? (
        <View style={styles.mapErrorSlot}>
          <Banner title={t('onboarding.mapError')} tone="danger" />
          <Button
            label="Use Sample Boundary"
            variant="primary"
            onPress={generateSampleBoundary}
            testID="use-sample-boundary-btn"
          />
          <Button
            label={t('common.retry')}
            variant="secondary"
            icon="restart"
            onPress={() => {
              setMapReady(false);
              setMapAttempt((n) => n + 1);
            }}
          />
        </View>
      ) : (
        <BoundaryMap
          key={mapAttempt}
          initialCentre={centre}
          initialZoom={zoom}
          points={points}
          onAddPoint={addPoint}
          onMovePoint={movePoint}
          onReady={handleReady}
          onError={handleError}
          editable
          showsUserLocation={gpsFixState === 'ok'}
        />
      )}

      <View style={styles.controls}>
        <Button
          label={t('onboarding.undo')}
          onPress={undoPoint}
          variant="secondary"
          icon="undo"
          disabled={points.length === 0}
          style={styles.controlButton}
        />
        <Button
          label={t('onboarding.restart')}
          onPress={restart}
          variant="secondary"
          icon="restart"
          disabled={points.length === 0}
          style={styles.controlButton}
        />
        {points.length < 3 && (
          <Button
            label="Sample Field"
            onPress={generateSampleBoundary}
            variant="secondary"
            style={styles.controlButton}
            testID="sample-boundary-btn"
          />
        )}
      </View>

      <View style={styles.areaSlot}>
        <AreaCard area={area} enabled={canConfirm} />
      </View>

      <View style={styles.footer}>
        <Button
          label={canConfirm ? t('onboarding.confirmBoundary') : t('onboarding.needMorePoints')}
          onPress={() => onConfirm(points, accuracy)}
          disabled={!canConfirm}
          accessibilityLabel={
            canConfirm
              ? t('onboarding.confirmBoundary')
              : `${t('onboarding.needMorePoints')} (${points.length}/${MIN_VERTICES})`
          }
          testID="confirm-boundary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bannerSlot: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 8,
  },
  mapErrorSlot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: 12,
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 12,
  },
  controlButton: { flex: 1 },
  areaSlot: { paddingHorizontal: layout.screenPadding, paddingTop: 12 },
  footer: { paddingHorizontal: layout.screenPadding, paddingTop: 12, paddingBottom: 16 },
});
