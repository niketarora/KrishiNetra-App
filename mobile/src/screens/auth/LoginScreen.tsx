import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { colors, layout } from '@/theme';

import { validateEmail } from './validation';

type Props = { onGoToRegister: () => void };

export function LoginScreen({ onGoToRegister }: Props) {
  const { t } = useTranslation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const emailError = validateEmail(email);
    const passwordError = password ? null : 'auth.errors.passwordRequired';

    if (emailError || passwordError) {
      setFieldErrors({
        email: emailError ? t(emailError) : undefined,
        password: passwordError ? t(passwordError) : undefined,
      });
      return;
    }

    setFieldErrors({});
    setFormErrorKey(null);
    setSubmitting(true);

    const result = await signIn({ email, password });
    setSubmitting(false);

    // On success the auth listener swaps the navigator out from under us —
    // there is nothing to navigate to by hand.
    if (!result.ok) setFormErrorKey(result.errorKey);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text variant="title">{t('auth.loginTitle')}</Text>
            <Text variant="caption" style={styles.subtitle}>
              {t('auth.loginSubtitle')}
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

          <View style={styles.fields}>
            <Input
              label={t('auth.emailLabel')}
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              error={fieldErrors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              testID="login-email"
            />
            <Input
              label={t('auth.passwordLabel')}
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              secure
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              testID="login-password"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('auth.login')}
            onPress={handleSubmit}
            loading={submitting}
            testID="login-submit"
          />
          <Pressable onPress={onGoToRegister} style={styles.switch} accessibilityRole="link">
            <Text variant="caption">{t('auth.noAccount')} </Text>
            <Text variant="bodyMedium" color={colors.primary}>
              {t('auth.goToRegister')}
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
    gap: 20,
  },
  intro: { gap: 6 },
  subtitle: {},
  fields: { gap: 16 },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 24,
    gap: 14,
  },
  switch: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
});
