import { ReactElement } from "react";
import { StyleProp, ViewStyle } from "react-native";

import { colors } from "@/application/theme";
import { SportSlug } from "@/core/types/models";
import {
  BasketballIcon,
  GolfIcon,
  PickleballIcon,
  RunningIcon,
  SportSvgProps,
  TennisIcon,
  VolleyballIcon
} from "@/components/icons/SportIcons";

type Props = {
  sport: SportSlug;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

const SPORT_ICON_MAP: Record<SportSlug, (props: SportSvgProps) => ReactElement> = {
  pickleball: PickleballIcon,
  tennis: TennisIcon,
  volleyball: VolleyballIcon,
  basketball: BasketballIcon,
  golf: GolfIcon,
  running: RunningIcon
};

export function SportIcon({
  sport,
  size = 24,
  color = colors.text,
  strokeWidth = 1.9,
  style
}: Props) {
  const Icon = SPORT_ICON_MAP[sport];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}
