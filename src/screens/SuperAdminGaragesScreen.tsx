import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, Garage, BASE_URL } from '../context/DataContext';

export default function SuperAdminGaragesScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { garages, refreshData, updateGarageStatus, token } = useAppValues();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'Approved' | 'Pending' | 'Suspended'>('ALL');
  const [selectedGarage, setSelectedGarage] = useState<Garage | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [garageDetails, setGarageDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchFullGarageDetails = async (garageId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`${BASE_URL}/garages/${garageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGarageDetails(data);
      }
    } catch (e) {
      console.error('Error fetching garage details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openGarageModal = (garage: Garage) => {
    setSelectedGarage(garage);
    setGarageDetails(null);
    setModalVisible(true);
    fetchFullGarageDetails(garage.id || garage._id || '');
  };

  const handleStatusChange = async (garageId: string, status: string, verificationStatus?: string) => {
    setLoadingAction(true);
    try {
      await updateGarageStatus(garageId, status, verificationStatus);
      if (selectedGarage) {
        setSelectedGarage({
          ...selectedGarage,
          status: status as any,
          verificationStatus: (verificationStatus || selectedGarage.verificationStatus) as any
        });
      }
      await refreshData();
      Alert.alert('Status Updated', `Garage status successfully changed to "${status}".`);
    } catch (error: any) {
      Alert.alert('Update Failed', error?.message || 'Could not update garage status.');
    } finally {
      setLoadingAction(false);
    }
  };

  const [approvingStationId, setApprovingStationId] = useState<string | null>(null);

  const handleStationStatusChange = async (garageId: string, stationId: string, status: 'Approved' | 'Rejected') => {
    setApprovingStationId(stationId);
    try {
      const res = await fetch(`${BASE_URL}/garages/${garageId}/stations/${stationId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', `Station successfully ${status.toLowerCase()}.`);
        await fetchFullGarageDetails(garageId);
        await refreshData();
      } else {
        Alert.alert('Error', data.error || 'Failed to update station status.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update station status.');
    } finally {
      setApprovingStationId(null);
    }
  };

  // Filter garages
  const filteredGarages = garages.filter((g) => {
    const matchesFilter = selectedFilter === 'ALL' || g.status === selectedFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      g.name.toLowerCase().includes(q) ||
      (g.address && g.address.toLowerCase().includes(q)) ||
      (g.email && g.email.toLowerCase().includes(q)) ||
      (g.phone && g.phone.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return '#10B981';
      case 'Pending':
        return '#F59E0B';
      case 'Suspended':
      case 'Rejected':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Garages Directory</Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            All UK Registered Garages & Locations ({garages.length})
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.placeholder} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search garage name, town, or postcode..."
            placeholderTextColor={theme.colors.placeholder}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.placeholder} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs - Horizontal Scroll */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {(['ALL', 'Approved', 'Pending', 'Suspended'] as const).map((filter) => {
            const isActive = selectedFilter === filter;
            const count = filter === 'ALL' ? garages.length : garages.filter(g => g.status === filter).length;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.colors.secondary : theme.colors.card,
                    borderColor: isActive ? theme.colors.secondary : theme.colors.border,
                  }
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isActive ? '#FFFFFF' : theme.colors.text }
                  ]}
                >
                  {filter === 'ALL' ? 'All Garages' : filter} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Garages List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredGarages.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="garage-alert" size={48} color={theme.colors.placeholder} />
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No Garages Found</Text>
            <Text style={[styles.emptyStateSubtitle, { color: theme.colors.placeholder }]}>
              Try adjusting your search query or filter selection.
            </Text>
          </View>
        ) : (
          filteredGarages.map((garage) => {
            const statusColor = getStatusColor(garage.status);
            const isVerified = garage.verificationStatus === 'Verified';

            return (
              <TouchableOpacity
                key={garage.id || garage._id}
                activeOpacity={0.8}
                onPress={() => openGarageModal(garage)}
                style={[
                  styles.garageCard,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                ]}
              >
                {/* Top Row: Icon, Name, Status & Verification Badge */}
                <View style={styles.cardHeader}>
                  <View style={[styles.garageAvatar, { backgroundColor: statusColor + '15' }]}>
                    <MaterialCommunityIcons name="garage" size={26} color={statusColor} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.garageName, { color: theme.colors.text }]} numberOfLines={1}>
                        {garage.name}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                          {garage.status}
                        </Text>
                      </View>
                    </View>

                    {/* Address / Location */}
                    <View style={styles.locationRow}>
                      <MaterialCommunityIcons name="map-marker-outline" size={14} color="#EF4444" style={{ marginRight: 2 }} />
                      <Text style={[styles.locationText, { color: theme.colors.placeholder }]} numberOfLines={2}>
                        {garage.address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Contact row */}
                <View style={styles.contactRow}>
                  {garage.phone ? (
                    <View style={styles.contactItem}>
                      <MaterialCommunityIcons name="phone-outline" size={13} color={theme.colors.placeholder} />
                      <Text style={[styles.contactText, { color: theme.colors.placeholder }]}>{garage.phone}</Text>
                    </View>
                  ) : null}
                  {garage.email ? (
                    <View style={styles.contactItem}>
                      <MaterialCommunityIcons name="email-outline" size={13} color={theme.colors.placeholder} />
                      <Text style={[styles.contactText, { color: theme.colors.placeholder }]}>{garage.email}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Bottom Stats & Verification Banner */}
                <View style={[styles.cardFooter, { borderTopColor: theme.colors.border + '60' }]}>
                  <View style={styles.metricChip}>
                    <MaterialCommunityIcons name="account-group" size={14} color="#6366F1" />
                    <Text style={[styles.metricChipText, { color: theme.colors.text }]}>
                      {garage.customerCount ?? 0} Customers
                    </Text>
                  </View>
                  <View style={styles.metricChip}>
                    <MaterialCommunityIcons name="account-tie" size={14} color="#8B5CF6" />
                    <Text style={[styles.metricChipText, { color: theme.colors.text }]}>
                      {garage.staffCount ?? 0} Staff
                    </Text>
                  </View>
                  <View style={styles.metricChip}>
                    <MaterialCommunityIcons
                      name={isVerified ? 'check-decagram' : 'alert-circle-outline'}
                      size={14}
                      color={isVerified ? '#10B981' : '#F59E0B'}
                    />
                    <Text style={[styles.metricChipText, { color: isVerified ? '#10B981' : '#F59E0B' }]}>
                      {isVerified ? 'Verified' : 'Unverified'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.placeholder} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Garage Details & Management Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.card }]}>
            {selectedGarage && (
              <>
                {/* Modal Header */}
                <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                      {selectedGarage.name}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                      Garage Profile & Platform Controls
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                    <MaterialCommunityIcons name="close" size={22} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Status Banner */}
                  <View style={[styles.modalStatusBanner, { backgroundColor: getStatusColor(selectedGarage.status) + '15', borderColor: getStatusColor(selectedGarage.status) }]}>
                    <MaterialCommunityIcons name="shield-check" size={20} color={getStatusColor(selectedGarage.status)} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.statusBannerTitle, { color: getStatusColor(selectedGarage.status) }]}>
                        Status: {selectedGarage.status.toUpperCase()}
                      </Text>
                      <Text style={[styles.statusBannerSubtitle, { color: theme.colors.placeholder }]}>
                        Verification: {selectedGarage.verificationStatus || 'Pending'}
                      </Text>
                    </View>
                  </View>

                  {/* Location & Contact Info Card */}
                  <View style={[styles.infoSection, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <Text style={[styles.infoSectionTitle, { color: theme.colors.text }]}>Location & Contact</Text>
                    
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="map-marker" size={16} color="#EF4444" style={styles.infoIcon} />
                      <Text style={[styles.infoText, { color: theme.colors.text }]}>{selectedGarage.address}</Text>
                    </View>

                    {selectedGarage.phone ? (
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="phone" size={16} color="#10B981" style={styles.infoIcon} />
                        <Text style={[styles.infoText, { color: theme.colors.text }]}>{selectedGarage.phone}</Text>
                      </View>
                    ) : null}

                    {selectedGarage.email ? (
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="email" size={16} color="#3B82F6" style={styles.infoIcon} />
                        <Text style={[styles.infoText, { color: theme.colors.text }]}>{selectedGarage.email}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Operational Details */}
                  {selectedGarage.openingTime && (
                    <View style={[styles.infoSection, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                      <Text style={[styles.infoSectionTitle, { color: theme.colors.text }]}>Operating Hours</Text>
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.placeholder} style={styles.infoIcon} />
                        <Text style={[styles.infoText, { color: theme.colors.text }]}>
                          {selectedGarage.openingTime} - {selectedGarage.closingTime || '18:00'}
                        </Text>
                      </View>
                      {selectedGarage.workingDays && selectedGarage.workingDays.length > 0 && (
                        <View style={styles.infoRow}>
                          <MaterialCommunityIcons name="calendar-week" size={16} color={theme.colors.placeholder} style={styles.infoIcon} />
                          <Text style={[styles.infoText, { color: theme.colors.text }]}>
                            {selectedGarage.workingDays.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Staff List */}
                  {garageDetails?.staffList && garageDetails.staffList.length > 0 && (
                    <View style={[styles.infoSection, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                      <Text style={[styles.infoSectionTitle, { color: theme.colors.text }]}>
                        Assigned Staff ({garageDetails.staffList.length})
                      </Text>
                      {garageDetails.staffList.map((st: any) => (
                        <View key={st.id || st._id} style={styles.staffItemRow}>
                          <MaterialCommunityIcons name="account-circle-outline" size={18} color="#6366F1" />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={[styles.staffNameText, { color: theme.colors.text }]}>{st.username || st.email}</Text>
                            <Text style={[styles.staffEmailText, { color: theme.colors.placeholder }]}>{st.email} • {st.role}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Testing Stations & Bays Management */}
                  <View style={[styles.infoSection, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={[styles.infoSectionTitle, { color: theme.colors.text }]}>MOT Testing Stations</Text>
                      <View style={{ backgroundColor: theme.colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>
                          {(garageDetails?.stations || []).filter((s: any) => s.status === 'Approved').length} Approved
                        </Text>
                      </View>
                    </View>

                    {(!garageDetails?.stations || garageDetails.stations.length === 0) ? (
                      <Text style={{ fontSize: 12, color: theme.colors.placeholder }}>No stations configured yet.</Text>
                    ) : (
                      garageDetails.stations.map((st: any) => {
                        const isPending = st.status === 'Pending';
                        const isApproved = st.status === 'Approved';
                        const isProcessing = approvingStationId === (st.id || st._id);

                        return (
                          <View
                            key={st.id || st._id}
                            style={{
                              borderWidth: 1,
                              borderColor: isPending ? '#F59E0B' : theme.colors.border,
                              borderRadius: 8,
                              padding: 10,
                              marginBottom: 8,
                              backgroundColor: theme.colors.card,
                            }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>{st.name}</Text>
                                <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 2 }}>
                                  {st.type || 'Class 4 MOT Bay'} • {st.slotDuration || 40} mins/slot
                                </Text>
                              </View>
                              <View
                                style={{
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                  backgroundColor: isApproved ? '#10B98120' : isPending ? '#F59E0B20' : '#EF444420',
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: '700',
                                    color: isApproved ? '#10B981' : isPending ? '#F59E0B' : '#EF4444',
                                  }}
                                >
                                  {st.status}
                                </Text>
                              </View>
                            </View>

                            {isPending && (
                              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                                <TouchableOpacity
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    backgroundColor: '#EF444415',
                                    borderWidth: 1,
                                    borderColor: '#EF4444',
                                  }}
                                  disabled={isProcessing}
                                  onPress={() =>
                                    handleStationStatusChange(
                                      selectedGarage.id || selectedGarage._id || '',
                                      st.id || st._id,
                                      'Rejected'
                                    )
                                  }
                                >
                                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EF4444' }}>Reject</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    backgroundColor: '#10B981',
                                  }}
                                  disabled={isProcessing}
                                  onPress={() =>
                                    handleStationStatusChange(
                                      selectedGarage.id || selectedGarage._id || '',
                                      st.id || st._id,
                                      'Approved'
                                    )
                                  }
                                >
                                  {isProcessing ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                  ) : (
                                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' }}>
                                      Approve Station
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>

                  {/* Action Buttons */}
                  <Text style={[styles.actionsHeading, { color: theme.colors.text }]}>Platform Governance Actions</Text>

                  <View style={styles.actionButtonContainer}>
                    {selectedGarage.status !== 'Approved' && (
                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: '#10B981' }]}
                        disabled={loadingAction}
                        onPress={() => handleStatusChange(selectedGarage.id || selectedGarage._id || '', 'Approved', 'Verified')}
                      >
                        {loadingAction ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
                            <Text style={styles.modalActionBtnText}>Approve & Verify Garage</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    {selectedGarage.status === 'Approved' && (
                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: '#F59E0B' }]}
                        disabled={loadingAction}
                        onPress={() => handleStatusChange(selectedGarage.id || selectedGarage._id || '', 'Suspended')}
                      >
                        {loadingAction ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="pause-circle" size={18} color="#FFFFFF" />
                            <Text style={styles.modalActionBtnText}>Suspend Garage Operations</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    {selectedGarage.status !== 'Rejected' && (
                      <TouchableOpacity
                        style={[styles.modalActionBtn, { backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF4444' }]}
                        disabled={loadingAction}
                        onPress={() => handleStatusChange(selectedGarage.id || selectedGarage._id || '', 'Rejected', 'Rejected')}
                      >
                        <MaterialCommunityIcons name="close-circle" size={18} color="#EF4444" />
                        <Text style={[styles.modalActionBtnText, { color: '#EF4444' }]}>Reject / Blacklist</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
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
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    padding: 0,
  },
  filterChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyStateSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  garageCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  garageAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garageName: {
    fontSize: 15.5,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 3,
  },
  locationText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactText: {
    fontSize: 11.5,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statusBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusBannerSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  infoSection: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  infoSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
  },
  staffItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  staffNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  staffEmailText: {
    fontSize: 11.5,
  },
  actionsHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  actionButtonContainer: {
    gap: 8,
    marginBottom: 16,
  },
  modalActionBtn: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
