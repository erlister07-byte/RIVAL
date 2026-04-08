import { ReactNode } from "react";

import { MainLayout } from "@/components/ui/MainLayout";

type Props = {
  children: ReactNode;
  scrollable?: boolean;
};

export function Screen({ children, scrollable = true }: Props) {
  return <MainLayout scrollable={scrollable}>{children}</MainLayout>;
}
