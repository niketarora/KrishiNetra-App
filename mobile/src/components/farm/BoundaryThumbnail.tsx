import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';
import { normalizeForThumbnail, type LatLng } from '@/utils/geo';

type Props = {
  points: LatLng[];
  size?: number;
};

/**
 * A small preview of the farmer's actual drawn boundary, rendered as SVG from
 * the saved coordinates. Used on the Home field card and the confirm screen.
 *
 * Drawn from real data rather than a stock image, so the card shows the shape
 * the farmer walked — the field summary is one of the few genuinely populated
 * surfaces in Phase 1.
 */
export function BoundaryThumbnail({ points, size = 64 }: Props) {
  const normalized = normalizeForThumbnail(points);

  const path =
    normalized.length >= 3
      ? `${normalized
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * 80 + 10).toFixed(2)} ${(p.y * 80 + 10).toFixed(2)}`)
          .join(' ')} Z`
      : null;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      {path ? (
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path
            d={path}
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
    // Stands in for the satellite tile behind the boundary in the prototype.
    backgroundColor: colors.mapBase,
  },
});
