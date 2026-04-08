import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";

import { colors } from "@/application/theme";
import { SportSlug } from "@/core/types/models";

type Props = {
  sport: SportSlug;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function SportIcon({
  sport,
  size = 24,
  color = colors.text,
  strokeWidth = 1.9
}: Props) {
  const commonStroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none" as const
  };

  switch (sport) {
    case "pickleball":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...commonStroke} d="M8.8 6.1c0-1.5 1.2-2.7 2.7-2.7h3.5c2.3 0 4.2 1.9 4.2 4.2v5.1c0 3.2-2.6 5.8-5.8 5.8h-1.9a2.7 2.7 0 0 1-2.7-2.7z" />
          <Path {...commonStroke} d="M9 14.9 6.2 20.7" />
          <Circle cx="12.2" cy="8.2" r="0.7" fill={color} />
          <Circle cx="15" cy="9.8" r="0.7" fill={color} />
          <Circle cx="12.8" cy="11.9" r="0.7" fill={color} />
        </Svg>
      );
    case "tennis":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Ellipse {...commonStroke} cx="10.3" cy="8.9" rx="4.8" ry="6.5" transform="rotate(-28 10.3 8.9)" />
          <Line {...commonStroke} x1="7.8" y1="4.7" x2="13.1" y2="14.8" />
          <Line {...commonStroke} x1="6.1" y1="7" x2="11.4" y2="17.1" />
          <Line {...commonStroke} x1="9.5" y1="3.8" x2="14.8" y2="13.9" />
          <Path {...commonStroke} d="M14.1 15.2 18.2 20.5" />
          <Path {...commonStroke} d="M16.3 13.8 20.4 19.1" />
        </Svg>
      );
    case "basketball":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...commonStroke} cx="12" cy="12" r="8.2" />
          <Path {...commonStroke} d="M12 3.8c2.3 2.2 3.5 5 3.5 8.2S14.3 18 12 20.2" />
          <Path {...commonStroke} d="M12 3.8c-2.3 2.2-3.5 5-3.5 8.2S9.7 18 12 20.2" />
          <Line {...commonStroke} x1="3.8" y1="12" x2="20.2" y2="12" />
        </Svg>
      );
    case "volleyball":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...commonStroke} cx="12" cy="12" r="8.2" />
          <Path {...commonStroke} d="M12 3.8c2.9 1.2 4.8 3.4 5.8 6.4" />
          <Path {...commonStroke} d="M18.2 10.2c-.2 3.1-1.6 5.6-4.4 7.4" />
          <Path {...commonStroke} d="M13.8 17.6c-3.1.2-5.8-.8-8-3.2" />
          <Path {...commonStroke} d="M6 14.4c-.3-3 1-5.8 3.4-7.9" />
          <Path {...commonStroke} d="M9.4 6.5c1.5 1.5 3.2 2.2 5.5 2.3" />
        </Svg>
      );
    case "running":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...commonStroke} d="M4.1 15.3h3.6l2.2-3.6h3.8l2.4 2.5h2.1c1.2 0 2.1 1 2.1 2.2v.5H4.9C3.9 16.9 3 16 3 15c0-.3.3-.6 1.1-.6Z" />
          <Path {...commonStroke} d="M9.6 11.6 8 8.9h2.7l1.8 2.7" />
          <Line {...commonStroke} x1="6.7" y1="18.5" x2="18.1" y2="18.5" />
        </Svg>
      );
    case "golf":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...commonStroke} d="M8.8 4.2v13.8" />
          <Path {...commonStroke} d="M8.9 4.4c2.1.2 3.9.9 5.5 2.1-1.4 1.6-3.2 2.6-5.5 3" />
          <Line {...commonStroke} x1="5.5" y1="19.8" x2="18.5" y2="19.8" />
          <Path {...commonStroke} d="M15.9 15.6h1.7a1.8 1.8 0 0 1 1.8 1.8v2.4H15v-2.1c0-1.2.4-2.1.9-2.1Z" />
        </Svg>
      );
  }
}
