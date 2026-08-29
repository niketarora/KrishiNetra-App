import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone, Card, EmptyState, Icon, Screen, ScreenHeader, Text } from '@/components/ui';
import { demoCommunicationProvider } from '@/features/alerts/communicationProvider';
import type { AlertChannel, AlertPriority, ChannelStatus } from '@/features/alerts/types';
import { sampleDate } from '@/features/demo/demoMode';
import { localize } from '@/utils/localizedText';
import { colors, layout, radius } from '@/theme';

type Props = {
  alertId: string;
  onBack: () => void;
};

const PRIORITY_TONES: Record<AlertPriority, BadgeTone> = {
  high: 'danger',
  medium: 'warning',
  info: 'accent',
};

const CHANNEL_TONES: Record<ChannelStatus, BadgeTone> = {
  sent: 'success',
  initiated: 'success',
  notSent: 'neutral',
};

export function AlertDetailScreen({ alertId, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const alert = demoCommunicationProvider.getEvent(alertId);

  if (!alert) {
    return (
      <Screen>
        <ScreenHeader title={t('alerts.title')} onBack={onBack} />
        <EmptyState
          icon="bell"
          title={t('alerts.notFoundTitle')}
          body={t('alerts.notFoundBody')}
          testID="alert-not-found"
        />
      </Screen>
    );
  }

  const date = sampleDate(alert.occurredDaysAgo);
  date.setHours(alert.occurredHour, alert.occurredMinute, 0, 0);
  const timestamp = `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

  const channelEntries = Object.entries(alert.channels) as [AlertChannel, ChannelStatus][];

  return (
    <Screen>
      <ScreenHeader title={localize(alert.title, i18n.language)} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.metaRow}>
          <Badge label={t(`alerts.priority.${alert.priority}`)} tone={PRIORITY_TONES[alert.priority]} />
          <Badge label={t(`alerts.categories.${alert.category}`)} tone="neutral" />
        </View>

        <Text variant="caption" color={colors.text.muted}>
          {alert.location} · {timestamp}
        </Text>

        <Card>
          <Text variant="body">{localize(alert.body, i18n.language)}</Text>
        </Card>

        <View style={styles.demoNotice} testID="alert-demo-notice">
          <Icon name="help" size={16} color={colors.accent} strokeWidth={1.8} />
          <Text variant="microMedium" color={colors.accent} style={styles.demoNoticeText}>
            {t('alerts.demoNotice')}
          </Text>
        </View>

        <Card style={styles.channelsCard}>
          <Text variant="caption">{t('alerts.title')}</Text>
          {channelEntries.length === 0 ? (
            <Text variant="body" color={colors.text.muted}>
              {t('alerts.status.notSent')}
            </Text>
          ) : (
            channelEntries.map(([channel, status]) => (
              <View key={channel} style={styles.channelRow}>
                <Text variant="bodyMedium">{t(`alerts.channels.${channel}`)}</Text>
                <Badge label={t(`alerts.status.${status}`)} tone={CHANNEL_TONES[status]} />
              </View>
            ))
          )}
        </Card>
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md,
  },
  demoNoticeText: { flex: 1 },
  channelsCard: { gap: 10 },
  channelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
