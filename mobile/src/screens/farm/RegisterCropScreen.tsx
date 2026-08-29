import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AreaCard } from '@/components/farm/AreaCard';
import { BoundaryThumbnail } from '@/components/farm/BoundaryThumbnail';
import { Banner, Button, Icon, Input, Screen, ScreenHeader, Text } from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { createFarmCrop, listCrops, type Crop } from '@/services/agronomy';
import { DataError } from '@/services/errors';
import { colors, layout } from '@/theme';
import { calculateArea, type LatLng } from '@/utils/geo';

type Props = {
  points: LatLng[];
  onSaved: () => void;
  onBack: () => void;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function cropLabel(crop: Crop, language: string): string {
  if (language.startsWith('hi') && crop.name_hi) return crop.name_hi;
  return crop.name_en;
}

/**
 * The last step of Land Registration: name the field, optionally record what's
 * growing on it, and save.
 *
 * Crop info is entirely optional — a farmer can register bare land. What is
 * asked for is exactly what `farm_crops` already stores (crop, variety, sowing
 * date, notes); irrigation source and soil type have no column anywhere in the
 * schema, so rather than invent one, this screen offers the free-text notes
 * field for a farmer who wants to note that down.
 */
export function RegisterCropScreen({ points, onSaved, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const { saveBoundary } = useFarm();

  const [name, setName] = useState('');
  const [crops, setCrops] = useState<Crop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [variety, setVariety] = useState('');
  const [sownOn, setSownOn] = useState(today());
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [cropWarning, setCropWarning] = useState(false);

  useEffect(() => {
    listCrops()
      .then(setCrops)
      // The crop picker is a convenience, not the point of this screen — a
      // farmer can still register their land and add a crop later.
      .catch(() => setCrops([]));
  }, []);

  const area = useMemo(() => calculateArea(points), [points]);
  const dateError = sownOn.trim() && !DATE_PATTERN.test(sownOn.trim());

  const handleSave = async () => {
    setSaving(true);
    setErrorKey(null);
    setCropWarning(false);

    try {
      const farm = await saveBoundary(points, name);

      if (selectedCropId) {
        try {
          await createFarmCrop(farm.id, {
            crop_id: selectedCropId,
            variety: variety.trim() || null,
            sown_on: !dateError && sownOn.trim() ? sownOn.trim() : null,
            notes: notes.trim() || null,
          });
        } catch {
          // The field itself saved. Losing the crop write here shouldn't throw
          // away the boundary the farmer just walked — it can be added later
          // from My Farm.
          setCropWarning(true);
        }
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
      <ScreenHeader title={t('myFarm.cropStepTitle')} onBack={onBack} />

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

          {cropWarning ? <Banner title={t('myFarm.saveCropError')} tone="warning" /> : null}

          <View style={styles.preview}>
            <BoundaryThumbnail points={points} size={140} />
          </View>

          <AreaCard area={area} />

          <Input
            label={t('onboarding.fieldNameLabel')}
            placeholder={t('onboarding.fieldNamePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            testID="crop-field-name"
          />

          <View style={styles.cropSection}>
            <Text variant="caption" style={styles.cropLabel}>
              {t('myFarm.cropLabel')}
            </Text>

            <View style={styles.cropList}>
              {crops.map((crop) => {
                const selected = crop.id === selectedCropId;
                return (
                  <Pressable
                    key={crop.id}
                    onPress={() => setSelectedCropId(selected ? null : crop.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`crop-option-${crop.code}`}
                    style={[styles.cropChip, selected && styles.cropChipSelected]}
                  >
                    {selected ? <Icon name="check" size={14} color={colors.primaryDark} /> : null}
                    <Text
                      variant="bodyMedium"
                      color={selected ? colors.primaryDark : colors.text.primary}
                    >
                      {cropLabel(crop, i18n.language)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {selectedCropId ? (
            <>
              <Input
                label={t('myFarm.varietyLabel')}
                placeholder={t('myFarm.varietyPlaceholder')}
                value={variety}
                onChangeText={setVariety}
                testID="crop-variety"
              />

              <Input
                label={t('myFarm.sownOnLabel')}
                placeholder="YYYY-MM-DD"
                value={sownOn}
                onChangeText={setSownOn}
                error={dateError ? t('myFarm.sownOnInvalid') : null}
                testID="crop-sown-on"
              />
            </>
          ) : null}

          <Input
            label={t('myFarm.notesLabel')}
            placeholder={t('myFarm.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
            style={styles.notesInput}
            testID="crop-notes"
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={saving ? t('onboarding.saving') : t('myFarm.saveCta')}
            onPress={handleSave}
            loading={saving}
            testID="crop-save"
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
  cropSection: { gap: 8 },
  cropLabel: { marginBottom: -2 },
  cropList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cropChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cropChipSelected: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 24 },
});
