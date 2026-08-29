import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Mapbox, {
  Camera,
  FillLayer,
  LineLayer,
  LocationPuck,
  MapView,
  PointAnnotation,
  ShapeSource,
  StyleURL,
} from '@rnmapbox/maps';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/ui/Banner';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { colors } from '@/theme';
import { bounds, fromPosition, toGeoJSON, toPosition } from '@/utils/geo';

import type { BoundaryMapProps } from './BoundaryMap.types';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

if (MAPBOX_ACCESS_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

const DEFAULT_CENTRE = { latitude: 22.9734, longitude: 78.6569 };
const DEFAULT_ZOOM = 16.5;

function BoundaryMapComponent({
  points,
  initialCentre,
  initialZoom = DEFAULT_ZOOM,
  onAddPoint,
  onMovePoint,
  onReady,
  onError,
  editable = true,
  showsUserLocation = false,
}: BoundaryMapProps) {
  const { t } = useTranslation();
  const cameraRef = useRef<Camera>(null);

  const centre = initialCentre ?? (points[0] ? points[0] : DEFAULT_CENTRE);

  useEffect(() => {
    if (!cameraRef.current) return;
    if (points.length >= 3) {
      const b = bounds(points);
      cameraRef.current.fitBounds([b.maxLng, b.maxLat], [b.minLng, b.minLat], [40, 40, 40, 40], 400);
    }
  }, [points]);

  const handlePress = useCallback(
    (feature: any) => {
      if (!editable || !onAddPoint) return;
      const coords = feature?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        onAddPoint(fromPosition(coords as [number, number]));
      }
    },
    [editable, onAddPoint],
  );

  const handleRecenter = useCallback(() => {
    if (!cameraRef.current) return;
    if (points.length >= 3) {
      const b = bounds(points);
      cameraRef.current.fitBounds([b.maxLng, b.maxLat], [b.minLng, b.minLat], [40, 40, 40, 40], 500);
    } else if (initialCentre) {
      cameraRef.current.setCamera({
        centerCoordinate: toPosition(initialCentre),
        zoomLevel: initialZoom,
        animationDuration: 500,
      });
    }
  }, [points, initialCentre, initialZoom]);

  const featureCollection = useMemo(() => {
    if (points.length < 3) return null;
    try {
      const geojson = toGeoJSON(points);
      return {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: geojson,
            properties: {},
          },
        ],
      };
    } catch {
      return null;
    }
  }, [points]);

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <View style={styles.errorContainer}>
        <Banner
          title={t('onboarding.mapTokenMissing', 'Mapbox access token is missing')}
          tone="warning"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={StyleURL.SatelliteStreet}
        onPress={handlePress}
        onDidFinishLoadingMap={onReady}
        onMapLoadingError={onError}
        scaleBarEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
        testID="boundary-map"
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: toPosition(centre),
            zoomLevel: initialZoom,
          }}
        />

        {showsUserLocation ? <LocationPuck puckBearing="heading" puckBearingEnabled /> : null}

        {featureCollection ? (
          <ShapeSource id="boundary-source" shape={featureCollection}>
            <FillLayer
              id="boundary-fill"
              style={{
                fillColor: colors.polygonFill,
                fillOpacity: 1,
              }}
            />
            <LineLayer
              id="boundary-line"
              style={{
                lineColor: colors.primary,
                lineWidth: 3,
              }}
            />
          </ShapeSource>
        ) : null}

        {editable
          ? points.map((point, index) => (
              <PointAnnotation
                key={`vertex-${index}`}
                id={`vertex-${index}`}
                coordinate={toPosition(point)}
                draggable
                onDragEnd={(feature: any) => {
                  const coords = feature?.geometry?.coordinates;
                  if (Array.isArray(coords) && coords.length >= 2) {
                    onMovePoint?.(index, fromPosition(coords as [number, number]));
                  }
                }}
              >
                <View style={styles.vertex} />
              </PointAnnotation>
            ))
          : null}
      </MapView>

      <View style={styles.satellitePill} pointerEvents="none">
        <Text variant="microMedium" color="#FFFFFF">
          {t('onboarding.satelliteView')}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.recenterButton}
        onPress={handleRecenter}
        accessibilityLabel={t('onboarding.recenter', 'Recenter')}
        testID="recenter-button"
      >
        <Icon name="locate" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {editable ? (
        <View style={styles.hint} pointerEvents="none">
          <Text variant="micro" color="rgba(255,255,255,0.75)">
            {points.length === 0 ? t('onboarding.mapHint') : t('onboarding.mapHintDrag')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const BoundaryMap = memo(BoundaryMapComponent);

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 180, overflow: 'hidden', backgroundColor: colors.mapBase },
  errorContainer: { flex: 1, minHeight: 180, padding: 16, justifyContent: 'center' },
  vertex: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  satellitePill: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: 'rgba(28,31,26,0.82)',
  },
  recenterButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(28,31,26,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: { position: 'absolute', bottom: 10, right: 12 },
});
