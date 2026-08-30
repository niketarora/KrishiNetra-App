import { addMonths, buildMonthGrid, startOfMonth, toIsoDate } from './calendar';

describe('toIsoDate', () => {
  it('formats as yyyy-mm-dd', () => {
    expect(toIsoDate(new Date(2026, 7, 27))).toBe('2026-08-27');
  });
});

describe('startOfMonth', () => {
  it('resets to the 1st of the given month', () => {
    const result = startOfMonth(new Date(2026, 7, 27));
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(7);
    expect(result.getFullYear()).toBe(2026);
  });
});

describe('addMonths', () => {
  it('moves forward within the same year', () => {
    const result = addMonths(new Date(2026, 7, 15), 1);
    expect(result.getMonth()).toBe(8);
    expect(result.getFullYear()).toBe(2026);
  });

  it('rolls over into the next year', () => {
    const result = addMonths(new Date(2026, 11, 15), 1);
    expect(result.getMonth()).toBe(0);
    expect(result.getFullYear()).toBe(2027);
  });

  it('moves backward', () => {
    const result = addMonths(new Date(2026, 0, 15), -1);
    expect(result.getMonth()).toBe(11);
    expect(result.getFullYear()).toBe(2025);
  });
});

describe('buildMonthGrid', () => {
  it('pads August 2026 (starts on a Saturday) with 5 leading blanks', () => {
    const grid = buildMonthGrid(new Date(2026, 7, 1));

    // 1 Aug 2026 is a Saturday — Monday-first index 5.
    expect(grid.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(grid[5]?.getDate()).toBe(1);
  });

  it('includes every day of the month exactly once', () => {
    const grid = buildMonthGrid(new Date(2026, 7, 1));
    const days = grid.filter((cell): cell is Date => cell !== null).map((cell) => cell.getDate());

    expect(days).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it('always returns a whole number of 7-day weeks', () => {
    for (let month = 0; month < 12; month += 1) {
      const grid = buildMonthGrid(new Date(2026, month, 1));
      expect(grid.length % 7).toBe(0);
    }
  });

  it('pads February in a non-leap year to 28 days', () => {
    const grid = buildMonthGrid(new Date(2026, 1, 1));
    const days = grid.filter((cell): cell is Date => cell !== null);

    expect(days).toHaveLength(28);
  });
});
