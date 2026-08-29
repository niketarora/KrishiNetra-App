import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';
import { normalizeForThumbnail, type LatLng } from '@/utils/geo';

type Props = {
  points: LatLng[];
  size?: number;
  borderRadius?: number;
};

export function BoundaryThumbnail({ points, size = 64, borderRadius = 8 }: Props) {
  const normalized = normalizeForThumbnail(points);

  const path =
    normalized.length >= 3
      ? `${normalized
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * 80 + 10).toFixed(2)} ${(p.y * 80 + 10).toFixed(2)}`)
          .join(' ')} Z`
      : null;

  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius }]} pointerEvents="none">
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
    backgroundColor: colors.mapBase,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
