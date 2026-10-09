import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Dimensions,
  Linking,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, AlertNotification } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const STANDARD_SLOTS = [
  '08:30', '09:15', '10:00', '10:45',
  '11:30', '12:15', '13:00', '13:45',
  '14:30', '15:15', '16:00', '16:45'
];

const getSlotNumber = (item: any) => {
  if (item.slotNumber) return item.slotNumber;
  let timeStr = item.slotTime || '';
  if (!timeStr && item.makeModel) {
    const match = item.makeModel.match(/Slot:\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i) ||
                  item.makeModel.match(/at\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
    if (match) timeStr = match[1];
  }
  if (timeStr) {
    const start = timeStr.split(' - ')[0].trim();
    const idx = STANDARD_SLOTS.indexOf(start);
    if (idx !== -1) return idx + 1;
  }
  return null;
};

const getSlotDisplay = (item: any) => {
  const num = getSlotNumber(item);
  return num ? `Slot #${num}` : 'MOT Slot';
};

const getSlotTimeDisplay = (item: any) => {
  if (item.slotTime) return item.slotTime;
  if (item.makeModel) {
    const match = item.makeModel.match(/Slot:\s*([^\n\r]+)/i);
    if (match) return match[1].trim();
  }
  return '45-Min Test Slot';
};

const formatBookingDate = (dateVal: any) => {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch (e) {}
  return String(dateVal);
};

export default function BookedMotsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { alerts, customers, approveAlert, acknowledgeAlert, rejectAlert, refreshData } = useAppValues();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshData();
    });
    return unsubscribe;
  }, [navigation]);

  // Rejection modal states
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Filter alerts of type BOOKED
  const bookedMots = useMemo(() => alerts.filter((a) => a.type === 'BOOKED'), [alerts]);

  const pendingCount = useMemo(() => bookedMots.filter(a => a.status === 'Pending').length, [bookedMots]);
  const approvedCount = useMemo(() => bookedMots.filter(a => a.status === 'Approved' || a.status === 'Completed').length, [bookedMots]);
  const rejectedCount = useMemo(() => bookedMots.filter(a => a.status === 'Rejected').length, [bookedMots]);

  // Filtered list based on search and tab
  const filteredBookings = useMemo(() => {
    return bookedMots.filter((item) => {
      // Status filter
      if (statusFilter === 'PENDING' && item.status !== 'Pending') return false;
      if (statusFilter === 'APPROVED' && (item.status !== 'Approved' && item.status !== 'Completed')) return false;
      if (statusFilter === 'REJECTED' && item.status !== 'Rejected') return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesReg = item.registrationNumber?.toLowerCase().includes(query);
        const matchesCust = item.customerName?.toLowerCase().includes(query);
        const matchesMake = item.makeModel?.toLowerCase().includes(query);
        const matchesService = item.serviceName?.toLowerCase().includes(query);
        return matchesReg || matchesCust || matchesMake || matchesService;
      }
      return true;
    });
  }, [bookedMots, statusFilter, searchQuery]);

  // Group filtered booked MOTs by customer
  const groupedBookings = useMemo(() => {
    return filteredBookings.reduce((acc, alert) => {
      const custId = alert.customerId || 'unknown';
      if (!acc[custId]) {
        const customer = customers.find(c => 
          String(c.id).toLowerCase() === String(custId).toLowerCase() ||
          String(c._id).toLowerCase() === String(custId).toLowerCase()
        );

        acc[custId] = {
          customerId: custId,
          customerName: alert.customerName || (customer ? `${customer.firstName} ${customer.lastName}` : 'Customer'),
          mobile: customer?.mobile || '',
          email: customer?.email || '',
          alerts: []
        };
      }
      acc[custId].alerts.push(alert);
      return acc;
    }, {} as Record<string, { customerId: string; customerName: string; mobile: string; email: string; alerts: AlertNotification[] }>);
  }, [filteredBookings, customers]);

  const groupedList = Object.values(groupedBookings);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error('[BOOKED MOTS] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirm = async (alertId: string) => {
    setLoadingAction(alertId);
    try {
      await approveAlert(alertId);
      Alert.alert('Approved', 'MOT Booking has been confirmed successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not approve booking.');
    } finally {
      setLoadingAction(null);
    }
  };

  const openRejectModal = (alertId: string) => {
    setSelectedAlertId(alertId);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const submitRejection = async () => {
    if (!selectedAlertId) return;
    const alertId = selectedAlertId;
    setRejectModalVisible(false);
    setLoadingAction(alertId);
    try {
      await rejectAlert(alertId, rejectionReason || 'Unavailable slot / Garage busy');
      Alert.alert('Rejected', 'Booking request has been rejected.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not reject booking.');
    } finally {
      setLoadingAction(null);
      setSelectedAlertId(null);
    }
  };

  const callCustomer = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Navbar Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Main', { screen: 'Dashboard' })} 
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity> 
        <View style={styles.navTitleContainer}>
          <Text style={[styles.navTitle, { color: theme.colors.text }]}>Booked Appointments</Text>
          <Text style={[styles.navSubtitle, { color: theme.colors.placeholder }]}>
            {bookedMots.length} total bookings
          </Text>
        </View>
        <TouchableOpacity 
          onPress={onRefresh} 
          style={[styles.refreshIconBtn, { borderColor: theme.colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchWrapper, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.placeholder} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="Search by VRN, customer or make..."
          placeholderTextColor={theme.colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.filterTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsScroll}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              statusFilter === 'ALL'
                ? { backgroundColor: theme.colors.secondary, borderColor: theme.colors.secondary }
                : { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
            ]}
            onPress={() => setStatusFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, { color: statusFilter === 'ALL' ? '#FFFFFF' : theme.colors.text }]}>
              All ({bookedMots.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              statusFilter === 'PENDING'
                ? { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }
                : { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
            ]}
            onPress={() => setStatusFilter('PENDING')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name="clock-alert-outline" 
              size={13} 
              color={statusFilter === 'PENDING' ? '#FFFFFF' : '#F59E0B'} 
              style={{ marginRight: 4 }} 
            />
            <Text style={[styles.filterPillText, { color: statusFilter === 'PENDING' ? '#FFFFFF' : theme.colors.text }]}>
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              statusFilter === 'APPROVED'
                ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                : { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
            ]}
            onPress={() => setStatusFilter('APPROVED')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name="check-circle-outline" 
              size={13} 
              color={statusFilter === 'APPROVED' ? '#FFFFFF' : '#10B981'} 
              style={{ marginRight: 4 }} 
            />
            <Text style={[styles.filterPillText, { color: statusFilter === 'APPROVED' ? '#FFFFFF' : theme.colors.text }]}>
              Confirmed ({approvedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              statusFilter === 'REJECTED'
                ? { backgroundColor: '#EF4444', borderColor: '#EF4444' }
                : { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
            ]}
            onPress={() => setStatusFilter('REJECTED')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name="close-circle-outline" 
              size={13} 
              color={statusFilter === 'REJECTED' ? '#FFFFFF' : '#EF4444'} 
              style={{ marginRight: 4 }} 
            />
            <Text style={[styles.filterPillText, { color: statusFilter === 'REJECTED' ? '#FFFFFF' : theme.colors.text }]}>
              Rejected ({rejectedCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.secondary]} />
        }
      >
        {groupedList.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyText, { color: theme.colors.text }]}>No bookings found</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.placeholder }]}>
              {searchQuery ? `No appointments matching "${searchQuery}"` : 'No appointments in this category'}
            </Text>
          </View>
        ) : (
          groupedList.map((group) => {
            return (
              <View
                key={group.customerId}
                style={[styles.customerContainerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                {/* Customer Section Header */}
                <View style={[styles.customerGroupHeader, { borderBottomColor: theme.colors.border }]}>
                  <View style={styles.customerInfoLeft}>
                    <View style={[styles.customerAvatar, { backgroundColor: theme.colors.secondary + '15' }]}>
                      <Text style={[styles.customerAvatarText, { color: theme.colors.secondary }]}>
                        {group.customerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.customerGroupName, { color: theme.colors.text }]}>
                        {group.customerName}
                      </Text>
                      {group.mobile ? (
                        <TouchableOpacity 
                          onPress={() => callCustomer(group.mobile)}
                          style={styles.customerPhoneRow}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="phone-outline" size={12} color={theme.colors.secondary} />
                          <Text style={[styles.customerPhoneText, { color: theme.colors.secondary }]}>
                            {group.mobile}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  
                  <View style={[styles.badgeCount, { backgroundColor: theme.colors.secondary + '12' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.secondary }}>
                      {group.alerts.length} {group.alerts.length === 1 ? 'Slot' : 'Slots'}
                    </Text>
                  </View>
                </View>

                {/* Sub-cards for each vehicle booking */}
                <View style={styles.vehiclesList}>
                  {group.alerts.map((item, index) => {
                    const isPending = item.status === 'Pending';
                    const isApproved = item.status === 'Approved';
                    const isRejected = item.status === 'Rejected';
                    const isCompleted = item.status === 'Completed';

                    let statusText = 'Acknowledged';
                    let statusColor = '#6B7280';
                    let statusBg = '#6B728015';
                    let statusIcon = 'check';

                    if (isCompleted) {
                      statusText = 'Completed';
                      statusColor = '#10B981';
                      statusBg = '#10B98115';
                      statusIcon = 'check-decagram';
                    } else if (isPending) {
                      statusText = 'Pending Approval';
                      statusColor = '#F59E0B';
                      statusBg = '#F59E0B15';
                      statusIcon = 'clock-alert-outline';
                    } else if (isApproved) {
                      statusText = 'Confirmed';
                      statusColor = '#10B981';
                      statusBg = '#10B98115';
                      statusIcon = 'check-circle';
                    } else if (isRejected) {
                      statusText = 'Rejected';
                      statusColor = '#EF4444';
                      statusBg = '#EF444415';
                      statusIcon = 'close-circle';
                    }

                    return (
                      <View 
                        key={item.id}
                        style={[
                          styles.subVehicleCard, 
                          { 
                            backgroundColor: theme.colors.background, 
                            borderColor: isPending ? '#F59E0B50' : theme.colors.border,
                            borderLeftWidth: isPending ? 3.5 : 1,
                            borderLeftColor: isPending ? '#F59E0B' : theme.colors.border,
                          }
                        ]}
                      >
                        {/* Top Row: Vehicle VRN + Model + Status Badge */}
                        <View style={styles.vehicleHeaderRow}>
                          <View style={styles.vehicleTitleGroup}>
                            {group.alerts.length > 1 && (
                              <View style={[styles.slotNumberPill, { backgroundColor: theme.colors.secondary + '15', borderColor: theme.colors.secondary + '40' }]}>
                                <Text style={[styles.slotNumberPillText, { color: theme.colors.secondary }]}>Slot {index + 1}.</Text>
                              </View>
                            )}
                            <View style={styles.plate}>
                              <Text style={styles.plateText}>{item.registrationNumber}</Text>
                            </View>
                            <Text style={[styles.makeModelText, { color: theme.colors.text }]} numberOfLines={1}>
                              {item.makeModel?.split(' (Slot:')[0]?.split(' at ')[0] || item.makeModel}
                            </Text>
                          </View>

                          <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '30' }]}>
                            <MaterialCommunityIcons name={statusIcon} size={11} color={statusColor} style={{ marginRight: 3 }} />
                            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                          </View>
                        </View>

                        {/* Compact Details Grid */}
                        <View style={styles.compactDetailsGrid}>
                          {/* Date & Time */}
                          <View style={[styles.detailChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <MaterialCommunityIcons name="calendar-month-outline" size={13} color={theme.colors.secondary} />
                            <Text style={[styles.detailChipText, { color: theme.colors.text }]}>
                              {formatBookingDate(item.date)}
                            </Text>
                          </View>

                          {/* Slot Time */}
                          <View style={[styles.detailChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <MaterialCommunityIcons name="clock-outline" size={13} color="#3B82F6" />
                            <Text style={[styles.detailChipText, { color: theme.colors.text }]}>
                              {group.alerts.length > 1 ? `Slot ${index + 1}. ` : `${getSlotDisplay(item)} • `}{getSlotTimeDisplay(item)}
                            </Text>
                          </View>

                          {/* Service Name & Price */}
                          <View style={[styles.detailChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <MaterialCommunityIcons name="wrench-outline" size={13} color="#8B5CF6" />
                            <Text style={[styles.detailChipText, { color: theme.colors.text }]} numberOfLines={1}>
                              {item.serviceName || 'MOT Test'}
                              {item.price ? ` • £${item.price}` : ''}
                              {item.duration ? ` (${item.duration}m)` : ''}
                            </Text>
                          </View>

                          {/* Bay / Station if present */}
                          {item.stationName && (
                            <View style={[styles.detailChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                              <MaterialCommunityIcons name="garage" size={13} color="#10B981" />
                              <Text style={[styles.detailChipText, { color: theme.colors.text }]}>
                                {item.stationName}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Rejection Notice */}
                        {isRejected && item.rejectionReason && (
                          <View style={[styles.rejectionNotice, { backgroundColor: '#EF444410', borderColor: '#EF444430' }]}>
                            <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>Reason for Rejection:</Text>
                              <Text style={[styles.rejectionText, { color: theme.colors.text }]}>{item.rejectionReason}</Text>
                            </View>
                          </View>
                        )}

                        {/* Compact Action Buttons (If Pending) */}
                        {isPending && (
                          <View style={styles.subActionRow}>
                            <TouchableOpacity
                              onPress={() => openRejectModal(item.id)}
                              disabled={loadingAction !== null}
                              style={[styles.subActionBtn, styles.subRejectBtn, { borderColor: '#EF444440' }]}
                              activeOpacity={0.7}
                            >
                              <MaterialCommunityIcons name="close" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EF4444' }}>Reject</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleConfirm(item.id)}
                              disabled={loadingAction !== null}
                              style={[styles.subActionBtn, styles.subConfirmBtn, { backgroundColor: theme.colors.secondary }]}
                              activeOpacity={0.7}
                            >
                              {loadingAction === item.id ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                              ) : (
                                <>
                                  <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' }}>Confirm Booking</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Reject Reason Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={rejectModalVisible}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrapper, { backgroundColor: '#EF444415' }]}>
                <MaterialCommunityIcons name="calendar-remove" size={22} color="#EF4444" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Reject Booking Request</Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                  Customer will be notified of this cancellation reason.
                </Text>
              </View>
            </View>

            {/* Quick Reason Chips */}
            <Text style={[styles.presetTitle, { color: theme.colors.placeholder }]}>Quick reasons:</Text>
            <View style={styles.presetChips}>
              {['Slot already booked', 'Garage closed', 'Staff unavailable', 'Equipment maintenance'].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setRejectionReason(reason)}
                  style={[
                    styles.presetChip,
                    { 
                      backgroundColor: rejectionReason === reason ? '#EF444420' : theme.colors.background,
                      borderColor: rejectionReason === reason ? '#EF4444' : theme.colors.border,
                    }
                  ]}
                >
                  <Text style={[styles.presetChipText, { color: rejectionReason === reason ? '#EF4444' : theme.colors.text }]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              placeholder="Or enter custom reason..."
              placeholderTextColor={theme.colors.placeholder}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setRejectModalVisible(false)}
                style={[styles.modalBtn, styles.modalCancelBtn, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitRejection}
                style={[styles.modalBtn, styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]}
              >
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  navTitleContainer: {
    flex: 1,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  navSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  refreshIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  filterTabsContainer: {
    marginBottom: 8,
  },
  filterTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  customerContainerCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 14,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  customerGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  customerInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  customerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  customerGroupName: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  customerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  customerPhoneText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  badgeCount: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  vehiclesList: {
    gap: 10,
  },
  subVehicleCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  vehicleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 8,
  },
  slotNumberPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  slotNumberPillText: {
    fontSize: 10.5,
    fontWeight: '700',
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
  makeModelText: {
    fontWeight: '600',
    fontSize: 12.5,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  compactDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  detailChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  rejectionNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
  },
  rejectionText: {
    fontSize: 11,
    marginTop: 1,
  },
  subActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 8,
  },
  subActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  subRejectBtn: {
    borderWidth: 1,
    backgroundColor: '#EF444410',
  },
  subConfirmBtn: {
    elevation: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  presetTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  presetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 12.5,
    height: 60,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  modalCancelBtn: {
    borderWidth: 1,
  },
  modalConfirmBtn: {
    elevation: 1,
  },
  modalBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

