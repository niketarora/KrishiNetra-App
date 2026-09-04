import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone, Card, EmptyState, Icon, Screen, ScreenHeader, Text } from '@/components/ui';
import { demoCommunicationProvider } from '@/features/alerts/communicationProvider';
import type { AlertChannel, AlertPriority, ChannelStatus } from '@/features/alerts/types';
import { sampleDate } from '@/features/demo/demoMode';
import { makeAlertCall, sendAlertSms } from '@/services/notifications';
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

  const [smsStatus, setSmsStatus] = useState<ChannelStatus>(alert?.channels.sms ?? 'notSent');
  const [voiceStatus, setVoiceStatus] = useState<ChannelStatus>(alert?.channels.voice ?? 'notSent');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  const handleSendSms = async () => {
    if (isSendingSms) return;
    setIsSendingSms(true);
    setFeedback(null);
    try {
      const message = `${localize(alert.title, i18n.language)}: ${localize(alert.body, i18n.language)}`;
      const result = await sendAlertSms({
        phone,
        message,
        alertId: alert.id,
      });
      setSmsStatus('sent');
      setFeedback({
        message: result.simulated
          ? `${t('alerts.smsSuccess')} (${t('alerts.simulatedNotice')})`
          : t('alerts.smsSuccess'),
        type: 'success',
      });
    } catch {
      setFeedback({ message: t('alerts.smsError'), type: 'error' });
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleMakeCall = async () => {
    if (isCalling) return;
    setIsCalling(true);
    setFeedback(null);
    try {
      const message = `${localize(alert.title, i18n.language)}. ${localize(alert.body, i18n.language)}`;
      const result = await makeAlertCall({
        phone,
        message,
        language: i18n.language,
        alertId: alert.id,
      });
      setVoiceStatus('initiated');
      setFeedback({
        message: result.simulated
          ? `${t('alerts.callSuccess')} (${t('alerts.simulatedNotice')})`
          : t('alerts.callSuccess'),
        type: 'success',
      });
    } catch {
      setFeedback({ message: t('alerts.callError'), type: 'error' });
    } finally {
      setIsCalling(false);
    }
  };

  const date = sampleDate(alert.occurredDaysAgo);
  date.setHours(alert.occurredHour, alert.occurredMinute, 0, 0);
  const timestamp = `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

  const channelEntries: [AlertChannel, ChannelStatus][] = [];
  if (alert.channels.sms !== undefined || smsStatus !== 'notSent') {
    channelEntries.push(['sms', smsStatus]);
  }
  if (alert.channels.voice !== undefined || voiceStatus !== 'notSent') {
    channelEntries.push(['voice', voiceStatus]);
  }

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

        <Card style={styles.actionCard}>
          <Text variant="caption">{t('alerts.sendActionTitle')}</Text>

          <View style={styles.phoneInputContainer}>
            <Text variant="caption" color={colors.text.muted}>
              {t('alerts.phoneLabel')}
            </Text>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.text.muted}
              keyboardType="phone-pad"
              accessibilityLabel={t('alerts.phoneLabel')}
              testID="alert-phone-input"
            />
          </View>

          {feedback ? (
            <View
              style={[
                styles.feedbackBox,
                feedback.type === 'error' ? styles.feedbackBoxError : styles.feedbackBoxSuccess,
              ]}
              testID="alert-feedback-banner"
            >
              <Icon
                name={feedback.type === 'error' ? 'close' : 'check'}
                size={16}
                color={feedback.type === 'error' ? colors.danger : colors.success}
              />
              <Text
                variant="caption"
                color={feedback.type === 'error' ? colors.danger : colors.success}
                style={styles.feedbackText}
              >
                {feedback.message}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionButtonsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.smsBtn,
                pressed && styles.btnPressed,
                isSendingSms && styles.btnDisabled,
              ]}
              onPress={handleSendSms}
              disabled={isSendingSms || isCalling}
              accessibilityRole="button"
              accessibilityLabel={t('alerts.sendSms')}
              testID="send-alert-sms-button"
            >
              {isSendingSms ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <View style={styles.btnContent}>
                  <Icon name="mail" size={18} color={colors.surface} />
                  <Text variant="bodyMedium" color={colors.surface}>
                    {t('alerts.sendSms')}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.callBtn,
                pressed && styles.btnPressed,
                isCalling && styles.btnDisabled,
              ]}
              onPress={handleMakeCall}
              disabled={isSendingSms || isCalling}
              accessibilityRole="button"
              accessibilityLabel={t('alerts.makeCall')}
              testID="make-alert-call-button"
            >
              {isCalling ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <View style={styles.btnContent}>
                  <Icon name="phone" size={18} color={colors.surface} />
                  <Text variant="bodyMedium" color={colors.surface}>
                    {t('alerts.makeCall')}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
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
  actionCard: { gap: 14 },
  phoneInputContainer: { gap: 6 },
  phoneInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: colors.neutralBg,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
  },
  feedbackBoxSuccess: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  feedbackBoxError: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  feedbackText: { flex: 1 },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  smsBtn: {
    backgroundColor: colors.primary,
  },
  callBtn: {
    backgroundColor: colors.success,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
