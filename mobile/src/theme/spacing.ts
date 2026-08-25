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
  /** Minimum touch target — design.md §7. */
  touchTarget: 44,
  primaryButtonHeight: 48,
  secondaryButtonHeight: 44,
  fabSize: 56,
} as const;

/**
 * The prototype is flat: square corners, hairline borders, no shadows. Only
 * the FAB and status dots are round. `design.md` §1.4 still describes a 12dp
 * radius — the prototype is the newer artifact and wins.
 */
export const radius = {
  none: 0,
  pill: 999,
} as const;
