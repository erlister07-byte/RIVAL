import { ReactElement } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";

export type SportSvgProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  strokeWidth?: number;
};

const DEFAULT_SIZE = 20;
const DEFAULT_COLOR = "#111827";
const DEFAULT_STROKE_WIDTH = 1.9;

function createStroke(color: string, strokeWidth: number) {
  return {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none" as const
  };
}

export function PickleballIcon({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  style,
  strokeWidth = DEFAULT_STROKE_WIDTH
}: SportSvgProps): ReactElement {
  const stroke = createStroke(color, strokeWidth);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        {...stroke}
        d="M9.5 5.8c0-1.8 1.4-3.2 3.2-3.2h1.9c3 0 5.4 2.4 5.4 5.4v3.7c0 3.7-3 6.7-6.7 6.7h-.8a3 3 0 0 1-3-3Z"
      />
      <Path {...stroke} d="M9.7 15.3 6.1 20.5" />
      <Circle cx="12.8" cy="7.6" r="0.75" fill={color} stroke="none" />
      <Circle cx="15.5" cy="9.2" r="0.75" fill={color} stroke="none" />
      <Circle cx="13.1" cy="11.4" r="0.75" fill={color} stroke="none" />
    </Svg>
  );
}

export function TennisIcon({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  style,
  strokeWidth = DEFAULT_STROKE_WIDTH
}: SportSvgProps): ReactElement {
  const stroke = createStroke(color, strokeWidth);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Ellipse {...stroke} cx="9.8" cy="10" rx="4.7" ry="6.1" transform="rotate(28 9.8 10)" />
      <Line {...stroke} x1="8.4" y1="6" x2="13.9" y2="14.1" />
      <Line {...stroke} x1="7" y1="7.7" x2="12.5" y2="15.8" />
      <Path {...stroke} d="M14.5 15 18.9 19.7" />
    </Svg>
  );
}

export function VolleyballIcon({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  style,
  strokeWidth = DEFAULT_STROKE_WIDTH
}: SportSvgProps): ReactElement {
  const stroke = createStroke(color, strokeWidth);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Circle {...stroke} cx="12" cy="12" r="8" />
      <Path {...stroke} d="M12 4.2a8.6 8.6 0 0 1 5.7 4" />
      <Path {...stroke} d="M18.7 10.5a8.7 8.7 0 0 1-4.6 6.7" />
      <Path {...stroke} d="M7.2 18.1a8.6 8.6 0 0 1-3.9-6.2" />
    </Svg>
  );
}

export function BasketballIcon({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  style,
  strokeWidth = DEFAULT_STROKE_WIDTH
}: SportSvgProps): ReactElement {
  const stroke = createStroke(color, strokeWidth);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Circle {...stroke} cx="12" cy="12" r="8" />
      <Line {...stroke} x1="12" y1="4" x2="12" y2="20" />
      <Path {...stroke} d="M5.1 14.2c2-1.4 4.4-2.1 6.9-2.1 2.6 0 5 .7 6.9 2.1" />
    </Svg>
  );
}

export function GolfIcon({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  style,
  strokeWidth = DEFAULT_STROKE_WIDTH
}: SportSvgProps): ReactElement {
  const stroke = createStroke(color, Math.max(strokeWidth, 2));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path {...stroke} d="M7.6 3.6v14.5" />
      <Path {...stroke} d="M8.1 4.2c2.1.3 3.8 1 5.3 2.2-1.4 1.5-3.1 2.4-5.3 2.8" />
      <Path {...stroke} d="M5.3 19.3h10.8" />
      <Circle cx="17.8" cy="19.3" r="0.95" fill={color} stroke="none" />
    </Svg>
  );
}

export function RunningIcon({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  style,
  strokeWidth = DEFAULT_STROKE_WIDTH
}: SportSvgProps): ReactElement {
  const stroke = createStroke(color, Math.max(strokeWidth, 2));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        {...stroke}
        d="M4.3 15.5h4.9l2.1-3.1h4.3l2.5 2.7h2.3c.9 0 1.6.7 1.6 1.6v.7H8.2c-1.6 0-2.9-.7-3.9-1.9Z"
      />
      <Path {...stroke} d="M9.6 12.3 8.1 9.6h3l1.5 2.7" />
      <Path {...stroke} d="M6.4 19.1h11.7" />
    </Svg>
  );
}
