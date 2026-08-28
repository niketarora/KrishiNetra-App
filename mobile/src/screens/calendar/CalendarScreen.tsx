import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MonthGrid } from '@/components/calendar/MonthGrid';
import { Card, EmptyState, Icon, Screen, ScreenHeader, SampleBanner, Text } from '@/components/ui';
import { isDemoMode } from '@/features/demo/demoMode';
import { buildDemoCalendarEvents } from '@/features/calendar/demoEvents';
import { EVENT_TYPE_ICONS } from '@/features/calendar/eventTypeIcon';
import type { FarmCalendarEvent } from '@/features/calendar/types';
import { useFarm } from '@/features/farm/FarmContext';
import { getCurrentCrop, type CurrentCrop } from '@/services/agronomy';
import { colors, layout } from '@/theme';
import { addMonths, toIsoDate } from '@/utils/calendar';

type Props = {
  onBack: () => void;
  onRegisterLand: () => void;
  onOpenEvent: (eventId: string) => void;
};

/** Show the crop in the farmer's own language — same rule as Home/My Farm. */
function cropName(current: CurrentCrop, language: string): string {
  if (language.startsWith('hi') && current.crop.name_hi) return current.crop.name_hi;
  return current.crop.name_en;
}

/** "21 Aug" — same short-date convention used on Home/Field. */
function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Smart Farm Calendar — Feature #10, v1.
 *
 * Every event on this screen is local demo data (see
 * `features/calendar/demoEvents.ts`), gated behind the same
 * `EXPO_PUBLIC_DEMO_MODE` flag every other fabricated surface in the app
 * uses — there is no irrigation/weather/crop-health engine behind this yet.
 * The month grid itself is real and functional either way.
 *
 * No navigation hook is used here — like `LearningHomeScreen`, this screen
 * only takes navigation callbacks as props, so it renders in a test with no
 * `NavigationContainer`.
 */
export function CalendarScreen({ onBack, onRegisterLand, onOpenEvent }: Props) {
  const { t, i18n } = useTranslation();
  const { farm } = useFarm();

  const [crop, setCrop] = useState<CurrentCrop | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));

  useEffect(() => {
    if (!farm) {
      setCrop(null);
      return;
    }

    let cancelled = false;
    getCurrentCrop(farm.id)
      .then((result) => {
        if (!cancelled) setCrop(result);
      })
      .catch(() => {
        if (!cancelled) setCrop(null);
      });

    return () => {
      cancelled = true;
    };
  }, [farm]);

  const demo = isDemoMode();
  const events: FarmCalendarEvent[] = demo && farm ? buildDemoCalendarEvents(farm.id, crop?.crop.id ?? null) : [];

  const markedDates = new Set(events.map((event) => event.date));
  const selectedDayEvents = events.filter((event) => event.date === selectedDate);
  const upcomingEvents = events
    .filter((event) => event.status === 'upcoming')
    .sort((a, b) => a.date.localeCompare(b.date));

  const relativeLabel = (dateIso: string): string => {
    const diffMs = new Date(`${dateIso}T00:00:00Z`).getTime() - new Date(`${toIsoDate(new Date())}T00:00:00Z`).getTime();
    const diffDays = Math.round(diffMs / 86_400_000);

    if (diffDays === 0) return t('calendar.today');
    if (diffDays === 1) return t('calendar.tomorrow');
    if (diffDays > 1 && diffDays < 7) return t('calendar.inDays', { count: diffDays });
    if (diffDays >= 7 && diffDays < 14) return t('calendar.nextWeek');
    return formatShortDate(dateIso);
  };

  const fieldCropLine = () => {
    const fieldLabel = farm?.name?.trim() || t('home.unnamedField');
    return crop ? `${fieldLabel} · ${cropName(crop, i18n.language)}` : fieldLabel;
  };

  const renderEvent = (event: FarmCalendarEvent) => (
    <Card
      key={event.id}
      onPress={() => onOpenEvent(event.id)}
      style={styles.eventCard}
      testID={`calendar-event-${event.id}`}
    >
      <Icon name={EVENT_TYPE_ICONS[event.eventType]} size={20} color={colors.demo.fg} />
      <View style={styles.eventBody}>
        <Text variant="bodyMedium">{t(event.titleKey)}</Text>
        <Text variant="caption" color={colors.text.muted}>
          {fieldCropLine()}
        </Text>
      </View>
      <Text variant="micro" color={colors.text.muted}>
        {relativeLabel(event.date)}
      </Text>
    </Card>
  );

  return (
    <Screen>
      <ScreenHeader title={t('calendar.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!farm ? (
          <EmptyState
            icon="field"
            title={t('calendar.noFarmTitle')}
            body={t('calendar.noFarmBody')}
            actionLabel={t('myFarm.registerCta')}
            onAction={onRegisterLand}
            testID="calendar-no-farm"
          />
        ) : (
          <>
            {demo ? <SampleBanner /> : null}

            <View style={styles.monthHeader}>
              <Pressable
                onPress={() => setMonth((current) => addMonths(current, -1))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.previousMonth')}
              >
                <Icon name="back" size={20} />
              </Pressable>
              <Text variant="cardTitle">
                {month.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}
              </Text>
              <Pressable
                onPress={() => setMonth((current) => addMonths(current, 1))}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.nextMonth')}
              >
                <Icon name="chevron" size={20} />
              </Pressable>
            </View>

            <MonthGrid
              month={month}
              selectedDate={selectedDate}
              markedDates={markedDates}
              onSelectDate={setSelectedDate}
            />

            {selectedDayEvents.length > 0 ? (
              <View style={styles.section}>
                <Text variant="caption">{formatShortDate(selectedDate)}</Text>
                {selectedDayEvents.map(renderEvent)}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text variant="cardTitle">{t('calendar.upcoming')}</Text>
              {upcomingEvents.length === 0 ? (
                <EmptyState
                  icon="clock"
                  title={t('calendar.noEventsTitle')}
                  body={t('calendar.noEventsBody')}
                  testID="calendar-no-events"
                />
              ) : (
                upcomingEvents.map(renderEvent)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 32,
    gap: layout.cardGap,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: { gap: layout.cardGap, marginTop: 4 },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventBody: { flex: 1, minWidth: 0, gap: 2 },
});
