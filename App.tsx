import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { DataProvider } from './src/context/DataContext';
import RootNavigator from './src/navigation/RootNavigator';
import './src/utils/AlertManager'; // Register global Alert override
import CustomAlertModal from './src/components/CustomAlertModal';
import Toast from 'react-native-toast-message';

function AppContent() {
  const { theme, isDarkMode } = useAppTheme();

  return (
    <NavigationContainer theme={theme as any}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.card}
      />
      <RootNavigator />
      <CustomAlertModal />
      <Toast />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DataProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </DataProvider>
    </SafeAreaProvider>
  );
}
