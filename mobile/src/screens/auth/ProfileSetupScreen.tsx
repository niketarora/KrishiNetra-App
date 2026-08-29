import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Banner, Button, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { updateProfile } from '@/services/profiles';
import { colors, layout } from '@/theme';

import { validateEmail, validateName } from './validation';

/**
 * Shown once, right after a farmer's first successful phone verification —
 * gated in `RootNavigator` on `profile.full_name` being empty, the same
 * state-driven pattern the farm-registration gate already uses. Saving
 * updates the profile and calls `refreshProfile()`, which flips that gate off
 * and lets `RootNavigator` fall through to Onboarding/Main on its own; there
 * is no imperative "navigate to Home" here.
 */
export function ProfileSetupScreen() {
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<(typeof SUPPORTED_LANGUAGES)[number]['code']>('en');
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string }>({});
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const nameError = validateName(fullName);
    // Email is optional — only validated when the farmer actually typed one.
    const emailError = email.trim() ? validateEmail(email) : null;

    if (nameError || emailError) {
      setFieldErrors({
        fullName: nameError ? t(nameError) : undefined,
        email: emailError ? t(emailError) : undefined,
      });
      return;
    }

    setFieldErrors({});
    setFormErrorKey(null);
    setSubmitting(true);

    try {
      if (user) {
        await updateProfile(user.id, {
          full_name: fullName.trim(),
          email: email.trim() || null,
          language,
        });
      }
      await refreshProfile();
    } catch {
      setFormErrorKey('errors.generic');
    } finally {
      setSubmitting(false);
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
            <Text variant="title">{t('profileSetup.title')}</Text>
            <Text variant="caption">{t('profileSetup.subtitle')}</Text>
          </View>

          {formErrorKey ? <Banner title={t(formErrorKey)} tone="danger" /> : null}

          <View style={styles.fields}>
            <Input
              label={t('auth.nameLabel')}
              placeholder={t('auth.namePlaceholder')}
              value={fullName}
              onChangeText={setFullName}
              error={fieldErrors.fullName}
              autoCapitalize="words"
              autoComplete="name"
              testID="profile-setup-name"
            />
            <Input
              label={`${t('auth.emailLabel')} (${t('profileSetup.emailOptional')})`}
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              error={fieldErrors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              testID="profile-setup-email"
            />

            <View>
              <Text variant="caption" style={styles.languageLabel}>
                {t('profile.language')}
              </Text>
              <View style={styles.languageRow}>
                {SUPPORTED_LANGUAGES.map((option) => (
                  <Pressable
                    key={option.code}
                    onPress={() => setLanguage(option.code)}
                    style={[styles.languageChip, language === option.code && styles.languageChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: language === option.code }}
                    testID={`profile-setup-language-${option.code}`}
                  >
                    <Text
                      variant="bodyMedium"
                      color={language === option.code ? colors.text.onPrimary : colors.text.primary}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('profileSetup.saveCta')}
            onPress={handleSubmit}
            loading={submitting}
            testID="profile-setup-submit"
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
  intro: { gap: 6 },
  fields: { gap: 16 },
  languageLabel: { marginBottom: 6 },
  languageRow: { flexDirection: 'row', gap: 10 },
  languageChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  languageChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 24, gap: 14 },
});
