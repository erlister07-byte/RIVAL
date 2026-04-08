import { DefaultTheme } from "@react-navigation/native";
import { theme } from "@/styles/theme";

export const colors = {
  background: theme.colors.background,
  surface: theme.colors.white,
  surfaceMuted: theme.colors.gray100,
  surfaceRaised: theme.colors.white,
  text: theme.colors.gray700,
  textMuted: theme.colors.gray600,
  border: theme.colors.gray200,
  borderStrong: theme.colors.gray200,
  primary: theme.colors.primaryStart,
  primaryPressed: theme.colors.primaryEnd,
  primarySoft: "#EEF2FF",
  danger: theme.colors.error,
  error: theme.colors.error,
  success: theme.colors.success,
  warning: theme.colors.warning,
  accent: theme.colors.primaryEnd,
  accentSoft: "#ECFEFF",
  shadow: "rgba(0,0,0,0.08)",
  white: theme.colors.white,
  gray100: theme.colors.gray100,
  gray200: theme.colors.gray200,
  gray400: theme.colors.gray400,
  gray600: theme.colors.gray600,
  gray700: theme.colors.gray700,
  primaryStart: theme.colors.primaryStart,
  primaryEnd: theme.colors.primaryEnd
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
  xxxl: 56
};

export const radius = {
  sm: 16,
  md: 16,
  lg: 16,
  pill: 999
};

export const typography = {
  hero: 36,
  title: 30,
  heading: 24,
  subheading: 18,
  body: 15,
  bodyStrong: 16,
  caption: 13,
  overline: 12
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 10
    },
    elevation: 6
  }
};

export const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.primary,
    text: colors.text,
    border: colors.border
  }
};
