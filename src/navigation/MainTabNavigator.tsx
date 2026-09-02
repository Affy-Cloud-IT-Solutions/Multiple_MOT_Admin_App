import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import SuperAdminDashboardScreen from '../screens/SuperAdminDashboardScreen';
import SuperAdminGaragesScreen from '../screens/SuperAdminGaragesScreen';
import SuperAdminAuditsScreen from '../screens/SuperAdminAuditsScreen';
import AdminCustomersScreen from '../screens/AdminCustomersScreen';
import AdminRemindersScreen from '../screens/AdminRemindersScreen';
import AdminAlertsScreen from '../screens/AdminAlertsScreen';
import AdminSlotsScreen from '../screens/AdminSlotsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { theme } = useAppTheme();
  const { alerts, user } = useAppValues();

  const isSuperAdmin = user?.role === 'admin';

  // Calculate pending alerts to show badge count only for garage staff/admin
  const pendingAlertsCount = !isSuperAdmin
    ? alerts.filter((a) => a.status === 'Pending').length
    : 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = 'home';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
          } else if (route.name === 'Garages') {
            iconName = focused ? 'garage' : 'garage-open-variant';
          } else if (route.name === 'Customers') {
            iconName = focused ? 'account-multiple' : 'account-multiple-outline';
          } else if (route.name === 'Audits') {
            iconName = focused ? 'clipboard-text-clock' : 'clipboard-text-clock-outline';
          } else if (route.name === 'Reminders') {
            iconName = focused ? 'bell-ring' : 'bell-ring-outline';
          } else if (route.name === 'Slots') {
            iconName = focused ? 'calendar-clock' : 'calendar-clock-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'bell-badge' : 'bell-badge-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'account-circle' : 'account-circle-outline';
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
        // Super Admin Experience: Platform Management (NO Reminders & NO Alerts)
        <>
          <Tab.Screen 
            name="Dashboard" 
            component={SuperAdminDashboardScreen} 
            options={{ title: 'Overview' }} 
          />
          <Tab.Screen 
            name="Garages" 
            component={SuperAdminGaragesScreen} 
            options={{ title: 'Garages' }} 
          />
          <Tab.Screen 
            name="Customers" 
            component={AdminCustomersScreen} 
            options={{ title: 'Customers' }} 
          />
          <Tab.Screen 
            name="Audits" 
            component={SuperAdminAuditsScreen} 
            options={{ title: 'Logs' }} 
          />
          <Tab.Screen 
            name="Profile" 
            component={ProfileScreen} 
            options={{ title: 'Settings' }} 
          />
        </>
      ) : (
        // Garage Admin & Staff Experience: Garage-specific operations & alerts
        <>
          <Tab.Screen 
            name="Dashboard" 
            component={AdminDashboardScreen} 
            options={{ title: 'Dashboard' }} 
          />
          <Tab.Screen 
            name="Customers" 
            component={AdminCustomersScreen} 
            options={{ title: 'Customers' }} 
          />
          <Tab.Screen 
            name="Reminders" 
            component={AdminRemindersScreen} 
            options={{ title: 'Reminders' }} 
          />
          <Tab.Screen 
            name="Slots" 
            component={AdminSlotsScreen} 
            options={{ title: 'Slots' }} 
          />
          <Tab.Screen 
            name="Profile" 
            component={ProfileScreen} 
            options={{ title: 'Settings' }} 
          />
        </>
      )}
    </Tab.Navigator>
  );
}
