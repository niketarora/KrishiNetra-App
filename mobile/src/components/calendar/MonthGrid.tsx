import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme';
import { buildMonthGrid, toIsoDate } from '@/utils/calendar';

type Props = {
  /** Any date within the month to render. */
  month: Date;
  /** ISO yyyy-mm-dd, or null when nothing is selected. */
  selectedDate: string | null;
  /** Dates (ISO) that should show an event dot. */
  markedDates: Set<string>;
  onSelectDate: (date: string) => void;
};

const WEEKDAY_REFERENCE = new Date(2024, 0, 1); // a Monday, so index 0..6 maps Mon..Sun.

/**
 * A plain Monday-first month grid — flexbox rows of `Pressable` day cells, no
 * calendar library. `buildMonthGrid` (in `utils/calendar.ts`) does the date
 * math; this component only lays it out and reports taps.
 */
export function MonthGrid({ month, selectedDate, markedDates, onSelectDate }: Props) {
  const cells = buildMonthGrid(month);
  const todayIso = toIsoDate(new Date());
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const weekdayLabel = (index: number) => {
    const date = new Date(WEEKDAY_REFERENCE);
    date.setDate(date.getDate() + index);
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date).slice(0, 2);
  };

  return (
    <View testID="month-grid">
      <View style={styles.weekRow}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} variant="micro" center style={styles.weekdayCell}>
            {weekdayLabel(i)}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day, dayIndex) => {
            if (!day) return <View key={dayIndex} style={styles.dayCell} />;

            const iso = toIsoDate(day);
            const isSelected = iso === selectedDate;
            const isToday = iso === todayIso;
            const hasEvent = markedDates.has(iso);

            return (
              <Pressable
                key={dayIndex}
                onPress={() => onSelectDate(iso)}
                style={styles.dayCell}
                testID={`calendar-day-${iso}`}
                accessibilityRole="button"
              >
                <View
                  style={[
                    styles.dayCircle,
                    isToday && !isSelected && styles.dayCircleToday,
                    isSelected && styles.dayCircleSelected,
                  ]}
                >
                  <Text
                    variant={isToday ? 'bodyMedium' : 'body'}
                    color={
                      isSelected ? colors.text.onPrimary : isToday ? colors.primaryDark : colors.text.primary
                    }
                  >
                    {day.getDate()}
                  </Text>
                </View>
                <View style={[styles.dot, hasEvent && styles.dotVisible]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row' },
  weekdayCell: { flex: 1, paddingVertical: 6 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 2 },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayCircleSelected: { backgroundColor: colors.primary },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  // Event dots are purple: every date they mark is demo/sample data.
  dotVisible: { backgroundColor: colors.demo.fg },
});
