/**
 * Design tokens from ui-designs/design.md §1.1, confirmed against the inline
 * styles in the `Farmer App.dc.html` prototype. Do not introduce colours that
 * are not in this file.
 */
export const colors = {
  primary: '#1E4D2B',
  primaryDark: '#133E21',

  bg: '#FBFBFA',
  surface: '#FFFFFF',
  border: '#E5E8E2',
  /** Outline-button / secondary-control border — heavier than `border`. */
  borderStrong: '#C8CEC4',
  /** Neutral banner + pressed-surface tint. */
  neutralBg: '#F1F3EE',

  success: '#2E7D4F',
  successBg: '#EAF4EC',
  successBorder: '#CDE3D2',

  warning: '#B8720A',
  warningBg: '#FEF3C7',

  danger: '#DC2626',
  dangerBg: '#FEE2E2',

  accent: '#0284C7',
  accentBg: '#E0F2FE',
  accentBorder: '#BAE6FD',
  accentBadgeBg: '#E0F2FE',
  accentBadgeFg: '#0369A1',

  /**
   * Earth/harvest accent — used sparingly for a featured highlight or a farm
   * context card border, never as a primary action colour.
   */
  harvest: '#A9682E',
  harvestBg: '#FBF3E8',
  harvestBorder: '#EED9BF',

  text: {
    primary: '#1C251D',
    secondary: '#5C685F',
    muted: '#7A867D',
    onPrimary: '#FFFFFF',
  },

  /** Badges & Tag pills matching reference design */
  badges: {
    sampleBg: '#F3E8FF',
    sampleFg: '#7C3AED',
    sampleBorder: '#DDD6FE',
    radarBg: '#E0F2FE',
    radarFg: '#0284C7',
    radarBorder: '#BAE6FD',
    highPriorityBg: '#FEE2E2',
    highPriorityFg: '#DC2626',
    mediumPriorityBg: '#FEF3C7',
    mediumPriorityFg: '#D97706',
    schemeBg: '#E6F4EA',
    schemeFg: '#137333',
    statusTagBg: '#EAF4EC',
    statusTagFg: '#1E4D2B',
  },

  /**
   * Sample-data violet. Deliberately OUTSIDE the design language.
   */
  demo: {
    fg: '#7C3AED',
    bg: '#F3E8FF',
    border: '#DDD6FE',
  },

  /** Satellite-map placeholder base, used behind tiles while they load. */
  mapBase: '#6F6F68',
  /** Polygon fill on the drawing map — green at 34% opacity. */
  polygonFill: 'rgba(30,77,43,0.34)',
  /** Polygon fill on small static thumbnails — slightly denser. */
  polygonFillThumb: 'rgba(30,77,43,0.42)',
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
