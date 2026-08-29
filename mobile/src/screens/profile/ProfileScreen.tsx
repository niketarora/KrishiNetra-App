import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon, IconBadge, type IconBadgeTone, Screen, ScreenHeader, Text, type IconName } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useFarm } from '@/features/farm/FarmContext';
import { useLanguage } from '@/features/language/LanguageContext';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { colors, layout, radius } from '@/theme';
import { initials, maskPhone } from '@/utils/format';

type Props = {
  onBack: () => void;
  /** Always goes to the same place — My Farm decides what to show. */
  onOpenMyFarm: () => void;
  onOpenSchemes: () => void;
  onOpenAlerts: () => void;
};

type Row = {
  key: string;
  icon: IconName;
  tone: IconBadgeTone;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/** design.md §4.12 — reached from the header avatar, never a bottom-nav slot. */
export function ProfileScreen({ onBack, onOpenMyFarm, onOpenSchemes, onOpenAlerts }: Props) {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const { farm } = useFarm();
  const { language, setLanguage } = useLanguage();

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((l) => l.code === language)?.label ?? language;

  const cycleLanguage = () => {
    const index = SUPPORTED_LANGUAGES.findIndex((l) => l.code === language);
    const next = SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length];
    void setLanguage(next.code);
  };

  const confirmLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  // Grouped into short sections (task spec: "Farmer identity, not developer
  // settings") rather than one long flat list — same rows, same testIDs, same
  // behaviour, just visually organised.
  const farmerRows: Row[] = [
    { key: 'phone', icon: 'phone', tone: 'primary', label: t('profile.phone'), value: maskPhone(profile?.phone) },
    { key: 'email', icon: 'mail', tone: 'primary', label: t('profile.email'), value: profile?.email ?? t('profile.emailNotAdded') },
  ];

  const preferenceRows: Row[] = [
    { key: 'language', icon: 'globe', tone: 'accent', label: t('profile.language'), value: currentLanguage, onPress: cycleLanguage },
    {
      key: 'location',
      icon: 'pin',
      tone: 'harvest',
      // Read-only for now — Niket's future GPS/manual entry writes here later
      // (location_source flips from 'demo' to 'gps'/'manual'; see 0005_farmer_identity.sql).
      label: t('profile.location'),
      value: profile?.location_city ?? t('common.notAvailable'),
    },
  ];

  const serviceRows: Row[] = [
    { key: 'myFarm', icon: 'field', tone: 'primary', label: t(farm ? 'profile.myFarm' : 'profile.registerLand'), onPress: onOpenMyFarm },
    { key: 'schemes', icon: 'check', tone: 'harvest', label: t('profile.schemes'), onPress: onOpenSchemes },
    { key: 'alerts', icon: 'bell', tone: 'warning', label: t('profile.alerts'), onPress: onOpenAlerts },
  ];

  const supportRows: Row[] = [
    // Help has nothing behind it yet. Shown disabled rather than hidden so
    // the farmer sees where the app is going, but tapping it can't lead to a
    // dead screen.
    { key: 'help', icon: 'help', tone: 'neutral', label: t('profile.help'), disabled: true },
    { key: 'logout', icon: 'logout', tone: 'danger', label: t('profile.logout'), onPress: confirmLogout, danger: true },
  ];

  const sections: { key: string; titleKey: string; rows: Row[] }[] = [
    { key: 'farmer', titleKey: 'profile.sectionFarmer', rows: farmerRows },
    { key: 'preferences', titleKey: 'profile.sectionPreferences', rows: preferenceRows },
    { key: 'services', titleKey: 'profile.sectionServices', rows: serviceRows },
    { key: 'support', titleKey: 'profile.sectionSupport', rows: supportRows },
  ];

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text variant="title" color={colors.text.onPrimary}>
              {initials(profile?.full_name, profile?.email, profile?.phone)}
            </Text>
          </View>
          <Text variant="title">{profile?.full_name ?? ''}</Text>
          <Text variant="caption" color={colors.text.muted}>
            {maskPhone(profile?.phone)}
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text variant="caption" color={colors.text.muted} style={styles.sectionHeading}>
              {t(section.titleKey)}
            </Text>
            <View style={styles.rows}>
              {section.rows.map((row, index) => (
                <Pressable
                  key={row.key}
                  onPress={row.onPress}
                  disabled={row.disabled || !row.onPress}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: row.disabled }}
                  testID={`profile-${row.key}`}
                  style={({ pressed }) => [
                    styles.row,
                    index === section.rows.length - 1 && styles.rowLast,
                    pressed && !row.disabled && styles.rowPressed,
                    row.disabled && styles.rowDisabled,
                  ]}
                >
                  <IconBadge icon={row.icon} tone={row.tone} size={32} iconSize={16} />
                  <Text
                    variant="body"
                    color={row.danger ? colors.danger : colors.text.primary}
                    style={styles.rowLabel}
                  >
                    {row.label}
                  </Text>
                  {row.value ? (
                    <Text variant="caption" color={colors.text.secondary}>
                      {row.value}
                    </Text>
                  ) : null}
                  {row.onPress && !row.danger ? (
                    <Icon name="chevron" size={18} color={colors.text.muted} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingHorizontal: layout.screenPadding, gap: layout.cardGap },
  identity: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: 6,
  },
  section: { gap: 8 },
  // No uppercase transform — it does nothing useful for Devanagari and the
  // app avoids that pattern everywhere else (Hindi has no letter-case concept).
  sectionHeading: { marginLeft: 2 },
  rows: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: layout.touchTarget,
    paddingVertical: 12,
    paddingHorizontal: layout.cardPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: colors.neutralBg },
  rowDisabled: { opacity: 0.5 },
  rowLabel: { flex: 1 },
});
