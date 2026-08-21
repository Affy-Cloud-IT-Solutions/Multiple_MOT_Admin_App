import React, { useState, useEffect } from 'react';
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
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { validateMotExpiryDate } from '../utils/validationUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomerDetailScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { customers, vehicles, alerts, audits, rescheduleBooking, refreshData } = useAppValues();

  const { customerId } = route.params;

  const [activeTab, setActiveTab] = useState<'vehicles' | 'bookings' | 'history'>('vehicles');
  const [refreshing, setRefreshing] = useState(false);



  const customer = customers.find((c) => c.id === customerId);

  if (!customer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.colors.text }}>Customer not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
          <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Filter lists
  const customerVehicles = vehicles.filter((v) => 
    v.customerId && String(v.customerId).toLowerCase() === String(customerId || '').toLowerCase()
  );
  const customerBookings = alerts.filter((a) => 
    a.type === 'BOOKED' && a.customerId && String(a.customerId).toLowerCase() === String(customerId || '').toLowerCase()
  );
  
  // Audits filtering
  const customerAudits = audits.filter((a) => {
    const detailsLower = a.details.toLowerCase();
    const nameLower = `${customer.firstName} ${customer.lastName}`.toLowerCase();
    const emailLower = customer.email.toLowerCase();
    const hasVehiclePlate = customerVehicles.some((v) => detailsLower.includes(v.registrationNumber.toLowerCase()));
    return detailsLower.includes(nameLower) || detailsLower.includes(emailLower) || hasVehiclePlate;
  });

  const getBookingSlot = (makeModel: string) => {
    const parts = makeModel.split(' - Slot: ');
    return parts.length > 1 ? parts[1] : 'Morning';
  };

  const getBookingVehicle = (makeModel: string) => {
    return makeModel.split(' - Slot: ')[0];
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Navigation Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]} numberOfLines={1}>
          Customer Full Profile
        </Text>
      </View>

      {/* Profile Header Block */}
      <View style={[styles.profileBlock, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border, paddingBottom: 16 }]}>
        <View style={styles.profileMetaRow}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.secondary }]}>
            <Text style={styles.avatarText}>
              {customer.firstName[0]}{customer.lastName[0]}
            </Text>
          </View>
          <View style={styles.profileMetaInfo}>
            <Text style={[styles.profileName, { color: theme.colors.text }]}>
              {customer.firstName} {customer.lastName}
            </Text>
            <View style={styles.contactCol}>
              <View style={styles.contactItem}>
                <MaterialCommunityIcons name="email" size={13} color={theme.colors.placeholder} />
                <Text style={[styles.contactText, { color: theme.colors.placeholder }]}>{customer.email}</Text>
              </View>
              <View style={styles.contactItem}>
                <MaterialCommunityIcons name="phone" size={13} color={theme.colors.placeholder} />
                <Text style={[styles.contactText, { color: theme.colors.placeholder }]}>{customer.mobile}</Text>
              </View>
              <View style={styles.contactItem}>
                <MaterialCommunityIcons name="calendar-account" size={13} color={theme.colors.placeholder} />
                <Text style={[styles.contactText, { color: theme.colors.placeholder }]}>
                  Since: {customer.createdDate ? new Date(customer.createdDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                </Text>
              </View>
              {customer.address && (
                <View style={styles.contactItem}>
                  <MaterialCommunityIcons name="map-marker" size={13} color={theme.colors.placeholder} />
                  <Text style={[styles.contactText, { color: theme.colors.placeholder }]} numberOfLines={1}>{customer.address}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Tabs Row */}
      <View style={[styles.tabsRow, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        {(['vehicles', 'bookings', 'history'] as const).map((tab) => {
          const isActive = activeTab === tab;
          let label = 'Vehicles';
          let icon = 'car-multiple';
          if (tab === 'bookings') {
            label = "Booked MOT's";
            icon = 'calendar-clock';
          } else if (tab === 'history') {
            label = 'History Log';
            icon = 'history';
          }

          return (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setActiveTab(tab);
              }}
              style={[
                styles.tabItem,
                isActive && { borderBottomColor: theme.colors.secondary, borderBottomWidth: 3 },
              ]}
            >
              <MaterialCommunityIcons
                name={icon}
                size={16}
                color={isActive ? theme.colors.secondary : theme.colors.placeholder}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? theme.colors.secondary : theme.colors.placeholder },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Contents */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.secondary]} />
        }
      >
        {activeTab === 'vehicles' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Registered Vehicles ({customerVehicles.length})</Text>
            {customerVehicles.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="car-off" size={48} color={theme.colors.placeholder} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No vehicles registered.</Text>
              </View>
            ) : (
              customerVehicles.map((v) => {
                const isActive = v.status === 'Active';
                const isPending = v.status === 'Pending';
                const isRejected = v.status === 'Rejected';

                let statusColor = theme.colors.placeholder;
                let statusBg = theme.colors.border + '30';
                if (isActive) {
                  statusColor = theme.colors.success;
                  statusBg = theme.colors.success + '15';
                } else if (isPending) {
                  statusColor = theme.colors.warning;
                  statusBg = theme.colors.warning + '15';
                } else if (isRejected) {
                  statusColor = theme.colors.error;
                  statusBg = theme.colors.error + '15';
                }

                return (
                  <View
                    key={v.id}
                    style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.plate}>
                        <Text style={styles.plateText}>{v.registrationNumber}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{v.status}</Text>
                      </View>
                    </View>

                    <View style={styles.cardBody}>
                      <Text style={[styles.makeModelText, { color: theme.colors.text }]}>
                        {v.year} • {v.make} {v.model}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginTop: 4 }}>
                        MOT Expiry: {new Date(v.motExpiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                      {v.lastServiceDate && (
                        <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginTop: 2 }}>
                          Last Serviced: {new Date(v.lastServiceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      )}
                      
                      {isRejected && v.rejectionReason && (
                        <View style={[styles.rejectionReasonBox, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error }]}>
                          <Text style={{ fontSize: 11, color: theme.colors.error, fontWeight: 'bold' }}>Rejection Reason:</Text>
                          <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2 }}>{v.rejectionReason}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'bookings' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>MOT Booking List ({customerBookings.length})</Text>
            {customerBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="calendar-blank" size={48} color={theme.colors.placeholder} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No bookings found.</Text>
              </View>
            ) : (
              customerBookings.map((b) => {
                const isPending = b.status === 'Pending';
                const isApproved = b.status === 'Approved';
                const isRejected = b.status === 'Rejected';

                let statusText = 'Acknowledged';
                let statusColor = theme.colors.placeholder;
                let statusBg = theme.colors.border + '30';

                if (isPending) {
                  statusText = 'Pending';
                  statusColor = theme.colors.warning;
                  statusBg = theme.colors.warning + '15';
                } else if (isApproved) {
                  statusText = 'Confirmed';
                  statusColor = theme.colors.success;
                  statusBg = theme.colors.success + '15';
                } else if (isRejected) {
                  statusText = 'Rejected';
                  statusColor = theme.colors.error;
                  statusBg = theme.colors.error + '15';
                }

                return (
                  <View
                    key={b.id}
                    style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.smallPlate}>
                        <Text style={styles.smallPlateText}>{b.registrationNumber}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                      </View>
                    </View>

                    <View style={styles.cardBody}>
                      <Text style={[styles.bookingVehicleTitle, { color: theme.colors.text }]}>
                        {getBookingVehicle(b.makeModel)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <MaterialCommunityIcons name="calendar-clock" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 13, color: theme.colors.text }}>
                          {new Date(b.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • Slot: {getBookingSlot(b.makeModel)}
                        </Text>
                      </View>

                      {isRejected && b.rejectionReason && (
                        <View style={[styles.rejectionReasonBox, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error }]}>
                          <Text style={{ fontSize: 11, color: theme.colors.error, fontWeight: 'bold' }}>Rejection Reason:</Text>
                          <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2 }}>{b.rejectionReason}</Text>
                        </View>
                      )}

                      {b.rescheduled && (
                        <View style={[styles.rescheduledBadge, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }]}>
                          <MaterialCommunityIcons name="clock-alert-outline" size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.colors.primary }}>Rescheduled</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'history' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Activity Logs ({customerAudits.length})</Text>
            {customerAudits.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color={theme.colors.placeholder} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No activity logged.</Text>
              </View>
            ) : (
              customerAudits.map((a) => (
                <View
                  key={a.id}
                  style={[styles.auditCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                >
                  <View style={styles.auditHeader}>
                    <Text style={[styles.auditActivity, { color: theme.colors.text }]}>{a.activity}</Text>
                    <Text style={{ fontSize: 10, color: theme.colors.placeholder }}>
                      {new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginTop: 4 }}>
                    {a.details}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>


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
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  profileBlock: {
    padding: 16,
    borderBottomWidth: 1,
  },
  profileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 2,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileMetaInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  contactCol: {
    gap: 3,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 12.5,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    height: 44,
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 13.5,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  plateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  smallPlate: {
    backgroundColor: '#FFD300',
    borderWidth: 0.7,
    borderColor: '#000',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  smallPlateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 9.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  cardBody: {
    gap: 2,
  },
  makeModelText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rejectionReasonBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  bookingVehicleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rescheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    marginTop: 12,
  },
  auditCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auditActivity: {
    fontSize: 13.5,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    height: 40,
    marginBottom: 14,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  slotOptionBtn: {
    width: '47%',
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  rescheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    marginTop: 10,
  },
});
