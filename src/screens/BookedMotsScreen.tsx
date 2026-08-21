import React, { useState } from 'react';
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
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BookedMotsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { alerts, approveAlert, acknowledgeAlert, rejectAlert, refreshData } = useAppValues();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

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
  const bookedMots = alerts.filter((a) => a.type === 'BOOKED');

  // Group booked MOTs by customer
  const groupedBookings = bookedMots.reduce((acc, alert) => {
    const custId = alert.customerId || 'unknown';
    if (!acc[custId]) {
      acc[custId] = {
        customerId: custId,
        customerName: alert.customerName,
        alerts: []
      };
    }
    acc[custId].alerts.push(alert);
    return acc;
  }, {} as Record<string, { customerId: string; customerName: string; alerts: typeof bookedMots }>);

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

  const handleAcknowledge = async (alertId: string) => {
    setLoadingAction(alertId);
    try {
      await acknowledgeAlert(alertId);
      Alert.alert('Acknowledged', 'Booking request acknowledged and removed from pending.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not acknowledge booking.');
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
      await rejectAlert(alertId, rejectionReason);
      Alert.alert('Rejected', 'Booking request has been rejected.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not reject booking.');
    } finally {
      setLoadingAction(null);
      setSelectedAlertId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Navbar Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Dashboard' })} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
          {/* <Text style={[styles.backBtnText, { color: theme.colors.text }]}>Back</Text> */}
        </TouchableOpacity> 
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>Booked MOT's</Text>
        <View style={styles.countBadge}>
          <Text style={[styles.countText, { color: theme.colors.secondary }]}>{bookedMots.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.secondary]} />
        }
      >
        {groupedList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-blank" size={54} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No MOT bookings found.</Text>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="account" size={20} color={theme.colors.secondary} style={{ marginRight: 8 }} />
                    <Text style={[styles.customerGroupName, { color: theme.colors.text }]}>
                      {group.customerName}
                    </Text>
                  </View>
                  <View style={[styles.badgeCount, { backgroundColor: theme.colors.secondary + '20' }]}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.secondary }}>
                      {group.alerts.length} {group.alerts.length === 1 ? 'Booking' : 'Bookings'}
                    </Text>
                  </View>
                </View>

                {/* Sub-cards for each vehicle booking */}
                <View style={styles.vehiclesList}>
                  {group.alerts.map((item) => {
                    const isPending = item.status === 'Pending';
                    const isApproved = item.status === 'Approved';
                    const isRejected = item.status === 'Rejected';

                    let statusText = 'Acknowledged';
                    let statusColor = theme.colors.placeholder;
                    let statusBg = theme.colors.border + '30';

                    if (isPending) {
                      statusText = 'Pending Confirmation';
                      statusColor = theme.colors.warning;
                      statusBg = theme.colors.warning + '15';
                    } else if (isApproved) {
                      statusText = 'Booking Confirmed';
                      statusColor = theme.colors.success;
                      statusBg = theme.colors.success + '15';
                    } else if (isRejected) {
                      statusText = 'Booking Rejected';
                      statusColor = theme.colors.error;
                      statusBg = theme.colors.error + '15';
                    }

                    return (
                      <View 
                        key={item.id}
                        style={[styles.subVehicleCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                      >
                        {/* Sub Card Header: Date & Status */}
                        <View style={styles.subCardHeader}>
                          <Text style={{ fontSize: 10, color: theme.colors.placeholder }}>
                            Requested: {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
                            <Text style={[styles.statusText, { color: statusColor, fontSize: 9 }]}>{statusText}</Text>
                          </View>
                        </View>

                        {/* Vehicle Row */}
                        <View style={styles.subCardBody}>
                          <View style={styles.vehicleRow}>
                            <View style={styles.plate}>
                              <Text style={styles.plateText}>{item.registrationNumber}</Text>
                            </View>
                            <Text style={[styles.makeModelText, { color: theme.colors.text, flex: 1, fontSize: 13 }]}>
                              {item.makeModel}
                            </Text>
                          </View>

                          {isRejected && item.rejectionReason && (
                            <View style={{ marginTop: 8, padding: 8, borderRadius: 6, backgroundColor: theme.colors.error + '10', borderWidth: 0.5, borderColor: theme.colors.error }}>
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.error }}>Rejection Reason:</Text>
                              <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2 }}>{item.rejectionReason}</Text>
                            </View>
                          )}
                        </View>

                        {/* Action buttons inside sub-card (If Pending) */}
                        {isPending && (
                          <View style={styles.subActionRow}>
                            <TouchableOpacity
                              onPress={() => openRejectModal(item.id)}
                              disabled={loadingAction !== null}
                              style={[styles.subActionBtn, styles.subDismissBtn, { borderColor: theme.colors.error + '30' }]}
                            >
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.error }}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleConfirm(item.id)}
                              disabled={loadingAction !== null}
                              style={[styles.subActionBtn, styles.subConfirmBtn, { backgroundColor: theme.colors.secondary }]}
                            >
                              {loadingAction === item.id ? (
                                <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
                              ) : (
                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.dark ? theme.colors.background : '#FFFFFF' }}>Confirm Booking</Text>
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
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Reject Booking Request</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
              Please enter the reason for rejecting this booking request. This reason will be displayed to the customer.
            </Text>
            
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              placeholder="e.g. No slots available, garage closed"
              placeholderTextColor={theme.colors.placeholder}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
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
                style={[styles.modalBtn, styles.modalConfirmBtn, { backgroundColor: theme.colors.error }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Confirm Reject</Text>
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
    height: 56,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  countBadge: {
    backgroundColor: '#0284C715',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  countText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 128,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  bookingCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  statusBadge: {
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardBody: {
    padding: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '500',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00000003',
    padding: 6,
    borderRadius: 6,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 10,
  },
  plateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  makeModelText: {
    fontWeight: 'bold',
    fontSize: 13,
    flex: 1,
  },
  divider: {
    height: 1,
  },
  actionRow: {
    flexDirection: 'row',
    padding: 10,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rejectBtn: {
    borderWidth: 1.2,
  },
  approveBtn: {
    elevation: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  customerContainerCard: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 18,
    padding: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  customerGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  customerGroupName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  badgeCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vehiclesList: {
    gap: 12,
  },
  subVehicleCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  subCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subCardBody: {
    marginBottom: 6,
  },
  subActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
    paddingTop: 8,
  },
  subActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subDismissBtn: {
    borderWidth: 1,
  },
  subConfirmBtn: {
    elevation: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
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
    fontWeight: 'bold',
  },
});
