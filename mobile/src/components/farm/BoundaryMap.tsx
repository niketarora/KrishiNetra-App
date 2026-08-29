import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { MapPressEvent, Marker, Polygon, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';
import type { LatLng } from '@/utils/geo';

import { Text } from '../ui/Text';

type Props = {
  region: Region;
  points: LatLng[];
  /** Omit both handlers to render a read-only preview. */
  onAddPoint?: (point: LatLng) => void;
  onMovePoint?: (index: number, point: LatLng) => void;
  /** Fires once the native map is up — the screen uses it to clear its timeout. */
  onReady?: () => void;
  editable?: boolean;
  /** Shows the device's live position as a blue dot. Off by default. */
  showsUserLocation?: boolean;
};

/**
 * Satellite map with the farmer's boundary drawn on it.
 *
 * Vertices are draggable rather than delete-and-redraw: a farmer standing at
 * the edge of their field will place a corner slightly off, and dragging it
 * into place is far easier than restarting. TRD §24 flags map re-renders as a
 * performance risk, so the vertex markers are memoised and `tracksViewChanges`
 * is off — without that, every marker re-rasterises on each drag frame.
 */
function BoundaryMapComponent({
  region,
  points,
  onAddPoint,
  onMovePoint,
  onReady,
  editable = true,
  showsUserLocation = false,
}: Props) {
  const { t } = useTranslation();

  const handlePress = useCallback(
    (event: MapPressEvent) => {
      if (!editable || !onAddPoint) return;
      onAddPoint(event.nativeEvent.coordinate);
    },
    [editable, onAddPoint],
  );

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        mapType="satellite"
        initialRegion={region}
        onPress={handlePress}
        onMapReady={onReady}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        loadingEnabled
        loadingBackgroundColor={colors.mapBase}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        testID="boundary-map"
      >
        {points.length >= 3 ? (
          <Polygon
            coordinates={points}
            strokeColor={colors.primary}
            strokeWidth={3}
            fillColor={colors.polygonFill}
          />
        ) : null}

        {editable
          ? points.map((point, index) => (
              <Marker
                key={`vertex-${index}`}
                coordinate={point}
                draggable
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
                onDragEnd={(event) => onMovePoint?.(index, event.nativeEvent.coordinate)}
                accessibilityLabel={`${t('onboarding.mapHintDrag')} ${index + 1}`}
              >
                <View style={styles.vertex} />
              </Marker>
            ))
          : null}
      </MapView>

      <View style={styles.satellitePill} pointerEvents="none">
        <Text variant="microMedium" color="#FFFFFF">
          {t('onboarding.satelliteView')}
        </Text>
      </View>

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
  vertex: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  satellitePill: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(28,31,26,0.82)',
  },
  hint: { position: 'absolute', bottom: 10, right: 12 },
});
