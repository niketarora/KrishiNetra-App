import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  Card,
  Icon,
  IconBadge,
  LanguagePickerModal,
  Screen,
  ScreenHeader,
  Text,
  type IconName,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useFarm } from '@/features/farm/FarmContext';
import { useLanguage } from '@/features/language/LanguageContext';
import { colors, fonts, layout, radius } from '@/theme';
import { firstName, initials } from '@/utils/format';

type Props = {
  onOpenHistory: () => void;
  onOpenCalendar: () => void;
  onOpenLearning: () => void;
  onOpenSchemes: () => void;
  onOpenUpdates: () => void;
  onOpenAlerts: () => void;
  onOpenMyLands: () => void;
  onOpenProfile: () => void;
  onOpenVisualAssistant: () => void;
  onOpenArMoisture: () => void;
};

type MenuRow = {
  key: string;
  icon: IconName;
  titleKey: string;
  subtitleKey?: string;
  onPress: () => void;
  badge?: string;
};

export function MoreScreen({
  onOpenHistory,
  onOpenCalendar,
  onOpenLearning,
  onOpenSchemes,
  onOpenUpdates,
  onOpenAlerts,
  onOpenMyLands,
  onOpenProfile,
  onOpenVisualAssistant,
  onOpenArMoisture,
}: Props) {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const { farm } = useFarm();
  const { language, setLanguage } = useLanguage();
  const [langPickerVisible, setLangPickerVisible] = useState(false);

  const name = firstName(profile?.full_name, profile?.email, profile?.phone);
  const locationLine = [farm?.district || profile?.location_district, farm?.state || profile?.location_state]
    .filter(Boolean)
    .join(', ');

  const handleLogout = () => {
    Alert.alert(
      t('profile.logoutConfirmTitle'),
      t('profile.logoutConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'),
          style: 'destructive',
          onPress: () => void signOut(),
        },
      ],
    );
  };

  const farmServices: MenuRow[] = [
    {
      key: 'history',
      icon: 'history',
      titleKey: 'history.title',
      subtitleKey: 'history.overviewTitle',
      onPress: onOpenHistory,
    },
    {
      key: 'calendar',
      icon: 'clock',
      titleKey: 'home.calendar',
      subtitleKey: 'calendar.upcoming',
      onPress: onOpenCalendar,
    },
    {
      key: 'lands',
      icon: 'map',
      titleKey: 'profile.myFarm',
      subtitleKey: 'myLands.title',
      onPress: onOpenMyLands,
    },
  ];

  const intelligenceServices: MenuRow[] = [
    {
      key: 'schemes',
      icon: 'help',
      titleKey: 'home.schemes',
      subtitleKey: 'schemes.intro',
      onPress: onOpenSchemes,
    },
    {
      key: 'updates',
      icon: 'plant',
      titleKey: 'home.updates',
      subtitleKey: 'updates.intro',
      onPress: onOpenUpdates,
    },
    {
      key: 'alerts',
      icon: 'bell',
      titleKey: 'home.alerts',
      subtitleKey: 'alerts.intro',
      onPress: onOpenAlerts,
    },
  ];

  const learningAndAI: MenuRow[] = [
    {
      key: 'learning',
      icon: 'book',
      titleKey: 'home.learning',
      subtitleKey: 'learning.tagline',
      onPress: onOpenLearning,
    },
    {
      key: 'visual',
      icon: 'camera',
      titleKey: 'home.visualAssistantTitle',
      subtitleKey: 'home.visualAssistantSub',
      onPress: onOpenVisualAssistant,
    },
    {
      key: 'ar',
      icon: 'locate',
      titleKey: 'home.arMoistureTitle',
      subtitleKey: 'home.arMoistureSub',
      onPress: onOpenArMoisture,
    },
  ];

  const renderSection = (title: string, items: MenuRow[]) => (
    <View style={styles.section} key={title}>
      <Text variant="caption" color={colors.text.muted} style={styles.sectionTitle}>
        {title}
      </Text>
      <Card style={styles.menuGroupCard}>
        {items.map((row, idx) => (
          <Pressable
            key={row.key}
            onPress={row.onPress}
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.menuRowPressed,
              idx < items.length - 1 && styles.menuRowBorder,
            ]}
          >
            <IconBadge icon={row.icon} tone="primary" size={36} iconSize={18} />
            <View style={styles.menuTextGroup}>
              <Text variant="bodyMedium" color={colors.text.primary}>
                {t(row.titleKey)}
              </Text>
              {row.subtitleKey ? (
                <Text variant="micro" color={colors.text.muted} numberOfLines={1}>
                  {t(row.subtitleKey)}
                </Text>
              ) : null}
            </View>
            <Icon name="chevron" size={16} color={colors.text.muted} />
          </Pressable>
        ))}
      </Card>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title={t('nav.more', { defaultValue: 'More' })} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Farmer Profile Card */}
        <Card onPress={onOpenProfile} style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text variant="cardTitle" color={colors.text.onPrimary}>
              {initials(profile?.full_name, profile?.email, profile?.phone)}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text variant="cardTitle">{name}</Text>
            <Text variant="caption" color={colors.text.secondary}>
              {profile?.phone || profile?.email || ''}
            </Text>
            {locationLine ? (
              <Text variant="micro" color={colors.text.muted}>
                {locationLine}
              </Text>
            ) : null}
          </View>
          <Icon name="chevron" size={18} color={colors.text.muted} />
        </Card>

        {renderSection(t('profile.sectionServices', { defaultValue: 'Farm & Records' }), farmServices)}
        {renderSection(t('home.farmerResources', { defaultValue: 'Intelligence & Schemes' }), intelligenceServices)}
        {renderSection(t('learning.title', { defaultValue: 'Academy & AI Tools' }), learningAndAI)}

        {/* Preferences & Logout */}
        <View style={styles.section}>
          <Text variant="caption" color={colors.text.muted} style={styles.sectionTitle}>
            {t('profile.sectionPreferences', { defaultValue: 'Preferences & Account' })}
          </Text>
          <Card style={styles.menuGroupCard}>
            <Pressable
              onPress={() => setLangPickerVisible(true)}
              style={({ pressed }) => [styles.menuRow, styles.menuRowBorder, pressed && styles.menuRowPressed]}
            >
              <IconBadge icon="translate" tone="primary" size={36} iconSize={18} />
              <View style={styles.menuTextGroup}>
                <Text variant="bodyMedium">{t('profile.language')}</Text>
                <Text variant="micro" color={colors.text.muted}>
                  {t('profile.languageHindi')} / {t('profile.languageEnglish')}
                </Text>
              </View>
              <Icon name="chevron" size={16} color={colors.text.muted} />
            </Pressable>

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <IconBadge icon="logout" tone="danger" size={36} iconSize={18} />
              <View style={styles.menuTextGroup}>
                <Text variant="bodyMedium" color={colors.danger}>
                  {t('profile.logout')}
                </Text>
              </View>
              <Icon name="chevron" size={16} color={colors.danger} />
            </Pressable>
          </Card>
        </View>
      </ScrollView>

      <LanguagePickerModal
        visible={langPickerVisible}
        selectedCode={language}
        onSelect={(code) => {
          void setLanguage(code);
          setLangPickerVisible(false);
        }}
        onClose={() => setLangPickerVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 110,
    gap: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: fonts.medium,
    marginLeft: 4,
  },
  menuGroupCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuRowPressed: {
    backgroundColor: colors.neutralBg,
  },
  menuTextGroup: {
    flex: 1,
    gap: 2,
  },
});
