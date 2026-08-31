import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { colors, layout } from '@/theme';
import { maskPhone } from '@/utils/format';

import { validateOtp } from './validation';

const RESEND_COOLDOWN_SECONDS = 30;

type Props = {
  normalizedPhone: string;
  /** The just-issued demo code, shown on screen since there is no SMS to receive it by. */
  initialDevCode: string;
  onBack: () => void;
};

/**
 * Phone-first signup/login, screen 2 of 2. The demo OTP banner is the one
 * deliberate departure from a real OTP screen — see `features/auth/demoOtp.ts`
 * for why the code is shown here rather than texted.
 */
export function OtpVerifyScreen({ normalizedPhone, initialDevCode, onBack }: Props) {
  const { t } = useTranslation();
  const { requestPhoneOtp, verifyPhoneOtp } = useAuth();

  const [devCode, setDevCode] = useState(initialDevCode);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async () => {
    const validationError = validateOtp(code);
    if (validationError) {
      setError(t(validationError));
      return;
    }

    setError(null);
    setFormErrorKey(null);
    setSubmitting(true);

    const result = await verifyPhoneOtp(normalizedPhone, code);
    setSubmitting(false);

    // On success the auth listener swaps the navigator out from under us —
    // there is nothing to navigate to by hand (same pattern as LoginScreen).
    if (!result.ok) setFormErrorKey(result.errorKey);
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setFormErrorKey(null);

    const result = await requestPhoneOtp(normalizedPhone);
    setResending(false);

    if (result.ok) {
      setDevCode(result.devCode);
      setCode(result.devCode);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else {
      setFormErrorKey(result.errorKey);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text variant="title">{t('auth.otpTitle')}</Text>
            <Text variant="caption" style={styles.subtitle}>
              {t('auth.otpSentTo')}: {maskPhone(`+91${normalizedPhone}`)}
            </Text>
          </View>

          <View style={styles.demoBanner} testID="demo-otp-banner">
            <Text variant="microMedium" color={colors.demo.fg} style={styles.demoBannerTitle}>
              {t('auth.demoOtpBannerTitle')}
            </Text>
            <Text variant="body" color={colors.demo.fg} testID="demo-otp-code">
              {t('auth.demoOtpBannerBody', { code: devCode })}
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
            label={t('auth.otpLabel')}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            error={error}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.otpInput}
            onSubmitEditing={handleVerify}
            returnKeyType="go"
            testID="otp-input"
          />

          <Pressable
            onPress={cooldown > 0 || resending ? undefined : handleResend}
            disabled={cooldown > 0 || resending}
            accessibilityRole="button"
            testID="resend-otp"
          >
            <Text variant="microMedium" color={cooldown > 0 ? colors.text.muted : colors.primary}>
              {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resendOtp')}
            </Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Button label={t('auth.verify')} onPress={handleVerify} loading={submitting} testID="otp-submit" />
          <Pressable onPress={onBack} style={styles.switch} accessibilityRole="link">
            <Text variant="bodyMedium" color={colors.primary}>
              {t('auth.changeNumber')}
            </Text>
          </Pressable>
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
    gap: 16,
  },
  intro: { gap: 6 },
  subtitle: {},
  demoBanner: {
    padding: 12,
    backgroundColor: colors.demo.bg,
    borderWidth: 1,
    borderColor: colors.demo.border,
    gap: 2,
  },
  demoBannerTitle: { letterSpacing: 0.6 },
  otpInput: { letterSpacing: 6, fontSize: 20 },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 24, gap: 14 },
  switch: { alignItems: 'center' },
});
