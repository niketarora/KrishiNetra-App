import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import { Text } from './Text';
import { listSchemeStates } from '@/services/schemes';
import { colors, layout, radius, spacing } from '@/theme';

type Props = {
  visible: boolean;
  selectedState: string | null;
  onSelectState: (state: string) => void;
  onClose: () => void;
};

const FALLBACK_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export function StatePickerModal({
  visible,
  selectedState,
  onSelectState,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }

    let cancelled = false;
    setLoading(true);

    listSchemeStates()
      .then((data) => {
        if (!cancelled) setStates(data.length > 0 ? data : FALLBACK_STATES);
      })
      .catch(() => {
        if (!cancelled) setStates(FALLBACK_STATES);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filteredStates = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return states;
    return states.filter((s) => s.toLowerCase().includes(q));
  }, [query, states]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text variant="cardTitle">{t('schemes.selectState')}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={styles.closeButton}
            testID="close-state-picker"
          >
            <Icon name="close" size={20} color={colors.text.primary} />
          </Pressable>
        </View>

        <View style={styles.searchContainer}>
          <Input
            label={t('schemes.searchState')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('schemes.searchState')}
            autoFocus={false}
            clearButtonMode="while-editing"
            testID="state-search-input"
          />
        </View>

        {loading && states.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </View>
        ) : (
          <FlatList
            data={filteredStates}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected =
                selectedState?.toLowerCase().trim() === item.toLowerCase().trim();
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.stateRow,
                    isSelected && styles.stateRowSelected,
                    pressed && styles.stateRowPressed,
                  ]}
                  onPress={() => {
                    onSelectState(item);
                    onClose();
                  }}
                  testID={`state-option-${item}`}
                >
                  <Text
                    variant={isSelected ? 'bodyMedium' : 'body'}
                    color={isSelected ? colors.primaryDark : colors.text.primary}
                    style={styles.stateText}
                  >
                    {item}
                  </Text>
                  {isSelected ? (
                    <Icon name="check" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
  },
  loadingContainer: {
    padding: layout.screenPadding,
    gap: spacing.sm,
  },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.xxl,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stateRowSelected: {
    backgroundColor: colors.successBg,
    borderRadius: radius.sm,
  },
  stateRowPressed: {
    opacity: 0.7,
  },
  stateText: {
    flex: 1,
  },
});
