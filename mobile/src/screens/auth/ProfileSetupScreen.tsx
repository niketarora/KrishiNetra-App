import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import * as SecureStore from 'expo-secure-store';

import { Banner, Button, Icon, Input, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { detectCurrentLocation, type GpsLocationResult } from '@/services/locationService';
import { updateProfile } from '@/services/profiles';
import { supabase } from '@/services/supabase';
import { colors, layout, radius } from '@/theme';

import { validateEmail, validateName } from './validation';

/**
 * Shown once, right after a farmer's first successful phone verification —
 * gated in `RootNavigator` on `profile.full_name` being empty.
 *
 * Automatically captures the farmer's GPS location (lat, lng, city, district, state, country)
 * so their profile and field analysis are accurately seeded on signup.
 */
export function ProfileSetupScreen() {
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<(typeof SUPPORTED_LANGUAGES)[number]['code']>('en');
  const [location, setLocation] = useState<GpsLocationResult | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string }>({});
  const [formErrorKey, setFormErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    setLocationError(null);
    try {
      const loc = await detectCurrentLocation();
      setLocation(loc);
    } catch {
      setLocationError(t('profileSetup.locationPermissionPrompt'));
    } finally {
      setDetectingLocation(false);
    }
  };

  useEffect(() => {
    void handleDetectLocation();
  }, []);

  const handleSubmit = async () => {
    const nameError = validateName(fullName);
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
        // Flag this farmer as a genuinely first-time farmer completing initial onboarding
        try {
          await SecureStore.setItemAsync(`krishinetra.first_time_farmer.${user.id}`, 'true');
          await supabase.auth.updateUser({
            data: { is_new_farmer: true },
          });
        } catch {
          // non-fatal
        }

        await updateProfile(user.id, {
          full_name: fullName.trim(),
          email: email.trim() || null,
          language,
          ...(location
            ? {
                location_latitude: location.latitude,
                location_longitude: location.longitude,
                location_city: location.city,
                location_district: location.district,
                location_state: location.state,
                location_country: location.country,
                location_source: location.source,
              }
            : {}),
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

            {/* GPS Location Card */}
            <View style={styles.locationSection}>
              <Text variant="caption" style={styles.locationLabel}>
                {t('profileSetup.locationLabel')}
              </Text>

              <View style={styles.locationCard} testID="profile-setup-location-card">
                <View style={styles.locationHeader}>
                  <View style={styles.locationIconWrap}>
                    <Icon name="pin" size={20} color={colors.primaryDark} />
                  </View>
                  <View style={styles.locationDetails}>
                    {detectingLocation ? (
                      <View style={styles.detectingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text variant="bodyMedium" color={colors.text.muted}>
                          {t('profileSetup.detectingLocation')}
                        </Text>
                      </View>
                    ) : location ? (
                      <>
                        <Text variant="bodyMedium" color={colors.text.primary} style={styles.locationPlace}>
                          {[location.city, location.district, location.state].filter(Boolean).join(', ')}
                        </Text>
                        <Text variant="micro" color={colors.text.muted}>
                          {location.latitude}° N, {location.longitude}° E · {location.country || 'India'}
                        </Text>
                      </>
                    ) : (
                      <Text variant="caption" color={colors.text.muted}>
                        {locationError || t('profileSetup.locationPermissionPrompt')}
                      </Text>
                    )}
                  </View>
                </View>

                <Pressable
                  onPress={handleDetectLocation}
                  disabled={detectingLocation}
                  style={({ pressed }) => [
                    styles.refreshGpsButton,
                    pressed && styles.refreshGpsButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('profileSetup.detectLocation')}
                >
                  <Icon name="locate" size={14} color={colors.primaryDark} strokeWidth={2} />
                  <Text variant="microMedium" color={colors.primaryDark}>
                    {location ? t('common.refresh', 'Refresh') : t('profileSetup.detectLocation')}
                  </Text>
                </Pressable>
              </View>
            </View>

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
  locationSection: { gap: 6 },
  locationLabel: { marginBottom: 2 },
  locationCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationDetails: {
    flex: 1,
    gap: 2,
  },
  locationPlace: {
    fontWeight: '600',
  },
  detectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshGpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
  },
  refreshGpsButtonPressed: {
    opacity: 0.8,
  },
  languageLabel: { marginBottom: 6 },
  languageRow: { flexDirection: 'row', gap: 10 },
  languageChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  languageChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 24, gap: 14 },
});
