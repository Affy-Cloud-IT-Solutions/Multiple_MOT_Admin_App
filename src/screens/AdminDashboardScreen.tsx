import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, Dimensions, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

const { width } = Dimensions.get('window');

const formatBookingDate = (dateVal: any) => {
  if (!dateVal) return '';
  try {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    if (typeof dateVal === 'string') {
      const matchIso = dateVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (matchIso) {
        const y = matchIso[1];
        const m = parseInt(matchIso[2], 10) - 1;
        const d = parseInt(matchIso[3], 10);
        if (m >= 0 && m < 12) {
          return `${d} ${months[m]} ${y}`;
        }
      }
      const matchUk = dateVal.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (matchUk) {
        const d = parseInt(matchUk[1], 10);
        const m = parseInt(matchUk[2], 10) - 1;
        const y = matchUk[3];
        if (m >= 0 && m < 12) {
          return `${d} ${months[m]} ${y}`;
        }
      }
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const monthStr = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${monthStr} ${year}`;
    }
  } catch (e) {}
  return String(dateVal);
};

export default function AdminDashboardScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { user, currentGarage, customers, vehicles, alerts, audits, refreshData } = useAppValues();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const [checklistHidden, setChecklistHidden] = useState(false);

  const [localSetup, setLocalSetup] = useState<{ location: boolean; services: boolean; docs: boolean }>({
    location: false,
    services: false,
    docs: false,
  });

  React.useEffect(() => {
    const loadSetup = async () => {
      const gid = currentGarage?.id || currentGarage?._id;
      if (!gid) return;
      try {
        const [loc, srv, doc] = await Promise.all([
          AsyncStorage.getItem(`garage_loc_${gid}`),
          AsyncStorage.getItem(`garage_srv_${gid}`),
          AsyncStorage.getItem(`garage_doc_${gid}`),
        ]);
        setLocalSetup({
          location: loc === 'true',
          services: srv === 'true',
          docs: doc === 'true',
        });
      } catch (e) {}
    };
    loadSetup();
  }, [currentGarage]);

  // Dynamic Onboarding Checklist:
  // After initial registration, ONLY "Initial registration details" is done.
  // Location, Services, and Docs are only completed once explicitly set by the garage owner.
  const hasRegistered = true;
  const hasLocation = Boolean(currentGarage?.locationConfigured || localSetup.location);
  const hasServices = Boolean(currentGarage?.servicesConfigured || localSetup.services);
  const hasDocs = Boolean(currentGarage?.documentsConfigured || localSetup.docs);

  const checklistTasks = [
    {
      id: 'reg',
      title: 'Initial registration details',
      icon: 'car',
      completed: hasRegistered,
      onPress: undefined
    },
    {
      id: 'location',
      title: 'Location of your garage',
      icon: 'map-marker-outline',
      completed: hasLocation,
      onPress: () => navigation.navigate('GarageSetup', { initialTab: 'location' })
    },
    {
      id: 'services',
      title: 'Your services & pricing rates',
      icon: 'tag-outline',
      completed: hasServices,
      onPress: () => navigation.navigate('GarageSetup', { initialTab: 'services' })
    },
    {
      id: 'docs',
      title: 'Upload MOT & DVLA documents',
      icon: 'shield-check-outline',
      completed: hasDocs,
      onPress: () => navigation.navigate('GarageSetup', { initialTab: 'documents' })
    },
  ];

  const completedCount = checklistTasks.filter(t => t.completed).length;
  const progressPercent = Math.round((completedCount / checklistTasks.length) * 100);
  const pendingTasks = checklistTasks.filter(t => !t.completed);
  const completedTasks = checklistTasks.filter(t => t.completed);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshData();
    });
    return unsubscribe;
  }, [navigation]);

  const activeVehicles = vehicles.filter((v) => v.status === 'Active');
  const totalCustomersCount = customers.length;
  const activeVehiclesCount = activeVehicles.length;
  const soldVehiclesCount = vehicles.filter((v) => v.status === 'Sold').length;
  const bookedMots = alerts.filter(a => a.type === 'BOOKED');
  // Only show customer-facing alerts to garage admin; ignore internal garage registration approval alerts
  const pendingAlerts = alerts.filter(a => a.status === 'Pending' && a.type !== 'GARAGE_REGISTRATION');

  // StatCard component
  const StatCard = ({ icon, value, label, color, subtitle, onPress }: any) => (
    <TouchableOpacity 
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.statCard, 
        { 
          backgroundColor: theme.colors.card, 
          borderColor: color,
          borderWidth: 0.5,
        }
      ]}
    >
      <View style={[styles.iconWrapper, { backgroundColor: color + '12' }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>{label}</Text>
        {subtitle && (
          <Text style={[styles.statSubtitle, { color: color }]}>{subtitle}</Text>
        )}
      </View>
      {onPress && (
        <MaterialCommunityIcons name="chevron-right" size={16} color={theme.colors.placeholder} />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Dashboard</Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            Garage Overview & Operations
          </Text>
        </View>
        <View style={styles.headerActions}>
          {/* Bell Notification Icon with Pending Alerts Badge */}
          <TouchableOpacity 
            style={[styles.headerIconButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('AdminAlerts')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="bell-outline" size={20} color={theme.colors.text} />
            {pendingAlerts.length > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {pendingAlerts.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Refresh Button */}
          <TouchableOpacity 
            style={[styles.headerIconButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
            disabled={isRefreshing}
            onPress={async () => {
              setIsRefreshing(true);
              try {
                await refreshData();
                Alert.alert('Refreshed', 'Database reloaded successfully!');
              } catch (error) {
                console.error('Refresh error:', error);
              } finally {
                setIsRefreshing(false);
              }
            }}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={theme.colors.secondary} />
            ) : (
              <MaterialCommunityIcons name="refresh" size={20} color={theme.colors.secondary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Dynamic Getting Started Onboarding Card (Compact UI) */}
      {user && (user.role === 'garage_admin' || user.role === 'staff') && !checklistHidden && (
        <View style={[styles.gettingStartedCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {/* Header Row: Tag + Percent Badge + Hide Button */}
          <View style={styles.gettingStartedHeader}>
            <View style={styles.gettingStartedTagBox}>
              <MaterialCommunityIcons name="rocket-launch-outline" size={13} color="#EA580C" />
              <Text style={styles.gettingStartedTag}>COMPLETE YOUR PROFILE</Text>
            </View>
            <View style={styles.headerRightActions}>
              <View style={[styles.percentBadge, { backgroundColor: progressPercent === 100 ? '#10B98115' : '#EA580C15' }]}>
                <Text style={[styles.percentBadgeText, { color: progressPercent === 100 ? '#10B981' : '#EA580C' }]}>
                  {progressPercent}% Complete
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setChecklistHidden(true)}
                style={styles.hideIconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={16} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Subtitle / Description */}
          <Text style={[styles.gettingStartedSubtitle, { color: theme.colors.placeholder }]}>
            Finish setup to go live & receive customer bookings
          </Text>

          {/* Progress Bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: theme.colors.border + '50' }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: progressPercent === 100 ? '#10B981' : '#EA580C',
                }
              ]}
            />
          </View>

          {/* Checklist content (collapsible) */}
          {!checklistCollapsed && (
            <View style={styles.checklistContent}>
              {/* Uncompleted Items */}
              {pendingTasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskRow, { borderBottomColor: theme.colors.border + '40' }]}
                  onPress={task.onPress}
                  activeOpacity={0.7}
                  disabled={!task.onPress}
                >
                  <View style={styles.taskLeft}>
                    <MaterialCommunityIcons name={task.icon as any} size={17} color={theme.colors.secondary} />
                    <Text style={[styles.taskTitle, { color: theme.colors.text }]}>{task.title}</Text>
                  </View>
                  <View style={[styles.emptyCheckbox, { borderColor: theme.colors.border }]} />
                </TouchableOpacity>
              ))}

              {/* Completed Items Section */}
              {completedTasks.length > 0 && (
                <View style={styles.completedSection}>
                  <Text style={[styles.completedHeader, { color: theme.colors.placeholder }]}>COMPLETED ({completedTasks.length})</Text>
                  {completedTasks.map((task) => (
                    <View key={task.id} style={[styles.taskRow, { borderBottomColor: theme.colors.border + '30' }]}>
                      <View style={styles.taskLeft}>
                        <MaterialCommunityIcons name={task.icon as any} size={17} color="#9CA3AF" />
                        <Text style={styles.completedTaskTitle}>{task.title}</Text>
                      </View>
                      <View style={styles.checkedBox}>
                        <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Collapse / Expand Toggle */}
          <TouchableOpacity
            style={styles.collapseToggle}
            onPress={() => setChecklistCollapsed(!checklistCollapsed)}
            activeOpacity={0.7}
          >
            <Text style={[styles.collapseToggleText, { color: theme.colors.secondary }]}>
              {checklistCollapsed ? `Expand checklist (${pendingTasks.length} remaining)` : 'Collapse checklist'}
            </Text>
            <MaterialCommunityIcons
              name={checklistCollapsed ? 'chevron-down' : 'chevron-up'}
              size={16}
              color={theme.colors.secondary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* When user hid the card, provide a sleek, full-width "Complete Your Profile" banner */}
      {user && (user.role === 'garage_admin' || user.role === 'staff') && checklistHidden && (
        <TouchableOpacity
          style={[
            styles.unhidePill,
            {
              backgroundColor: theme.colors.card,
              borderColor: progressPercent === 100 ? '#10B98150' : '#EA580C40',
            }
          ]}
          onPress={() => setChecklistHidden(false)}
          activeOpacity={0.8}
        >
          <View style={[styles.unhideIconBox, { backgroundColor: progressPercent === 100 ? '#10B98115' : '#EA580C15' }]}>
            <MaterialCommunityIcons
              name={progressPercent === 100 ? "check-decagram" : "account-check-outline"}
              size={20}
              color={progressPercent === 100 ? "#10B981" : "#EA580C"}
            />
          </View>
          <View style={styles.unhideTextBox}>
            <View style={styles.unhideTitleRow}>
              <Text style={[styles.unhideTitle, { color: theme.colors.text }]}>Complete Your Profile</Text>
              <View style={[styles.unhidePercentBadge, { backgroundColor: progressPercent === 100 ? '#10B98118' : '#EA580C15' }]}>
                <Text style={[styles.unhidePercentText, { color: progressPercent === 100 ? '#10B981' : '#EA580C' }]}>
                  {progressPercent}% Complete
                </Text>
              </View>
            </View>
            <View style={[styles.unhideMiniProgressTrack, { backgroundColor: theme.colors.border + '60' }]}>
              <View
                style={[
                  styles.unhideMiniProgressFill,
                  {
                    width: `${progressPercent}%`,
                    backgroundColor: progressPercent === 100 ? '#10B981' : '#EA580C',
                  }
                ]}
              />
            </View>
          </View>
          <View style={styles.unhideArrowBtn}>
            <MaterialCommunityIcons name="chevron-down" size={20} color={theme.colors.placeholder} />
          </View>
        </TouchableOpacity>
      )}

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatCard 
            icon="account-group-outline" 
            value={totalCustomersCount} 
            label="Total Customers" 
            color="#6366F1"
            onPress={() => navigation.navigate('Customers')}
          />
          <StatCard 
            icon="car-multiple" 
            value={activeVehiclesCount} 
            label="Active Vehicles" 
            color="#8B5CF6"
            onPress={() => navigation.navigate('Customers')}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard 
            icon="calendar-check-outline" 
            value={bookedMots.length} 
            label="Bookings" 
            color="#3B82F6"
            subtitle={bookedMots.length > 0 ? "View Schedule" : "No Bookings"}
            onPress={() => navigation.navigate('BookedMots')}
          />
          <StatCard 
            icon="bell-ring-outline" 
            value={pendingAlerts.length} 
            label="Action Alerts" 
            color="#F59E0B"
            subtitle={pendingAlerts.length > 0 ? "Needs Review" : "All Caught Up"}
            onPress={() => navigation.navigate('AdminAlerts')}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard 
            icon="car-off" 
            value={soldVehiclesCount} 
            label="Sold Vehicles" 
            color="#6B7280"
          />
          <StatCard 
            icon="clipboard-list-outline" 
            value={audits.length} 
            label="Total Audits" 
            color="#EC4899"
            onPress={() => navigation.navigate('SuperAdminAudits')}
          />
        </View>
      </View>

      {/* Quick Actions Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Management</Text>
        
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.quickActionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('BookedMots')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#3B82F615' }]}>
              <MaterialCommunityIcons name="calendar-month-outline" size={22} color="#3B82F6" />
            </View>
            <Text style={[styles.quickActionTitle, { color: theme.colors.text }]}>Bookings & Slots</Text>
            <Text style={[styles.quickActionSubtitle, { color: theme.colors.placeholder }]}>Manage appointments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('AdminServices')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#8B5CF615' }]}>
              <MaterialCommunityIcons name="tag-multiple-outline" size={22} color="#8B5CF6" />
            </View>
            <Text style={[styles.quickActionTitle, { color: theme.colors.text }]}>Services & Pricing</Text>
            <Text style={[styles.quickActionSubtitle, { color: theme.colors.placeholder }]}>Configure garage rates</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('AdminAlerts')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#F59E0B15' }]}>
              <MaterialCommunityIcons name="bell-badge-outline" size={22} color="#F59E0B" />
            </View>
            <Text style={[styles.quickActionTitle, { color: theme.colors.text }]}>Customer Alerts</Text>
            <Text style={[styles.quickActionSubtitle, { color: theme.colors.placeholder }]}>Requests & changes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onPress={() => navigation.navigate('Customers')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#10B98115' }]}>
              <MaterialCommunityIcons name="account-group" size={22} color="#10B981" />
            </View>
            <Text style={[styles.quickActionTitle, { color: theme.colors.text }]}>Customers Directory</Text>
            <Text style={[styles.quickActionSubtitle, { color: theme.colors.placeholder }]}>View client records</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Bookings Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Bookings</Text>
          {bookedMots.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('BookedMots')}>
              <Text style={[styles.viewAllText, { color: theme.colors.secondary }]}>View All ({bookedMots.length})</Text>
            </TouchableOpacity>
          )}
        </View>

        {bookedMots.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={theme.colors.placeholder} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No Recent Bookings</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.placeholder }]}>
              When customers book appointments, they will appear here.
            </Text>
          </View>
        ) : (
          bookedMots.slice(0, 5).map((booking) => {
            const cleanMake = (booking.makeModel || 'Vehicle').split(' (Slot:')[0]?.split(' at ')[0].trim();
            const slotInfo = booking.slotTime || (booking.makeModel?.match(/Slot:\s*([^\n\r]+)/i)?.[1]) || '';
            const rawStatus = (booking.status || 'Booked').toLowerCase();
            const formattedDate = formatBookingDate(booking.date);

            // Correct status colors: Completed (Green), Approved (Sky Blue / Teal), Cancelled/Rejected (Red), Pending (Amber)
            let statusColor = '#3B82F6';
            let statusBg = '#3B82F618';
            if (rawStatus === 'completed') {
              statusColor = '#10B981'; // Green
              statusBg = '#10B98118';
            } else if (rawStatus === 'approved') {
              statusColor = '#0284C7'; // Blue/Cyan
              statusBg = '#0284C718';
            } else if (rawStatus === 'cancelled' || rawStatus === 'canceled') {
              statusColor = '#EF4444'; // Red
              statusBg = '#EF444418';
            } else if (rawStatus === 'rejected') {
              statusColor = '#DC2626'; // Dark Red
              statusBg = '#DC262618';
            } else if (rawStatus === 'pending') {
              statusColor = '#F59E0B'; // Amber
              statusBg = '#F59E0B18';
            }

            return (
              <TouchableOpacity
                key={booking.id}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('BookedMots')}
                style={[
                  styles.bookingCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.bookingCardHeader}>
                  <View style={styles.vehicleInfo}>
                    <View style={styles.plate}>
                      <Text style={styles.plateText}>{booking.registrationNumber}</Text>
                    </View>
                    <Text style={[styles.vehicleName, { color: theme.colors.text }]} numberOfLines={1}>
                      {cleanMake}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                      {booking.status || 'Booked'}
                    </Text>
                  </View>
                </View>

                <View style={styles.bookingDetails}>
                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="account-outline" size={14} color={theme.colors.placeholder} />
                    <Text style={[styles.detailText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                      {booking.customerName}
                    </Text>
                  </View>
                  {booking.serviceName && (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="wrench-outline" size={14} color={theme.colors.placeholder} />
                      <Text style={[styles.detailText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                        {booking.serviceName} {booking.price ? `(£${booking.price})` : ''}
                      </Text>
                    </View>
                  )}
                  {(slotInfo || formattedDate) && (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="calendar-clock" size={14} color={theme.colors.placeholder} />
                      <Text style={[styles.detailText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                        {formattedDate}{slotInfo ? `${formattedDate ? ' • ' : ''}${slotInfo}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  statsGrid: {
    paddingHorizontal: 16,
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
  },
  statCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    gap: 8,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  statSubtitle: {
    fontSize: 8,
    fontWeight: '500',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionCard: {
    width: (width - 42) / 2,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    alignItems: 'flex-start',
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 11,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  bookingCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  plateText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  vehicleName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bookingDetails: {
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    flex: 1,
    fontSize: 12,
  },
  gettingStartedCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  gettingStartedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gettingStartedTagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gettingStartedTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#EA580C',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  percentBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  hideIconBtn: {
    padding: 2,
  },
  gettingStartedSubtitle: {
    fontSize: 11.5,
    marginBottom: 8,
    lineHeight: 15,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  checklistContent: {
    paddingTop: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 0.5,
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  taskTitle: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  completedSection: {
    marginTop: 6,
  },
  completedHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  completedTaskTitle: {
    fontSize: 12.5,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  checkedBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    gap: 4,
  },
  collapseToggleText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  unhidePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  unhideIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unhideTextBox: {
    flex: 1,
  },
  unhideTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  unhideTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  unhidePercentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  unhidePercentText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  unhideMiniProgressTrack: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  unhideMiniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  unhideArrowBtn: {
    paddingLeft: 2,
  },
});