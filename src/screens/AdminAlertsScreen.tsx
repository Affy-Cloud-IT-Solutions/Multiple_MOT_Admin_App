import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

export default function AdminAlertsScreen() {
  const { theme } = useAppTheme();
  const { alerts, approveAlert, acknowledgeAlert, rejectAlert } = useAppValues();

  // Show only pending alerts
  const pendingAlerts = alerts.filter((a) => a.status === 'Pending');

  const handleApprove = (alertId: string, alertType: string) => {
    approveAlert(alertId);
    let message = 'Action approved successfully!';
    if (alertType === 'NEW_VEHICLE') {
      message = 'New vehicle has been approved and added to the customer profile!';
    } else if (alertType === 'SOLD') {
      message = 'Vehicle status updated to Sold. Future reminders stopped.';
    } else if (alertType === 'BOOKED') {
      message = 'MOT Booking confirmed!';
    }
    Alert.alert('Approved', message);
  };

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedAlertType, setSelectedAlertType] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleReject = (alertId: string, alertType: string) => {
    setSelectedAlertId(alertId);
    setSelectedAlertType(alertType);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const submitRejection = async () => {
    if (!selectedAlertId) return;
    const alertId = selectedAlertId;
    const alertType = selectedAlertType;
    
    setRejectModalVisible(false);
    setLoadingAction(alertId);
    try {
      if (alertType === 'BOOKED' || alertType === 'NEW_VEHICLE') {
        await rejectAlert(alertId, rejectionReason);
      } else {
        await acknowledgeAlert(alertId);
      }
      Alert.alert('Rejected', 'Request has been rejected.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not reject request.');
    } finally {
      setLoadingAction(null);
      setSelectedAlertId(null);
      setSelectedAlertType(null);
    }
  };

  const handleAcknowledge = (alertId: string) => {
    acknowledgeAlert(alertId);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Admin Notifications</Text>
        <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
          Review self-service requests submitted by customers
        </Text>
      </View>

      <View style={styles.listContainer}>
        {pendingAlerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bell-off-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No pending action alerts.</Text>
          </View>
        ) : (
          pendingAlerts.map((item) => {
            let iconName = 'alert-circle-outline';
            let iconColor = theme.colors.secondary;
            let typeText = 'Alert';

            if (item.type === 'NEW_VEHICLE') {
              iconName = 'car';
              iconColor = '#10B981'; // Green
              typeText = 'New Vehicle Added';
            } else if (item.type === 'SOLD') {
              iconName = 'car-off';
              iconColor = theme.colors.warning; // Orange
              typeText = 'Vehicle Marked Sold';
            } else if (item.type === 'BOOKED') {
              iconName = 'calendar-check';
              iconColor = theme.colors.secondary; // Blue
              typeText = 'MOT Booking Requested';
            }

            return (
              <View
                key={item.id}
                style={[styles.alertCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={iconName} size={22} color={iconColor} style={{ marginRight: 8 }} />
                    <Text style={[styles.typeText, { color: theme.colors.text }]}>{typeText}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>{item.date}</Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={[styles.bodyText, { color: theme.colors.text }]}>
                    Customer <Text style={{ fontWeight: 'bold' }}>{item.customerName}</Text>{' '}
                    {item.type === 'NEW_VEHICLE' && 'wishes to register a new vehicle:'}
                    {item.type === 'SOLD' && 'reported they sold their vehicle:'}
                    {item.type === 'BOOKED' && 'requested MOT booking for:'}
                  </Text>

                  <View style={styles.vehicleRow}>
                    <View style={styles.plate}>
                      <Text style={styles.plateText}>{item.registrationNumber}</Text>
                    </View>
                    <Text style={[styles.makeModelText, { color: theme.colors.text }]}>
                      {item.makeModel}
                    </Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => handleReject(item.id, item.type)}
                    disabled={loadingAction !== null}
                    style={[styles.actionBtn, styles.rejectBtn, { borderColor: theme.colors.error }]}
                  >
                    <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleApprove(item.id, item.type)}
                    disabled={loadingAction !== null}
                    style={[
                      styles.actionBtn, 
                      styles.approveBtn, 
                      { backgroundColor: item.type === 'BOOKED' ? theme.colors.secondary : theme.colors.primary }
                    ]}
                  >
                    {loadingAction === item.id ? (
                      <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
                    ) : (
                      <Text style={[styles.actionBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>
                        {item.type === 'BOOKED' ? 'Confirm Booking' : 'Approve'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Reject Reason Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={rejectModalVisible}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {selectedAlertType === 'NEW_VEHICLE' ? 'Reject Vehicle Registration' : 'Reject Booking Request'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
              Please enter the reason for rejecting this {selectedAlertType === 'NEW_VEHICLE' ? 'registration' : 'booking'} request. This reason will be displayed to the customer.
            </Text>
            
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              placeholder={selectedAlertType === 'NEW_VEHICLE' ? "e.g. Invalid document, vehicle scrapped" : "e.g. No slots available, garage closed"}
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
                <Text style={[styles.modalBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  alertCard: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
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
  typeText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardBody: {
    padding: 12,
    paddingTop: 4,
  },
  bodyText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#00000005',
    padding: 6,
    borderRadius: 6,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
