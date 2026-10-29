import { DefaultTheme, DarkTheme } from '@react-navigation/native';

export const fonts = {
  regular: 'Urbanist-Regular',
  medium: 'Urbanist-Medium',
  semiBold: 'Urbanist-SemiBold',
  bold: 'Urbanist-Bold',
  extraBold: 'Urbanist-ExtraBold',
  heavy: 'Urbanist-ExtraBold',
  black: 'Urbanist-Black',
  light: 'Urbanist-Light',
  extraLight: 'Urbanist-ExtraLight',
  thin: 'Urbanist-Thin',
  italic: 'Urbanist-Italic',
  boldItalic: 'Urbanist-BoldItalic',
  semiBoldItalic: 'Urbanist-SemiBoldItalic',
  mediumItalic: 'Urbanist-MediumItalic',
} as const;

export const typography = {
  regular: { fontFamily: fonts.regular },
  medium: { fontFamily: fonts.medium },
  semiBold: { fontFamily: fonts.semiBold },
  bold: { fontFamily: fonts.bold },
  extraBold: { fontFamily: fonts.extraBold },
  black: { fontFamily: fonts.black },
  light: { fontFamily: fonts.light },
  extraLight: { fontFamily: fonts.extraLight },
  thin: { fontFamily: fonts.thin },
};

export const CustomLightTheme = {
  ...DefaultTheme,
  dark: false,
  fonts,
  typography,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0F172A', // Slate 900
    primaryContainer: '#E2E8F0', // Slate 200
    secondary: '#0284C7', // Sky 600
    secondaryContainer: '#E0F2FE', // Sky 100
    background: '#F8FAFC', // Slate 50
    card: '#FFFFFF', // White
    text: '#0F172A', // Slate 900
    border: '#E2E8F0', // Slate 200
    notification: '#EF4444',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    placeholder: '#64748B',
    accent: '#F59E0B', // Yellow gold plate accent
  },
};

export const CustomDarkTheme = {
  ...DarkTheme,
  dark: true,
  fonts,
  typography,
  colors: {
    ...DarkTheme.colors,
    primary: '#F8FAFC', // Slate 50
    primaryContainer: '#334155', // Slate 700
    secondary: '#38BDF8', // Sky 400
    secondaryContainer: '#0C4A6E', // Sky 900
    background: '#0F172A', // Slate 900
    card: '#1E293B', // Slate 800
    text: '#F8FAFC', // Slate 50
    border: '#334155', // Slate 700
    notification: '#F87171',
    error: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    placeholder: '#94A3B8',
    accent: '#FBBF24', // Yellow gold plate accent
  },
};

export type AppTheme = typeof CustomLightTheme;
