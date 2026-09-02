import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Icon, Screen, ScreenHeader, Text } from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { useHeadingAndLocation } from '@/features/arMoisture/useHeadingAndLocation';
import { useMoistureTargets } from '@/features/arMoisture/useMoistureTargets';
import {
  directionHintFor,
  gpsQualityFromAccuracy,
  haversineDistanceMeters,
  headingQualityFromAccuracy,
  initialBearingDegrees,
  relativeBearingDegrees,
  roundDistanceForDisplay,
  type DirectionHint,
} from '@/utils/arGeoMath';
import { colors, layout, radius } from '@/theme';

type Props = { onBack: () => void };

/** Farther than this from the farm centroid, guidance still works but gets a soft "you appear to be far from this field" note — not a hard block, since GPS/centroid can both be imprecise. */
const OUTSIDE_FARM_WARNING_METERS = 2000;

/** Inside this distance, the directional arrow gives way to the "you're here" detail card. Deliberately not 0m — GPS uncertainty makes an exact-zero claim dishonest. */
const ARRIVAL_THRESHOLD_METERS = 8;

/**
 * AR Moisture Guidance — camera-based directional guidance to a moisture
 * *sampling target*, not a measured moisture zone (see
 * `features/arMoisture/types.ts`'s header comment for why). Built entirely
 * from already-installed `expo-camera` + `expo-location` — no new
 * dependency, no ARCore/ViroReact, no world-anchored AR. The rear camera
 * stays open as a live backdrop; distance/bearing/heading math (see
 * `utils/arGeoMath.ts`) drives a directional overlay on top of it.
 */
export function ARMoistureGuidanceScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const { farm } = useFarm();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { location, heading, locationPermission, headingAvailable, requestLocationPermission } =
    useHeadingAndLocation(true);

  const farmCenter = useMemo(() => {
    if (farm?.centroid_lat == null || farm?.centroid_lng == null) return null;
    return { latitude: Number(farm.centroid_lat), longitude: Number(farm.centroid_lng) };
  }, [farm?.centroid_lat, farm?.centroid_lng]);

  const { targets, unavailable } = useMoistureTargets(farm?.id ?? null, farmCenter);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTarget = targets[activeIndex] ?? null;

  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      void requestCameraPermission();
    }
  }, [cameraPermission, requestCameraPermission]);

  useEffect(() => {
    void requestLocationPermission();
    // Runs once on mount — requestLocationPermission is stable (useCallback with no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Camera permission still resolving -------------------------------------
  if (!cameraPermission) {
    return (
      <Screen>
        <ScreenHeader title={t('arMoisture.title')} onBack={onBack} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // --- Camera permission denied -----------------------------------------------
  if (!cameraPermission.granted) {
    return (
      <Screen>
        <ScreenHeader title={t('arMoisture.title')} onBack={onBack} />
        <View style={styles.permissionBody}>
          <Banner
            title={t('arMoisture.cameraPermissionTitle')}
            detail={
              cameraPermission.canAskAgain
                ? t('arMoisture.cameraPermissionBody')
                : t('arMoisture.cameraPermissionDenied')
            }
            tone="warning"
            icon="camera"
          />
          {cameraPermission.canAskAgain ? (
            <Button
              label={t('arMoisture.allowCamera')}
              onPress={() => void requestCameraPermission()}
              icon="camera"
              testID="ar-moisture-allow-camera"
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  // --- Location permission denied ---------------------------------------------
  if (locationPermission === 'denied') {
    return (
      <Screen>
        <ScreenHeader title={t('arMoisture.title')} onBack={onBack} />
        <View style={styles.permissionBody}>
          <Banner
            title={t('arMoisture.locationPermissionTitle')}
            detail={t('arMoisture.locationPermissionBody')}
            tone="warning"
            icon="pin"
          />
          <Button
            label={t('arMoisture.allowLocation')}
            onPress={() => void requestLocationPermission()}
            icon="pin"
            testID="ar-moisture-allow-location"
          />
        </View>
      </Screen>
    );
  }

  // --- No farm registered -----------------------------------------------------
  if (!farm || !farmCenter) {
    return (
      <Screen>
        <ScreenHeader title={t('arMoisture.title')} onBack={onBack} />
        <View style={styles.permissionBody}>
          <Banner
            title={t('arMoisture.noFarmTitle')}
            detail={t('arMoisture.noFarmBody')}
            tone="warning"
            icon="field"
          />
        </View>
      </Screen>
    );
  }

  // --- Spatial estimate unavailable (API failed or produced no usable cells) --
  // Deliberately never silently substitutes fabricated targets here — see
  // `useMoistureTargets.ts`'s header comment.
  if (targets.length === 0 && unavailable) {
    return (
      <Screen>
        <ScreenHeader title={t('arMoisture.title')} onBack={onBack} />
        <View style={styles.permissionBody} testID="ar-moisture-zones-unavailable">
          <Banner
            title={t('arMoisture.zonesUnavailableTitle')}
            detail={t('arMoisture.zonesUnavailableBody')}
            tone="warning"
            icon="field"
          />
        </View>
      </Screen>
    );
  }

  if (targets.length === 0) {
    return (
      <Screen>
        <ScreenHeader title={t('arMoisture.title')} onBack={onBack} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const farmerLatLng =
    location.latitude != null && location.longitude != null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;

  const distanceMeters = farmerLatLng && activeTarget ? haversineDistanceMeters(farmerLatLng, activeTarget) : null;
  const distanceFromFarmCenter = farmerLatLng ? haversineDistanceMeters(farmerLatLng, farmCenter) : null;
  const outsideFarm = distanceFromFarmCenter != null && distanceFromFarmCenter > OUTSIDE_FARM_WARNING_METERS;

  const targetBearing =
    farmerLatLng && activeTarget ? initialBearingDegrees(farmerLatLng, activeTarget) : null;
  const relativeBearing =
    targetBearing != null && heading.degrees != null
      ? relativeBearingDegrees(targetBearing, heading.degrees)
      : null;
  const directionHint: DirectionHint | null = relativeBearing != null ? directionHintFor(relativeBearing) : null;

  const gpsQuality = gpsQualityFromAccuracy(location.accuracy);
  const headingQuality = headingAvailable ? headingQualityFromAccuracy(heading.accuracy) : 'unavailable';

  const arrived = distanceMeters != null && distanceMeters <= ARRIVAL_THRESHOLD_METERS;

  const roundedDistance =
    distanceMeters != null ? roundDistanceForDisplay(distanceMeters, location.accuracy) : null;

  const acquiringFix = farmerLatLng == null;

  return (
    <View style={styles.root} testID="ar-moisture-camera">
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="back" size={22} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
          <Text variant="cardTitle" color="#FFFFFF" center>
            {t('arMoisture.title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.bottomArea}>
          {acquiringFix ? (
            <View style={styles.statusCard} testID="ar-moisture-acquiring">
              <ActivityIndicator color="#FFFFFF" />
              <Text variant="bodyMedium" color="#FFFFFF">
                {t('arMoisture.acquiringFix')}
              </Text>
            </View>
          ) : (
            <>
              {outsideFarm ? (
                <View style={styles.warningPill} testID="ar-moisture-outside-farm">
                  <Icon name="alert" size={14} color="#FFFFFF" />
                  <Text variant="micro" color="#FFFFFF">
                    {t('arMoisture.outsideFarm')}
                  </Text>
                </View>
              ) : null}

              {arrived && activeTarget ? (
                <View style={styles.arrivalCard} testID="ar-moisture-arrived">
                  <Text variant="microMedium" color={colors.accent}>
                    {t('arMoisture.arrivedLabel')}
                  </Text>
                  <Text variant="cardTitle" color="#FFFFFF">
                    {activeTarget.label}
                  </Text>
                  {activeTarget.estimatedMoisturePercent != null ? (
                    <Text variant="caption" color="#EDEEE9">
                      {t('arMoisture.estimatedMoisture', { percent: activeTarget.estimatedMoisturePercent })}
                    </Text>
                  ) : null}
                  <Text variant="caption" color="#EDEEE9">
                    {activeTarget.note ?? t('arMoisture.navigateHere')}
                  </Text>
                  <ProvenanceNote t={t} source={activeTarget.provenance.source} />
                </View>
              ) : (
                <View style={styles.guidanceCard} testID="ar-moisture-guidance">
                  {directionHint ? (
                    <DirectionArrow hint={directionHint} relativeBearing={relativeBearing ?? 0} />
                  ) : (
                    <Text variant="micro" color="#EDEEE9">
                      {t('arMoisture.headingUnavailable')}
                    </Text>
                  )}

                  <Text variant="microMedium" color="#EDEEE9" style={styles.targetLabel}>
                    {activeTarget?.relativeStatus === 'LOWER_THAN_FARM_AVERAGE'
                      ? t('arMoisture.lowerMoistureLabel')
                      : t('arMoisture.targetLabel')}
                  </Text>

                  {activeTarget?.estimatedMoisturePercent != null ? (
                    <Text variant="caption" color="#EDEEE9">
                      {t('arMoisture.estimatedMoisture', { percent: activeTarget.estimatedMoisturePercent })}
                    </Text>
                  ) : null}

                  <Text variant="title" color="#FFFFFF">
                    {roundedDistance != null ? t('arMoisture.distanceValue', { meters: roundedDistance }) : '—'}
                  </Text>

                  <Text variant="caption" color="#EDEEE9">
                    {t('arMoisture.navigateHere')}
                  </Text>

                  <ProvenanceNote t={t} source={activeTarget?.provenance.source} />

                  <View style={styles.qualityRow}>
                    <Text variant="micro" color={qualityColor(gpsQuality)}>
                      {t('arMoisture.gpsQuality', { quality: t(`arMoisture.quality.${gpsQuality}`) })}
                    </Text>
                    <Text variant="micro" color={qualityColor(headingQuality)}>
                      {t('arMoisture.headingQuality', { quality: t(`arMoisture.quality.${headingQuality}`) })}
                    </Text>
                  </View>
                </View>
              )}

              {targets.length > 1 ? (
                <Button
                  variant="secondary"
                  label={t('arMoisture.nextTarget')}
                  onPress={() => setActiveIndex((i) => (i + 1) % targets.length)}
                  testID="ar-moisture-next-target"
                />
              ) : null}
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Same "never invent data" language shown once per card, not buried — the
 * whole point of this MVP's data-truth requirement. Demo targets keep the
 * loud "DEMO DATA" label; API-backed prototype targets get the softer (but
 * still honest) "AI ESTIMATE — verify in field" label — neither ever claims
 * a measured reading.
 */
function ProvenanceNote({ t, source }: { t: (key: string) => string; source?: 'demo' | 'api' }) {
  return (
    <View style={styles.provenancePill} testID="ar-moisture-provenance">
      <Text variant="micro" color="#151714">
        {source === 'api' ? t('arMoisture.aiEstimateLabel') : t('arMoisture.demoDataLabel')}
      </Text>
    </View>
  );
}

function qualityColor(quality: string): string {
  if (quality === 'good') return colors.success;
  if (quality === 'fair') return '#F2C94C';
  return colors.danger;
}

/** A simple CSS-triangle arrow rotated to point toward the target relative to the phone's own heading — 'behind' gets a distinct look rather than a spun-around forward arrow, which would misleadingly suggest "just ahead but flipped." */
function DirectionArrow({ hint, relativeBearing }: { hint: DirectionHint; relativeBearing: number }) {
  if (hint === 'behind') {
    return (
      <View style={styles.behindIndicator} testID="ar-moisture-arrow-behind">
        <Icon name="undo" size={28} color="#FFFFFF" strokeWidth={2.4} />
      </View>
    );
  }

  return (
    <View style={[styles.arrowWrap, { transform: [{ rotate: `${relativeBearing}deg` }] }]} testID="ar-moisture-arrow">
      <View style={styles.arrowTriangle} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permissionBody: { paddingHorizontal: layout.screenPadding, paddingTop: 8, gap: 16 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 36 },
  bottomArea: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 24,
    paddingTop: 14,
    gap: 12,
  },
  statusCard: {
    backgroundColor: 'rgba(21, 23, 20, 0.85)',
    borderRadius: radius.lg,
    padding: layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(224, 79, 79, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  guidanceCard: {
    backgroundColor: 'rgba(21, 23, 20, 0.9)',
    borderRadius: radius.lg,
    padding: layout.cardPadding,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  arrivalCard: {
    backgroundColor: 'rgba(21, 23, 20, 0.92)',
    borderRadius: radius.lg,
    padding: layout.cardPadding,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  targetLabel: { marginTop: 4 },
  qualityRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  provenancePill: {
    backgroundColor: '#F2C94C',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  arrowWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderRightWidth: 16,
    borderBottomWidth: 28,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  behindIndicator: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
});
