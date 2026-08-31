/**
 * Design tokens from ui-designs/design.md §1.1, confirmed against the inline
 * styles in the `Farmer App.dc.html` prototype. Do not introduce colours that
 * are not in this file.
 */
export const colors = {
  primary: '#2E7D4F',
  primaryDark: '#1B5236',

  bg: '#F7F8F4',
  surface: '#FFFFFF',
  border: '#E2E4DC',
  /** Outline-button / secondary-control border — heavier than `border`. */
  borderStrong: '#C6CABF',
  /** Neutral banner + pressed-surface tint. */
  neutralBg: '#EDEEE9',

  success: '#3E8F5C',
  successBg: '#E8F5EC',
  successBorder: '#CBE4D5',

  warning: '#B8720A',
  warningBg: '#FBEEDC',

  danger: '#B23A2E',
  dangerBg: '#FBE7E4',

  accent: '#1E6FA8',
  accentBg: '#E6F1FA',
  accentBorder: '#C9DDEE',
  accentBadgeBg: '#D3E4F2',
  accentBadgeFg: '#15537D',

  /**
   * Earth/harvest accent — used sparingly for a featured highlight or a farm
   * context card border, never as a primary action colour. Deliberately a
   * warmer, browner tone than `warning` so the two don't read as the same
   * signal when they appear near each other.
   */
  harvest: '#A9682E',
  harvestBg: '#F5E9D8',
  harvestBorder: '#E6CFA8',

  text: {
    primary: '#1C1F1A',
    secondary: '#5B6058',
    // Darkened from the original #8B8F86 — that was borderline low-contrast
    // on `bg`/`surface` for a field-under-sunlight prototype. Still visibly
    // lighter than `secondary`, just no longer faint.
    muted: '#70766C',
    onPrimary: '#FFFFFF',
  },

  /**
   * Sample-data violet. Deliberately OUTSIDE the design language.
   *
   * Everything else in this file is the product's palette, so a value wearing
   * these colours reads as foreign at a glance — which is the entire point.
   * They appear only under DEMO_MODE, always behind a "SAMPLE DATA" badge, and
   * never in a shipped build. See `features/demo/demoMode.ts`.
   */
  demo: {
    fg: '#6B21A8',
    bg: '#F5EBFF',
    border: '#D8B4FE',
  },

  /** Satellite-map placeholder base, used behind tiles while they load. */
  mapBase: '#6F6F68',
  /** Polygon fill on the drawing map — green at 34% opacity. */
  polygonFill: 'rgba(62,143,92,0.34)',
  /** Polygon fill on small static thumbnails — slightly denser. */
  polygonFillThumb: 'rgba(62,143,92,0.42)',
} as const;

/**
 * The avatar overlay is a dark, full-screen surface with its own palette.
 * Prototype: `Farmer App.dc.html`, the `voiceOpen` block.
 */
export const avatarColors = {
  shell: '#151714',
  stage: '#1E211C',
  headerSubtitle: '#9AA396',
  chipBorder: '#3A4036',
  chipText: '#DDE2D8',
  chipPressed: '#23271F',
  footerHint: '#6E7669',
  scrimTop: 'rgba(10,12,9,0)',
  scrimBottom: 'rgba(10,12,9,0.92)',
  scrimMid: 'rgba(10,12,9,0.62)',
  pillBg: 'rgba(10,12,9,0.62)',
  sourceChip: 'rgba(46,125,79,0.9)',

  errorBlockBg: '#2A1D1A',
  errorText: '#E2857A',
  endButtonBg: '#3A1E1A',
  endButtonBorder: '#6A2E27',
  endButtonPressed: '#4A2621',

  /** Per-state accent — drives the live dot, status text and waveform. */
  state: {
    idle: '#9AA396',
    listening: '#7FC69B',
    thinking: '#D8B77A',
    speaking: '#8FC2E8',
    // Guiding shares the speaking blue: the avatar is still talking, it is
    // just walking the farmer somewhere while it does. A separate colour would
    // imply a separate kind of activity.
    guiding: '#8FC2E8',
    error: '#E2857A',
  },
  waveIdle: '#4A5145',
} as const;

/**
 * The corner guide.
 *
 * A light surface, unlike the dark full-screen avatar it replaced. The peek
 * sits over the live app rather than covering it, so it has to read as part of
 * the app's own palette instead of as a separate dark world.
 */
export const guideColors = {
  bubbleBg: '#FFFFFF',
  bubbleBorder: '#D5DBCF',
  /** The green panel the avatar leans on, matched so the bubble joins it. */
  panel: '#5C7A3F',
  scrim: 'rgba(10,12,9,0.05)',
} as const;
