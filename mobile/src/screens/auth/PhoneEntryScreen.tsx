import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, IconBadge, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { colors, layout } from '@/theme';

import { normalizePhone, validatePhone } from './validation';

type Props = { onOtpSent: (normalizedPhone: string, devCode: string) => void };

/**
 * Phone-first signup/login, screen 1 of 2 (task spec: Phone → OTP → Home).
 * Replaces the old email/password Login/Register pair in `AuthNavigator` —
 * those screens and their validators stay in the repo unmodified (still
 * unit-tested) but are no longer routed to.
 */
export function PhoneEntryScreen({ onOtpSent }: Props) {
  const { t } = useTranslation();
  const { requestPhoneOtp } = useAuth();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const validationError = validatePhone(phone);
    if (validationError) {
      setError(t(validationError));
      return;
    }

    setError(null);
    setFormErrorKey(null);
    setSubmitting(true);

    const normalized = normalizePhone(phone);
    const result = await requestPhoneOtp(normalized);
    setSubmitting(false);

    if (!result.ok) {
      setFormErrorKey(result.errorKey);
      return;
    }
    onOtpSent(normalized, result.devCode);
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <IconBadge icon="field" tone="primary" size={64} iconSize={30} />
            <Text variant="bodyMedium" color={colors.primaryDark}>
              {t('common.appName')}
            </Text>
          </View>

          <View style={styles.intro}>
            <Text variant="title" center>{t('auth.phoneTitle')}</Text>
            <Text variant="caption" center style={styles.subtitle}>
              {t('auth.phoneSubtitle')}
            </Text>
          </View>

          {formErrorKey ? (
            <Banner
              title={t(formErrorKey)}
              tone="danger"
              onDismiss={() => setFormErrorKey(null)}
              dismissLabel={t('common.cancel')}
            />
          ) : null}

          <Input
            label={t('auth.phoneLabel')}
            placeholder={t('auth.phonePlaceholder')}
            value={phone}
            onChangeText={setPhone}
            error={error}
            leading={<Text variant="bodyMedium">+91</Text>}
            keyboardType="phone-pad"
            maxLength={10}
            autoComplete="tel"
            textContentType="telephoneNumber"
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
            testID="phone-input"
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('common.continue')}
            onPress={handleSubmit}
            loading={submitting}
            testID="phone-submit"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 20,
  },
  brand: { alignItems: 'center', gap: 8, marginBottom: 8 },
  intro: { gap: 6 },
  subtitle: {},
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 24, gap: 14 },
});
