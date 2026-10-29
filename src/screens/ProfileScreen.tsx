import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  Switch,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import { fonts } from '../theme/theme';
import {
  validateFirstName,
  validateLastName,
  validateEmail,
  validatePassword,
} from '../utils/validationUtils';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation }: any) {
  const { isDarkMode, theme, toggleTheme } = useAppTheme();
  const {
    user,
    createStaffAccount,
    setToken,
    setUser,
    logout,
    customers = [],
    vehicles = [],
    alerts = [],
  } = useAppValues();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return 'GU';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
          onPress: async () => {
            setLoggingOut(true);
            try {
              // Revokes the refresh token on the server, clears the stored session and returns to Login
              await logout();
            } finally {
              setLoggingOut(false);
            }
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
      Alert.alert(
        'Validation Error',
        'Last name is required. Please enter a full name.'
      );
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
      await createStaffAccount(
        staffName.trim(),
        staffEmail.trim().toLowerCase(),
        staffPassword.trim()
      );
      Alert.alert(
        'Success',
        `Staff account for ${staffName} has been created successfully.`
      );
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create staff account');
    } finally {
      setCreatingStaff(false);
    }
  };

  const customerId = user?.customerId;
  const customer = customers.find(
    (c) =>
      String(c.id).toLowerCase() === String(customerId || '').toLowerCase() ||
      String(c._id).toLowerCase() === String(customerId || '').toLowerCase()
  );

  const customerVehicles = vehicles.filter(
    (v) =>
      v.customerId &&
      (String(v.customerId).toLowerCase() ===
        String(customerId || '').toLowerCase() ||
        String(v.customerId).toLowerCase() ===
          String(customer?.id || '').toLowerCase() ||
        String(v.customerId).toLowerCase() ===
          String(customer?._id || '').toLowerCase()) &&
      v.status !== 'Sold' &&
      v.status !== 'Scrapped'
  );

  const totalVehicles = customerVehicles.length;
  const pendingVehicles = customerVehicles.filter(
    (v) => v.status === 'Pending'
  ).length;

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#7C3AED';
      case 'garage_admin':
        return '#D97706';
      case 'staff':
        return '#059669';
      default:
        return '#3B82F6';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return 'shield-account';
      case 'garage_admin':
        return 'garage';
      case 'staff':
        return 'account-tie';
      default:
        return 'account';
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.avatarCircle,
            {
              backgroundColor: isDarkMode
                ? theme.colors.secondary + '30'
                : theme.colors.secondary + '15',
            },
          ]}
        >
          <Text
            style={[styles.avatarText, { color: theme.colors.secondary }]}
          >
            {getInitials(user?.name || '')}
          </Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={[styles.userName, { color: theme.colors.text }]}>
            {user?.name || 'Guest User'}
          </Text>
          <View style={styles.userEmailRow}>
            <MaterialCommunityIcons
              name="email-outline"
              size={14}
              color={theme.colors.placeholder}
            />
            <Text
              style={[styles.userEmail, { color: theme.colors.placeholder }]}
            >
              {user?.email || 'guest@example.com'}
            </Text>
          </View>
          {user?.role && (
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor:
                    getRoleColor(user.role) + '15',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={getRoleIcon(user.role)}
                size={12}
                color={getRoleColor(user.role)}
              />
              <Text
                style={[
                  styles.roleBadgeText,
                  { color: getRoleColor(user.role) },
                ]}
              >
                {user.role === 'admin'
                  ? 'Super Admin'
                  : user.role === 'garage_admin'
                  ? 'Garage Admin'
                  : user.role === 'staff'
                  ? 'Staff'
                  : 'Customer'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Grid */}
      {user && (
        <View style={styles.statsGrid}>
          {user.role === 'customer' ? (
            <>
              <StatCard
                icon="car"
                value={totalVehicles}
                label="Vehicles"
                color={theme.colors.secondary}
                theme={theme}
              />
              <StatCard
                icon="clock-outline"
                value={pendingVehicles}
                label="Pending"
                color={theme.colors.warning}
                theme={theme}
              />
              <StatCard
                icon="message-text-outline"
                value={customer?.preferredContact || 'SMS'}
                label="Alert Channel"
                color={theme.colors.success}
                theme={theme}
                isText
              />
            </>
          ) : (
            <>
              <StatCard
                icon="account-group"
                value={customers.length}
                label="Customers"
                color={theme.colors.secondary}
                theme={theme}
              />
              <StatCard
                icon="car-multiple"
                value={vehicles.filter((v) => v.status === 'Active').length}
                label="Active Cars"
                color={theme.colors.warning}
                theme={theme}
              />
              <StatCard
                icon="bell-alert"
                value={alerts.filter((a) => a.status === 'Pending').length}
                label="Open Alerts"
                color={theme.colors.success}
                theme={theme}
              />
            </>
          )}
        </View>
      )}

      {/* Customer Info */}
      {user?.role === 'customer' && customer && (
        <Section title="Personal Details" theme={theme}>
          <InfoRow
            icon="phone"
            label="Mobile Number"
            value={customer.mobile || 'Not provided'}
            iconColor={theme.colors.secondary}
            theme={theme}
          />
          <InfoRow
            icon="message-alert"
            label="Preferred Contact"
            value={customer.preferredContact || 'SMS'}
            iconColor={theme.colors.success}
            theme={theme}
          />
          {customer.address && (
            <InfoRow
              icon="map-marker"
              label="Address"
              value={customer.address}
              iconColor={theme.colors.warning}
              theme={theme}
            />
          )}
        </Section>
      )}

      {/* Garage Operations & Tools Hub (For Garage Admin and Staff only; excluded for Super Admin) */}
      {user && (user.role === 'garage_admin' || user.role === 'staff') && (
        <Section title="Garage Operations & Tools" theme={theme}>
          <MenuRow
            icon="shield-check-outline"
            iconColor="#10B981"
            title="Location, Photos & MOT Documents"
            subtitle="Configure GPS map pin, facility photos & legal verification"
            onPress={() => navigation.navigate('GarageSetup')}
            theme={theme}
          />
          <MenuRow
            icon="car-wrench"
            iconColor="#0284C7"
            title="Services & Pricing"
            subtitle="Manage MOT, Servicing, Brakes, Tyres & custom rates"
            onPress={() => navigation.navigate('AdminServices')}
            theme={theme}
          />
          {/* MOT Reminders Hub hidden from the mobile admin app for now
          <MenuRow
            icon="bell-ring"
            iconColor="#D97706"
            title="MOT Reminders Hub"
            subtitle="View scheduled MOT renewal notifications & campaigns"
            onPress={() => navigation.navigate('AdminReminders')}
            theme={theme}
          />
          */}
          <MenuRow
            icon="clipboard-text-clock"
            iconColor="#7C3AED"
            title="System Audit Logs"
            subtitle="Review platform activity, logs & security events"
            onPress={() => navigation.navigate('SuperAdminAudits')}
            theme={theme}
            isLast={user.role !== 'garage_admin'}
          />
          {user.role === 'garage_admin' && (
            <MenuRow
              icon="account-group"
              iconColor="#059669"
              title="Staff Directory"
              subtitle="View all authorized garage technicians"
              onPress={() => navigation.navigate('StaffList')}
              theme={theme}
              isLast
            />
          )}
        </Section>
      )}

      {/* App Settings */}
      <Section title="App Settings" theme={theme}>
        <SettingRow
          icon="theme-light-dark"
          title="Dark Mode"
          subtitle="Toggle light/dark appearance"
          control={
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E0E0E0', true: theme.colors.secondary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E0E0E0"
            />
          }
          theme={theme}
        />
        <SettingRow
          icon="bell-ring-outline"
          title="MOT Expiry Alerts"
          subtitle="Receive automatic push notifications"
          control={
            <Switch
              value={notificationsEnabled}
              onValueChange={() => setNotificationsEnabled(!notificationsEnabled)}
              trackColor={{ false: '#E0E0E0', true: theme.colors.secondary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E0E0E0"
            />
          }
          theme={theme}
          isLast
        />
      </Section>

      {/* Garage Admin Section (Staff Creation is strictly for Garage Admin) */}
      {user?.role === 'garage_admin' && (
        <Section title="Staff Management" theme={theme}>
          <View style={styles.adminHeader}>
            <MaterialCommunityIcons
              name="account-plus"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={[styles.adminTitle, { color: theme.colors.text }]}>
              Add New Staff
            </Text>
          </View>
          <Text
            style={[styles.adminSubtitle, { color: theme.colors.placeholder }]}
          >
            Create accounts for staff to manage vehicles and bookings
          </Text>

          <InputField
            icon="account"
            placeholder="Full Name"
            value={staffName}
            onChangeText={setStaffName}
            theme={theme}
          />
          <InputField
            icon="email"
            placeholder="Email Address"
            value={staffEmail}
            onChangeText={setStaffEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            theme={theme}
          />
          <InputField
            icon="lock"
            placeholder="Password"
            value={staffPassword}
            onChangeText={setStaffPassword}
            secureTextEntry
            autoCapitalize="none"
            theme={theme}
          />

          <TouchableOpacity
            onPress={handleCreateStaff}
            disabled={creatingStaff}
            style={[
              styles.createStaffButton,
              {
                backgroundColor: theme.colors.primary,
                opacity: creatingStaff ? 0.7 : 1,
              },
            ]}
          >
            {creatingStaff ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="account-plus"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.createStaffText}>Create Account</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('StaffList')}
            style={[
              styles.viewStaffButton,
              { borderColor: theme.colors.primary },
            ]}
          >
            <MaterialCommunityIcons
              name="account-multiple"
              size={18}
              color={theme.colors.primary}
            />
            <Text
              style={[styles.viewStaffText, { color: theme.colors.primary }]}
            >
              View Staff List
            </Text>
          </TouchableOpacity>
        </Section>
      )}

      {/* Logout Button */}
      <TouchableOpacity
        onPress={user ? handleLogout : () => navigation.navigate('Login')}
        disabled={loggingOut}
        style={[
          styles.actionButtonContainer,
          {
            borderColor: user ? theme.colors.error : theme.colors.primary,
            backgroundColor: user
              ? theme.colors.error + '0A'
              : theme.colors.primary + '0A',
            opacity: loggingOut ? 0.7 : 1,
          },
        ]}
      >
        {loggingOut ? (
          <ActivityIndicator
            color={user ? theme.colors.error : theme.colors.primary}
            size="small"
          />
        ) : (
          <>
            <MaterialCommunityIcons
              name={user ? 'logout' : 'login'}
              size={20}
              color={user ? theme.colors.error : theme.colors.primary}
            />
            <Text
              style={[
                styles.actionButtonText,
                { color: user ? theme.colors.error : theme.colors.primary },
              ]}
            >
              {user ? 'Sign Out' : 'Sign In / Register'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={[styles.versionText, { color: theme.colors.placeholder }]}>
        MOT Reminder System • Version 1.0.0
      </Text>
    </ScrollView>
  );
}

// ===== Helper Components =====

interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  color: string;
  theme: any;
  isText?: boolean;
}

const StatCard = ({ icon, value, label, color, theme, isText }: StatCardProps) => (
  <View
    style={[
      styles.statCard,
      {
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
      },
    ]}
  >
    <View
      style={[
        styles.statIconWrapper,
        { backgroundColor: color + '15' },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={color} />
    </View>
    <Text
      style={[
        isText ? styles.statNumberText : styles.statNumber,
        { color: theme.colors.text },
      ]}
      numberOfLines={1}
    >
      {value}
    </Text>
    <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>
      {label}
    </Text>
  </View>
);

interface SectionProps {
  title: string;
  theme: any;
  children: React.ReactNode;
}

const Section = ({ title, theme, children }: SectionProps) => (
  <View style={styles.sectionWrapper}>
    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
      {title}
    </Text>
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {children}
    </View>
  </View>
);

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
  iconColor: string;
  theme: any;
}

const InfoRow = ({ icon, label, value, iconColor, theme }: InfoRowProps) => (
  <View style={styles.infoRow}>
    <View
      style={[
        styles.infoIconWrapper,
        { backgroundColor: iconColor + '15' },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
    </View>
    <View style={styles.infoTextWrapper}>
      <Text style={[styles.infoLabel, { color: theme.colors.placeholder }]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, { color: theme.colors.text }]}>
        {value}
      </Text>
    </View>
  </View>
);

interface MenuRowProps {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  theme: any;
  isLast?: boolean;
}

const MenuRow = ({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  theme,
  isLast,
}: MenuRowProps) => (
  <>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.settingRow}
    >
      <View style={styles.settingLeft}>
        <View
          style={[
            styles.settingIconWrapper,
            { backgroundColor: iconColor + '18' },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={iconColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text
            style={[styles.settingSubtitle, { color: theme.colors.placeholder }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={theme.colors.placeholder}
      />
    </TouchableOpacity>
    {!isLast && (
      <View
        style={[styles.settingDivider, { backgroundColor: theme.colors.border }]}
      />
    )}
  </>
);

interface SettingRowProps {
  icon: string;
  title: string;
  subtitle: string;
  control: React.ReactNode;
  theme: any;
  isLast?: boolean;
}

const SettingRow = ({
  icon,
  title,
  subtitle,
  control,
  theme,
  isLast,
}: SettingRowProps) => (
  <>
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View
          style={[
            styles.settingIconWrapper,
            { backgroundColor: theme.colors.secondary + '15' },
          ]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={theme.colors.secondary}
          />
        </View>
        <View>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text
            style={[styles.settingSubtitle, { color: theme.colors.placeholder }]}
          >
            {subtitle}
          </Text>
        </View>
      </View>
      {control}
    </View>
    {!isLast && (
      <View
        style={[styles.settingDivider, { backgroundColor: theme.colors.border }]}
      />
    )}
  </>
);

interface InputFieldProps {
  icon: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  theme: any;
  secureTextEntry?: boolean;
  keyboardType?: string;
  autoCapitalize?: string;
}

const InputField = ({
  icon,
  placeholder,
  value,
  onChangeText,
  theme,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
}: InputFieldProps) => (
  <View
    style={[
      styles.inputContainer,
      {
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      },
    ]}
  >
    <MaterialCommunityIcons
      name={icon}
      size={18}
      color={theme.colors.placeholder}
      style={styles.inputIcon}
    />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.placeholder}
      style={[styles.adminInput, { color: theme.colors.text }]}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType as any}
      autoCapitalize={autoCapitalize as any}
    />
  </View>
);

// ===== Styles =====

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontFamily: fonts.bold,
  },
  headerMeta: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 18,
    fontFamily: fonts.bold,
    marginBottom: 2,
  },
  userEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginLeft: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    alignSelf: 'flex-start',
  },
  roleBadgeText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 20,
    marginHorizontal: -4,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 18,
    fontFamily: fonts.bold,
    marginBottom: 2,
  },
  statNumberText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionWrapper: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },
  settingSubtitle: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 1,
  },
  settingDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingTop: 4,
    gap: 8,
  },
  adminTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  adminSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginBottom: 14,
    paddingHorizontal: 14,
    lineHeight: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 10,
  },
  adminInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontFamily: fonts.regular,
    paddingVertical: 0,
  },
  createStaffButton: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginHorizontal: 14,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  createStaffText: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  viewStaffButton: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginHorizontal: 14,
    marginBottom: 4,
    gap: 8,
  },
  viewStaffText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  actionButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: fonts.regular,
    marginBottom: 20,
    letterSpacing: 0.3,
  },
});