import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

import { Text } from '../ui/Text';
import type { BoundaryMapProps } from './BoundaryMap.types';

/**
 * Web-only stand-in for `BoundaryMap.tsx`. Metro/Expo resolve `*.web.tsx`
 * ahead of `*.tsx` when bundling for the web platform, so this file exists
 * purely so nothing in the app ever imports `@rnmapbox/maps` on web.
 *
 * `onReady` still fires immediately so a screen that times out waiting for it
 * doesn't show a false "map failed to load" error while previewing on web.
 */
export function BoundaryMap({ onReady }: BoundaryMapProps) {
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
