import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors } from './theme';

/** Soft sunrise over layered hills and a lake. Decorative only. */
export function Landscape({ width = 220, height = 130 }: { width?: number; height?: number }) {
  return (
    // Hidden from screen readers on the wrapper: react-native-svg forwards accessibility props to the DOM on web.
    <View aria-hidden pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 220 130">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F3F1EB" stopOpacity="0" />
            <Stop offset="1" stopColor="#E4ECE4" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#B9CEC4" />
            <Stop offset="1" stopColor="#E3ECE6" />
          </LinearGradient>
          {/* Fades the scene into the page background on the left and bottom edges. */}
          <LinearGradient id="fadeLeft" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.bg} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.bg} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.bg} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="220" height="130" fill="url(#sky)" />
        <Circle cx="150" cy="44" r="20" fill="#F2DDB0" opacity={0.9} />
        <Path d="M0 92 L38 60 L62 76 L98 40 L134 72 L160 56 L220 88 L220 130 L0 130 Z" fill="#C8D8CD" />
        <Path d="M0 100 L30 82 L58 92 L92 66 L126 90 L170 70 L220 96 L220 130 L0 130 Z" fill="#9DB8A8" />
        <Path d="M0 108 L46 92 L84 104 L122 86 L162 102 L200 92 L220 100 L220 130 L0 130 Z" fill="#6F9483" />
        <Rect x="0" y="110" width="220" height="20" fill="url(#lake)" />
        <Path d="M70 118 H110 M128 123 H156 M30 124 H52" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.5} strokeLinecap="round" />
        <Rect x="0" y="0" width="90" height="130" fill="url(#fadeLeft)" />
        <Rect x="0" y="112" width="220" height="18" fill="url(#fadeBottom)" />
      </Svg>
    </View>
  );
}
