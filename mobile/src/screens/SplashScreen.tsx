import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { colors } from '@/theme';

/**
 * Shown while the stored session is being checked. design.md §4.1 keeps this
 * as short and plain as possible — it is a session check, not a brand moment.
 */
export function SplashScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text variant="title" color={colors.primary}>
        {t('common.appName')}
      </Text>
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  spinner: { marginTop: 20 },
});
