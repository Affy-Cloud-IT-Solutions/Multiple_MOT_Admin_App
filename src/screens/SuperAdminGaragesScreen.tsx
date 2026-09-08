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
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, Garage, BASE_URL } from '../context/DataContext';

export default function SuperAdminGaragesScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { garages, refreshData, updateGarageStatus, updateGarageDocumentStatus, updateGarageProfile, token } = useAppValues();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'Approved' | 'Pending' | 'Suspended'>('ALL');
  const [selectedGarage, setSelectedGarage] = useState<Garage | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [garageDetails, setGarageDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Dynamic Garage Images Management States
  const [garageImages, setGarageImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [savingImages, setSavingImages] = useState(false);

  // Document Review & Verification Modal State
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [docActionLoading, setDocActionLoading] = useState(false);

  // Garage Application Rejection Modal State
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('');

  const REJECTION_PRESETS = [
    'DVLA VTS Site Number could not be verified in the DVSA register.',
    'MOT Authorised Examiner (AE) certificate is invalid or unverified.',
    'Facility photos do not meet minimum MOT testing bay requirements.',
    'Public Liability Insurance certificate is missing or expired.',
    'Companies House / Trade registration credentials do not match.',
    'Station equipment calibration certificates are incomplete.'
  ];

  const fetchFullGarageDetails = async (garageId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`${BASE_URL}/garages/${garageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGarageDetails(data);
        if (data.images && data.images.length > 0) {
          setGarageImages(data.images);
        }
      }
    } catch (e) {
      console.error('Error fetching garage details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openGarageModal = (garage: Garage) => {
    setSelectedGarage(garage);
    setGarageImages(garage.images || []);
    setNewImageUrl('');
    setGarageDetails(null);
    setModalVisible(true);
    fetchFullGarageDetails(garage.id || garage._id || '');
  };

  const handleOpenDocModal = (doc: any) => {
    setSelectedDoc(doc);
    setDocModalVisible(true);
  };

  const handleSetDocStatus = async (newDocStatus: 'Verified' | 'Rejected') => {
    if (!selectedGarage || !selectedDoc) return;
    const garageId = selectedGarage.id || selectedGarage._id || '';
    const docId = selectedDoc.id || selectedDoc._id;
    if (!docId) {
      Alert.alert('Notice', 'Document ID not available for individual tracking.');
      return;
    }
    setDocActionLoading(true);
    try {
      await updateGarageDocumentStatus(garageId, docId, newDocStatus);
      setSelectedDoc({ ...selectedDoc, status: newDocStatus });
      await fetchFullGarageDetails(garageId);
      Alert.alert('Document Updated', `Certificate marked as "${newDocStatus}".`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update certificate status.');
    } finally {
      setDocActionLoading(false);
    }
  };

  const handleOpenRejectModal = () => {
    setRejectionReasonInput(selectedGarage?.rejectionReason || '');
    setSelectedPresetReason('');
    setRejectModalVisible(true);
  };

  const handleConfirmRejection = async () => {
    if (!selectedGarage) return;
    const finalReason = rejectionReasonInput.trim() || selectedPresetReason.trim() || 'Documentation or regulatory criteria not verified.';
    const garageId = selectedGarage.id || selectedGarage._id || '';
    setLoadingAction(true);
    try {
      await updateGarageStatus(garageId, 'Rejected', 'Rejected', finalReason);
      setSelectedGarage({
        ...selectedGarage,
        status: 'Rejected',
        verificationStatus: 'Rejected',
        rejectionReason: finalReason
      });
      setRejectModalVisible(false);
      await refreshData();
      Alert.alert('Application Rejected', `Garage status updated to Rejected.\n\nReason: "${finalReason}"`);
    } catch (err: any) {
      Alert.alert('Rejection Failed', err.message || 'Could not reject garage application.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updated = garageImages.filter((_, idx) => idx !== indexToRemove);
    setGarageImages(updated);
  };

  const handleAddImage = (urlToAdd?: string) => {
    const targetUrl = (urlToAdd || newImageUrl).trim();
    if (!targetUrl) {
      Alert.alert('Error', 'Please enter a valid image URL');
      return;
    }
    if (garageImages.includes(targetUrl)) {
      Alert.alert('Notice', 'This image is already in the gallery.');
      return;
    }
    setGarageImages([...garageImages, targetUrl]);
    setNewImageUrl('');
  };

  const handleSaveImages = async () => {
    if (!selectedGarage) return;
    const garageId = selectedGarage.id || selectedGarage._id || '';
    setSavingImages(true);
    try {
      await updateGarageProfile(garageId, { 
        images: garageImages,
        logoUrl: garageImages[0] || selectedGarage.logoUrl 
      });
      setSelectedGarage({
        ...selectedGarage,
        images: garageImages,
        logoUrl: garageImages[0] || selectedGarage.logoUrl
      });
      Alert.alert('Success', 'Garage images updated successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save garage images.');
    } finally {
      setSavingImages(false);
    }
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
                onPress={() => navigation.navigate('GarageVerificationReview', { garageId: garage.id || garage._id, garage })}
                style={[
                  styles.garageCard,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                ]}
              >
                {/* Top Row: Icon/Thumbnail, Name, Status & Verification Badge */}
                <View style={styles.cardHeader}>
                  <View style={[styles.garageAvatar, { backgroundColor: statusColor + '15' }]}>
                    {(garage.images && garage.images.length > 0) ? (
                      <Image source={{ uri: garage.images[0] }} style={styles.garageAvatarImg} />
                    ) : garage.logoUrl ? (
                      <Image source={{ uri: garage.logoUrl }} style={styles.garageAvatarImg} />
                    ) : (
                      <MaterialCommunityIcons name="garage" size={26} color={statusColor} />
                    )}
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
                      {garage.verificationStatus || 'Pending'}
                    </Text>
                  </View>

                  {garage.images && garage.images.length > 0 && (
                    <View style={styles.metricChip}>
                      <MaterialCommunityIcons name="camera-outline" size={13} color="#0284C7" />
                      <Text style={[styles.metricChipText, { color: theme.colors.text }]}>
                        {garage.images.length} Photos
                      </Text>
                    </View>
                  )}
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
                  {/* Garage Photos Carousel */}
                  {garageImages.length > 0 && (
                    <View style={styles.modalCarouselContainer}>
                      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.modalCarousel}>
                        {garageImages.map((imgUri, idx) => (
                          <View key={`modal-img-${idx}`} style={styles.modalCarouselSlide}>
                            <Image source={{ uri: imgUri }} style={styles.modalCarouselImage} />
                            <View style={styles.modalCarouselTag}>
                              <MaterialCommunityIcons name="camera" size={11} color="#FFF" style={{ marginRight: 4 }} />
                              <Text style={styles.modalCarouselTagText}>{idx + 1} / {garageImages.length}</Text>
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

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
                    <Text style={[styles.infoSectionTitle, { color: theme.colors.text }]}>Location & Coordinates</Text>
                    
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="map-marker" size={16} color="#EF4444" style={styles.infoIcon} />
                      <Text style={[styles.infoText, { color: theme.colors.text }]}>
                        {selectedGarage.address}{selectedGarage.city ? `, ${selectedGarage.city}` : ''} {selectedGarage.postcode || ''}
                      </Text>
                    </View>

                    {(selectedGarage.latitude !== undefined || selectedGarage.longitude !== undefined) && (
                      <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#0284C7" style={styles.infoIcon} />
                        <Text style={[styles.infoText, { color: theme.colors.placeholder }]}>
                          GPS: {selectedGarage.latitude || 51.5074}, {selectedGarage.longitude || -0.1278}
                        </Text>
                      </View>
                    )}

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

                  {/* MOT Legal Authorization & Verification Credentials */}
                  <View style={[styles.infoSection, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="shield-check" size={18} color="#10B981" style={{ marginRight: 6 }} />
                        <Text style={[styles.infoSectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                          MOT Legal Authorization
                        </Text>
                      </View>
                      <View style={{ backgroundColor: selectedGarage.verificationStatus === 'Verified' ? '#10B98120' : '#F59E0B20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: selectedGarage.verificationStatus === 'Verified' ? '#10B981' : '#F59E0B' }}>
                          {selectedGarage.verificationStatus || 'Pending Review'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      <View style={{ flex: 1, minWidth: 120, backgroundColor: theme.colors.card, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border }}>
                        <Text style={{ fontSize: 10, color: theme.colors.placeholder }}>DVLA VTS Site #</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>{selectedGarage.vtsNumber || 'VTS-Pending'}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 120, backgroundColor: theme.colors.card, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border }}>
                        <Text style={{ fontSize: 10, color: theme.colors.placeholder }}>MOT AE #</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>{selectedGarage.motAuthorisedExaminerNumber || 'AE-Pending'}</Text>
                      </View>
                    </View>

                    {selectedGarage.businessRegistrationNumber ? (
                      <View style={{ backgroundColor: theme.colors.card, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 }}>
                        <Text style={{ fontSize: 10, color: theme.colors.placeholder }}>Companies House / Business Reg #</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>{selectedGarage.businessRegistrationNumber}</Text>
                      </View>
                    ) : null}

                    {/* Rejection Alert if Rejected */}
                    {selectedGarage.status === 'Rejected' && (
                      <View style={{ backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444440', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>Application Rejected</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: theme.colors.text }}>
                          Reason: {selectedGarage.rejectionReason || 'Documentation or verification criteria not verified.'}
                        </Text>
                      </View>
                    )}

                    {/* Verification Documents List */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>
                        Submitted Certificates ({selectedGarage.verificationDocuments?.length || 0})
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.colors.placeholder }}>Tap to inspect & verify</Text>
                    </View>

                    {(!selectedGarage.verificationDocuments || selectedGarage.verificationDocuments.length === 0) ? (
                      <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginVertical: 4 }}>No legal certificates attached.</Text>
                    ) : (
                      selectedGarage.verificationDocuments.map((doc: any, dIdx: number) => {
                        const docStatus = doc.status || 'Pending';
                        const isDocVerified = docStatus === 'Verified';
                        const isDocRejected = docStatus === 'Rejected';

                        return (
                          <TouchableOpacity 
                            key={dIdx} 
                            onPress={() => handleOpenDocModal(doc)}
                            style={{ 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              backgroundColor: theme.colors.card, 
                              padding: 10, 
                              borderRadius: 8, 
                              borderWidth: 1, 
                              borderColor: isDocVerified ? '#10B98160' : isDocRejected ? '#EF444460' : theme.colors.border, 
                              marginBottom: 8 
                            }}
                          >
                            <MaterialCommunityIcons 
                              name="file-certificate" 
                              size={24} 
                              color={isDocVerified ? '#10B981' : isDocRejected ? '#EF4444' : '#6366F1'} 
                              style={{ marginRight: 10 }} 
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>{doc.name}</Text>
                              <Text style={{ fontSize: 10.5, color: theme.colors.placeholder, marginTop: 2 }}>
                                Uploaded: {doc.uploadDate ? new Date(doc.uploadDate).toLocaleDateString() : 'Recent'}
                              </Text>
                            </View>

                            <View style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                              backgroundColor: isDocVerified ? '#10B98120' : isDocRejected ? '#EF444420' : '#F59E0B20',
                              marginRight: 6
                            }}>
                              <Text style={{
                                fontSize: 10.5,
                                fontWeight: '700',
                                color: isDocVerified ? '#10B981' : isDocRejected ? '#EF4444' : '#F59E0B'
                              }}>
                                {docStatus}
                              </Text>
                            </View>

                            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.placeholder} />
                          </TouchableOpacity>
                        );
                      })
                    )}
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

                  {/* Dynamic Garage Images & Gallery Management */}
                  <View style={[styles.infoSection, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="image-multiple-outline" size={18} color="#0284C7" style={{ marginRight: 6 }} />
                        <Text style={[styles.infoSectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                          Garage Photos ({garageImages.length})
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.saveGalleryBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={handleSaveImages}
                        disabled={savingImages}
                      >
                        {savingImages ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.saveGalleryBtnText}>Save Photos</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Image Thumbnails Strip with Delete Button */}
                    {garageImages.length === 0 ? (
                      <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginVertical: 8 }}>
                        No gallery photos added yet. Add one below.
                      </Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                        {garageImages.map((imgUri, idx) => (
                          <View key={`gallery-${idx}`} style={styles.adminGalleryThumbBox}>
                            <Image source={{ uri: imgUri }} style={styles.adminGalleryThumb} />
                            <TouchableOpacity
                              style={styles.adminGalleryDeleteBtn}
                              onPress={() => handleRemoveImage(idx)}
                            >
                              <MaterialCommunityIcons name="close" size={12} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    )}

                    {/* Quick Preset Badges */}
                    <Text style={[styles.presetSectionLabel, { color: theme.colors.placeholder }]}>
                      Quick Add Sample Photos:
                    </Text>
                    <View style={styles.presetRow}>
                      {[
                        { label: '+ Sample 1', url: 'https://images.unsplash.com/photo-1617886322168-72b886573c3c?w=800&h=500&fit=crop' },
                        { label: '+ Sample 2', url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=500&fit=crop' },
                        { label: '+ Sample 3', url: 'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=800&h=500&fit=crop' },
                        { label: '+ Sample 4', url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&h=500&fit=crop' },
                      ].map((preset) => (
                        <TouchableOpacity
                          key={preset.label}
                          style={[styles.presetChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                          onPress={() => handleAddImage(preset.url)}
                        >
                          <Text style={[styles.presetChipText, { color: theme.colors.text }]}>{preset.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Add Custom Image URL Input */}
                    <View style={styles.addImageInputRow}>
                      <TextInput
                        value={newImageUrl}
                        onChangeText={setNewImageUrl}
                        placeholder="Paste image URL (https://...)..."
                        placeholderTextColor={theme.colors.placeholder}
                        style={[styles.imageUrlInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                      />
                      <TouchableOpacity
                        style={[styles.addImageBtn, { backgroundColor: theme.colors.secondary }]}
                        onPress={() => handleAddImage()}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                        <Text style={styles.addImageBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

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
                        onPress={handleOpenRejectModal}
                      >
                        <MaterialCommunityIcons name="close-circle" size={18} color="#EF4444" />
                        <Text style={[styles.modalActionBtnText, { color: '#EF4444' }]}>Reject Application</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: DOCUMENT INSPECTOR & VERIFIER ================= */}
      <Modal
        visible={docModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDocModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.docModalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="file-certificate-outline" size={24} color="#6366F1" style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Certificate Inspector</Text>
              </View>
              <TouchableOpacity onPress={() => setDocModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            {selectedDoc && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text }}>{selectedDoc.name}</Text>
                
                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
                  <View style={{ 
                    backgroundColor: selectedDoc.status === 'Verified' ? '#10B98120' : selectedDoc.status === 'Rejected' ? '#EF444420' : '#F59E0B20', 
                    paddingHorizontal: 10, 
                    paddingVertical: 4, 
                    borderRadius: 6 
                  }}>
                    <Text style={{ 
                      fontSize: 11, 
                      fontWeight: '700', 
                      color: selectedDoc.status === 'Verified' ? '#10B981' : selectedDoc.status === 'Rejected' ? '#EF4444' : '#F59E0B' 
                    }}>
                      Status: {selectedDoc.status || 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={{ backgroundColor: theme.colors.background, padding: 10, borderRadius: 8, marginVertical: 8 }}>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>Certificate File Link / URL:</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2 }} numberOfLines={2}>
                    {selectedDoc.fileUrl}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => Linking.openURL(selectedDoc.fileUrl).catch(() => Alert.alert('Certificate Preview', `Viewing: ${selectedDoc.name}\nURL: ${selectedDoc.fileUrl}`))}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    backgroundColor: theme.colors.primary, 
                    paddingVertical: 10, 
                    borderRadius: 8, 
                    marginVertical: 8 
                  }}
                >
                  <MaterialCommunityIcons name="open-in-new" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Open & View Document File</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    disabled={docActionLoading}
                    onPress={() => handleSetDocStatus('Rejected')}
                    style={{ 
                      flex: 1, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      backgroundColor: '#EF444415', 
                      borderWidth: 1, 
                      borderColor: '#EF4444', 
                      paddingVertical: 10, 
                      borderRadius: 8 
                    }}
                  >
                    {docActionLoading ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="close-circle-outline" size={18} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12.5 }}>Reject Doc</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={docActionLoading}
                    onPress={() => handleSetDocStatus('Verified')}
                    style={{ 
                      flex: 1, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      backgroundColor: '#10B981', 
                      paddingVertical: 10, 
                      borderRadius: 8 
                    }}
                  >
                    {docActionLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 }}>Verify Doc</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: GARAGE APPLICATION REJECTION ================= */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.rejectModalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="alert-octagon" size={24} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Reject Application</Text>
              </View>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginVertical: 8 }}>
              Select or specify the regulatory reason for rejection. This reason will be shown to the garage admin upon login.
            </Text>

            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text, marginBottom: 6 }}>
              Quick Common Reasons:
            </Text>

            <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
              {REJECTION_PRESETS.map((preset, pIdx) => {
                const isSelected = selectedPresetReason === preset;
                return (
                  <TouchableOpacity
                    key={pIdx}
                    onPress={() => {
                      setSelectedPresetReason(preset);
                      setRejectionReasonInput(preset);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.background,
                      borderWidth: 1,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      borderRadius: 6,
                      padding: 8,
                      marginBottom: 6
                    }}
                  >
                    <MaterialCommunityIcons 
                      name={isSelected ? 'radiobox-marked' : 'radiobox-blank'} 
                      size={16} 
                      color={isSelected ? theme.colors.primary : theme.colors.placeholder} 
                      style={{ marginRight: 6 }} 
                    />
                    <Text style={{ fontSize: 11.5, color: isSelected ? theme.colors.primary : theme.colors.text, flex: 1 }}>
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.text, marginTop: 8, marginBottom: 4 }}>
              Custom Rejection Note / Guidance:
            </Text>
            <TextInput
              value={rejectionReasonInput}
              onChangeText={setRejectionReasonInput}
              placeholder="Provide specific corrective guidance for the garage owner..."
              placeholderTextColor={theme.colors.placeholder}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                borderWidth: 1,
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
                color: theme.colors.text,
                height: 70,
                textAlignVertical: 'top'
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setRejectModalVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: 'center'
                }}
              >
                <Text style={{ fontSize: 13, color: theme.colors.placeholder, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={loadingAction}
                onPress={handleConfirmRejection}
                style={{
                  flex: 1.5,
                  backgroundColor: '#EF4444',
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row'
                }}
              >
                {loadingAction ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="close-octagon-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '800' }}>Confirm Rejection</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
  garageAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    resizeMode: 'cover',
  },
  modalCarouselContainer: {
    height: 160,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
  },
  modalCarousel: {
    width: '100%',
    height: '100%',
  },
  modalCarouselSlide: {
    width: 340,
    height: 160,
    position: 'relative',
  },
  modalCarouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalCarouselTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  modalCarouselTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  saveGalleryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  saveGalleryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  adminGalleryThumbBox: {
    width: 90,
    height: 65,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.3)',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  adminGalleryThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  adminGalleryDeleteBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminGalleryIndexBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  adminGalleryIndexText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  presetSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  presetRow: {
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
    fontSize: 10,
    fontWeight: '600',
  },
  addImageInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  imageUrlInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  addImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  addImageBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  docModalContent: {
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rejectModalContent: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
