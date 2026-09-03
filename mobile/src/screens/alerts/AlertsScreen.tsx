import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  type BadgeTone,
  Card,
  EmptyState,
  Icon,
  IconBadge,
  type IconBadgeTone,
  SampleBadge,
  Screen,
  ScreenHeader,
  Text,
  type IconName,
} from '@/components/ui';
import { demoCommunicationProvider } from '@/features/alerts/communicationProvider';
import type { AlertCategory, AlertChannel, AlertEvent, AlertPriority, ChannelStatus } from '@/features/alerts/types';
import { sampleDate } from '@/features/demo/demoMode';
import { localize } from '@/utils/localizedText';
import { colors, fonts, layout, radius } from '@/theme';

type Props = {
  onBack: () => void;
  onOpenAlert: (alertId: string) => void;
};

const PRIORITY_TONES: Record<AlertPriority, BadgeTone> = {
  high: 'danger',
  medium: 'warning',
  info: 'accent',
};

const CATEGORY_ICONS: Record<AlertCategory, IconName> = {
  weather: 'sun',
  disaster: 'alert',
  government: 'help',
  advisory: 'plant',
  cropHealth: 'plant',
};

const CATEGORY_TONES: Record<AlertCategory, IconBadgeTone> = {
  weather: 'accent',
  disaster: 'danger',
  government: 'harvest',
  advisory: 'primary',
  cropHealth: 'primary',
};

const CHANNEL_TONES: Record<ChannelStatus, BadgeTone> = {
  sent: 'success',
  initiated: 'success',
  notSent: 'neutral',
};

function relativeDate(daysAgo: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (daysAgo <= 0) return t('alerts.today');
  if (daysAgo === 1) return t('alerts.yesterday');
  return t('alerts.daysAgo', { count: daysAgo });
}

function formatDateTime(alert: AlertEvent): string {
  const date = sampleDate(alert.occurredDaysAgo);
  date.setHours(alert.occurredHour, alert.occurredMinute, 0, 0);
  const dateStr = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${timeStr}`;
}

/**
 * Alert / Communication History — task's "convincing prototype UI" showing
 * that KrishiNetra can eventually notify farmers of high-priority events by
 * SMS/voice. Every entry here is demo data (`features/alerts/demoAlerts.ts`);
 * this screen is deliberately never gated behind `EXPO_PUBLIC_DEMO_MODE`,
 * unlike the sourceless Home/History tiles — it is the actual, permanent
 * Alerts surface, mirroring how `UpdatesScreen` always shows its demo feed.
 */
export function AlertsScreen({ onBack, onOpenAlert }: Props) {
  const { t, i18n } = useTranslation();
  const alerts = demoCommunicationProvider.getHistory();

  const renderAlert = (alert: AlertEvent) => {
    const channelEntries = Object.entries(alert.channels) as [AlertChannel, ChannelStatus][];

    return (
      <Card
        key={alert.id}
        onPress={() => onOpenAlert(alert.id)}
        style={styles.alertCard}
        testID={`alert-card-${alert.id}`}
      >
        <View style={styles.headerRow}>
          <Badge label={t(`alerts.priority.${alert.priority}`)} tone={PRIORITY_TONES[alert.priority]} />
          <SampleBadge testID={`alert-sample-badge-${alert.id}`} />
        </View>

        <View style={styles.titleRow}>
          <IconBadge icon={CATEGORY_ICONS[alert.category]} tone={CATEGORY_TONES[alert.category]} />
          <Text variant="bodyMedium" style={styles.title}>
            {localize(alert.title, i18n.language)}
          </Text>
        </View>

        <Text variant="caption" color={colors.text.muted}>
          {t(`alerts.categories.${alert.category}`)} · {alert.location}
        </Text>
        <Text variant="caption" style={styles.summary}>
          {localize(alert.body, i18n.language)}
        </Text>

        <View style={styles.channelRow}>
          {channelEntries.map(([channel, status]) => (
            <Badge
              key={channel}
              label={`${t(`alerts.channels.${channel}`)} · ${t(`alerts.status.${status}`)}`}
              tone={CHANNEL_TONES[status]}
            />
          ))}
        </View>

        <View style={styles.timestampRow}>
          <Icon name="clock" size={13} color={colors.text.muted} />
          <Text variant="micro" color={colors.text.muted} style={styles.timestamp}>
            {relativeDate(alert.occurredDaysAgo, t)} · {formatDateTime(alert)}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <Screen>
      <ScreenHeader
        title={t('alerts.title')}
        subtitle="मौसम, आपदा, योजना और सलाह की सूचनाएं"
        onBack={onBack}
        right={
          <View style={styles.headerIconBtn}>
            <Icon name="bell" size={20} color={colors.text.primary} />
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="caption" color={colors.text.muted}>{t('alerts.intro')}</Text>

        <View style={styles.sampleBanner} testID="alerts-sample-banner">
          <Icon name="help" size={18} color={colors.accent} strokeWidth={1.8} />
          <View style={styles.sampleBannerBody}>
            <Text variant="microMedium" color={colors.accent}>
              {t('alerts.sampleBannerTitle')}
            </Text>
            <Text variant="micro" color={colors.text.secondary}>
              {t('alerts.sampleBannerBody')}
            </Text>
          </View>
        </View>

        {alerts.length === 0 ? (
          <EmptyState icon="bell" title={t('alerts.emptyTitle')} testID="alerts-empty" />
        ) : (
          alerts.map(renderAlert)
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 110,
    gap: layout.cardGap,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
  },
  sampleBannerBody: { flex: 1, gap: 2 },
  alertCard: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 16 },
  summary: { marginTop: 2, lineHeight: 18 },
  channelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timestamp: { fontSize: 12 },
});
