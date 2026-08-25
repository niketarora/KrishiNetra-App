import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Region } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { AreaCard } from '@/components/farm/AreaCard';
import { BoundaryMap } from '@/components/farm/BoundaryMap';
import { Banner, Button, Screen, ScreenHeader } from '@/components/ui';
import { layout } from '@/theme';
import { calculateArea, isValidPolygon, MIN_VERTICES, type LatLng } from '@/utils/geo';

type Props = {
  /** Where to open the map — the farmer's GPS fix, or their saved farm. */
  initialCentre: LatLng | null;
  /** Vertices to load for an edit, empty for a fresh draw. */
  initialPoints?: LatLng[];
  onConfirm: (points: LatLng[]) => void;
  onBack: () => void;
};

/** Roughly a 400m box — tight enough that a field fills the frame. */
const DEFAULT_DELTA = 0.004;

/** Centre of India, so a map with no fix still opens somewhere sensible. */
const FALLBACK_CENTRE: LatLng = { latitude: 22.9734, longitude: 78.6569 };

/** How long to wait for the native map before offering a retry. */
const MAP_READY_TIMEOUT_MS = 12000;

export function DrawBoundaryScreen({ initialCentre, initialPoints = [], onConfirm, onBack }: Props) {
  const { t } = useTranslation();

  const [points, setPoints] = useState<LatLng[]>(initialPoints);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  // Remounts MapView on retry — a map that failed to initialise will not
  // recover on its own.
  const [mapAttempt, setMapAttempt] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const region = useMemo<Region>(() => {
    const centre = initialPoints[0] ?? initialCentre ?? FALLBACK_CENTRE;
    return {
      latitude: centre.latitude,
      longitude: centre.longitude,
      latitudeDelta: DEFAULT_DELTA,
      longitudeDelta: DEFAULT_DELTA,
    };
  }, [initialCentre, initialPoints]);

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

  // Recomputed only when the boundary actually changes, not on every render —
  // the geodesic calculation runs over the whole ring each time.
  const area = useMemo(() => calculateArea(points), [points]);
  const canConfirm = isValidPolygon(points);

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('onboarding.drawTitle')} onBack={onBack} />

      {mapFailed ? (
        <View style={styles.mapErrorSlot}>
          <Banner title={t('onboarding.mapError')} tone="danger" />
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
          region={region}
          points={points}
          onAddPoint={addPoint}
          onMovePoint={movePoint}
          onReady={handleReady}
        />
      )}

      <View style={styles.controls}>
        <Button
          label={t('onboarding.undoPoint')}
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
      </View>

      <View style={styles.areaSlot}>
        <AreaCard area={area} enabled={canConfirm} />
      </View>

      <View style={styles.footer}>
        <Button
          label={canConfirm ? t('onboarding.confirmBoundary') : t('onboarding.needMorePoints')}
          onPress={() => onConfirm(points)}
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
