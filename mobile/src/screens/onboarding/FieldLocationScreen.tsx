import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Icon, Screen, ScreenHeader, Text } from '@/components/ui';
import { colors, layout } from '@/theme';
import type { LatLng } from '@/utils/geo';

type Props = {
  onContinue: (centre: LatLng | null) => void;
  onBack?: () => void;
};

/**
 * design.md §4.6 — centre the map before the farmer starts drawing.
 *
 * GPS is offered first because it needs no typing, but it is never required:
 * permission may be denied, and a farmer may be setting up from home rather
 * than standing in the field. Either way they can continue and pan the map
 * themselves, so this step can't become a dead end.
 */
export function FieldLocationScreen({ onContinue, onBack }: Props) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);
  const [noticeKey, setNoticeKey] = useState<string | null>(null);

  const useCurrentLocation = async () => {
    setLocating(true);
    setNoticeKey(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNoticeKey('onboarding.locationDenied');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onContinue({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setNoticeKey('onboarding.locationFailed');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('onboarding.locationTitle')} onBack={onBack} />

      <View style={styles.body}>
        <Text variant="body" color={colors.text.secondary}>
          {t('onboarding.locationBody')}
        </Text>

        {noticeKey ? (
          <Banner title={t(noticeKey)} tone="neutral" icon="pin" />
        ) : null}

        <View style={styles.illustration}>
          <Icon name="map" size={32} color={colors.text.muted} strokeWidth={1.6} />
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label={locating ? t('onboarding.locating') : t('onboarding.useLocation')}
          onPress={useCurrentLocation}
          loading={locating}
          icon="pin"
          testID="use-location"
        />
        <Button
          label={t('onboarding.continueToMap')}
          onPress={() => onContinue(null)}
          variant="secondary"
          testID="continue-to-map"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    gap: layout.cardGap,
  },
  illustration: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 24, gap: 12 },
});
