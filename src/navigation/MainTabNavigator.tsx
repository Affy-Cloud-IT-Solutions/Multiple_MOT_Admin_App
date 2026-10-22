import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import SuperAdminDashboardScreen from '../screens/SuperAdminDashboardScreen';
import SuperAdminGaragesScreen from '../screens/SuperAdminGaragesScreen';
import SuperAdminAuditsScreen from '../screens/SuperAdminAuditsScreen';
import AdminCustomersScreen from '../screens/AdminCustomersScreen';
import AdminServicesScreen from '../screens/AdminServicesScreen';
import AdminSlotsScreen from '../screens/AdminSlotsScreen';
import AdminAlertsScreen from '../screens/AdminAlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { theme } = useAppTheme();
  const { user } = useAppValues();

  const isSuperAdmin = user?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = 'circle-outline';

          if (route.name === 'Dashboard') {
            iconName = 'view-dashboard-outline';
          } else if (route.name === 'Garages') {
            iconName = 'garage-variant';
          } else if (route.name === 'Services') {
            iconName = 'car-wrench';
          } else if (route.name === 'Audits') {
            iconName = 'clipboard-text-clock-outline';
          } else if (route.name === 'Customers') {
            iconName = 'account-group-outline';
          } else if (route.name === 'Slots') {
            iconName = 'calendar-clock-outline';
          } else if (route.name === 'Reminders') {
            iconName = 'bell-outline';
          } else if (route.name === 'Profile') {
            iconName = 'cog-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.secondary,
        tabBarInactiveTintColor: theme.colors.placeholder,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          elevation: 8,
          shadowOpacity: 0.1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontWeight: 'bold',
          fontSize: 11,
        },
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 2,
          shadowOpacity: 0.05,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      {isSuperAdmin ? (
        // Super Admin Experience: Platform Management (Overview, Garages, Audits, Profile)
        <>
          <Tab.Screen 
            name="Dashboard" 
            component={SuperAdminDashboardScreen} 
            options={{ title: 'Overview', headerShown: false }} 
          />
          <Tab.Screen 
            name="Garages" 
            component={SuperAdminGaragesScreen} 
            options={{ title: 'Garages', headerShown: false }} 
          />
          <Tab.Screen 
            name="Audits" 
            component={SuperAdminAuditsScreen} 
            options={{ title: 'Audits', headerShown: false }} 
          />
          <Tab.Screen 
            name="Profile" 
            component={ProfileScreen} 
            options={{ title: 'Settings', headerShown: false }} 
          />
        </>
      ) : (
        // Garage Admin & Staff Experience: Services & Pricing, Bookings, Customers, Slots, Profile
        <>
          <Tab.Screen 
            name="Dashboard" 
            component={AdminDashboardScreen} 
            options={{ title: 'Dashboard', headerShown: false }} 
          />
          <Tab.Screen 
            name="Services" 
            component={AdminServicesScreen} 
            options={{ title: 'Services', headerShown: false }} 
          />
          <Tab.Screen 
            name="Customers" 
            component={AdminCustomersScreen} 
            options={{ title: 'Customers', headerShown: false }} 
          />
          <Tab.Screen 
            name="Slots" 
            component={AdminSlotsScreen} 
            options={{ title: 'Slots', headerShown: false }} 
          />
          {/* <Tab.Screen 
            name="Reminders" 
            component={AdminAlertsScreen} 
            options={{ 
              title: 'Reminders', 
              headerShown: false,
              tabBarBadge: pendingAlertsCount > 0 ? pendingAlertsCount : undefined,
            }} 
          /> */}
          <Tab.Screen 
            name="Profile" 
            component={ProfileScreen} 
            options={{ title: 'Settings', headerShown: false }} 
          />
        </>
      )}
    </Tab.Navigator>
  );
}
