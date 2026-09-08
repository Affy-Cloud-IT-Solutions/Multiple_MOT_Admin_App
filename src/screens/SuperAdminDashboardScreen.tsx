import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';

const { width } = Dimensions.get('window');

export default function SuperAdminDashboardScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { user, garages, customers, vehicles, audits, refreshData, updateGarageStatus, token } = useAppValues();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const fetchPlatformStats = async () => {
    try {
      const response = await fetch(`${BASE_URL}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Error fetching platform stats:', e);
    }
  };

  useEffect(() => {
    fetchPlatformStats();
    const unsubscribe = navigation.addListener('focus', () => {
      refreshData();
      fetchPlatformStats();
    });
    return unsubscribe;
  }, [navigation, token]);

  const pendingGarages = garages.filter(g => g.status === 'Pending');
  const approvedGarages = garages.filter(g => g.status === 'Approved');

  const totalGaragesCount = stats?.totalGarages ?? garages.length;
  const approvedGaragesCount = stats?.approvedGarages ?? approvedGarages.length;
  const pendingGaragesCount = stats?.pendingGarages ?? pendingGarages.length;
  const totalCustomersCount = stats?.totalCustomers ?? customers.length;
  const totalVehiclesCount = stats?.totalVehicles ?? vehicles.length;
  const totalBookingsCount = stats?.bookedMots ?? 0;
  const totalAuditsCount = stats?.totalAudits ?? audits.length;

  const handleApproveGarage = async (garageId: string, name: string) => {
    setLoadingAction(garageId);
    try {
      await updateGarageStatus(garageId, 'Approved', 'Verified');
      await fetchPlatformStats();
      Alert.alert('Approved', `Garage "${name}" has been approved and verified for public operations!`);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not approve garage.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRejectGarage = async (garageId: string, name: string) => {
    Alert.alert(
      'Reject Garage',
      `Are you sure you want to reject "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction(garageId);
            try {
              await updateGarageStatus(garageId, 'Rejected', 'Rejected');
              await fetchPlatformStats();
              Alert.alert('Rejected', `Garage "${name}" has been rejected.`);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Could not reject garage.');
            } finally {
              setLoadingAction(null);
            }
          }
        }
      ]
    );
  };

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
          borderWidth: 0.8,
        }
      ]}
    >
      <View style={[styles.iconWrapper, { backgroundColor: color + '15' }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>{label}</Text>
        {subtitle && (
          <Text style={[styles.statSubtitle, { color }]}>{subtitle}</Text>
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
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.roleTag}>
            <MaterialCommunityIcons name="shield-crown" size={14} color="#6366F1" />
            <Text style={styles.roleTagText}>SUPER ADMIN CONSOLE</Text>
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Platform Overview</Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            UK-wide Garage & Network Management
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
          disabled={isRefreshing}
          onPress={async () => {
            setIsRefreshing(true);
            try {
              await refreshData();
              await fetchPlatformStats();
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

      {/* Platform Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatCard
            icon="garage"
            value={totalGaragesCount}
            label="Total Garages"
            color="#6366F1"
            subtitle={`${approvedGaragesCount} Active`}
            onPress={() => navigation.navigate('Garages')}
          />
          <StatCard
            icon="clock-alert-outline"
            value={pendingGaragesCount}
            label="Pending Garages"
            color={pendingGaragesCount > 0 ? '#EF4444' : '#10B981'}
            subtitle={pendingGaragesCount > 0 ? 'Requires Action' : 'All Clear'}
            onPress={() => navigation.navigate('Garages')}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon="account-group-outline"
            value={totalCustomersCount}
            label="Total Customers"
            color="#3B82F6"
            subtitle="Platform-wide"
            onPress={() => navigation.navigate('Customers')}
          />
          <StatCard
            icon="car-multiple"
            value={totalVehiclesCount}
            label="Total Vehicles"
            color="#8B5CF6"
            subtitle="All Garages"
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon="calendar-check-outline"
            value={totalBookingsCount}
            label="Total Bookings"
            color="#10B981"
            subtitle="All Services"
          />
          <StatCard
            icon="clipboard-list-outline"
            value={totalAuditsCount}
            label="System Audits"
            color="#EC4899"
            subtitle="Audit Trail"
            onPress={() => navigation.navigate('Audits')}
          />
        </View>
      </View>

      {/* Pending Garages Section */}
      {pendingGarages.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.badgePulse}>
                <Text style={styles.badgePulseText}>{pendingGarages.length}</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Garages Pending Approval
              </Text>
            </View>
          </View>

          {pendingGarages.map((garage) => (
            <TouchableOpacity
              key={garage.id || garage._id}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('GarageVerificationReview', { garageId: garage.id || garage._id, garage })}
              style={[
                styles.pendingCard,
                { backgroundColor: theme.colors.card, borderColor: '#F59E0B' }
              ]}
            >
              <View style={styles.pendingCardHeader}>
                <View style={[styles.garageIconBox, { backgroundColor: '#F59E0B15' }]}>
                  <MaterialCommunityIcons name="garage-open" size={24} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.pendingGarageName, { color: theme.colors.text }]}>
                      {garage.name}
                    </Text>
                    <View style={{ backgroundColor: '#F59E0B20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: '#F59E0B', fontSize: 10.5, fontWeight: 'bold' }}>Pending Review</Text>
                    </View>
                  </View>
                  <Text style={[styles.pendingGarageLocation, { color: theme.colors.placeholder }]} numberOfLines={1}>
                    <MaterialCommunityIcons name="map-marker-outline" size={13} color={theme.colors.placeholder} /> {garage.address}
                  </Text>
                  {garage.phone ? (
                    <Text style={[styles.pendingGaragePhone, { color: theme.colors.placeholder }]}>
                      <MaterialCommunityIcons name="phone-outline" size={13} color={theme.colors.placeholder} /> {garage.phone} • {garage.email}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.pendingCardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn, { flex: 1, backgroundColor: theme.colors.primary }]}
                  onPress={() => navigation.navigate('GarageVerificationReview', { garageId: garage.id || garage._id, garage })}
                >
                  <MaterialCommunityIcons name="clipboard-check-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.actionBtnText}>Review Application & Audit Docs →</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Top Garages Overview */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Registered Garages Directory</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Garages')}>
            <Text style={[styles.viewAllText, { color: theme.colors.secondary }]}>View All ({garages.length})</Text>
          </TouchableOpacity>
        </View>

        {garages.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="garage-alert" size={36} color={theme.colors.placeholder} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No garages registered yet.</Text>
          </View>
        ) : (
          garages.slice(0, 3).map((garage) => (
            <TouchableOpacity
              key={garage.id || garage._id}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Garages')}
              style={[
                styles.garageSummaryCard,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
              ]}
            >
              <View style={styles.garageSummaryTop}>
                <View style={[styles.garageAvatar, { backgroundColor: theme.colors.primaryContainer }]}>
                  <MaterialCommunityIcons name="garage" size={24} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.garageTitle, { color: theme.colors.text }]} numberOfLines={1}>
                      {garage.name}
                    </Text>
                    <View
                      style={[
                        styles.statusChip,
                        {
                          backgroundColor:
                            garage.status === 'Approved'
                              ? '#10B98118'
                              : garage.status === 'Pending'
                              ? '#F59E0B18'
                              : '#EF444418'
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          {
                            color:
                              garage.status === 'Approved'
                                ? '#10B981'
                                : garage.status === 'Pending'
                                ? '#F59E0B'
                                : '#EF4444'
                          }
                        ]}
                      >
                        {garage.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.garageAddress, { color: theme.colors.placeholder }]} numberOfLines={1}>
                    <MaterialCommunityIcons name="map-marker" size={13} color="#EF4444" /> {garage.address}
                  </Text>
                </View>
              </View>

              <View style={[styles.garageMetricsRow, { borderTopColor: theme.colors.border + '60' }]}>
                <View style={styles.metricItem}>
                  <MaterialCommunityIcons name="account-group" size={14} color={theme.colors.placeholder} />
                  <Text style={[styles.metricText, { color: theme.colors.text }]}>
                    {garage.customerCount ?? 0} Customers
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <MaterialCommunityIcons name="account-tie" size={14} color={theme.colors.placeholder} />
                  <Text style={[styles.metricText, { color: theme.colors.text }]}>
                    {garage.staffCount ?? 0} Staff
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <MaterialCommunityIcons name="calendar-check" size={14} color={theme.colors.placeholder} />
                  <Text style={[styles.metricText, { color: theme.colors.text }]}>
                    {garage.bookingsCount ?? 0} Bookings
                  </Text>
                </View>
                {garage.rating ? (
                  <View style={styles.metricItem}>
                    <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
                    <Text style={[styles.metricText, { color: theme.colors.text }]}>
                      {garage.rating}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366F118',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  statsGrid: {
    paddingHorizontal: 16,
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 70,
    gap: 10,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  statSubtitle: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
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
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  badgePulse: {
    backgroundColor: '#EF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePulseText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  pendingCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
  },
  pendingCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  garageIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingGarageName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  pendingGarageLocation: {
    fontSize: 12,
    marginBottom: 2,
  },
  pendingGaragePhone: {
    fontSize: 11,
  },
  pendingCardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approveBtn: {
    backgroundColor: '#10B981',
  },
  rejectBtn: {
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  garageSummaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  garageSummaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  garageAvatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garageTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  garageAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  garageMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});
