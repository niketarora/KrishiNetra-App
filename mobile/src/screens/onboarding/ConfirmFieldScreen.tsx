import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AreaCard } from '@/components/farm/AreaCard';
import { BoundaryThumbnail } from '@/components/farm/BoundaryThumbnail';
import { Banner, Button, Input, Screen, ScreenHeader, Text } from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { DataError } from '@/services/errors';
import { colors, layout } from '@/theme';
import { calculateArea, type LatLng } from '@/utils/geo';

type Props = {
  points: LatLng[];
  /** Pre-fills the name when an existing farm's boundary is being edited. */
  initialName?: string | null;
  accuracy?: number | null;
  mode?: 'create' | 'edit';
  onSaved: () => void;
  onBack: () => void;
};

/**
 * design.md §4.8 — name the field and commit it.
 *
 * A save failure keeps the farmer here with their boundary intact rather than
 * dropping them back to the map: redrawing a field they already walked is the
 * worst possible outcome of a flaky connection.
 */
export function ConfirmFieldScreen({
  points,
  initialName,
  accuracy,
  mode = 'create',
  onSaved,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const { saveBoundary, addLand } = useFarm();

  const [name, setName] = useState(initialName ?? '');
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const area = useMemo(() => calculateArea(points), [points]);

  const handleSave = async () => {
    setSaving(true);
    setErrorKey(null);

    try {
      if (mode === 'edit') {
        await saveBoundary(points, name, accuracy);
      } else {
        await addLand(points, name, accuracy);
      }
      onSaved();
    } catch (error) {
      setErrorKey(error instanceof DataError ? error.translationKey : 'onboarding.saveError');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('onboarding.confirmTitle')} onBack={onBack} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {errorKey ? (
            <Banner
              title={t(errorKey)}
              tone="danger"
              onDismiss={() => setErrorKey(null)}
              dismissLabel={t('common.cancel')}
            />
          ) : null}

          <View style={styles.preview}>
            <BoundaryThumbnail points={points} size={160} />
          </View>

          <Input
            label={t('onboarding.fieldNameLabel')}
            placeholder={t('onboarding.fieldNamePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            testID="field-name"
          />

          <AreaCard area={area} />

          <Text variant="micro" color={colors.text.muted}>
            {t('onboarding.mapHintDrag')}
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={saving ? t('onboarding.saving') : t('onboarding.saveField')}
            onPress={handleSave}
            loading={saving}
            testID="save-field"
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
    paddingTop: 8,
    paddingBottom: 24,
    gap: layout.cardGap,
  },
  preview: { alignItems: 'center', paddingVertical: 8 },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 24 },
});
