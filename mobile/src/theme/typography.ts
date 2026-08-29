import { TextStyle } from 'react-native';

import { colors } from './colors';

/**
 * The prototype uses Archivo for Latin text and Noto Sans Devanagari for
 * Hindi. Weights are limited to 400/500/600 — design.md §1.2 keeps the set
 * small deliberately, for performance on low-end devices.
 */
export const fonts = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  devanagariRegular: 'NotoSansDevanagari_400Regular',
  devanagariMedium: 'NotoSansDevanagari_500Medium',
  devanagariSemiBold: 'NotoSansDevanagari_600SemiBold',
} as const;

/**
 * Type scale from design.md §1.2. Sentence case everywhere — never all-caps
 * labels, which read poorly in glare and do not survive translation into the
 * 22 target languages.
 */
export const type = {
  title: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text.primary,
  },
  /**
   * A primary farm value that needs to read at a glance in bright light —
   * a temperature, an area, a price. Bigger and bolder than `title`, used
   * sparingly (StatusCard's value, the farm-context card's headline number).
   */
  stat: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    lineHeight: 27,
    color: colors.text.primary,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.text.primary,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  bodyMedium: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  micro: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.muted,
  },
  microMedium: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.secondary,
  },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
