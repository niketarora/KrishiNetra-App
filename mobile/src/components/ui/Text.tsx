import { useMemo } from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fonts, type, type TypeVariant } from '@/theme';

type Props = RNTextProps & {
  variant?: TypeVariant;
  color?: string;
  center?: boolean;
};

/** Latin font family → its Devanagari counterpart at the same weight. */
const DEVANAGARI: Record<string, string> = {
  [fonts.regular]: fonts.devanagariRegular,
  [fonts.medium]: fonts.devanagariMedium,
  [fonts.semibold]: fonts.devanagariSemiBold,
};

/**
 * Every string in the app renders through this component.
 *
 * Beyond the type scale it swaps in Noto Sans Devanagari when the interface is
 * in Hindi — Archivo has no Devanagari glyphs, so without this, Hindi renders
 * as tofu boxes. Line height is also nudged up, since Devanagari needs more
 * vertical room for its matras than Latin does at the same size.
 */
export function Text({ variant = 'body', color, center, style, ...rest }: Props) {
  const { i18n } = useTranslation();
  const isDevanagari = i18n.language === 'hi';

  const resolved = useMemo(() => {
    const base = type[variant];
    if (!isDevanagari) return base;

    return {
      ...base,
      fontFamily: DEVANAGARI[base.fontFamily] ?? base.fontFamily,
      lineHeight: Math.round(base.lineHeight * 1.2),
    };
  }, [variant, isDevanagari]);

  return (
    <RNText
      style={StyleSheet.flatten([
        resolved,
        color ? { color } : null,
        center ? styles.center : null,
        style,
      ])}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
