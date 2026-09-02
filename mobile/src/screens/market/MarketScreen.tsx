import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import { GuideTarget } from '@/components/guide/GuideTarget';
import {
  Badge,
  Banner,
  Card,
  EmptyState,
  Icon,
  Input,
  Screen,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import {
  analyseMarketIntelligence,
  type MarketIntelligenceData,
} from '@/services/marketIntelligence';
import { colors, fonts, layout, radius } from '@/theme';
import { useMarketData } from './useMarketData';

const COMMODITY_OPTIONS = [
  'Mustard',
  'Wheat',
  'Gram',
  'Maize',
  'Soybean',
  'Onion',
  'Tomato',
  'Bajra',
];

function formatRupees(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return '₹0';
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function MarketScreen() {
  const { t, i18n } = useTranslation();
  const { farm } = useFarm();
  const { crop: farmCrop, msp, refresh: refreshFarmData } = useMarketData(farm?.id ?? null);

  const [activeTab, setActiveTab] = useState<'myCrop' | 'explore'>('myCrop');
  const [selectedCrop, setSelectedCrop] = useState<string>('Mustard');
  const [quantity, setQuantity] = useState<string>('50');
  const [location, setLocation] = useState<string>('Kota');
  const [moisture, setMoisture] = useState<string>('9.5');
  const [sampleImage, setSampleImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [intelligence, setIntelligence] = useState<MarketIntelligenceData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [showAdjustments, setShowAdjustments] = useState<boolean>(false);

  const scrollRef = useRef<ScrollView>(null);

  // Sync with farmer's registered crop & location when available
  useEffect(() => {
    if (farmCrop?.crop.name_en) {
      setSelectedCrop(farmCrop.crop.name_en);
    }
    if (farm?.name) {
      setLocation('Kota');
    }
  }, [farmCrop, farm]);

  const runAnalysis = useCallback(
    async (targetCrop?: string) => {
      setLoading(true);
      setErrorKey(null);
      try {
        const cropToUse = targetCrop || selectedCrop;
        const result = await analyseMarketIntelligence({
          crop: cropToUse,
          quantity: Number(quantity) || 30,
          location: location.trim() || 'Kota',
          moisture: moisture ? Number(moisture) : undefined,
          imageName: sampleImage?.fileName || `${cropToUse.toLowerCase()}_sample.jpg`,
          imageMimeType: sampleImage?.mimeType || 'image/jpeg',
          locale: i18n.language.startsWith('hi') ? 'hi' : 'en',
        });
        setIntelligence(result);
      } catch {
        setErrorKey('market.loadError');
      } finally {
        setLoading(false);
      }
    },
    [selectedCrop, quantity, location, moisture, sampleImage, i18n.language]
  );

  useEffect(() => {
    void runAnalysis();
  }, [runAnalysis]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([refreshFarmData(), runAnalysis()]);
    setRefreshing(false);
  };

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setErrorKey('common.permissionDenied');
      return;
    }

    const picked = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

    if (!picked.canceled && picked.assets[0]) {
      setSampleImage(picked.assets[0]);
    }
  };

  const rec = intelligence?.sale_recommendation;
  const pred = intelligence?.price_prediction;
  const market = intelligence?.market_intelligence;
  const quality = intelligence?.crop_analysis;
  const explanation = intelligence?.quality_price_explanation;
  const buyers = intelligence?.buyer_matches ?? [];
  const bestBuyer = intelligence?.best_buyer;

  const currentModal = market?.current_mandi_price ?? 0;
  const mspPrice = msp?.price_per_quintal ?? 0;
  const mspDifference = currentModal > 0 && mspPrice > 0 ? currentModal - mspPrice : null;

  return (
    <Screen>
      <ScreenHeader title={t('market.title')} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {errorKey ? <Banner title={t(errorKey)} tone="danger" icon="offline" /> : null}

          {/* Mode Switcher */}
          <View style={styles.segmentContainer}>
            <Pressable
              style={[styles.segmentBtn, activeTab === 'myCrop' && styles.segmentBtnActive]}
              onPress={() => {
                setActiveTab('myCrop');
                if (farmCrop?.crop.name_en) {
                  setSelectedCrop(farmCrop.crop.name_en);
                  void runAnalysis(farmCrop.crop.name_en);
                }
              }}
            >
              <Text
                variant="caption"
                style={[styles.segmentText, activeTab === 'myCrop' && styles.segmentTextActive]}
              >
                {t('market.tabMyCrop')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, activeTab === 'explore' && styles.segmentBtnActive]}
              onPress={() => setActiveTab('explore')}
            >
              <Text
                variant="caption"
                style={[styles.segmentText, activeTab === 'explore' && styles.segmentTextActive]}
              >
                {t('market.tabExplore')}
              </Text>
            </Pressable>
          </View>

          {/* Commodity & Harvest Parameters Form */}
          <Card>
            <Text variant="cardTitle" color={colors.text.primary}>
              {t('market.cropLabel')}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {COMMODITY_OPTIONS.map((item) => {
                const isActive = selectedCrop.toLowerCase() === item.toLowerCase();
                return (
                  <Pressable
                    key={item}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      setSelectedCrop(item);
                    }}
                  >
                    <Text
                      variant="caption"
                      style={[styles.chipText, isActive && styles.chipTextActive]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.inputGrid}>
              <View style={styles.inputCol}>
                <Input
                  label={t('market.quantityLabel')}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="50"
                />
              </View>
              <View style={styles.inputCol}>
                <Input
                  label={t('market.locationLabel')}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Kota"
                />
              </View>
            </View>

            <View style={styles.inputGrid}>
              <View style={styles.inputCol}>
                <Input
                  label={t('market.moistureLabel')}
                  value={moisture}
                  onChangeText={setMoisture}
                  keyboardType="decimal-pad"
                  placeholder="9.5"
                />
              </View>
              <View style={styles.inputCol}>
                <Text variant="caption" color={colors.text.secondary} style={styles.fieldLabel}>
                  {t('market.uploadPhoto')}
                </Text>
                <View style={styles.photoActions}>
                  <Pressable
                    style={styles.photoBtn}
                    onPress={() => pickImage(false)}
                  >
                    <Icon name="search" size={16} color={colors.primary} />
                    <Text variant="micro" color={colors.primary} style={styles.photoBtnText}>
                      Gallery
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.photoBtn}
                    onPress={() => pickImage(true)}
                  >
                    <Icon name="camera" size={16} color={colors.primary} />
                    <Text variant="micro" color={colors.primary} style={styles.photoBtnText}>
                      Camera
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {sampleImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: sampleImage.uri }} style={styles.imagePreview} />
                <View style={styles.imageBadge}>
                  <Icon name="check" size={12} color="#fff" />
                  <Text variant="micro" color="#fff">
                    {t('market.photoAdded')}
                  </Text>
                </View>
              </View>
            ) : null}

            <Pressable
              style={[styles.analyseBtn, loading && styles.analyseBtnDisabled]}
              onPress={() => runAnalysis()}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text variant="bodyMedium" color="#fff" style={styles.btnText}>
                    {t('market.analysing')}
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Icon name="plant" size={18} color="#fff" />
                  <Text variant="bodyMedium" color="#fff" style={styles.btnText}>
                    {t('market.analyseButton')}
                  </Text>
                </View>
              )}
            </Pressable>
          </Card>

          {/* AI Sale Recommendation Hero Card */}
          {rec ? (
            <GuideTarget id="recommendation-card" scroll={scrollRef}>
              <Card
                style={[
                  styles.recommendationCard,
                  rec.recommendation === 'WAIT'
                    ? styles.recWait
                    : styles.recSell,
                ]}
              >
                <View style={styles.recHeader}>
                  <Badge
                    label={t(`market.recs.${rec.recommendation}`) || rec.recommendation}
                    tone={rec.recommendation === 'WAIT' ? 'success' : 'neutral'}
                  />
                  <Text variant="micro" color={colors.text.secondary}>
                    {Math.round(rec.confidence * 100)}% {t('field.experimentalBadge')}
                  </Text>
                </View>

                <View style={styles.profitRow}>
                  <View>
                    <Text variant="cardTitle" style={styles.profitNumber}>
                      {formatRupees(rec.additional_expected_profit)}
                    </Text>
                    <Text variant="caption" color={colors.text.secondary}>
                      {t('market.expectedAdditionalIncome')}
                    </Text>
                  </View>
                  {rec.recommended_wait_days > 0 ? (
                    <View style={styles.waitBadge}>
                      <Icon name="clock" size={16} color={colors.primary} />
                      <Text variant="bodyMedium" color={colors.primary} style={styles.waitBadgeText}>
                        {rec.recommended_wait_days} Days Hold
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text variant="caption" color={colors.text.primary} style={styles.recReason}>
                  {intelligence?.messages?.explanation || rec.reason}
                </Text>
              </Card>
            </GuideTarget>
          ) : null}

          {/* Price Forecast & 7-Day Trend Card */}
          {pred && market ? (
            <GuideTarget id="price-card" scroll={scrollRef}>
              <Card>
                <View style={styles.cardHeaderRow}>
                  <Text variant="cardTitle">{t('market.currentPrice')}</Text>
                  {mspDifference !== null ? (
                    <Badge
                      label={
                        mspDifference >= 0
                          ? `+${formatRupees(mspDifference)} MSP`
                          : `${formatRupees(mspDifference)} MSP`
                      }
                      tone={mspDifference >= 0 ? 'success' : 'danger'}
                    />
                  ) : null}
                </View>

                <View style={styles.priceOverviewGrid}>
                  <View style={styles.priceOverviewCell}>
                    <Text variant="caption" color={colors.text.secondary}>
                      {t('market.currentPrice')}
                    </Text>
                    <Text variant="cardTitle" style={styles.priceValue}>
                      {formatRupees(market.current_mandi_price)}
                    </Text>
                    <Text variant="micro" color={colors.text.muted}>
                      {t('market.perQuintal')}
                    </Text>
                  </View>

                  <View style={styles.priceOverviewCell}>
                    <Text variant="caption" color={colors.text.secondary}>
                      {t('market.fairPriceRange')}
                    </Text>
                    <Text variant="cardTitle" style={[styles.priceValue, { color: colors.primary }]}>
                      {formatRupees(pred.current_fair_price_min)} - {formatRupees(pred.current_fair_price_max)}
                    </Text>
                    <Text variant="micro" color={colors.text.muted}>
                      AI Grade Evaluated
                    </Text>
                  </View>
                </View>

                <View style={styles.forecastBands}>
                  <View style={styles.forecastBandItem}>
                    <Text variant="micro" color={colors.text.secondary}>
                      {t('market.predicted3Day')}
                    </Text>
                    <Text variant="bodyMedium" style={styles.forecastNumber}>
                      {formatRupees(pred.predicted_3_day_price_min)} - {formatRupees(pred.predicted_3_day_price_max)}
                    </Text>
                  </View>
                  <View style={styles.forecastBandItem}>
                    <Text variant="micro" color={colors.text.secondary}>
                      {t('market.predicted7Day')}
                    </Text>
                    <Text variant="bodyMedium" style={[styles.forecastNumber, { color: colors.primary }]}>
                      {formatRupees(pred.predicted_7_day_price_min)} - {formatRupees(pred.predicted_7_day_price_max)}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardHeaderRow}>
                  <Text variant="caption">{t('market.sevenDayTrend')}</Text>
                  <Text
                    variant="caption"
                    color={market.trend_7_days >= 0 ? colors.success : colors.danger}
                    style={styles.trendPercent}
                  >
                    {market.trend_7_days >= 0 ? `+${market.trend_7_days}%` : `${market.trend_7_days}%`}
                  </Text>
                </View>

                <View style={styles.trendContainer}>
                  {market.historical_prices && market.historical_prices.length >= 2 ? (
                    <TrendBars prices={market.historical_prices} />
                  ) : (
                    <Text variant="micro" color={colors.text.muted}>
                      {t('market.trendNeedsHistory')}
                    </Text>
                  )}
                </View>

                <Text variant="micro" color={colors.text.muted} style={styles.provenanceText}>
                  {t('market.observedOn', {
                    date: market.date,
                    mandi: market.location,
                  })}
                </Text>
              </Card>
            </GuideTarget>
          ) : null}

          {/* Quality & Grade Breakdown */}
          {quality && explanation ? (
            <Card>
              <View style={styles.cardHeaderRow}>
                <Text variant="cardTitle">{t('market.qualityBreakdown')}</Text>
                <Badge label={`Grade ${quality.quality_grade}`} tone="accent" />
              </View>

              <View style={styles.qualityMetricsRow}>
                <View style={styles.metricBox}>
                  <Text variant="micro" color={colors.text.secondary}>
                    {t('market.qualityScore')}
                  </Text>
                  <Text variant="cardTitle" style={styles.metricVal}>
                    {quality.quality_score}/100
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text variant="micro" color={colors.text.secondary}>
                    {t('market.damage')}
                  </Text>
                  <Text variant="cardTitle" style={styles.metricVal}>
                    {quality.visible_damage_percentage}%
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text variant="micro" color={colors.text.secondary}>
                    {t('market.moistureLabel')}
                  </Text>
                  <Text variant="cardTitle" style={styles.metricVal}>
                    {moisture}%
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.toggleAdjustmentsBtn}
                onPress={() => setShowAdjustments((prev) => !prev)}
              >
                <Text variant="micro" color={colors.primary} style={styles.toggleText}>
                  {showAdjustments ? 'Hide Quality Adjustments' : t('market.viewAdjustments')}
                </Text>
                <Icon
                  name="chevron"
                  size={14}
                  color={colors.primary}
                  strokeWidth={2}
                />
              </Pressable>

              {showAdjustments ? (
                <View style={styles.adjustmentsList}>
                  {explanation.adjustments.map((adj, idx) => (
                    <View key={idx} style={styles.adjustmentItem}>
                      <Text variant="caption" color={colors.text.secondary}>
                        {adj.label}
                      </Text>
                      <Text
                        variant="caption"
                        color={
                          adj.type === 'base'
                            ? colors.text.primary
                            : adj.amount >= 0
                            ? colors.success
                            : colors.danger
                        }
                        style={styles.adjAmount}
                      >
                        {adj.amount >= 0 && adj.type !== 'base' ? `+₹${adj.amount}` : `₹${adj.amount}`}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.adjSummaryRow}>
                    <Text variant="bodyMedium" color={colors.text.primary}>
                      {t('market.adjustedPrice')}
                    </Text>
                    <Text variant="cardTitle" color={colors.primary}>
                      {formatRupees(explanation.adjusted_price)}/q
                    </Text>
                  </View>
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* Direct Verified Buyers Marketplace */}
          {buyers.length > 0 ? (
            <View style={styles.buyersSection}>
              <View style={styles.buyersHeaderRow}>
                <Text variant="cardTitle" color={colors.text.primary}>
                  {t('market.buyerMatchesTitle')}
                </Text>
                <Badge label={`${buyers.length} Matches`} tone="success" />
              </View>

              {buyers.map((buyer) => {
                const isBest = bestBuyer && bestBuyer.id === buyer.id;
                return (
                  <Card key={buyer.id} style={[styles.buyerCard, isBest && styles.bestBuyerCard]}>
                    {isBest ? (
                      <View style={styles.bestBuyerRibbon}>
                        <Icon name="check" size={14} color="#fff" />
                        <Text variant="micro" color="#fff" style={styles.ribbonText}>
                          {t('market.bestBuyerTitle')}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.buyerHeader}>
                      <View style={styles.buyerInfo}>
                        <Text variant="cardTitle" color={colors.text.primary}>
                          {buyer.name}
                        </Text>
                        <Text variant="micro" color={colors.text.secondary}>
                          {buyer.buyer_type} • Min Grade {buyer.minimum_grade}
                        </Text>
                      </View>
                      <View style={styles.matchScoreBadge}>
                        <Text variant="caption" color={colors.primary} style={styles.matchScoreText}>
                          {buyer.match_score}% Match
                        </Text>
                      </View>
                    </View>

                    <View style={styles.buyerPillsRow}>
                      <View style={styles.buyerPill}>
                        <Icon name="pin" size={12} color={colors.text.secondary} />
                        <Text variant="micro" color={colors.text.secondary}>
                          {buyer.distance_km} km
                        </Text>
                      </View>
                      {buyer.pickup_available ? (
                        <View style={[styles.buyerPill, styles.pickupPill]}>
                          <Icon name="check" size={12} color={colors.success} />
                          <Text variant="micro" color={colors.success}>
                            {t('market.freePickup')}
                          </Text>
                        </View>
                      ) : null}
                      {buyer.verified ? (
                        <View style={[styles.buyerPill, styles.verifiedPill]}>
                          <Icon name="check" size={12} color={colors.primary} />
                          <Text variant="micro" color={colors.primary}>
                            {t('market.verifiedBuyer')}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.buyerPill}>
                        <Icon name="clock" size={12} color={colors.text.secondary} />
                        <Text variant="micro" color={colors.text.secondary}>
                          {t('market.hours', { count: buyer.payment_time_hours })}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.buyerNetRow}>
                      <View>
                        <Text variant="micro" color={colors.text.secondary}>
                          Gross: {formatRupees(buyer.offered_price)}/q
                        </Text>
                        <Text variant="cardTitle" style={styles.netPayoutValue}>
                          {formatRupees(buyer.net_realisation.net_realisation_per_quintal)}
                          <Text variant="caption" color={colors.text.muted}> /qtl</Text>
                        </Text>
                        <Text variant="micro" color={colors.text.secondary}>
                          {t('market.netRealisation')}
                        </Text>
                      </View>

                      <View style={styles.totalRevenueBox}>
                        <Text variant="micro" color={colors.text.secondary}>
                          Est. Total Payout
                        </Text>
                        <Text variant="cardTitle" color={colors.primary} style={styles.totalRevenueText}>
                          {formatRupees(buyer.net_realisation.total_net_revenue)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          ) : (
            <EmptyState icon="market" title={t('market.emptyTitle')} testID="market-empty" />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TrendBars({ prices }: { prices: Array<{ date: string; modal_price: number }> }) {
  const series = [...prices].slice(-10);
  const values = series.map((p) => p.modal_price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return (
    <View style={styles.sparklineContainer} testID="price-trend">
      {series.map((item, index) => {
        const heightPct = 12 + ((item.modal_price - min) / span) * 36;
        return (
          <View key={index} style={styles.sparkBarCol}>
            <View style={[styles.sparkBar, { height: heightPct }]} />
            <Text variant="micro" color={colors.text.muted} style={styles.sparkDate}>
              {item.date.slice(5)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 110,
    gap: layout.cardGap,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#e6ede3',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentText: {
    fontFamily: fonts.medium,
    color: colors.text.secondary,
  },
  segmentTextActive: {
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: '#ebf1e8',
    borderWidth: 1,
    borderColor: '#d6e2d1',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    color: colors.text.primary,
  },
  chipTextActive: {
    fontFamily: fonts.semibold,
    color: '#ffffff',
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  inputCol: {
    flex: 1,
  },
  fieldLabel: {
    marginBottom: 6,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
    height: 48,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#f2f8ef',
  },
  photoBtnText: {
    fontFamily: fonts.semibold,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginTop: 12,
  },
  imagePreview: {
    width: '100%',
    height: 140,
    borderRadius: radius.md,
  },
  imageBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26, 77, 46, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  analyseBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyseBtnDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    fontFamily: fonts.semibold,
  },
  recommendationCard: {
    borderWidth: 1.5,
  },
  recWait: {
    backgroundColor: '#f1f8ee',
    borderColor: '#98cfa0',
  },
  recSell: {
    backgroundColor: '#fdf7ea',
    borderColor: '#edd49d',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  profitNumber: {
    fontSize: 26,
    color: colors.text.primary,
    fontFamily: fonts.semibold,
  },
  waitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  waitBadgeText: {
    fontFamily: fonts.semibold,
  },
  recReason: {
    marginTop: 8,
    lineHeight: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceOverviewGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  priceOverviewCell: {
    flex: 1,
  },
  priceValue: {
    fontSize: 20,
    marginTop: 2,
    fontFamily: fonts.semibold,
  },
  forecastBands: {
    flexDirection: 'row',
    backgroundColor: '#f4f8f2',
    padding: 10,
    borderRadius: radius.md,
    gap: 12,
  },
  forecastBandItem: {
    flex: 1,
  },
  forecastNumber: {
    fontFamily: fonts.semibold,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  trendPercent: {
    fontFamily: fonts.semibold,
  },
  trendContainer: {
    marginTop: 6,
    height: 60,
  },
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 52,
  },
  sparkBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  sparkBar: {
    width: 12,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  sparkDate: {
    fontSize: 9,
    marginTop: 3,
  },
  provenanceText: {
    marginTop: 8,
  },
  qualityMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#f4f8f2',
    padding: 10,
    borderRadius: radius.md,
  },
  metricVal: {
    fontSize: 16,
    marginTop: 4,
  },
  toggleAdjustmentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
  },
  toggleText: {
    fontFamily: fonts.semibold,
  },
  adjustmentsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  adjustmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adjAmount: {
    fontFamily: fonts.semibold,
  },
  adjSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buyersSection: {
    gap: 12,
  },
  buyersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buyerCard: {
    position: 'relative',
    gap: 10,
  },
  bestBuyerCard: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  bestBuyerRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  ribbonText: {
    fontFamily: fonts.semibold,
  },
  buyerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  buyerInfo: {
    flex: 1,
  },
  matchScoreBadge: {
    backgroundColor: '#ebf4e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  matchScoreText: {
    fontFamily: fonts.semibold,
  },
  buyerPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  buyerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f4ee',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pickupPill: {
    backgroundColor: '#e7f7e9',
  },
  verifiedPill: {
    backgroundColor: '#e9f1f7',
  },
  buyerNetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  netPayoutValue: {
    fontSize: 22,
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
  totalRevenueBox: {
    alignItems: 'flex-end',
  },
  totalRevenueText: {
    fontSize: 18,
    fontFamily: fonts.semibold,
  },
});
