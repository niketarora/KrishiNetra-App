import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAvatar } from '@/features/avatar/AvatarContext';
import { isAvatarVisible } from '@/features/avatar/avatarMachine';
import { colors, layout } from '@/theme';
import { Icon } from '../ui/Icon';

/**
 * KrishiNetra 2.0 Floating Assistant FAB:
 * Deep green circular mic button floating gracefully above the bottom navigation bar.
 * Clean, icon-only voice assistant entry point.
 */
export function AvatarFab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { open, state } = useAvatar();

  if (isAvatarVisible(state)) return null;

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.fab,
        { bottom: layout.navHeight + insets.bottom + 12 },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('avatar.openLabel')}
      testID="avatar-fab"
    >
      <Icon name="mic" size={26} color={colors.text.onPrimary} strokeWidth={2.3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: layout.screenPadding,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    elevation: 8,
    shadowColor: '#1E4D2B',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pressed: { backgroundColor: colors.primaryDark, transform: [{ scale: 0.96 }] },
});
