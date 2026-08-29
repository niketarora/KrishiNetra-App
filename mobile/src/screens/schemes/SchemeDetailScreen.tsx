import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Banner, Button, Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { getScheme } from '@/features/schemes/demoSchemes';
import { localize } from '@/utils/localizedText';
import { colors, layout } from '@/theme';

type Props = {
  schemeId: string;
  onBack: () => void;
};

/**
 * One scheme, read top to bottom. Every field is general, well-publicised
 * information rather than a precise legal rule — see `demoSchemes.ts` — and
 * the disclaimer banner at the bottom is permanent, not conditional.
 */
export function SchemeDetailScreen({ schemeId, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const scheme = getScheme(schemeId);

  if (!scheme) {
    return (
      <Screen>
        <ScreenHeader title={t('schemes.title')} onBack={onBack} />
        <EmptyState
          icon="help"
          title={t('schemes.notFoundTitle')}
          body={t('schemes.notFoundBody')}
          testID="scheme-not-found"
        />
      </Screen>
    );
  }

  const language = i18n.language;

  return (
    <Screen>
      <ScreenHeader title={localize(scheme.name, language)} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Badge label={t(`schemes.categories.${scheme.category}`)} tone="accent" />

        <Card>
          <Text variant="caption">{t('schemes.detail.whatIsIt')}</Text>
          <Text variant="body" style={styles.sectionBody}>
            {localize(scheme.summary, language)}
          </Text>
        </Card>

        <Card>
          <Text variant="caption">{t('schemes.detail.potentialBenefit')}</Text>
          <Text variant="body" style={styles.sectionBody}>
            {localize(scheme.benefit, language)}
          </Text>
        </Card>

        <Card>
          <Text variant="caption">{t('schemes.detail.whoMayBeEligible')}</Text>
          <Text variant="body" style={styles.sectionBody}>
            {localize(scheme.eligibility, language)}
          </Text>
        </Card>

        <Card>
          <Text variant="caption" style={styles.listTitle}>
            {t('schemes.detail.documents')}
          </Text>
          {scheme.documents.map((doc, index) => (
            <View key={index} style={styles.listRow}>
              <Text variant="bodyMedium" color={colors.text.secondary}>{'•'}</Text>
              <Text variant="body" style={styles.listText}>
                {localize(doc, language)}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <Text variant="caption">{t('schemes.detail.howToApply')}</Text>
          <Text variant="body" style={styles.sectionBody}>
            {localize(scheme.howToApply, language)}
          </Text>
        </Card>

        <Button
          label={t('schemes.detail.checkOfficialSource')}
          onPress={() => void Linking.openURL(scheme.officialUrl)}
          variant="secondary"
          testID="scheme-official-source"
        />

        <Banner tone="neutral" title={t('schemes.disclaimer')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 32,
    gap: layout.cardGap,
  },
  sectionBody: { marginTop: 6 },
  listTitle: { marginBottom: 8 },
  listRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  listText: { flex: 1 },
});
