/** Spacing scale from design.md §1.3. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const layout = {
  /** Horizontal padding on every screen except the map (edge-to-edge). */
  screenPadding: 16,
  /** Internal padding of a card. */
  cardPadding: 14,
  /** Vertical gap between stacked cards. */
  cardGap: 12,
  /** Header row height. */
  headerHeight: 56,
  /** Bottom navigation bar height. */
  navHeight: 60,
  /** Minimum touch target — bumped to 48dp for comfortable outdoor/gloved use. */
  touchTarget: 48,
  primaryButtonHeight: 48,
  secondaryButtonHeight: 48,
  fabSize: 56,
} as const;

/**
 * Visual-refinement pass: cards/buttons/inputs now carry real corner
 * radius and a very light elevation instead of the original flat,
 * square-cornered, hairline-only prototype look — still restrained (no pills
 * on buttons, no heavy shadows), just less "developer dashboard."
 */
export const radius = {
  none: 0,
  sm: 8,
  md: 16,
  lg: 20,
  pill: 999,
} as const;
