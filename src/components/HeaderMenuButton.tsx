import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDrawer } from '../context/DrawerContext';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

interface HeaderMenuButtonProps {
  style?: any;
  color?: string;
  size?: number;
}

export default function HeaderMenuButton({ style, color, size = 22 }: HeaderMenuButtonProps) {
  const { openDrawer } = useDrawer();
  const { theme } = useAppTheme();
  const { alerts, user } = useAppValues();

  // If user is super admin, no drawer needed
  if (user?.role === 'admin') {
    return null;
  }

  const hasPendingAlerts = Array.isArray(alerts) && alerts.some((a: any) => a && a.status === 'Pending');

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
      onPress={openDrawer}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialCommunityIcons
        name="menu"
        size={size}
        color={color || theme.colors.text}
      />
      {hasPendingAlerts && <View style={styles.badgeDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});

