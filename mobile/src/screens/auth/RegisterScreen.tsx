import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { colors, layout } from '@/theme';

import { validateEmail, validateName, validatePassword } from './validation';

type Props = { onGoToLogin: () => void };

export function RegisterScreen({ onGoToLogin }: Props) {
  const { t } = useTranslation();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const nameError = validateName(fullName);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (nameError || emailError || passwordError) {
      setFieldErrors({
        fullName: nameError ? t(nameError) : undefined,
        email: emailError ? t(emailError) : undefined,
        password: passwordError ? t(passwordError) : undefined,
      });
      return;
    }

    setFieldErrors({});
    setFormErrorKey(null);
    setSubmitting(true);

    const result = await signUp({ email, password, fullName });
    setSubmitting(false);

    if (!result.ok) setFormErrorKey(result.errorKey);
    // On success Supabase returns a session immediately (email confirmation is
    // off for Phase 1), and the auth listener moves the farmer to onboarding.
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
            <Text variant="title">{t('auth.registerTitle')}</Text>
            <Text variant="caption">{t('auth.registerSubtitle')}</Text>
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
              label={t('auth.nameLabel')}
              placeholder={t('auth.namePlaceholder')}
              value={fullName}
              onChangeText={setFullName}
              error={fieldErrors.fullName}
              autoCapitalize="words"
              autoComplete="name"
              testID="register-name"
            />
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
              testID="register-email"
            />
            <Input
              label={t('auth.passwordLabel')}
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              secure
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              testID="register-password"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('auth.register')}
            onPress={handleSubmit}
            loading={submitting}
            testID="register-submit"
          />
          <Pressable onPress={onGoToLogin} style={styles.switch} accessibilityRole="link">
            <Text variant="caption">{t('auth.haveAccount')} </Text>
            <Text variant="bodyMedium" color={colors.primary}>
              {t('auth.goToLogin')}
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
  fields: { gap: 16 },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 24, gap: 14 },
  switch: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
});
