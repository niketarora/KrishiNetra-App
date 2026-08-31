import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAvatar } from '@/features/avatar/AvatarContext';
import { isAvatarVisible } from '@/features/avatar/avatarMachine';
import { colors, layout } from '@/theme';

import { Icon } from '../ui/Icon';

/**
 * design.md §2: a 56dp circular mic button, bottom-right, sitting above the
 * bottom nav. The guide's entry point — deliberately not a navigation slot
 * (IMPLEMENTATION.md §7), because it is an interaction layer over the app, not
 * a destination in it.
 *
 * Mounted once, beside the peek and outside the navigator, rather than per
 * screen as it used to be. The guide can now take the farmer anywhere in the
 * app, so it has to be reachable from anywhere in the app — four screens
 * carrying their own copy left the other twenty without one.
 *
 * It stands down while the avatar is on screen: the peek carries its own mic
 * control, and two microphone buttons a thumb apart is one too many.
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
        { bottom: layout.navHeight + insets.bottom + 16 },
        pressed && styles.pressed,
      ]}
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
