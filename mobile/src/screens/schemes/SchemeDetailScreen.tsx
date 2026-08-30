import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Screen,
  ScreenHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { getSchemeDetail, type SchemeDetail } from '@/services/schemes';
import { colors, layout, spacing } from '@/theme';

type Props = {
  schemeId: string;
  onBack: () => void;
};

export function SchemeDetailScreen({ schemeId, onBack }: Props) {
  const { t } = useTranslation();
  const [scheme, setScheme] = useState<SchemeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    getSchemeDetail(schemeId)
      .then((data) => {
        if (!cancelled) setScheme(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [schemeId]);

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title={t('schemes.title')} onBack={onBack} />
        <ScrollView contentContainerStyle={styles.content}>
          <Skeleton height={32} width={120} />
          <Skeleton height={120} />
          <Skeleton height={100} />
          <Skeleton height={100} />
        </ScrollView>
      </Screen>
    );
  }

  if (error || !scheme) {
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

  const title = scheme.short_title?.trim() || scheme.name;

  return (
    <Screen>
      <ScreenHeader title={title} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {scheme.category ? (
          <Badge label={scheme.category} tone="accent" />
        ) : null}

        {scheme.what_is_it ? (
          <Card>
            <Text variant="caption">{t('schemes.detail.whatIsIt')}</Text>
            <Text variant="body" style={styles.sectionBody}>
              {scheme.what_is_it}
            </Text>
          </Card>
        ) : null}

        {scheme.potential_benefit ? (
          <Card>
            <Text variant="caption">{t('schemes.detail.potentialBenefit')}</Text>
            <Text variant="body" style={styles.sectionBody}>
              {scheme.potential_benefit}
            </Text>
          </Card>
        ) : null}

        {scheme.who_may_be_eligible ? (
          <Card>
            <Text variant="caption">{t('schemes.detail.whoMayBeEligible')}</Text>
            <Text variant="body" style={styles.sectionBody}>
              {scheme.who_may_be_eligible}
            </Text>
          </Card>
        ) : null}

        {scheme.documents && scheme.documents.length > 0 ? (
          <Card>
            <Text variant="caption" style={styles.listTitle}>
              {t('schemes.detail.documents')}
            </Text>
            {scheme.documents.map((doc, index) => (
              <View key={index} style={styles.listRow}>
                <Text variant="bodyMedium" color={colors.text.secondary}>
                  {'•'}
                </Text>
                <Text variant="body" style={styles.listText}>
                  {doc}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {scheme.how_to_apply ? (
          <Card>
            <Text variant="caption">{t('schemes.detail.howToApply')}</Text>
            <Text variant="body" style={styles.sectionBody}>
              {scheme.how_to_apply}
            </Text>
          </Card>
        ) : null}

        {scheme.official_source ? (
          <Button
            label={t('schemes.detail.checkOfficialSource')}
            onPress={() => void Linking.openURL(scheme.official_source!)}
            variant="secondary"
            testID="scheme-official-source"
          />
        ) : null}

        {scheme.myscheme_url ? (
          <Button
            label={t('schemes.detail.viewOnMyScheme')}
            onPress={() => void Linking.openURL(scheme.myscheme_url!)}
            variant="secondary"
            testID="scheme-myscheme-url"
          />
        ) : null}

        <Banner tone="neutral" title={t('schemes.disclaimer')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    gap: layout.cardGap,
  },
  sectionBody: {
    marginTop: 6,
  },
  listTitle: {
    marginBottom: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: 4,
  },
  listText: {
    flex: 1,
  },
});
