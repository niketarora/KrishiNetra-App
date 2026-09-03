import Svg, { Path, Defs, Marker, Polygon } from 'react-native-svg';
import { StyleProp, View, ViewStyle } from 'react-native';

type Props = {
  direction: 'up-right' | 'down' | 'up';
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Curved yellow directional arrow matching the flashcard design references.
 */
export function CurvedArrow({ direction, color = '#F59E0B', style }: Props) {
  if (direction === 'up-right') {
    // Curves from bottom-left to top-right towards profile avatar
    return (
      <View style={style} pointerEvents="none">
        <Svg width={70} height={70} viewBox="0 0 70 70" fill="none">
          <Defs>
            <Marker id="arrow-head" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <Polygon points="0 0, 6 3, 0 6" fill={color} />
            </Marker>
          </Defs>
          <Path
            d="M 10 55 C 20 60, 45 50, 56 22"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            fill="none"
          />
          {/* Hand-drawn style arrowhead */}
          <Path
            d="M 45 23 L 57 20 L 59 33"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  if (direction === 'down') {
    // Curves from top down towards My Farm
    return (
      <View style={style} pointerEvents="none">
        <Svg width={60} height={60} viewBox="0 0 60 60" fill="none">
          <Path
            d="M 50 10 C 42 12, 22 20, 26 44"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            fill="none"
          />
          {/* Arrowhead pointing down */}
          <Path
            d="M 16 35 L 26 46 L 36 35"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  // direction === 'up'
  // Curves up towards Mark boundary on map
  return (
    <View style={style} pointerEvents="none">
      <Svg width={60} height={60} viewBox="0 0 60 60" fill="none">
        <Path
          d="M 20 50 C 28 48, 42 38, 36 16"
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
        />
        {/* Arrowhead pointing up */}
        <Path
          d="M 26 24 L 35 14 L 45 24"
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
