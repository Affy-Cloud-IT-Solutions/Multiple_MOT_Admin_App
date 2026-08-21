import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Switch, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import { validateFirstName, validateLastName, validateEmail, validatePassword } from '../utils/validationUtils';

export default function ProfileScreen({ navigation }: any) {
  const { isDarkMode, theme, toggleTheme } = useAppTheme();
  const { user, createStaffAccount, setToken, setUser } = useAppValues();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Staff creation form states
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return 'GU';
    return name.slice(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            setLoggingOut(true);
            setTimeout(() => {
              setLoggingOut(false);
              setToken(null);
              setUser(null);
              navigation.replace('Login');
            }, 1200);
          },
        },
      ]
    );
  };

  const handleCreateStaff = async () => {
    const nameParts = staffName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const firstVal = validateFirstName(firstName);
    if (firstVal.error) {
      Alert.alert('Validation Error', `First Name: ${firstVal.error}`);
      return;
    }

    if (!lastName) {
      Alert.alert('Validation Error', 'Last name is required. Please enter a full name.');
      return;
    }
    const lastVal = validateLastName(lastName);
    if (lastVal.error) {
      Alert.alert('Validation Error', `Last Name: ${lastVal.error}`);
      return;
    }

    const emailVal = validateEmail(staffEmail);
    if (emailVal.error) {
      Alert.alert('Validation Error', emailVal.error);
      return;
    }

    const passwordVal = validatePassword(staffPassword);
    if (passwordVal.error) {
      Alert.alert('Validation Error', passwordVal.error);
      return;
    }

    setCreatingStaff(true);
    try {
      await createStaffAccount(staffName.trim(), staffEmail.trim().toLowerCase(), staffPassword.trim());
      Alert.alert('Success', `Staff account for ${staffName} has been created successfully.`);
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create staff account');
    } finally {
      setCreatingStaff(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.colors.secondary }]}>
          <Text style={styles.avatarText}>{getInitials(user?.name || '')}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.userName, { color: theme.colors.text }]}>
            {user?.name || 'Guest User'}
          </Text>
          <View style={styles.userInfoRow}>
            <MaterialCommunityIcons name="email" size={14} color={theme.colors.placeholder} />
            <Text style={[styles.userEmail, { color: theme.colors.placeholder }]}>
              {user?.email || 'guest@example.com'}
            </Text>
          </View>
          {user?.role && (
            <View style={[styles.roleBadge, { backgroundColor: theme.colors.secondary + '20' }]}>
              <MaterialCommunityIcons 
                name={user.role === 'admin' ? 'shield-account' : user.role === 'staff' ? 'account-tie' : 'account'} 
                size={12} 
                color={theme.colors.secondary} 
              />
              <Text style={[styles.roleBadgeText, { color: theme.colors.secondary }]}>
                {user.role === 'admin' ? 'Super Admin' : user.role === 'staff' ? 'Staff' : 'Customer'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Settings Options */}
      <View style={[styles.settingsContainer, { backgroundColor: theme.colors.card }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.colors.secondary + '15' }]}>
              <MaterialCommunityIcons name="theme-light-dark" size={20} color={theme.colors.secondary} />
            </View>
            <View>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Dark Mode</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.placeholder }]}>Toggle dark/light theme</Text>
            </View>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: '#E0E0E0', true: theme.colors.secondary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E0E0E0"
          />
        </View>

        <View style={[styles.settingDivider, { backgroundColor: theme.colors.border }]} />

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.colors.secondary + '15' }]}>
              <MaterialCommunityIcons name="bell-ring" size={20} color={theme.colors.secondary} />
            </View>
            <View>
              <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Notifications</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.placeholder }]}>MOT expiry alerts</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={() => setNotificationsEnabled(!notificationsEnabled)}
            trackColor={{ false: '#E0E0E0', true: theme.colors.secondary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E0E0E0"
          />
        </View>
      </View>

      {/* Admin Section */}
      {user?.role === 'admin' && (
        <View style={[styles.adminContainer, { backgroundColor: theme.colors.card }]}>
          <View style={styles.adminHeader}>
            <View style={[styles.adminIconWrapper, { backgroundColor: theme.colors.primary + '15' }]}>
              <MaterialCommunityIcons name="account-plus" size={20} color={theme.colors.primary} />
            </View>
            <Text style={[styles.adminTitle, { color: theme.colors.text }]}>Staff Management</Text>
          </View>
          <Text style={[styles.adminSubtitle, { color: theme.colors.placeholder }]}>
            Create staff accounts for garage management
          </Text>

          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="account" size={18} color={theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={staffName}
              onChangeText={setStaffName}
              placeholder="Full Name"
              placeholderTextColor={theme.colors.placeholder}
              style={[styles.adminInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="email" size={18} color={theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={staffEmail}
              onChangeText={setStaffEmail}
              placeholder="Email Address"
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.adminInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="lock" size={18} color={theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={staffPassword}
              onChangeText={setStaffPassword}
              placeholder="Password"
              placeholderTextColor={theme.colors.placeholder}
              secureTextEntry
              autoCapitalize="none"
              style={[styles.adminInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            />
          </View>

          <TouchableOpacity
            onPress={handleCreateStaff}
            disabled={creatingStaff}
            style={[styles.createStaffButton, { backgroundColor: theme.colors.primary, opacity: creatingStaff ? 0.7 : 1 }]}
          >
            {creatingStaff ? (
              <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="account-plus" size={18} color={theme.dark ? theme.colors.background : '#FFFFFF'} />
                <Text style={[styles.createStaffText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Create Staff Account</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('StaffList')}
            style={[styles.viewStaffButton, { borderColor: theme.colors.primary, borderWidth: 1.5, borderRadius: 10, height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 12, flexDirection: 'row', gap: 8 }]}
          >
            <MaterialCommunityIcons name="account-multiple" size={18} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 14 }}>View Staff List</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logout Button */}
      <TouchableOpacity
        onPress={handleLogout}
        disabled={loggingOut}
        style={[styles.logoutContainer, { borderColor: theme.colors.error, opacity: loggingOut ? 0.7 : 1 }]}
      >
        {loggingOut ? (
          <ActivityIndicator color={theme.colors.error} size="small" />
        ) : (
          <>
            <MaterialCommunityIcons name="logout" size={20} color={theme.colors.error} />
            <Text style={[styles.logoutText, { color: theme.colors.error }]}>Sign Out</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Version */}
      <Text style={[styles.versionText, { color: theme.colors.placeholder }]}>
        Version 1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'flex-start',
  },
  userName: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    marginLeft: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    gap: 4,
    alignSelf: 'flex-start',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  settingsContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 14,
    paddingVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  settingDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  adminContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  adminIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  adminTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  adminSubtitle: {
    fontSize: 12,
    marginBottom: 16,
    marginLeft: 42,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 10,
  },
  adminInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingVertical: 0,
  },
  createStaffButton: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  createStaffText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  logoutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 24,
  },
  viewStaffButton: {
    flexDirection: 'row',
    gap: 8,
  },
});