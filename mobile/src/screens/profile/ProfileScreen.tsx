import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon, LanguagePickerModal, Screen, ScreenHeader, Text, type IconName } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useFarm } from '@/features/farm/FarmContext';
import { useLanguage } from '@/features/language/LanguageContext';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { colors, layout } from '@/theme';
import { initials } from '@/utils/format';

type Props = {
  onBack: () => void;
  /** Always goes to the same place — My Farm decides what to show. */
  onOpenMyFarm: () => void;
  onOpenSchemes: () => void;
};

type Row = {
  key: string;
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/** design.md §4.12 — reached from the header avatar, never a bottom-nav slot. */
export function ProfileScreen({ onBack, onOpenMyFarm, onOpenSchemes }: Props) {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const { farm } = useFarm();
  const { language, setLanguage } = useLanguage();
  const [pickerVisible, setPickerVisible] = useState(false);

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((l) => l.code === language)?.label ?? language;

  const openLanguagePicker = () => {
    setPickerVisible(true);
  };

  const confirmLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const rows: Row[] = [
    {
      key: 'language',
      icon: 'globe',
      label: t('profile.language'),
      value: currentLanguage,
      onPress: openLanguagePicker,
    },
    {
      key: 'myFarm',
      icon: 'field',
      label: t(farm ? 'profile.myFarm' : 'profile.registerLand'),
      onPress: onOpenMyFarm,
    },
    {
      key: 'schemes',
      icon: 'check',
      label: t('profile.schemes'),
      onPress: onOpenSchemes,
    },
    // Notifications and Help have nothing behind them in Phase 1. They are
    // shown disabled rather than hidden so the farmer sees where the app is
    // going, but tapping them can't lead to a dead screen.
    { key: 'notifications', icon: 'bell', label: t('profile.notifications'), disabled: true },
    { key: 'help', icon: 'help', label: t('profile.help'), disabled: true },
    { key: 'logout', icon: 'logout', label: t('profile.logout'), onPress: confirmLogout, danger: true },
  ];

  return (
    <Screen>
      <ScreenHeader title={t('profile.title')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text variant="title" color={colors.text.onPrimary}>
              {initials(profile?.full_name, user?.email)}
            </Text>
          </View>
          <Text variant="title">{profile?.full_name ?? ''}</Text>
          <Text variant="caption" color={colors.text.muted}>
            {user?.email ?? ''}
          </Text>
        </View>

        <View style={styles.rows}>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              onPress={row.onPress}
              disabled={row.disabled || !row.onPress}
              accessibilityRole="button"
              accessibilityState={{ disabled: row.disabled }}
              testID={`profile-${row.key}`}
              style={({ pressed }) => [
                styles.row,
                pressed && !row.disabled && styles.rowPressed,
                row.disabled && styles.rowDisabled,
              ]}
            >
              <Icon
                name={row.icon}
                size={20}
                color={row.danger ? colors.danger : colors.text.secondary}
              />
              <Text
                variant="body"
                color={row.danger ? colors.danger : colors.text.primary}
                style={styles.rowLabel}
              >
                {row.label}
              </Text>
              {row.value ? (
                <Text variant="caption" color={colors.text.muted}>
                  {row.value}
                </Text>
              ) : null}
              {row.onPress && !row.danger ? (
                <Icon name="chevron" size={18} color={colors.text.muted} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <LanguagePickerModal
        visible={pickerVisible}
        selectedCode={language}
        onSelect={(code) => void setLanguage(code)}
        onClose={() => setPickerVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  identity: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  avatar: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: 6,
  },
  rows: { borderTopWidth: 1, borderTopColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: layout.touchTarget,
    paddingVertical: 14,
    paddingHorizontal: layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.neutralBg },
  rowDisabled: { opacity: 0.5 },
  rowLabel: { flex: 1 },
});
