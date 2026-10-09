import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, Dimensions, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

const { width } = Dimensions.get('window');

export default function AdminDashboardScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { customers, vehicles, alerts, audits, refreshData } = useAppValues();
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  const pendingAlerts = alerts.filter(a => a.status === 'Pending');

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
            label="Booked MOT's" 
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
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Booked MOTs</Text>
          {bookedMots.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('BookedMots')}>
              <Text style={[styles.viewAllText, { color: theme.colors.secondary }]}>View All ({bookedMots.length})</Text>
            </TouchableOpacity>
          )}
        </View>

        {bookedMots.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={theme.colors.placeholder} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No Booked MOTs</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.placeholder }]}>
              When customers book appointments, they will appear here.
            </Text>
          </View>
        ) : (
          bookedMots.slice(0, 5).map((booking) => {
            const cleanMake = (booking.makeModel || 'Vehicle').split(' (Slot:')[0]?.split(' at ')[0].trim();
            const slotInfo = booking.slotTime || (booking.makeModel?.match(/Slot:\s*([^\n\r]+)/i)?.[1]) || '';
            const isCompleted = booking.status === 'Completed';

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
                  <View style={[styles.statusBadge, { backgroundColor: isCompleted ? '#10B98115' : '#3B82F615' }]}>
                    <Text style={[styles.statusBadgeText, { color: isCompleted ? '#10B981' : '#3B82F6' }]}>
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
                  {(slotInfo || booking.date) && (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.placeholder} />
                      <Text style={[styles.detailText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                        {booking.date ? `${booking.date}` : ''}{slotInfo ? `${booking.date ? ' • ' : ''}${slotInfo}` : ''}
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
});