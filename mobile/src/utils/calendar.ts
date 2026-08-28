/**
 * Small, pure date helpers for the Smart Farm Calendar's month grid.
 * Same spirit as `utils/geo.ts`: no dependency on the component tree, easy to
 * unit test directly.
 */

/** "2026-08-27" — the grouping key used to match events to a day cell. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * A Monday-first grid of the given month, padded with `null` on both ends so
 * every row has exactly 7 cells — what `MonthGrid` renders directly.
 */
export function buildMonthGrid(date: Date): (Date | null)[] {
  const first = startOfMonth(date);
  // Date#getDay(): 0=Sunday..6=Saturday. Shift so Monday is index 0.
  const leadingBlanks = (first.getDay() + 6) % 7;
  const total = daysInMonth(date);

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(new Date(date.getFullYear(), date.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}
