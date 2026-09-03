import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Card, Icon, Screen, ScreenHeader, Text } from '@/components/ui';
import { ACCURACY_WARN_METERS, getCurrentFieldFix, type FieldFix } from '@/services/location';
import { colors, layout, radius } from '@/theme';
import type { LatLng } from '@/utils/geo';
import { useTourTarget } from '@/features/onboarding/useTourTarget';

type Props = {
  onSelectWalk: (centre: LatLng | null, accuracy: number | null) => void;
  onSelectDraw: (centre: LatLng | null, accuracy: number | null) => void;
  onBack?: () => void;
};

export function RegisterFieldMethodScreen({ onSelectWalk, onSelectDraw, onBack }: Props) {
  const { t } = useTranslation();
  const drawTargetRef = useTourTarget('tour-register-map', 20);

  const [locating, setLocating] = useState(true);
  const [gpsFix, setGpsFix] = useState<FieldFix | null>(null);
  const [centre, setCentre] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const fetchLocation = async () => {
    setLocating(true);
    const fix = await getCurrentFieldFix();
    setGpsFix(fix);
    if (fix.state === 'ok') {
      setCentre({ latitude: fix.latitude, longitude: fix.longitude });
      setAccuracy(fix.accuracy);
    } else {
      setCentre(null);
      setAccuracy(null);
    }
    setLocating(false);
  };

  useEffect(() => {
    void fetchLocation();
  }, []);

  const handleWalk = () => {
    onSelectWalk(centre, accuracy);
  };

  const handleDraw = () => {
    onSelectDraw(centre, accuracy);
  };

  return (
    <Screen>
      <ScreenHeader title={t('onboarding.methodTitle')} onBack={onBack} />

      <View style={styles.content}>
        <Text variant="body" color={colors.text.secondary}>
          {t('onboarding.methodSubtitle')}
        </Text>

        {/* Location Status Badge */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Icon
              name={gpsFix?.state === 'ok' ? 'pin' : 'offline'}
              size={18}
              color={gpsFix?.state === 'ok' ? colors.primary : colors.warning}
            />
            <Text variant="bodyMedium" color={colors.text.primary} style={styles.locationText}>
              {locating
                ? t('onboarding.locating')
                : gpsFix?.state === 'ok'
                  ? `${t('onboarding.gpsAcquired')}${
                      accuracy !== null && accuracy !== undefined
                        ? ` (${t('onboarding.gpsAccuracyMeters', { meters: Math.round(accuracy) })})`
                        : ''
                    }`
                  : t('onboarding.locationDenied')}
            </Text>
          </View>

          {gpsFix && gpsFix.state !== 'ok' ? (
            <Button
              label={t('onboarding.retryLocation')}
              onPress={fetchLocation}
              variant="secondary"
              icon="pin"
              loading={locating}
              testID="retry-location"
            />
          ) : null}
        </View>

        {accuracy !== null && accuracy > ACCURACY_WARN_METERS ? (
          <Banner title={t('onboarding.gpsAccuracyWarning')} tone="warning" icon="offline" />
        ) : null}

        {/* Method 1: Walk around field */}
        <Pressable
          onPress={handleWalk}
          style={({ pressed }) => [styles.methodCard, pressed && styles.methodCardPressed]}
          testID="method-walk"
          accessibilityRole="button"
        >
          <View style={styles.iconCircle}>
            <Icon name="field" size={24} color={colors.primary} />
          </View>
          <View style={styles.methodInfo}>
            <View style={styles.titleRow}>
              <Text variant="cardTitle">{t('onboarding.walkMethodTitle')}</Text>
              <View style={styles.badgePill}>
                <Text variant="microMedium" color={colors.primaryDark}>
                  GPS Walk
                </Text>
              </View>
            </View>
            <Text variant="caption" color={colors.text.secondary} style={styles.methodDesc}>
              {t('onboarding.walkMethodDesc')}
            </Text>
          </View>
          <Icon name="chevron" size={20} color={colors.text.muted} />
        </Pressable>

        {/* Method 2: Mark / Draw on Map */}
        <Pressable
          ref={drawTargetRef}
          collapsable={false}
          onPress={handleDraw}
          style={({ pressed }) => [styles.methodCard, pressed && styles.methodCardPressed]}
          testID="method-draw"
          accessibilityRole="button"
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.accentBg }]}>
            <Icon name="map" size={24} color={colors.accent} />
          </View>
          <View style={styles.methodInfo}>
            <View style={styles.titleRow}>
              <Text variant="cardTitle">{t('onboarding.drawMethodTitle')}</Text>
              <View style={[styles.badgePill, { backgroundColor: colors.accentBg }]}>
                <Text variant="microMedium" color={colors.accentBadgeFg}>
                  Satellite Map
                </Text>
              </View>
            </View>
            <Text variant="caption" color={colors.text.secondary} style={styles.methodDesc}>
              {t('onboarding.drawMethodDesc')}
            </Text>
          </View>
          <Icon name="chevron" size={20} color={colors.text.muted} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    gap: 16,
  },
  locationCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.none,
    padding: 14,
    gap: 10,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.none,
    padding: 16,
    gap: 14,
  },
  methodCardPressed: {
    backgroundColor: colors.neutralBg,
    borderColor: colors.borderStrong,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgePill: {
    backgroundColor: colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  methodDesc: {
    lineHeight: 18,
  },
});
