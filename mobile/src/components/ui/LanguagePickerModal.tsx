import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { Text } from './Text';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

type Props = {
  visible: boolean;
  selectedCode: LanguageCode;
  onSelect: (code: LanguageCode) => void;
  onClose: () => void;
};

export function LanguagePickerModal({ visible, selectedCode, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredLanguages = useMemo(() => {
    if (!search.trim()) return SUPPORTED_LANGUAGES;
    const q = search.toLowerCase().trim();
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.englishLabel.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [search]);

  const handleSelect = (code: LanguageCode) => {
    onSelect(code);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text variant="title" style={styles.title}>
              {t('profile.language')} / Language
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Icon name="x" size={20} color={colors.text.primary} />
            </Pressable>
          </View>

          {/* Search bar */}
          <View style={styles.searchBox}>
            <Icon name="search" size={18} color={colors.text.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search language / भाषा खोजें…"
              placeholderTextColor={colors.text.muted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        <FlatList
          data={filteredLanguages}
          keyExtractor={(item) => item.code}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = item.code === selectedCode;
            return (
              <Pressable
                onPress={() => handleSelect(item.code)}
                style={({ pressed }) => [
                  styles.itemRow,
                  isSelected && styles.itemRowSelected,
                  pressed && styles.itemRowPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.itemTextContainer}>
                  <Text variant="cardTitle" style={styles.nativeLabel}>
                    {item.label}
                  </Text>
                  <Text variant="caption" style={styles.englishLabel}>
                    {item.englishLabel}
                  </Text>
                </View>

                {isSelected ? (
                  <View style={styles.checkContainer}>
                    <Icon name="check" size={18} color={colors.primary} />
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  closeBtn: {
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralBg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutralBg,
    borderRadius: radius.none,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  itemRowSelected: {
    backgroundColor: colors.neutralBg,
  },
  itemRowPressed: {
    opacity: 0.7,
  },
  itemTextContainer: {
    flex: 1,
    gap: 2,
  },
  nativeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  englishLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  checkContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
});
