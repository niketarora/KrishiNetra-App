import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';
import type { LatLng } from '@/utils/geo';

import { Text } from '../ui/Text';

type Props = {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  points: LatLng[];
  onAddPoint?: (point: LatLng) => void;
  onMovePoint?: (index: number, point: LatLng) => void;
  onReady?: () => void;
  editable?: boolean;
};

/**
 * Web-only stand-in for `BoundaryMap.tsx`. Metro/Expo resolve `*.web.tsx`
 * ahead of `*.tsx` when bundling for the web platform, so this file exists
 * purely so nothing in the app ever imports `react-native-maps` on web —
 * that library has no web target and crashes at module load
 * ("codegenNativeComponent is not a function"). `BoundaryMap.tsx` (the real,
 * native, satellite-map implementation used on Android/iOS) is untouched.
 *
 * This is a placeholder only — no drawing/dragging on web, since there is no
 * map library backing it here. `onReady` still fires immediately so a screen
 * that times out waiting for it (see DrawBoundaryScreen's MAP_READY_TIMEOUT)
 * doesn't show a false "map failed to load" error while previewing on web.
 */
export function BoundaryMap({ onReady }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return (
    <View style={styles.container}>
      <Text variant="caption" color="#FFFFFF" center style={styles.message}>
        {t('onboarding.satelliteView')} — not available in the web preview.{'\n'}
        Use the Android/iOS app to draw or edit a field boundary.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.mapBase,
  },
  message: { maxWidth: 280 },
});
