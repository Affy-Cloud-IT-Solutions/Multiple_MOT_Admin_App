import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Linking } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme/theme';
import { useAppValues } from '../context/DataContext';
import { formatBookingDate, formatDateTime } from '../utils/dateUtils';

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
  if (item?.isDateOnly || item?.hasMot === false || item?.slotTime === 'Full Day Drop-off' || item?.slotTime === 'Drop-off (Full Day)') {
    return 'Workshop Drop-off';
  }
  const num = getSlotNumber(item);
  return num ? `Slot #${num}` : 'MOT Slot';
};

const getSlotTimeDisplay = (item: any) => {
  if (item?.isDateOnly || item?.hasMot === false || item?.slotTime === 'Full Day Drop-off' || item?.slotTime === 'Drop-off (Full Day)') {
    return 'Full-Day Workshop Drop-off (08:00 – 18:00)';
  }
  let slotTime = item.slotTime || '';
  if (!slotTime && item.makeModel) {
    const match = item.makeModel.match(/(?:MOT\s+)?Slot:\s*([^\n\r&]+)/i);
    if (match) slotTime = match[1].trim();
  } else if (slotTime && slotTime.includes(' & Service:')) {
    slotTime = slotTime.split(' & Service:')[0].replace(/^(?:MOT\s+)?Slot:\s*/i, '').trim();
  }
  return slotTime || '45-Min MOT Slot';
};



export default function AdminAlertsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { alerts, customers = [], approveAlert, acknowledgeAlert, rejectAlert, user, updateGarageStationStatus, updateGarageStatus, approveCustomService, rejectCustomService } = useAppValues();

  // Show only pending actionable alerts:
  // - On a multi-garage platform, vehicles belong to customer accounts (no approval needed for NEW_VEHICLE / SOLD)
  // - Garage Admin only acts on bookings for their garage (BOOKED)
  // - Super Admin acts on platform requests (GARAGE_REGISTRATION, GARAGE_DOCUMENT, NEW_STATION, CUSTOM_SERVICE)
  const pendingAlerts = alerts.filter((a) => {
    if (a.status !== 'Pending') return false;
    if (a.type === 'NEW_VEHICLE' || a.type === 'SOLD') return false;
    if (user?.role === 'admin') {
      return true; // Super admin sees platform requests
    }
    return a.type === 'BOOKED';
  });

  const handleApprove = async (alertId: string, alertType: string) => {
    setLoadingAction(alertId);
    try {
      let message = 'Action approved successfully!';
      if (alertType === 'NEW_STATION') {
        const item = pendingAlerts.find(a => a.id === alertId);
        if (item?.garageId && item?.stationId) {
          await updateGarageStationStatus(item.garageId, item.stationId, 'Approved');
          message = 'MOT Testing Station approved successfully! Daily booking slots are now active.';
        } else {
          await approveAlert(alertId);
          message = 'Station request approved!';
        }
      } else if (alertType === 'CUSTOM_SERVICE') {
        const item = pendingAlerts.find(a => a.id === alertId);
        if (item?.serviceId) {
          await approveCustomService(item.serviceId);
          message = `Custom service "${item.serviceName || 'Service'}" approved and live platform-wide!`;
        } else {
          await approveAlert(alertId);
          message = 'Custom service approved!';
        }
      } else if (alertType === 'GARAGE_REGISTRATION') {
        const item = pendingAlerts.find(a => a.id === alertId);
        const gId = item?.garageId || (item as any)?.garage?.id || (item as any)?.garage?._id;
        if (gId && navigation?.navigate) {
          navigation.navigate('GarageVerificationReview', { garageId: gId });
          setLoadingAction(null);
          return;
        } else if (gId) {
          await updateGarageStatus(gId, 'Approved', 'Verified');
          await approveAlert(alertId);
          message = 'Garage approved successfully!';
        } else {
          await approveAlert(alertId);
          message = 'Garage registration approved!';
        }
      } else if (alertType === 'GARAGE_DOCUMENT') {
        const item = pendingAlerts.find(a => a.id === alertId);
        const gId = item?.garageId || (item as any)?.garage?.id || (item as any)?.garage?._id;
        if (gId && navigation?.navigate) {
          navigation.navigate('GarageVerificationReview', { garageId: gId });
          setLoadingAction(null);
          return;
        } else {
          await approveAlert(alertId);
          message = 'Document reviewed and acknowledged.';
        }
      } else {
        await approveAlert(alertId);
        message = alertType === 'BOOKED' ? 'Booking confirmed successfully!' : 'Request approved!';
      }
      Alert.alert('Approved', message);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not approve request.');
    } finally {
      setLoadingAction(null);
    }
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
      if (alertType === 'NEW_STATION') {
        const item = pendingAlerts.find(a => a.id === alertId);
        if (item?.garageId && item?.stationId) {
          await updateGarageStationStatus(item.garageId, item.stationId, 'Rejected', rejectionReason || 'Station request rejected by platform admin');
        } else {
          await acknowledgeAlert(alertId);
        }
        Alert.alert('Rejected', 'Station request has been rejected.');
      } else if (alertType === 'CUSTOM_SERVICE') {
        const item = pendingAlerts.find(a => a.id === alertId);
        if (item?.serviceId) {
          await rejectCustomService(item.serviceId, rejectionReason || 'Does not meet platform service criteria');
        } else {
          await acknowledgeAlert(alertId);
        }
        Alert.alert('Rejected', 'Custom service has been rejected.');
      } else if (alertType === 'GARAGE_REGISTRATION') {
        const item = pendingAlerts.find(a => a.id === alertId);
        const gId = item?.garageId || (item as any)?.garage?.id || (item as any)?.garage?._id;
        if (gId) {
          await updateGarageStatus(gId, 'Rejected', 'Rejected', rejectionReason || 'Registration criteria not met.');
        }
        await acknowledgeAlert(alertId);
        Alert.alert('Rejected', 'Garage registration has been rejected.');
      } else if (alertType === 'GARAGE_DOCUMENT') {
        await acknowledgeAlert(alertId);
        Alert.alert('Rejected', 'Garage document has been rejected.');
      } else if (alertType === 'BOOKED') {
        await rejectAlert(alertId, rejectionReason);
        Alert.alert('Rejected', 'Booking request has been rejected.');
      } else {
        await acknowledgeAlert(alertId);
        Alert.alert('Rejected', 'Request has been rejected.');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not reject request.');
    } finally {
      setLoadingAction(null);
      setSelectedAlertId(null);
      setSelectedAlertType(null);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not acknowledge this notification.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
              iconName = (item.isDateOnly || item.hasMot === false) ? 'car-clock' : 'calendar-check';
              iconColor = theme.colors.secondary; // Blue
              typeText = (item.isDateOnly || item.hasMot === false) ? 'Service Drop-off Requested' : 'MOT Booking Requested';
            } else if (item.type === 'NEW_STATION') {
              iconName = 'garage-alert';
              iconColor = '#F59E0B'; // Amber
              typeText = 'MOT Testing Station Request';
            } else if (item.type === 'CUSTOM_SERVICE') {
              iconName = 'shape-plus';
              iconColor = '#8B5CF6'; // Purple
              typeText = 'Custom Service Approval Request';
            } else if (item.type === 'GARAGE_REGISTRATION') {
              iconName = 'storefront-outline';
              iconColor = '#3B82F6'; // Blue
              typeText = 'Garage Registration Request';
            } else if (item.type === 'GARAGE_DOCUMENT') {
              iconName = 'file-document-check-outline';
              iconColor = '#10B981'; // Green
              typeText = 'Garage Document Upload';
            }

            const customer = customers.find(c => 
              (c.id && item.customerId && String(c.id).toLowerCase() === String(item.customerId).toLowerCase()) ||
              (c._id && item.customerId && String(c._id).toLowerCase() === String(item.customerId).toLowerCase())
            );
            const custPhone = item.customerMobile || customer?.mobile || '';
            const custEmail = item.customerEmail || customer?.email || '';

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
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>
                    {formatDateTime(item.createdAt || item.date)}
                  </Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={[styles.bodyText, { color: theme.colors.text }]}>
                    {item.type === 'NEW_STATION' ? (
                      <>Garage <Text style={{ fontFamily: fonts.bold }}>{(item as any).garage?.name || item.customerName}</Text> requested approval to add a new MOT station:</>
                    ) : item.type === 'CUSTOM_SERVICE' ? (
                      <>Garage <Text style={{ fontFamily: fonts.bold }}>{(item as any).garage?.name || item.customerName}</Text> submitted a new custom service for platform approval:</>
                    ) : item.type === 'GARAGE_REGISTRATION' ? (
                      <>New garage registration from owner <Text style={{ fontFamily: fonts.bold }}>{item.customerName}</Text>:</>
                    ) : item.type === 'GARAGE_DOCUMENT' ? (
                      <>Garage <Text style={{ fontFamily: fonts.bold }}>{(item as any).garage?.name || item.customerName}</Text> uploaded a verification document for review:</>
                    ) : (
                      <>Customer <Text style={{ fontFamily: fonts.bold }}>{item.customerName}</Text>{' '}
                      {(item.isDateOnly || item.hasMot === false) ? 'requested service workshop booking for:' : 'requested MOT booking for:'}</>
                    )}
                  </Text>

                  {(custPhone || custEmail) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 6 }}>
                      {custPhone ? (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${custPhone}`)}
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.secondary + '15', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.secondary + '30' }}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="phone" size={11} color={theme.colors.secondary} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: theme.colors.secondary }}>{custPhone}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {custEmail ? (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`mailto:${custEmail}`)}
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98115', paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 6, borderWidth: 1, borderColor: '#10B98130' }}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="email-outline" size={11} color="#059669" style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 11, fontFamily: fonts.semiBold, color: '#059669' }}>{custEmail}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  {item.type === 'NEW_STATION' ? (
                    <View style={{ backgroundColor: '#F59E0B15', borderWidth: 1, borderColor: '#F59E0B40', padding: 12, borderRadius: 8, marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="garage" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: theme.colors.text }}>
                            {item.stationName || item.makeModel?.split(' - ')[1]?.split(' (')[0] || 'Testing Station'}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#F59E0B25', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#F59E0B' }}>Pending Approval</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: theme.colors.placeholder, marginTop: 4 }}>
                        {item.makeModel || `${item.customerName} - Station Request`}
                      </Text>
                    </View>
                  ) : item.type === 'CUSTOM_SERVICE' ? (
                    <View style={{ backgroundColor: '#8B5CF615', borderWidth: 1, borderColor: '#8B5CF640', padding: 12, borderRadius: 8, marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="shape-plus" size={18} color="#8B5CF6" style={{ marginRight: 6 }} />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: theme.colors.text }}>
                            {item.serviceName || item.makeModel?.split(' - ')[1] || 'Custom Service'}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#8B5CF625', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#8B5CF6' }}>Pending Approval</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: theme.colors.placeholder, marginTop: 4 }}>
                        {item.makeModel || `${item.customerName} - Custom Service Request`}
                      </Text>
                    </View>
                  ) : item.type === 'GARAGE_REGISTRATION' ? (
                    <View style={{ backgroundColor: '#3B82F615', borderWidth: 1, borderColor: '#3B82F640', padding: 12, borderRadius: 8, marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                          <MaterialCommunityIcons name="storefront" size={18} color="#3B82F6" style={{ marginRight: 6 }} />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: theme.colors.text }} numberOfLines={1}>
                            {(item as any).garage?.name || item.makeModel?.split(' - ')[0] || item.makeModel}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#3B82F625', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#3B82F6' }}>New Garage</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: theme.colors.placeholder, marginTop: 4 }}>
                        {item.makeModel}
                      </Text>
                    </View>
                  ) : item.type === 'GARAGE_DOCUMENT' ? (
                    <View style={{ backgroundColor: '#10B98115', borderWidth: 1, borderColor: '#10B98140', padding: 12, borderRadius: 8, marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                          <MaterialCommunityIcons name="file-document-check" size={18} color="#10B981" style={{ marginRight: 6 }} />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: theme.colors.text }} numberOfLines={1}>
                            {(item as any).garage?.name || item.makeModel?.split(' - ')[0] || 'Garage Document'}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#10B98125', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#10B981' }}>New Document</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: theme.colors.placeholder, marginTop: 4 }}>
                        {item.makeModel}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.vehicleRow}>
                      <View style={styles.plate}>
                        <Text style={styles.plateText}>{item.registrationNumber}</Text>
                      </View>
                      <Text style={[styles.makeModelText, { color: theme.colors.text }]}>
                        {item.makeModel}
                      </Text>
                    </View>
                  )}

                  {/* Multi-service chips if multiple services booked */}
                  {Array.isArray(item.services) && item.services.length > 1 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, marginBottom: 2 }}>
                      {item.services.map((s: any, sIdx: number) => {
                        const sName = typeof s === 'string' ? s : s?.name || '';
                        return (
                          <View key={sIdx} style={{ backgroundColor: theme.colors.secondary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10.5, color: theme.colors.secondary, fontFamily: fonts.semiBold }}>{sName}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {item.type === 'BOOKED' && (
                    <View style={[styles.slotDetailsCard, { backgroundColor: theme.colors.secondary + '12', borderColor: theme.colors.secondary + '30' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons
                            name={(item.isDateOnly || item.hasMot === false) ? "car-clock" : "calendar-clock"}
                            size={16}
                            color={theme.colors.secondary}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={{ fontSize: 13, fontFamily: fonts.bold, color: theme.colors.text }}>
                            {(item.isDateOnly || item.hasMot === false) ? 'Drop-off Date: ' : 'Appointment Date: '}
                            {formatBookingDate(item.date)}
                          </Text>
                        </View>
                        <View style={[styles.slotNumberBadge, { backgroundColor: theme.colors.secondary }]}>
                          <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: '#FFFFFF' }}>
                            {getSlotDisplay(item)}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: theme.colors.placeholder }}>
                          {(item.isDateOnly || item.hasMot === false) ? 'Intake: ' : 'Requested Slot: '}
                          <Text style={{ color: theme.colors.text, fontFamily: fonts.bold }}>{getSlotTimeDisplay(item)}</Text>
                          {item.stationName ? ` • Bay: ${item.stationName}` : ''}
                        </Text>
                      </View>
                      {item.serviceName && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <MaterialCommunityIcons name="wrench-outline" size={14} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 12, fontFamily: fonts.regular, color: theme.colors.placeholder }}>
                            Service: <Text style={{ color: theme.colors.text, fontFamily: fonts.bold }}>{item.serviceName}</Text>
                            {item.price ? ` • £${Number(item.price).toFixed(2)}` : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
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
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>
                        {item.type === 'BOOKED' 
                          ? 'Confirm Booking' 
                          : item.type === 'NEW_STATION' 
                          ? 'Approve Station' 
                          : item.type === 'GARAGE_REGISTRATION'
                          ? 'Review & Approve'
                          : item.type === 'GARAGE_DOCUMENT'
                          ? 'Review Document'
                          : 'Approve'}
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
              {selectedAlertType === 'NEW_STATION' 
                ? 'Reject Station Request' 
                : selectedAlertType === 'CUSTOM_SERVICE'
                ? 'Reject Custom Service'
                : selectedAlertType === 'GARAGE_REGISTRATION'
                ? 'Reject Garage Registration'
                : selectedAlertType === 'GARAGE_DOCUMENT'
                ? 'Reject Garage Document'
                : 'Reject Booking Request'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
              Please enter the reason for rejecting this request.
            </Text>
            
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              placeholder="e.g. No slots available, garage closed, or criteria not met"
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
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Reject</Text>
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
    fontFamily: fonts.extraBold,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
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
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  cardBody: {
    padding: 12,
    paddingTop: 4,
  },
  bodyText: {
    fontSize: 13.5,
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  makeModelText: {
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 16,
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
  },
  slotDetailsCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  slotNumberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});
