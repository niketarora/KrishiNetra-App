import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fonts, layout, radius } from '@/theme';

import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  /** Already-translated error sentence; turns the field red when present. */
  error?: string | null;
  /** Renders a show/hide toggle and starts obscured. */
  secure?: boolean;
  leading?: React.ReactNode;
};

/**
 * design.md §3.11. Errors appear inline beneath the field in danger red —
 * never as a toast or an alert dialog, which a farmer can miss or dismiss
 * before reading.
 */
export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, secure = false, leading, style, ...rest },
  ref,
) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text variant="caption" style={styles.label}>
        {label}
      </Text>

      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          error ? styles.fieldError : null,
        ]}
      >
        {leading ? <View style={styles.leading}>{leading}</View> : null}

        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.text.muted}
          secureTextEntry={secure && !revealed}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          accessibilityLabel={label}
          {...rest}
        />

        {secure ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            style={styles.reveal}
            accessibilityRole="button"
            accessibilityLabel={t(revealed ? 'auth.hidePassword' : 'auth.showPassword')}
          >
            <Text variant="microMedium" color={colors.text.secondary}>
              {t(revealed ? 'auth.hidePassword' : 'auth.showPassword')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" color={colors.danger} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  label: { marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.primaryButtonHeight,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  fieldFocused: { borderColor: colors.primary },
  fieldError: { borderColor: colors.danger },
  leading: { marginRight: 8 },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text.primary,
    paddingVertical: 10,
  },
  reveal: { paddingLeft: 10 },
  error: { marginTop: 6 },
});
