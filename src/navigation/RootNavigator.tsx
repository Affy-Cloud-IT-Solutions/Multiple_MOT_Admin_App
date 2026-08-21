import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import CustomerPortalScreen from '../screens/CustomerPortalScreen';
import BookingScreen from '../screens/BookingScreen';
import BookedMotsScreen from '../screens/BookedMotsScreen';
import StaffListScreen from '../screens/StaffListScreen';
import CustomerDetailScreen from '../screens/CustomerDetailScreen';
import AdminBookMotScreen from '../screens/AdminBookMotScreen';
import MainTabNavigator from './MainTabNavigator';
import { useAppTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.card,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerPortal"
        component={CustomerPortalScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BookedMots"
        component={BookedMotsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminBookMot"
        component={AdminBookMotScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StaffList"
        component={StaffListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CustomerDetail"
        component={CustomerDetailScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
