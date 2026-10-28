// Lightweight SVG charts (react-native-svg). No charting dependency needed.
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from './theme';

export function BarChart({
  data,
  height = 140,
  max,
  color = colors.primary,
  format = (v: number) => `${Math.round(v * 100)}%`,
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  max?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const top = Math.max(max ?? 0, ...data.map((d) => d.value), 0.0001);
  const W = 320;
  const chartH = height - 34;
  const slot = W / Math.max(1, data.length);
  const barW = Math.min(36, slot * 0.6);
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} accessibilityLabel={`Bar chart: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}>
      <Line x1={0} x2={W} y1={chartH + 14} y2={chartH + 14} stroke={colors.border} />
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / top) * chartH);
        const x = i * slot + (slot - barW) / 2;
        return (
          <Rect key={`${d.label}-${i}`} x={x} y={chartH + 14 - h} width={barW} height={h} rx={6} fill={d.color ?? color} opacity={0.9} />
        );
      })}
      {data.map((d, i) => (
        <SvgText key={`l${i}`} x={i * slot + slot / 2} y={height - 4} fontSize={10} fill={colors.muted} textAnchor="middle">
          {d.label}
        </SvgText>
      ))}
      {data.map((d, i) => (
        <SvgText key={`v${i}`} x={i * slot + slot / 2} y={Math.max(10, chartH + 10 - (d.value / top) * chartH)} fontSize={9.5} fill={colors.text} textAnchor="middle">
          {format(d.value)}
        </SvgText>
      ))}
    </Svg>
  );
}

/** Line chart for 1..5 mood scores; nulls are gaps. */
export function LineChart({ points, height = 130, min = 1, max = 5, color = colors.sim }: { points: (number | null)[]; height?: number; min?: number; max?: number; color?: string }) {
  const W = 320;
  const pad = 8;
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (height - pad * 2);
  let d = '';
  let pen = false;
  points.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    pen = true;
  });
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} accessibilityLabel="Mood trend line chart">
      {[1, 2, 3, 4, 5].map((g) => (
        <Line key={g} x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke={colors.border} strokeDasharray="3 4" />
      ))}
      <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((v, i) => (v === null ? null : <Circle key={i} cx={x(i)} cy={y(v)} r={2.6} fill={color} />))}
    </Svg>
  );
}

/** GitHub-style completion heatmap. Values are 0..1. */
export function Heatmap({ cells, columns = 13 }: { cells: { day: string; value: number | null }[]; columns?: number }) {
  const size = 18;
  const gap = 4;
  const rows = 7;
  const W = columns * (size + gap);
  const shade = (v: number | null) => (v === null ? colors.border : v === 0 ? '#EDEBF5' : v < 0.5 ? '#B9E4D3' : v < 1 ? '#6CC3A0' : colors.success);
  return (
    <Svg width="100%" height={rows * (size + gap)} viewBox={`0 0 ${W} ${rows * (size + gap)}`} accessibilityLabel="Daily completion heatmap">
      {cells.slice(-columns * rows).map((c, i) => (
        <Rect key={c.day} x={Math.floor(i / rows) * (size + gap)} y={(i % rows) * (size + gap)} width={size} height={size} rx={4} fill={shade(c.value)} />
      ))}
    </Svg>
  );
}

export function Ring({ value, size = 64, stroke = 7, color = colors.success, label }: { value: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${Math.round(v * 100)} percent`}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c * v} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontWeight: '800', fontSize: size / 4.2, color: colors.text }}>{label ?? `${Math.round(v * 100)}%`}</Text>
    </View>
  );
}
