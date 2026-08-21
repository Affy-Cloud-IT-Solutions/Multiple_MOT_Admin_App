import { DefaultTheme, DarkTheme } from '@react-navigation/native';

export const CustomLightTheme = {
  ...DefaultTheme,
  dark: false,
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
