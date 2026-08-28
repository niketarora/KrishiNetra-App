import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, layout } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * design.md §3.1/§3.2: primary is a 48dp solid green bar, at most one per
 * screen; secondary is a 44dp outlined bar used for undo/restart/see-more.
 * Square corners throughout, matching the prototype.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityLabel,
  testID,
}: Props) {
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && !inactive && (isPrimary ? styles.primaryPressed : styles.secondaryPressed),
        inactive && (isPrimary ? styles.primaryDisabled : styles.secondaryDisabled),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? colors.text.onPrimary : colors.text.primary}
        />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Icon
              name={icon}
              size={18}
              color={isPrimary ? colors.text.onPrimary : colors.text.primary}
            />
          ) : null}
          <Text
            variant="bodyMedium"
            color={isPrimary ? colors.text.onPrimary : colors.text.primary}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: {
    height: layout.primaryButtonHeight,
    backgroundColor: colors.primary,
  },
  primaryPressed: { backgroundColor: colors.primaryDark },
  // Disabled primary stays green but visibly recedes — the prototype dims
  // "Confirm field boundary" rather than turning it grey.
  primaryDisabled: { opacity: 0.4 },
  secondary: {
    height: layout.secondaryButtonHeight,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'transparent',
  },
  secondaryPressed: { backgroundColor: colors.neutralBg },
  secondaryDisabled: { opacity: 0.45 },
});
