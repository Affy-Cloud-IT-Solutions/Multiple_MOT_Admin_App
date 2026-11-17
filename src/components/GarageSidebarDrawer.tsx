import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
  ScrollView,
  Image,
  Alert,
  Platform,
  StatusBar,
  Easing,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawer } from '../context/DrawerContext';
import { useAppValues } from '../context/DataContext';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme/theme';
import { navigate } from '../navigation/NavigationService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);
const SWIPE_EDGE_WIDTH = 22; // Narrow 22px edge strip - never blocks app buttons

export default function GarageSidebarDrawer() {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode, toggleTheme } = useAppTheme();
  const { user, currentGarage, alerts, inventoryItems, inventoryStats, logout, isLoggingOut } = useAppValues();
  const { isOpen, closeDrawer, openDrawer, activeRoute, setActiveRoute } = useDrawer();

  // Internal rendered state so when closed, 0 full-screen views sit in the hierarchy
  const [isRendered, setIsRendered] = useState(false);
  const animX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  // Role checks
  const isSuperAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const isGarageAdmin = user?.role === 'garage_admin';

  // Badges
  const pendingAlertsCount = useMemo(() => {
    if (!Array.isArray(alerts)) return 0;
    return alerts.filter((a: any) => a && a.status === 'Pending').length;
  }, [alerts]);

  const lowStockAlertsCount = useMemo(() => {
    if (inventoryStats?.lowStockCount !== undefined || inventoryStats?.outOfStockCount !== undefined) {
      return (inventoryStats.lowStockCount || 0) + (inventoryStats.outOfStockCount || 0);
    }
    if (!Array.isArray(inventoryItems)) return 0;
    return inventoryItems.filter((i: any) => (i.quantity ?? 0) <= (i.minStockThreshold ?? 3)).length;
  }, [inventoryStats, inventoryItems]);

  // Fast GPU-accelerated Cubic Easing slide animations (60 FPS on RenderThread)
  const animateOpen = useCallback(() => {
    setIsRendered(true);
    animX.stopAnimation();
    Animated.timing(animX, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animX]);

  const animateClose = useCallback((callback?: () => void) => {
    animX.stopAnimation();
    Animated.timing(animX, {
      toValue: -DRAWER_WIDTH,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsRendered(false);
      closeDrawer();
      if (callback) {
        callback();
      }
    });
  }, [animX, closeDrawer]);

  useEffect(() => {
    if (isSuperAdmin || !user) {
      animX.setValue(-DRAWER_WIDTH);
      setIsRendered(false);
      return;
    }

    if (isOpen) {
      animateOpen();
    } else if (isRendered) {
      animateClose();
    }
  }, [isOpen, isSuperAdmin, user, animateOpen, animateClose, isRendered]);

  // Edge Swipe Listener (Only active when drawer is closed)
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (isSuperAdmin || !user || isOpen) return false;
        // Strictly horizontal right drag starting from the screen edge
        return (
          gestureState.dx > 18 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2
        );
      },
      onPanResponderGrant: () => {
        setIsRendered(true);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const newX = Math.min(0, -DRAWER_WIDTH + gestureState.dx);
        animX.setValue(newX);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dx > 55 || gestureState.vx > 0.35) {
          openDrawer();
          animateOpen();
        } else {
          animateClose();
        }
      },
    })
  ).current;

  // Drawer Container PanResponder (For smooth left-swipe to close when open)
  const drawerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Only horizontal swipe to left; ignores vertical list scrolling completely!
        return (
          gestureState.dx < -16 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2.5
        );
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dx < 0) {
          const newX = Math.min(0, Math.max(-DRAWER_WIDTH, gestureState.dx));
          animX.setValue(newX);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dx < -55 || gestureState.vx < -0.35) {
          animateClose();
        } else {
          animateOpen();
        }
      },
    })
  ).current;

  if (isSuperAdmin || !user) {
    return null;
  }

  // Smooth, instant navigation: closes drawer at 60fps first, then mounts target screen cleanly
  const handleNavPress = (target: string, isTab = true, params?: any) => {
    setActiveRoute(target);
    animateClose(() => {
      InteractionManager.runAfterInteractions(() => {
        if (isTab) {
          navigate('Main', { screen: target, params });
        } else {
          navigate(target, params);
        }
      });
    });
  };

  const handleLogout = () => {
    animateClose(() => {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out of your garage account?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: () => logout(),
          },
        ]
      );
    });
  };

  const backdropOpacity = animX.interpolate({
    inputRange: [-DRAWER_WIDTH, 0],
    outputRange: [0, 0.55],
    extrapolate: 'clamp',
  });

  return (
    <>
      {/* 1. Only when closed: 22px edge gesture catcher that NEVER blocks taps */}
      {!isRendered && (
        <View
          style={styles.edgeTouchZone}
          {...edgePanResponder.panHandlers}
        />
      )}

      {/* 2. When open or animating: full-screen backdrop and sliding drawer */}
      {isRendered && (
        <View style={styles.rootOverlay} pointerEvents="auto">
          {/* Dimmed Backdrop */}
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => animateClose()}
            />
          </Animated.View>

          {/* Sliding Drawer Container with Native GPU Transform */}
          <Animated.View
            style={[
              styles.drawerContainer,
              {
                width: DRAWER_WIDTH,
                backgroundColor: theme.colors.card,
                transform: [{ translateX: animX }],
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: Math.max(insets.bottom, 16),
                borderRightColor: theme.colors.border,
              },
            ]}
            {...drawerPanResponder.panHandlers}
          >
        {/* Top Header Card */}
        <View style={[styles.drawerHeader, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerTopRow}>
            {/* Ondoor Car Service Brand Logo */}
            <View
              style={[
                styles.brandLogoWrapper,
                isDarkMode && styles.brandLogoWrapperDark,
              ]}
            >
              <Image
                source={require('../images/ondoorcarservice_Logo.png')}
                style={styles.brandLogoImage}
                resizeMode="contain"
                accessibilityLabel="Ondoor Car Service"
              />
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => animateClose()}
              style={[styles.closeBtn, { backgroundColor: theme.colors.border + '30' }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Garage Name & User Info */}
          <View style={styles.garageInfoBlock}>
            <View style={styles.garageNameRow}>
              {currentGarage?.logoUrl ? (
                <Image
                  source={{ uri: currentGarage.logoUrl }}
                  style={styles.garageSmallThumb}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={[styles.garageName, { color: theme.colors.text }]} numberOfLines={1}>
                {currentGarage?.name || 'MOT Workshop Hub'}
              </Text>
            </View>

            <Text style={[styles.userName, { color: theme.colors.placeholder }]} numberOfLines={1}>
              {user?.name || user?.email || 'Workshop Manager'}
            </Text>
          </View>

          {/* Role Pill & Status Badge */}
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.roleBadge,
                {
                  backgroundColor: isStaff ? '#10B98118' : '#0284C718',
                  borderColor: isStaff ? '#10B98135' : '#0284C735',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={isStaff ? 'wrench-outline' : 'shield-account'}
                size={12}
                color={isStaff ? '#10B981' : '#0284C7'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.roleBadgeText,
                  { color: isStaff ? '#10B981' : '#0284C7' },
                ]}
              >
                {isStaff ? 'Workshop Staff' : 'Garage Admin'}
              </Text>
            </View>

            {currentGarage?.verificationStatus === 'Verified' && (
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={12} color="#10B981" />
                <Text style={styles.verifiedText}>DVLA VTS</Text>
              </View>
            )}
          </View>
        </View>

        {/* Scrollable Navigation Items */}
        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={styles.menuScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Group 1: WORKSHOP OPERATIONS */}
          <Text style={[styles.sectionTitle, { color: theme.colors.placeholder }]}>
            WORKSHOP OPERATIONS
          </Text>

          <DrawerNavItem
            title="Dashboard"
            subtitle="Overview & quick metrics"
            icon="view-dashboard-outline"
            active={activeRoute === 'Dashboard'}
            onPress={() => handleNavPress('Dashboard', true)}
            theme={theme}
          />

          <DrawerNavItem
            title="Bookings & Calendar"
            subtitle="Appointments & workshop jobs"
            icon="calendar-check-outline"
            active={activeRoute === 'Bookings' || activeRoute === 'BookedMots'}
            onPress={() => handleNavPress('Bookings', true)}
            theme={theme}
          />

          <DrawerNavItem
            title="Slots & Availability"
            subtitle="Station bays & schedule"
            icon="calendar-clock-outline"
            active={activeRoute === 'Slots'}
            onPress={() => handleNavPress('Slots', true)}
            theme={theme}
          />

          <DrawerNavItem
            title="Customers & Vehicles"
            subtitle="Client registry & history"
            icon="account-group-outline"
            active={activeRoute === 'Customers'}
            onPress={() => handleNavPress('Customers', true)}
            theme={theme}
          />

          <DrawerNavItem
            title="Inventory & Stock"
            subtitle="Parts, oils & stock levels"
            icon="package-variant-closed"
            badgeCount={lowStockAlertsCount > 0 ? lowStockAlertsCount : undefined}
            active={activeRoute === 'Inventory' || activeRoute === 'AdminInventory'}
            onPress={() => handleNavPress('Inventory', true)}
            theme={theme}
          />

          <DrawerNavItem
            title="Notifications & Alerts"
            subtitle="Customer bookings & requests"
            icon="bell-outline"
            badgeCount={pendingAlertsCount}
            active={activeRoute === 'AdminAlerts'}
            onPress={() => handleNavPress('AdminAlerts', false)}
            theme={theme}
          />

          {/* Group 2: GARAGE MANAGEMENT (Garage Admin Only) */}
          {isGarageAdmin && (
            <>
              <View style={[styles.sectionDivider, { backgroundColor: theme.colors.border + '60' }]} />
              <Text style={[styles.sectionTitle, { color: theme.colors.placeholder }]}>
                GARAGE CONFIGURATION
              </Text>

              <DrawerNavItem
                title="Services & Pricing"
                subtitle="MOT, repairs & catalogue"
                icon="car-wrench"
                active={activeRoute === 'Services' || activeRoute === 'AdminServices'}
                onPress={() => handleNavPress('Services', true)}
                theme={theme}
              />

              <DrawerNavItem
                title="Staff & Technicians"
                subtitle="Manage workshop crew accounts"
                icon="account-group"
                active={activeRoute === 'StaffList'}
                onPress={() => handleNavPress('StaffList', false)}
                theme={theme}
              />

              <DrawerNavItem
                title="Documentation & Location"
                subtitle="Location, bays & DVLA docs"
                icon="file-document-edit-outline"
                active={activeRoute === 'GarageSetup'}
                onPress={() => handleNavPress('GarageSetup', false)}
                theme={theme}
              />
            </>
          )}

          {/* Group 3: PREFERENCES & SETTINGS */}
          <View style={[styles.sectionDivider, { backgroundColor: theme.colors.border + '60' }]} />
          <Text style={[styles.sectionTitle, { color: theme.colors.placeholder }]}>
            ACCOUNT & SETTINGS
          </Text>

          <DrawerNavItem
            title="Settings & Profile"
            subtitle="Password, security & info"
            icon="cog-outline"
            active={activeRoute === 'Profile'}
            onPress={() => handleNavPress('Profile', true)}
            theme={theme}
          />

          {/* Dark / Light Mode Switch */}
          <TouchableOpacity
            style={[styles.navItem, { backgroundColor: 'transparent' }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.navItemIconBox,
                { backgroundColor: isDarkMode ? '#F59E0B18' : '#6366F118' },
              ]}
            >
              <MaterialCommunityIcons
                name={isDarkMode ? 'weather-sunny' : 'weather-night'}
                size={20}
                color={isDarkMode ? '#F59E0B' : '#6366F1'}
              />
            </View>
            <View style={styles.navItemTextBox}>
              <Text style={[styles.navItemTitle, { color: theme.colors.text }]}>
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </Text>
              <Text style={[styles.navItemSubtitle, { color: theme.colors.placeholder }]}>
                {isDarkMode ? 'Switch to bright appearance' : 'Switch to eye-friendly dark theme'}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="theme-light-dark"
              size={18}
              color={theme.colors.placeholder}
            />
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom Drawer Footer */}
        <View style={[styles.drawerFooter, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[
              styles.logoutBtn,
              {
                backgroundColor: '#EF444415',
                borderColor: '#EF444430',
                opacity: isLoggingOut ? 0.6 : 1,
              },
            ]}
            onPress={handleLogout}
            disabled={isLoggingOut}
            activeOpacity={0.7}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <MaterialCommunityIcons name="logout-variant" size={18} color="#EF4444" />
                <Text style={styles.logoutBtnText}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[styles.appVersionText, { color: theme.colors.placeholder }]}>
            Multiple MOT UK • v1.0.0
          </Text>
        </View>
          </Animated.View>
        </View>
      )}
    </>
  );
}

// Subcomponent for Navigation Item
interface DrawerNavItemProps {
  title: string;
  subtitle?: string;
  icon: string;
  active?: boolean;
  badgeCount?: number;
  onPress: () => void;
  theme: any;
}

function DrawerNavItem({
  title,
  subtitle,
  icon,
  active,
  badgeCount,
  onPress,
  theme,
}: DrawerNavItemProps) {
  return (
    <TouchableOpacity
      style={[
        styles.navItem,
        active && {
          backgroundColor: theme.colors.primary + '14',
          borderColor: theme.colors.primary + '35',
          borderWidth: 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.navItemIconBox,
          {
            backgroundColor: active
              ? theme.colors.primary
              : theme.colors.card,
            borderColor: active ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={active ? '#FFFFFF' : theme.colors.text}
        />
      </View>

      <View style={styles.navItemTextBox}>
        <Text
          style={[
            styles.navItemTitle,
            {
              color: active ? theme.colors.primary : theme.colors.text,
              fontFamily: active ? fonts.bold : fonts.semiBold,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.navItemSubtitle, { color: theme.colors.placeholder }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {typeof badgeCount === 'number' && badgeCount > 0 ? (
        <View style={styles.navItemBadge}>
          <Text style={styles.navItemBadgeText}>{badgeCount}</Text>
        </View>
      ) : active ? (
        <View style={[styles.activeIndicatorDot, { backgroundColor: theme.colors.primary }]} />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  rootOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  edgeTouchZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SWIPE_EDGE_WIDTH,
    zIndex: 9998,
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 25,
    borderRightWidth: 1,
  },
  drawerHeader: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandLogoWrapper: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  brandLogoWrapperDark: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  brandLogoImage: {
    width: 145,
    height: 38,
  },
  garageInfoBlock: {
    marginTop: 2,
  },
  garageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  garageSmallThumb: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  garageName: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  userName: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#10B98115',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#10B981',
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 6,
    marginLeft: 6,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 10,
    marginHorizontal: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginVertical: 2,
  },
  navItemIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },
  navItemTextBox: {
    flex: 1,
    justifyContent: 'center',
  },
  navItemTitle: {
    fontSize: 13.5,
  },
  navItemSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    marginTop: 1,
  },
  navItemBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  navItemBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  activeIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  drawerFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  logoutBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#EF4444',
  },
  appVersionText: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 8,
  },
});
