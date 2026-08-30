import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  FillLayer,
  LineLayer,
  MapView,
  Mapbox,
  ShapeSource,
  StyleURL,
  isNativeMapboxAvailable,
} from './mapboxSafe';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';
import { bounds, isValidPolygon, normalizeForThumbnail, toGeoJSON, type LatLng } from '@/utils/geo';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

if (isNativeMapboxAvailable && MAPBOX_ACCESS_TOKEN && Mapbox?.setAccessToken) {
  try {
    Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
  } catch {
    // Non-fatal
  }
}

type Props = {
  points: LatLng[];
  size?: number;
  borderRadius?: number;
};

/**
 * A preview of the farmer's drawn boundary. On native platforms with Mapbox,
 * renders a mini satellite-streets map fitted to the boundary polygon with
 * pointer events disabled. Falls back to an SVG path on web or missing token.
 */
export function BoundaryThumbnail({ points, size = 64, borderRadius = 8 }: Props) {
  const hasValidBoundary = isValidPolygon(points);

  const geojson = useMemo(() => {
    if (!hasValidBoundary) return null;
    try {
      return toGeoJSON(points);
    } catch {
      return null;
    }
  }, [points, hasValidBoundary]);

  const mapBounds = useMemo(() => {
    if (!hasValidBoundary) return null;
    const b = bounds(points);
    return {
      ne: [b.maxLng, b.maxLat] as [number, number],
      sw: [b.minLng, b.minLat] as [number, number],
      paddingBottom: 6,
      paddingLeft: 6,
      paddingRight: 6,
      paddingTop: 6,
    };
  }, [points, hasValidBoundary]);

  const normalized = normalizeForThumbnail(points);
  const svgPath =
    normalized.length >= 3
      ? `${normalized
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * 80 + 10).toFixed(2)} ${(p.y * 80 + 10).toFixed(2)}`)
          .join(' ')} Z`
      : null;

  return (
    <View
      style={[styles.frame, { width: size, height: size, borderRadius }]}
      pointerEvents="none"
      testID="boundary-thumbnail"
    >
      {hasValidBoundary && isNativeMapboxAvailable && MAPBOX_ACCESS_TOKEN && geojson && mapBounds ? (
        <MapView
          style={StyleSheet.absoluteFill}
          styleURL={StyleURL.SatelliteStreet}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          compassEnabled={false}
          scaleBarEnabled={false}
          attributionEnabled={false}
          logoEnabled={false}
        >
          <Camera defaultSettings={{ bounds: mapBounds }} />
          <ShapeSource id="thumb-polygon" shape={geojson}>
            <FillLayer
              id="thumb-fill"
              style={{
                fillColor: colors.polygonFillThumb,
                fillOpacity: 0.65,
              }}
            />
            <LineLayer
              id="thumb-stroke"
              style={{
                lineColor: '#FFFFFF',
                lineWidth: 2,
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        </MapView>
      ) : svgPath ? (
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path
            d={svgPath}
            fill={colors.polygonFillThumb}
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.mapBase,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
