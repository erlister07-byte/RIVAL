import { ReactNode } from "react";
import { ViewStyle } from "react-native";

import { Card as UiCard } from "@/components/ui/Card";

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <UiCard style={style}>{children}</UiCard>;
}
