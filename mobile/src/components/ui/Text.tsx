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

const DEVANAGARI_LANGS = new Set(['hi', 'mr', 'mai', 'ne', 'kok', 'doi', 'brx', 'sa']);
const INDIC_LANGS = new Set([
  'hi', 'mr', 'mai', 'ne', 'kok', 'doi', 'brx', 'sa',
  'bn', 'as', 'mni', 'te', 'ta', 'gu', 'kn', 'or', 'ml', 'pa', 'sat', 'ur', 'ks', 'sd'
]);

/**
 * Every string in the app renders through this component.
 *
 * Beyond the type scale it swaps in Noto Sans Devanagari when the interface is
 * in a Devanagari script language — Archivo has no Devanagari glyphs, so without this,
 * Devanagari renders as tofu boxes. Line height is also nudged up for all Indic scripts,
 * since complex scripts need more vertical room for their matras than Latin does.
 */
export function Text({ variant = 'body', color, center, style, ...rest }: Props) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.split('-')[0]?.toLowerCase() ?? 'en';
  const isDevanagari = DEVANAGARI_LANGS.has(lang);
  const isIndic = INDIC_LANGS.has(lang);

  const resolved = useMemo(() => {
    const base = type[variant];
    const adjustedFont = isDevanagari ? (DEVANAGARI[base.fontFamily] ?? base.fontFamily) : base.fontFamily;
    const adjustedLineHeight = isIndic ? Math.round(base.lineHeight * 1.2) : base.lineHeight;

    return {
      ...base,
      fontFamily: adjustedFont,
      lineHeight: adjustedLineHeight,
    };
  }, [variant, isDevanagari, isIndic]);

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
