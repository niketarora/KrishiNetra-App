import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAvatar } from '@/features/avatar/AvatarContext';
import { colors, layout } from '@/theme';

import { Icon } from '../ui/Icon';

/**
 * design.md §2: a 56dp circular mic button, bottom-right, sitting above the
 * bottom nav. It is the avatar's entry point on every main screen — the avatar
 * deliberately does not occupy a navigation slot (IMPLEMENTATION.md §7),
 * because it is an interaction layer over the app, not a destination in it.
 */
export function AvatarFab() {
  const { t } = useTranslation();
  const { open } = useAvatar();

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('avatar.openLabel')}
      testID="avatar-fab"
    >
      <Icon name="mic" size={26} color={colors.text.onPrimary} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: layout.screenPadding,
    bottom: 16,
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: layout.fabSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    // The one place the flat design allows a shadow — the FAB must read as
    // floating above the scrolling content beneath it.
    elevation: 6,
    shadowColor: '#1C1F1A',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  pressed: { backgroundColor: colors.primaryDark },
});
