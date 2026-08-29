import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Card, EmptyState, Icon, SampleBadge, Screen, ScreenHeader, Text } from '@/components/ui';
import { getDemoCalendarEvent } from '@/features/calendar/demoEvents';
import { EVENT_TYPE_ICONS } from '@/features/calendar/eventTypeIcon';
import { useFarm } from '@/features/farm/FarmContext';
import { getCurrentCrop, type CurrentCrop } from '@/services/agronomy';
import { colors, layout } from '@/theme';
import { toIsoDate } from '@/utils/calendar';

type Props = {
  eventId: string;
  onBack: () => void;
};

function cropName(current: CurrentCrop, language: string): string {
  if (language.startsWith('hi') && current.crop.name_hi) return current.crop.name_hi;
  return current.crop.name_en;
}

function formatShortDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * One calendar event, read top to bottom. The event is re-derived from the
 * same pure demo generator the list screen uses (`buildDemoCalendarEvents`,
 * via `getDemoCalendarEvent`), keyed only by `eventId` — the same trick
 * `TutorialDetailScreen` uses for `tutorialId` — so nothing but a string needs
 * to travel through navigation params.
 */
export function CalendarEventDetailScreen({ eventId, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const { farm } = useFarm();
  const [crop, setCrop] = useState<CurrentCrop | null>(null);

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

  const event = farm ? getDemoCalendarEvent(eventId, farm.id, crop?.crop.id ?? null) : null;

  if (!farm || !event) {
    return (
      <Screen>
        <ScreenHeader title={t('calendar.title')} onBack={onBack} />
        <EmptyState
          icon="clock"
          title={t('calendar.eventNotFoundTitle')}
          body={t('calendar.eventNotFoundBody')}
          testID="calendar-event-not-found"
        />
      </Screen>
    );
  }

  const isUpcoming = event.status === 'upcoming';

  return (
    <Screen>
      <ScreenHeader title={t(event.titleKey)} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.typeRow}>
          <Icon name={EVENT_TYPE_ICONS[event.eventType]} size={22} color={colors.demo.fg} />
          <Badge label={t(`calendar.eventTypes.${event.eventType}`)} tone="accent" />
        </View>

        <Card style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text variant="caption">{t('calendar.detail.field')}</Text>
            <Text variant="bodyMedium">{farm.name?.trim() || t('home.unnamedField')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption">{t('calendar.detail.crop')}</Text>
            <Text variant="bodyMedium" color={crop ? undefined : colors.text.muted}>
              {crop ? cropName(crop, i18n.language) : t('home.cropNone')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption">{t('calendar.detail.scheduled')}</Text>
            <Text variant="bodyMedium">{formatShortDate(event.date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text variant="caption">{t('calendar.detail.status')}</Text>
            <Badge
              label={t(isUpcoming ? 'calendar.statusUpcoming' : 'learning.completed')}
              tone={isUpcoming ? 'accent' : 'success'}
            />
          </View>
        </Card>

        <Card>
          <Text variant="caption" style={styles.reasonLabel}>
            {t('calendar.detail.whyShown')}
          </Text>
          <Text variant="body">{t(event.reasonKey)}</Text>
        </Card>

        <View style={styles.demoNotice} testID="calendar-demo-notice">
          <SampleBadge />
          <Text variant="micro" color={colors.text.muted} style={styles.demoNoticeText}>
            {t('calendar.detail.demoNotice')}
          </Text>
        </View>
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
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailCard: { gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reasonLabel: { marginBottom: 6 },
  demoNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  demoNoticeText: { flex: 1 },
});
