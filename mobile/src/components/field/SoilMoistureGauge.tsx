import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';

type Props = {
  percent: number; // 0 - 100
  size?: number;
};

/**
 * Semi-circular Soil Moisture Arc Gauge with dynamic needle indicator,
 * matching KrishiNetra 2.0 reference design (Screenshot 3).
 */
export function SoilMoistureGauge({ percent, size = 110 }: Props) {
  const clamped = Math.max(0, Math.min(100, isNaN(percent) ? 0 : percent));
  
  // Radius and center coordinates in a 120 x 70 viewBox
  const cx = 60;
  const cy = 60;
  const r = 46;

  // Semicircle arc goes from 180° (left) over 270° (top) to 360° (right)
  // angle in radians for current percentage:
  const angleDeg = 180 + (clamped / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;

  // Needle tip position
  const needleLength = 38;
  const nx = cx + needleLength * Math.cos(angleRad);
  const ny = cy + needleLength * Math.sin(angleRad);

  // Target dot on the arc
  const dx = cx + r * Math.cos(angleRad);
  const dy = cy + r * Math.sin(angleRad);

  // Background track path: 180 to 360 deg
  const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Active progress path
  // If angleDeg <= 180, nothing; if angleDeg >= 360, full
  const largeArc = clamped > 50 ? 1 : 0;
  const activePath = clamped > 0
    ? `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${dx} ${dy}`
    : '';

  // Tick marks at 20%, 40%, 60%, 80%
  const ticks = [20, 40, 60, 80].map((t) => {
    const rad = ((180 + (t / 100) * 180) * Math.PI) / 180;
    const x1 = cx + (r - 6) * Math.cos(rad);
    const y1 = cy + (r - 6) * Math.sin(rad);
    const x2 = cx + (r - 2) * Math.cos(rad);
    const y2 = cy + (r - 2) * Math.sin(rad);
    return { x1, y1, x2, y2, key: t };
  });

  return (
    <View style={[styles.container, { width: size, height: size * 0.65 }]}>
      <Svg width={size} height={size * 0.65} viewBox="0 0 120 70">
        {/* Background arc */}
        <Path
          d={trackPath}
          stroke="#C8E6C9"
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
        />

        {/* Active green progress arc */}
        {activePath ? (
          <Path
            d={activePath}
            stroke="#2E7D4F"
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}

        {/* Inner tick marks */}
        {ticks.map((tick) => (
          <Line
            key={tick.key}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="#81C784"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        ))}

        {/* Indicator dot on arc */}
        <Circle cx={dx} cy={dy} r={4.5} fill="#1E4D2B" />

        {/* Needle */}
        <Line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#1C251D"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Pivot center */}
        <Circle cx={cx} cy={cy} r={5} fill="#1C251D" />
        <Circle cx={cx} cy={cy} r={2} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
