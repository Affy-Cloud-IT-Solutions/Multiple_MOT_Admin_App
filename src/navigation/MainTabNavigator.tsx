import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import SuperAdminDashboardScreen from '../screens/SuperAdminDashboardScreen';
import SuperAdminGaragesScreen from '../screens/SuperAdminGaragesScreen';
import SuperAdminAuditsScreen from '../screens/SuperAdminAuditsScreen';
import SuperAdminCategoriesScreen from '../screens/SuperAdminCategoriesScreen';
import AdminCustomersScreen from '../screens/AdminCustomersScreen';
import AdminServicesScreen from '../screens/AdminServicesScreen';
import AdminSlotsScreen from '../screens/AdminSlotsScreen';
import AdminAlertsScreen from '../screens/AdminAlertsScreen';
import BookedMotsScreen from '../screens/BookedMotsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

import { fonts } from '../theme/theme';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { theme } = useAppTheme();
  const { user, pendingCustomServicesCount, fetchPendingCustomServices } = useAppValues();

  const isSuperAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';

  // Periodically fetch pending custom services count for Super Admin badges
  useEffect(() => {
    if (isSuperAdmin && fetchPendingCustomServices) {
      fetchPendingCustomServices().catch(() => {});
    }
  }, [isSuperAdmin, fetchPendingCustomServices]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = 'circle-outline';

          if (route.name === 'Dashboard') {
            iconName = 'view-dashboard-outline';
          } else if (route.name === 'Garages') {
            iconName = 'garage-variant';
          } else if (route.name === 'Bookings') {
            iconName = 'calendar-check-outline';
          } else if (route.name === 'Services') {
            iconName = 'car-wrench';
          } else if (route.name === 'SuperAdminCategories' || route.name === 'Categories') {
            iconName = 'shape-plus';
          } else if (route.name === 'Audits') {
            iconName = 'clipboard-text-clock-outline';
          } else if (route.name === 'Customers') {
            iconName = 'account-group-outline';
          } else if (route.name === 'Slots') {
            iconName = 'calendar-clock-outline';
          } else if (route.name === 'Reminders') {
            iconName = 'bell-outline';
          } else if (route.name === 'Profile') {
            iconName = isStaff ? 'account-outline' : 'cog-outline';
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
          fontFamily: fonts.semiBold,
          fontSize: 10,
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
          fontFamily: fonts.bold,
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
            name="SuperAdminCategories" 
            component={SuperAdminCategoriesScreen} 
            options={{ 
              title: 'Services', 
              headerShown: false,
              tabBarBadge: pendingCustomServicesCount > 0 ? pendingCustomServicesCount : undefined,
              tabBarBadgeStyle: {
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                fontSize: 10,
                fontFamily: fonts.bold,
              },
            }} 
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
      ) : isStaff ? (
        // Staff Experience: Daily Workshop Operations (Dashboard, Bookings/Calendar, Slots & Availability, Customers, Profile)
        <>
          <Tab.Screen 
            name="Dashboard" 
            component={AdminDashboardScreen} 
            options={{ title: 'Dashboard', headerShown: false }} 
          />
          <Tab.Screen 
            name="Bookings" 
            component={BookedMotsScreen} 
            options={{ title: 'Bookings', headerShown: false }} 
          />
          <Tab.Screen 
            name="Slots" 
            component={AdminSlotsScreen} 
            options={{ title: 'Slots', headerShown: false }} 
          />
          <Tab.Screen 
            name="Customers" 
            component={AdminCustomersScreen} 
            options={{ title: 'Customers', headerShown: false }} 
          />
          <Tab.Screen 
            name="Profile" 
            component={ProfileScreen} 
            options={{ title: 'Profile', headerShown: false }} 
          />
        </>
      ) : (
        // Garage Admin Experience: Full Business & Workshop Management (Dashboard, Services & Pricing, Customers, Slots & Bays, Settings)
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
