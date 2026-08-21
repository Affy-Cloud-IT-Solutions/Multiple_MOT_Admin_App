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

  const getDaysDiff = (dateStr: string) => {
    const today = new Date('2026-07-22');
    const expiry = new Date(dateStr);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const activeVehicles = vehicles.filter((v) => v.status === 'Active');
  const totalCustomersCount = customers.length;
  const activeVehiclesCount = activeVehicles.length;
  
  const dueIn7Days = activeVehicles.filter(v => {
    const diff = getDaysDiff(v.motExpiryDate);
    return diff >= 0 && diff <= 7;
  });
  
  const dueIn30Days = activeVehicles.filter(v => {
    const diff = getDaysDiff(v.motExpiryDate);
    return diff > 7 && diff <= 30;
  });

  const dueIn45Days = activeVehicles.filter(v => {
    const diff = getDaysDiff(v.motExpiryDate);
    return diff > 30 && diff <= 45;
  });

  const soldVehiclesCount = vehicles.filter((v) => v.status === 'Sold').length;
  const bookedMotsCount = alerts.filter(a => a.type === 'BOOKED').length;

  const sendManualReminder = (reg: string, customerId: string, days: number) => {
    const customer = customers.find(c => 
      String(c.id).toLowerCase() === String(customerId || '').toLowerCase() ||
      String(c._id).toLowerCase() === String(customerId || '').toLowerCase()
    );
    if (!customer) return;

    Alert.alert(
      'Send MOT Reminder',
      `Send ${days}-day MOT reminder to ${customer.firstName} ${customer.lastName} via ${customer.preferredContact}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            Alert.alert(
              'Sent!',
              `MOT reminder sent successfully to ${customer.firstName} (${customer.mobile}) via ${customer.preferredContact}.`
            );
          }
        }
      ]
    );
  };

  // Updated StatCard with border matching icon color
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
            MOT Reminder Management
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.refreshButton, { borderColor: theme.colors.border }]}
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

      {/* Stats Grid - Uniform 2-column layout */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatCard 
            icon="account-group-outline" 
            value={totalCustomersCount} 
            label="Total Customers" 
            color="#6366F1"
          />
          <StatCard 
            icon="car-multiple" 
            value={activeVehiclesCount} 
            label="Active Vehicles" 
            color="#8B5CF6"
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard 
            icon="clock-alert-outline" 
            value={dueIn7Days.length} 
            label="Due in 7 Days" 
            color="#EF4444"
            subtitle="Critical"
          />
          <StatCard 
            icon="clock-outline" 
            value={dueIn30Days.length} 
            label="Due in 30 Days" 
            color="#F59E0B"
            subtitle="Warning"
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard 
            icon="clock-start" 
            value={dueIn45Days.length} 
            label="Due in 45 Days" 
            color="#10B981"
            subtitle="Upcoming"
          />
          <StatCard 
            icon="calendar-check-outline" 
            value={bookedMotsCount} 
            label="Booked MOT's" 
            color="#3B82F6"
            onPress={() => navigation.navigate('BookedMots')}
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
          />
        </View>
      </View>

      {/* Urgent Action Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Urgent Actions</Text>
          <Text style={[styles.sectionCount, { color: theme.colors.placeholder }]}>
            {dueIn7Days.length + dueIn30Days.length} pending
          </Text>
        </View>
        
        {dueIn7Days.length === 0 && dueIn30Days.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={40} color={theme.colors.placeholder} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>All caught up</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.placeholder }]}>No vehicles require immediate attention</Text>
          </View>
        ) : (
          [...dueIn7Days, ...dueIn30Days].map((v) => {
            const customer = customers.find(c => 
              String(c.id).toLowerCase() === String(v.customerId || '').toLowerCase() ||
              String(c._id).toLowerCase() === String(v.customerId || '').toLowerCase()
            );
            const daysLeft = getDaysDiff(v.motExpiryDate);
            const isCritical = daysLeft <= 7;
            
            return (
              <View
                key={v.id}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: isCritical ? '#EF4444' : '#F59E0B',
                    borderLeftWidth: 4,
                  },
                ]}
              >
                <View style={styles.actionCardContent}>
                  <View style={styles.actionCardHeader}>
                    <View style={styles.vehicleInfo}>
                      <View style={styles.plate}>
                        <Text style={styles.plateText}>{v.registrationNumber}</Text>
                      </View>
                      <Text style={[styles.vehicleName, { color: theme.colors.text }]}>
                        {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                      </Text>
                    </View>
                    <View style={[styles.daysBadge, { backgroundColor: isCritical ? '#EF4444' : '#F59E0B' }]}>
                      <Text style={styles.daysText}>{daysLeft}d</Text>
                    </View>
                  </View>

                  <View style={styles.actionCardDetails}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="account-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                      <Text style={[styles.customerName, { color: theme.colors.placeholder }]}>
                        {customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="phone-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                      <Text style={[styles.contactInfo, { color: theme.colors.placeholder }]}>
                        {customer?.mobile} • {customer?.preferredContact}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => sendManualReminder(v.registrationNumber, v.customerId, isCritical ? 7 : 30)}
                    style={[styles.actionButton, { backgroundColor: theme.colors.secondary + '10' }]}
                  >
                    <MaterialCommunityIcons name="send-outline" size={16} color={theme.colors.secondary} />
                    <Text style={[styles.actionButtonText, { color: theme.colors.secondary }]}>
                      Send Reminder
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
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
    paddingBottom: 20,
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
  },
  actionCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  actionCardContent: {
    padding: 10,
  },
  actionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontSize: 13,
    fontWeight: '600',
  },
  daysBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  daysText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionCardDetails: {
    marginBottom: 8,
    gap: 1,
  },
  customerName: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  contactInfo: {
    fontSize: 11,
    fontWeight: '400',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});