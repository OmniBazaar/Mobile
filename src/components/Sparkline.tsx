/**
 * Sparkline — minimalist mini-chart over a flat numeric series.
 *
 * Renders an SVG polyline scaled to fit the supplied width × height.
 * Used in the Predictions market detail to show YES-price history,
 * but generic enough to feed any `[number]` series (no axes, no
 * tooltips — pure trend at a glance).
 *
 * Implementation notes:
 *   - Uses `react-native-svg` (already in Mobile's deps for QR code).
 *   - Empty / single-point input renders nothing so the caller doesn't
 *     have to gate.
 *   - Auto-fits y-range from the data; clamp to [0, 1] when the
 *     `clampUnit` flag is set (correct for prediction-market YES prices).
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { colors } from '../theme/colors';

/** Props. */
export interface SparklineProps {
  /** Numeric series, oldest → newest. */
  data: ReadonlyArray<number>;
  /** Pixel width. */
  width: number;
  /** Pixel height. */
  height: number;
  /** Stroke colour (defaults to brand primary). */
  color?: string;
  /** Stroke width in px. */
  strokeWidth?: number;
  /** When true, force the y-axis to [0, 1] (good for 0-1 probabilities). */
  clampUnit?: boolean;
}

/**
 * Render a single-stroke sparkline.
 * @param props - See {@link SparklineProps}.
 * @returns JSX.
 */
export default function Sparkline(props: SparklineProps): JSX.Element | null {
  const { data, width, height, color, strokeWidth, clampUnit } = props;
  if (data.length < 2) return null;

  const min = clampUnit === true ? 0 : Math.min(...data);
  const max = clampUnit === true ? 1 : Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke={color ?? colors.primary}
          strokeWidth={strokeWidth ?? 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
