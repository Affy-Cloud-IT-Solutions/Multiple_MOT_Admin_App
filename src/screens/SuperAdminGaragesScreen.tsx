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
  Switch,
} from 'react-native';
import { pick, types } from '@react-native-documents/picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, Garage, BASE_URL, DEFAULT_UK_BENCHMARK_PRICING } from '../context/DataContext';
import { fonts } from '../theme/theme';
import { formatShortDate } from '../utils/dateUtils';

export default function SuperAdminGaragesScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const {
    garages,
    refreshData,
    updateGarageStatus,
    updateGarageDocumentStatus,
    updateGarageProfile,
    token,
    authFetch,
    isConciergeMode,
    bookingMode,
    conciergePhoneNumber,
    conciergeWhatsappNumber,
    conciergeEmail,
    hideDirectGaragePhone,
    requireFullProfileForVisibility,
    updatePlatformSettings,
    bulkImportGaragesExcel,
    bookingLeads,
    fetchBookingLeads,
    updateBookingLead,
    convertLeadToBooking,
    fetchGaragePricing,
    updateGaragePricing,
  } = useAppValues();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'Approved' | 'Directory' | 'Claimed' | 'Pending' | 'Suspended'>('ALL');
  const [selectedGarage, setSelectedGarage] = useState<Garage | null>(null);
  const [garagePricing, setGaragePricing] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [garageDetails, setGarageDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Marketplace & Concierge Strategy States
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [tempBookingMode, setTempBookingMode] = useState<'CONCIERGE_CALL' | 'HYBRID' | 'DIRECT_ONLINE'>(bookingMode || 'CONCIERGE_CALL');
  const [tempConciergePhone, setTempConciergePhone] = useState(conciergePhoneNumber || '9999999999');
  const [tempConciergeWhatsapp, setTempConciergeWhatsapp] = useState(conciergeWhatsappNumber || '9999999999');

  // Excel Bulk Import States
  const [importingExcel, setImportingExcel] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);

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

  const handleToggleConciergeMode = async (newValue: boolean) => {
    setSavingSettings(true);
    try {
      await updatePlatformSettings({
        isConciergeMode: newValue,
        bookingMode: newValue ? 'CONCIERGE_CALL' : 'DIRECT_ONLINE',
        hideDirectGaragePhone: newValue,
      });
      await refreshData();
      Alert.alert(
        'Platform Mode Updated',
        newValue
          ? `Call to Book Mode is now ON:\n\n• Bulk upload & call leads are now active below.\n• Customer apps show "Call to Book" (${conciergePhoneNumber || '9999999999'}).`
          : 'Call to Book Mode is now OFF:\n\n• Normal full booking process restored.\n• Live slots, date/time calendar, and direct booking are active.'
      );
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update mode.');
    } finally {
      setSavingSettings(false);
    }
  };

  const openSettingsModal = () => {
    setTempBookingMode(bookingMode || 'CONCIERGE_CALL');
    setTempConciergePhone(conciergePhoneNumber || '9999999999');
    setTempConciergeWhatsapp(conciergeWhatsappNumber || '9999999999');
    setSettingsModalVisible(true);
  };

  const handleSavePlatformSettings = async () => {
    setSavingSettings(true);
    try {
      const isCallActive = tempBookingMode === 'CONCIERGE_CALL' || tempBookingMode === 'HYBRID';
      await updatePlatformSettings({
        bookingMode: tempBookingMode,
        isConciergeMode: isCallActive,
        hideDirectGaragePhone: isCallActive,
        conciergePhoneNumber: tempConciergePhone.trim() || '9999999999',
        conciergeWhatsappNumber: tempConciergeWhatsapp.trim() || '9999999999',
      });
      setSettingsModalVisible(false);
      await refreshData();
      Alert.alert(
        'Platform Mode Updated',
        tempBookingMode === 'CONCIERGE_CALL'
          ? 'Call to Book Mode is now active for all garages.'
          : tempBookingMode === 'HYBRID'
          ? 'Hybrid Mode is now active: Claimed garages take online bookings, directory garages route to Call to Book.'
          : 'Direct Online Booking is now active for all verified garages.'
      );
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not save platform settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handlePickAndImportExcel = async () => {
    try {
      const results = await pick({
        type: [types.xls, types.xlsx, types.csv],
        allowMultiSelection: false,
      });
      if (!results || results.length === 0) return;
      const file = results[0];
      setImportingExcel(true);
      const res = await bulkImportGaragesExcel({
        uri: file.uri,
        name: file.name || 'garages.xlsx',
        type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await refreshData();
      setUploadModalVisible(false);

      const total = res?.totalRows ?? res?.summary?.totalProcessed ?? 0;
      const created = res?.importedCount ?? res?.summary?.created ?? 0;
      const updated = res?.updatedCount ?? res?.summary?.updated ?? 0;
      const failed = (res?.errors?.length) ?? (res?.summary?.failed) ?? 0;

      if (failed > 0 && (created > 0 || updated > 0)) {
        Alert.alert(
          'Excel Import Completed With Warnings',
          `Processed: ${total} rows\nCreated: ${created}\nUpdated: ${updated}\nFailed: ${failed}\n\nFirst issue (Row ${res.errors[0]?.row}): ${res.errors[0]?.field} - ${res.errors[0]?.error}`
        );
      } else {
        Alert.alert(
          'Excel Import Completed',
          `Processed: ${total} rows\nCreated: ${created}\nUpdated: ${updated}\nFailed: ${failed}`
        );
      }
    } catch (err: any) {
      if (err.message && err.message.includes('User canceled')) return;
      Alert.alert('Import Failed', err.message || 'Could not process Excel file.');
    } finally {
      setImportingExcel(false);
    }
  };

  const handleDownloadSampleExcel = () => {
    const url = `${BASE_URL}/garages/export-sample-excel`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open template URL in browser.');
    });
  };

  const handleOpenLeads = () => {
    navigation.navigate('ConciergeLeads');
  };

  const fetchFullGarageDetails = async (garageId: string) => {
    setLoadingDetails(true);
    try {
      const response = await authFetch(`${BASE_URL}/garages/${garageId}`, {
        headers: {}
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
    setGaragePricing(null);
    setModalVisible(true);
    const gId = garage.id || garage._id || '';
    if (gId) {
      fetchFullGarageDetails(gId);
      fetchGaragePricing(gId)
        .then((p) => setGaragePricing(p))
        .catch(() => setGaragePricing(null));
    }
  };

  const handleResetGaragePricing = async () => {
    if (!selectedGarage) return;
    const gId = selectedGarage.id || selectedGarage._id || '';
    Alert.alert(
      'Apply Standard UK Rates? 🇬🇧',
      `Reset ${selectedGarage.name}'s servicing matrix, MOT combo rules, and delivery fees to standard UK benchmark rates?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Standard Rates',
          onPress: async () => {
            try {
              setLoadingAction(true);
              await updateGaragePricing(gId, DEFAULT_UK_BENCHMARK_PRICING);
              setGaragePricing(DEFAULT_UK_BENCHMARK_PRICING);
              Alert.alert('Success', 'Applied standard UK benchmark pricing rates.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update pricing.');
            } finally {
              setLoadingAction(false);
            }
          },
        },
      ]
    );
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
        logoUrl: selectedGarage.logoUrl || garageImages[0] 
      });
      setSelectedGarage({
        ...selectedGarage,
        images: garageImages,
        logoUrl: selectedGarage.logoUrl || garageImages[0]
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
      const res = await authFetch(`${BASE_URL}/garages/${garageId}/stations/${stationId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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
    let matchesFilter = true;
    if (selectedFilter === 'Approved') matchesFilter = g.status === 'Approved';
    else if (selectedFilter === 'Pending') matchesFilter = g.status === 'Pending';
    else if (selectedFilter === 'Suspended') matchesFilter = g.status === 'Suspended';
    else if (selectedFilter === 'Directory') matchesFilter = g.isClaimed === false || g.source === 'EXCEL_IMPORT';
    else if (selectedFilter === 'Claimed') matchesFilter = g.isClaimed === true;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      g.name.toLowerCase().includes(q) ||
      (g.address && g.address.toLowerCase().includes(q)) ||
      (g.email && g.email.toLowerCase().includes(q)) ||
      (g.phone && g.phone.toLowerCase().includes(q)) ||
      (g.internalPhone && g.internalPhone.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  // Until the garage sets its location, address/GPS are only the schema's central-London defaults
  const selectedLocationSet = Boolean(
    selectedGarage?.profileCompletion?.steps?.location ?? selectedGarage?.locationConfigured
  );

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
      {/* Marketplace & Platform Booking Mode Strategy Banner */}
      <View style={[styles.strategyCard, { 
        backgroundColor: theme.colors.card, 
        borderColor: bookingMode === 'HYBRID' ? '#6366F160' : isConciergeMode ? '#10B98150' : theme.colors.border 
      }]}>
        <View style={styles.strategyTopRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <MaterialCommunityIcons
                name={bookingMode === 'HYBRID' ? 'swap-horizontal' : isConciergeMode ? 'phone-in-talk' : 'calendar-check'}
                size={18}
                color={bookingMode === 'HYBRID' ? '#6366F1' : isConciergeMode ? '#10B981' : '#6B7280'}
              />
              <Text style={[styles.strategyBadgeTitle, { color: theme.colors.text }]}>
                {bookingMode === 'HYBRID'
                  ? 'Hybrid Mode Active'
                  : isConciergeMode
                  ? 'Call to Book Mode Active'
                  : 'Direct Online Booking Active'}
              </Text>
            </View>
            <Text style={[styles.strategySubtitle, { color: theme.colors.placeholder }]}>
              {bookingMode === 'HYBRID'
                ? `Partners: online slots • Directory: Helpline (${conciergePhoneNumber || '9999999999'})`
                : isConciergeMode
                ? `Booking Helpline: ${conciergePhoneNumber || '9999999999'} • Customer apps show "Call to Book"`
                : 'Whole normal booking process active (live slots, calendar, times)'}
            </Text>
          </View>
          <Switch
            value={isConciergeMode}
            onValueChange={handleToggleConciergeMode}
            trackColor={{ false: '#E0E0E0', true: '#10B981' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* When Concierge or Hybrid Mode is ON: Show Bulk Upload, Leads Board, and Settings */}
        {(isConciergeMode || bookingMode === 'HYBRID') && (
          <View style={styles.strategyActionRow}>
            <TouchableOpacity
              style={[styles.strategyBtn, { backgroundColor: '#0284C7', flex: 1.2 }]}
              onPress={() => setUploadModalVisible(true)}
              disabled={importingExcel}
            >
              {importingExcel ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="file-excel-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.strategyBtnText}>Bulk Upload Excel</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.strategyBtn, { backgroundColor: '#10B981', flex: 1.1 }]}
              onPress={handleOpenLeads}
            >
              <MaterialCommunityIcons name="clipboard-text-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.strategyBtnText}>
                Leads ({bookingLeads?.filter((l: any) => l.status === 'NEW').length || 0})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.strategyBtn, { backgroundColor: '#6366F1', flex: 0.8 }]}
              onPress={openSettingsModal}
            >
              <MaterialCommunityIcons name="cog-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.strategyBtnText}>Settings</Text>
            </TouchableOpacity>
          </View>
        )}
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
          {(['ALL', 'Approved', 'Directory', 'Claimed', 'Pending', 'Suspended'] as const).map((filter) => {
            const isActive = selectedFilter === filter;
            const count =
              filter === 'ALL'
                ? garages.length
                : filter === 'Directory'
                ? garages.filter(g => g.isClaimed === false || g.source === 'EXCEL_IMPORT').length
                : filter === 'Claimed'
                ? garages.filter(g => g.isClaimed === true).length
                : garages.filter(g => g.status === filter).length;
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
                  {filter === 'ALL' ? 'All Garages' : filter === 'Directory' ? 'Directory (Unclaimed)' : filter} ({count})
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
                    {garage.logoUrl ? (
                      <Image source={{ uri: garage.logoUrl }} style={styles.garageAvatarImg} />
                    ) : (garage.images && garage.images.length > 0) ? (
                      <Image source={{ uri: garage.images[0] }} style={styles.garageAvatarImg} />
                    ) : (
                      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: statusColor }}>
                        {(garage.name || 'G').charAt(0).toUpperCase()}
                      </Text>
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

                    {/* Directory / Claimed Badge */}
                    {garage.isClaimed === false || garage.source === 'EXCEL_IMPORT' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0284C715', borderWidth: 1, borderColor: '#0284C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 3 }}>
                        <MaterialCommunityIcons name="folder-text-outline" size={12} color="#0284C7" style={{ marginRight: 3 }} />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#0284C7' }}>Directory Listing (Unclaimed)</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98115', borderWidth: 1, borderColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 3 }}>
                        <MaterialCommunityIcons name="check-decagram" size={12} color="#10B981" style={{ marginRight: 3 }} />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#10B981' }}>Claimed Workshop</Text>
                      </View>
                    )}

                    {/* Address / Location */}
                    <View style={styles.locationRow}>
                      <MaterialCommunityIcons name="map-marker-outline" size={14} color="#EF4444" style={{ marginRight: 2 }} />
                      <Text style={[styles.locationText, { color: theme.colors.placeholder }]} numberOfLines={2}>
                        {garage.address}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Contact row with Phone & Admin Internal Phone */}
                <View style={styles.contactRow}>
                  {garage.phone ? (
                    <View style={styles.contactItem}>
                      <MaterialCommunityIcons name="phone-outline" size={13} color={theme.colors.placeholder} />
                      <Text style={[styles.contactText, { color: theme.colors.placeholder }]}>
                        Public: {garage.phone}
                      </Text>
                    </View>
                  ) : null}
                  {garage.internalPhone ? (
                    <View style={[styles.contactItem, { backgroundColor: '#F59E0B15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }]}>
                      <MaterialCommunityIcons name="lock-outline" size={12} color="#D97706" />
                      <Text style={[styles.contactText, { color: '#D97706', fontFamily: fonts.bold }]}>
                        Real: {garage.internalPhone}
                      </Text>
                    </View>
                  ) : null}
                  {garage.email ? (
                    <View style={styles.contactItem}>
                      <MaterialCommunityIcons name="email-outline" size={13} color={theme.colors.placeholder} />
                      <Text style={[styles.contactText, { color: theme.colors.placeholder }]}>{garage.email}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Pending Stations Warning Badge */}
                {Array.isArray(garage.stations) && garage.stations.some((s: any) => s.status === 'Pending') && (
                  <View style={{ backgroundColor: '#F59E0B15', borderWidth: 1, borderColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, marginHorizontal: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="clock-alert-outline" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: '#F59E0B', flex: 1 }}>
                      {garage.stations.filter((s: any) => s.status === 'Pending').length} Station Request(s) Pending Approval
                    </Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#F59E0B' }}>Review ➔</Text>
                  </View>
                )}

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
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                    <View style={[styles.garageAvatar, { width: 44, height: 44, borderRadius: 10, marginRight: 12, backgroundColor: getStatusColor(selectedGarage.status) + '15' }]}>
                      {selectedGarage.logoUrl ? (
                        <Image source={{ uri: selectedGarage.logoUrl }} style={styles.garageAvatarImg} resizeMode="contain" />
                      ) : (selectedGarage.images && selectedGarage.images.length > 0) ? (
                        <Image source={{ uri: selectedGarage.images[0] }} style={styles.garageAvatarImg} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: getStatusColor(selectedGarage.status) }}>
                          {(selectedGarage.name || 'G').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {selectedGarage.name}
                      </Text>
                      <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                        Garage Profile & Platform Controls
                      </Text>
                    </View>
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

                  {/* Brand Logo Section */}
                  <View style={[styles.infoSection, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <Text style={[styles.infoSectionTitle, { color: theme.colors.text }]}>Official Brand Logo</Text>
                    {selectedGarage.logoUrl ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, marginRight: 12 }}>
                          <Image source={{ uri: selectedGarage.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: theme.colors.text }}>Logo Active</Text>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.colors.placeholder }}>
                            Used across customer app search lists, garage profile, and booking cards.
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: theme.colors.primaryContainer, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: theme.colors.primary }}>
                            {(selectedGarage.name || 'G').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.colors.placeholder, flex: 1 }}>
                          No custom brand logo uploaded. Falling back to garage initial.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Location & Contact Info Card */}
                  <View style={[styles.infoSection, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <Text style={[styles.infoSectionTitle, { color: theme.colors.text }]}>Location & Coordinates</Text>
                    
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="map-marker" size={16} color="#EF4444" style={styles.infoIcon} />
                      <Text style={[styles.infoText, { color: selectedLocationSet ? theme.colors.text : '#F59E0B' }]}>
                        {selectedLocationSet
                          ? `${[selectedGarage.address, selectedGarage.city].filter(Boolean).join(', ')} ${selectedGarage.postcode || ''}`.trim() || 'Not provided'
                          : 'Location pending – not set up yet'}
                      </Text>
                    </View>

                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#0284C7" style={styles.infoIcon} />
                      <Text style={[styles.infoText, { color: selectedLocationSet ? theme.colors.placeholder : '#F59E0B' }]}>
                        {selectedLocationSet && selectedGarage.latitude != null && selectedGarage.longitude != null
                          ? `GPS: ${selectedGarage.latitude}, ${selectedGarage.longitude}`
                          : 'GPS: Pending'}
                      </Text>
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
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: selectedGarage.verificationStatus === 'Verified' ? '#10B981' : '#F59E0B' }}>
                          {selectedGarage.verificationStatus || 'Pending Review'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      <View style={{ flex: 1, minWidth: 120, backgroundColor: theme.colors.card, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border }}>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: theme.colors.placeholder }}>DVLA VTS Site #</Text>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text }}>{selectedGarage.vtsNumber || 'VTS-Pending'}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 120, backgroundColor: theme.colors.card, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border }}>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: theme.colors.placeholder }}>MOT AE #</Text>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text }}>{selectedGarage.motAuthorisedExaminerNumber || 'AE-Pending'}</Text>
                      </View>
                    </View>

                    {selectedGarage.businessRegistrationNumber ? (
                      <View style={{ backgroundColor: theme.colors.card, padding: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 }}>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: theme.colors.placeholder }}>Companies House / Business Reg #</Text>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text }}>{selectedGarage.businessRegistrationNumber}</Text>
                      </View>
                    ) : null}

                    {/* Rejection Alert if Rejected */}
                    {selectedGarage.status === 'Rejected' && (
                      <View style={{ backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444440', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#EF4444' }}>Application Rejected</Text>
                        </View>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.text }}>
                          Reason: {selectedGarage.rejectionReason || 'Documentation or verification criteria not verified.'}
                        </Text>
                      </View>
                    )}

                    {/* Verification Documents List */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: theme.colors.text }}>
                        Submitted Certificates ({selectedGarage.verificationDocuments?.length || 0})
                      </Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: theme.colors.placeholder }}>Tap to inspect & verify</Text>
                    </View>

                    {(!selectedGarage.verificationDocuments || selectedGarage.verificationDocuments.length === 0) ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder, marginVertical: 4 }}>No legal certificates attached.</Text>
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
                              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text }}>{doc.name}</Text>
                              <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: theme.colors.placeholder, marginTop: 2 }}>
                                Uploaded: {doc.uploadDate ? formatShortDate(doc.uploadDate) : 'Recent'}
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
                                fontFamily: fonts.bold,
                                fontSize: 10.5,
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
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: theme.colors.primary }}>
                          {(garageDetails?.stations || []).filter((s: any) => s.status === 'Approved').length} Approved
                        </Text>
                      </View>
                    </View>

                    {(!garageDetails?.stations || garageDetails.stations.length === 0) ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.colors.placeholder }}>No stations configured yet.</Text>
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
                                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text }}>{st.name}</Text>
                                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder, marginTop: 2 }}>
                                  {st.slotDuration || 45} mins/slot
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
                                    fontFamily: fonts.bold,
                                    fontSize: 10.5,
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
                                  <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: '#EF4444' }}>Reject</Text>
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
                                    <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: '#FFFFFF' }}>
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

                  {/* BookMyGarage Tiered Rates & Pricing Section */}
                  <View style={[styles.infoSection, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="calculator-variant-outline" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.infoSectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                          BookMyGarage Pricing Structure
                        </Text>
                      </View>
                      <View style={{ backgroundColor: garagePricing?.isConfigured ? '#10B98120' : '#F59E0B20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: garagePricing?.isConfigured ? '#10B981' : '#F59E0B' }}>
                          {garagePricing?.isConfigured ? 'Active CC Tiers' : 'Default Benchmarks'}
                        </Text>
                      </View>
                    </View>

                    {/* Quick rate highlights */}
                    <View style={{ backgroundColor: theme.colors.card, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: theme.colors.text, marginBottom: 6 }}>
                        Benchmark Servicing Rates (Mid-Bracket 1501-2000cc):
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        <View style={{ flex: 1, minWidth: '45%', backgroundColor: theme.colors.background, padding: 6, borderRadius: 6 }}>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: theme.colors.placeholder }}>Interim Service</Text>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text }}>
                            £{garagePricing?.servicing?.find((s: any) => s.bracket === '1501-2000cc')?.interim || 125}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: '45%', backgroundColor: theme.colors.background, padding: 6, borderRadius: 6 }}>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: theme.colors.placeholder }}>Full Service</Text>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text }}>
                            £{garagePricing?.servicing?.find((s: any) => s.bracket === '1501-2000cc')?.full || 185}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: '45%', backgroundColor: theme.colors.background, padding: 6, borderRadius: 6 }}>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: theme.colors.placeholder }}>Major Service</Text>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.text }}>
                            £{garagePricing?.servicing?.find((s: any) => s.bracket === '1501-2000cc')?.major || 245}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: '45%', backgroundColor: theme.colors.background, padding: 6, borderRadius: 6 }}>
                          <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, color: theme.colors.placeholder }}>MOT (Standalone / Combo)</Text>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#10B981' }}>
                            £{garagePricing?.mot?.standalonePrice || 54.85} / £{garagePricing?.mot?.comboWithFullMajor || 34.85}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#6366F1',
                        paddingVertical: 9,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        gap: 6,
                      }}
                      disabled={loadingAction}
                      onPress={handleResetGaragePricing}
                    >
                      {loadingAction ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="flash" size={16} color="#FFFFFF" />
                          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' }}>
                            Apply Recommended UK Benchmark Rates
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Action Buttons - Only displayed when garage application is Pending */}
                  {selectedGarage.status === 'Pending' && (
                    <>
                      <Text style={[styles.actionsHeading, { color: theme.colors.text }]}>Platform Governance Actions</Text>

                      <View style={styles.actionButtonContainer}>
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

                        <TouchableOpacity
                          style={[styles.modalActionBtn, { backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF4444' }]}
                          disabled={loadingAction}
                          onPress={handleOpenRejectModal}
                        >
                          <MaterialCommunityIcons name="close-circle" size={18} color="#EF4444" />
                          <Text style={[styles.modalActionBtnText, { color: '#EF4444' }]}>Reject Application</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
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
                <Text style={{ fontFamily: fonts.extraBold, fontSize: 16, color: theme.colors.text }}>{selectedDoc.name}</Text>
                
                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
                  <View style={{ 
                    backgroundColor: selectedDoc.status === 'Verified' ? '#10B98120' : selectedDoc.status === 'Rejected' ? '#EF444420' : '#F59E0B20', 
                    paddingHorizontal: 10, 
                    paddingVertical: 4, 
                    borderRadius: 6 
                  }}>
                    <Text style={{ 
                      fontFamily: fonts.bold,
                      fontSize: 11, 
                      color: selectedDoc.status === 'Verified' ? '#10B981' : selectedDoc.status === 'Rejected' ? '#EF4444' : '#F59E0B' 
                    }}>
                      Status: {selectedDoc.status || 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={{ backgroundColor: theme.colors.background, padding: 10, borderRadius: 8, marginVertical: 8 }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: theme.colors.placeholder }}>Certificate File Link / URL:</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: theme.colors.text, marginTop: 2 }} numberOfLines={2}>
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
                  <Text style={{ fontFamily: fonts.bold, color: '#FFFFFF', fontSize: 13 }}>Open & View Document File</Text>
                </TouchableOpacity>

                {selectedGarage?.status === 'Pending' && (
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
                          <Text style={{ fontFamily: fonts.bold, color: '#EF4444', fontSize: 12.5 }}>Reject Doc</Text>
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
                          <Text style={{ fontFamily: fonts.bold, color: '#FFFFFF', fontSize: 12.5 }}>Verify Doc</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
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

            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: theme.colors.placeholder, marginVertical: 8 }}>
              Select or specify the regulatory reason for rejection. This reason will be shown to the garage admin upon login.
            </Text>

            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: theme.colors.text, marginBottom: 6 }}>
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
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: isSelected ? theme.colors.primary : theme.colors.text, flex: 1 }}>
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: theme.colors.text, marginTop: 8, marginBottom: 4 }}>
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
                fontFamily: fonts.regular,
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
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: theme.colors.placeholder }}>Cancel</Text>
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
                    <Text style={{ fontFamily: fonts.extraBold, fontSize: 13, color: '#FFFFFF' }}>Confirm Rejection</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Booking Helpline Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.strategyModalContainer, { backgroundColor: theme.colors.card }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border, paddingHorizontal: 16, paddingVertical: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="cog-outline" size={20} color="#0284C7" />
                <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: 15 }]}>Booking Mode & Helpline</Text>
              </View>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
              {/* 3 Compact Mode Rows */}
              <View style={styles.compactModeGroup}>
                {/* 1. Call to Book */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setTempBookingMode('CONCIERGE_CALL')}
                  style={[
                    styles.compactModeRow,
                    { borderColor: tempBookingMode === 'CONCIERGE_CALL' ? '#F59E0B' : theme.colors.border },
                    tempBookingMode === 'CONCIERGE_CALL' && { backgroundColor: '#F59E0B12' }
                  ]}
                >
                  <MaterialCommunityIcons
                    name="phone-in-talk"
                    size={17}
                    color={tempBookingMode === 'CONCIERGE_CALL' ? '#F59E0B' : theme.colors.placeholder}
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.compactModeTitle, { color: tempBookingMode === 'CONCIERGE_CALL' ? '#F59E0B' : theme.colors.text }]}>
                      Call to Book (All Garages)
                    </Text>
                    <Text style={[styles.compactModeSub, { color: theme.colors.placeholder }]}>
                      All workshops show "Call to Book" connected to helpline
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={tempBookingMode === 'CONCIERGE_CALL' ? 'radiobox-marked' : 'radiobox-blank'}
                    size={18}
                    color={tempBookingMode === 'CONCIERGE_CALL' ? '#F59E0B' : theme.colors.placeholder}
                  />
                </TouchableOpacity>

                {/* 2. Hybrid Mode */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setTempBookingMode('HYBRID')}
                  style={[
                    styles.compactModeRow,
                    { borderColor: tempBookingMode === 'HYBRID' ? '#6366F1' : theme.colors.border },
                    tempBookingMode === 'HYBRID' && { backgroundColor: '#6366F112' }
                  ]}
                >
                  <MaterialCommunityIcons
                    name="swap-horizontal"
                    size={17}
                    color={tempBookingMode === 'HYBRID' ? '#6366F1' : theme.colors.placeholder}
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.compactModeTitle, { color: tempBookingMode === 'HYBRID' ? '#6366F1' : theme.colors.text }]}>
                      Hybrid Mode (Recommended)
                    </Text>
                    <Text style={[styles.compactModeSub, { color: theme.colors.placeholder }]}>
                      Partners: online booking · Directory: helpline
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={tempBookingMode === 'HYBRID' ? 'radiobox-marked' : 'radiobox-blank'}
                    size={18}
                    color={tempBookingMode === 'HYBRID' ? '#6366F1' : theme.colors.placeholder}
                  />
                </TouchableOpacity>

                {/* 3. Direct Online Booking */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setTempBookingMode('DIRECT_ONLINE')}
                  style={[
                    styles.compactModeRow,
                    { borderColor: tempBookingMode === 'DIRECT_ONLINE' ? '#10B981' : theme.colors.border },
                    tempBookingMode === 'DIRECT_ONLINE' && { backgroundColor: '#10B98112' }
                  ]}
                >
                  <MaterialCommunityIcons
                    name="calendar-check"
                    size={17}
                    color={tempBookingMode === 'DIRECT_ONLINE' ? '#10B981' : theme.colors.placeholder}
                  />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.compactModeTitle, { color: tempBookingMode === 'DIRECT_ONLINE' ? '#10B981' : theme.colors.text }]}>
                      Direct Online Booking
                    </Text>
                    <Text style={[styles.compactModeSub, { color: theme.colors.placeholder }]}>
                      Full live slot booking calendar across all workshops
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={tempBookingMode === 'DIRECT_ONLINE' ? 'radiobox-marked' : 'radiobox-blank'}
                    size={18}
                    color={tempBookingMode === 'DIRECT_ONLINE' ? '#10B981' : theme.colors.placeholder}
                  />
                </TouchableOpacity>
              </View>

              {/* 2-Column Compact Phone Inputs */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.compactInputLabel, { color: theme.colors.text }]}>Helpline Phone</Text>
                  <View style={[styles.compactInputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <MaterialCommunityIcons name="phone" size={15} color="#0284C7" />
                    <TextInput
                      style={[styles.compactTextInput, { color: theme.colors.text }]}
                      value={tempConciergePhone}
                      onChangeText={setTempConciergePhone}
                      placeholder="9999999999"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.compactInputLabel, { color: theme.colors.text }]}>WhatsApp Line</Text>
                  <View style={[styles.compactInputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <MaterialCommunityIcons name="whatsapp" size={15} color="#10B981" />
                    <TextInput
                      style={[styles.compactTextInput, { color: theme.colors.text }]}
                      value={tempConciergeWhatsapp}
                      onChangeText={setTempConciergeWhatsapp}
                      placeholder="9999999999"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={[styles.modalActionButtons, { borderTopColor: theme.colors.border, paddingVertical: 10, paddingHorizontal: 16 }]}>
              <TouchableOpacity
                onPress={() => setSettingsModalVisible(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border, paddingVertical: 8 }]}
              >
                <Text style={[styles.modalCancelText, { color: theme.colors.text, fontSize: 12 }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSavePlatformSettings}
                disabled={savingSettings}
                style={[styles.modalSaveBtn, { backgroundColor: '#0284C7', paddingVertical: 8 }]}
              >
                {savingSettings ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                    <Text style={[styles.modalSaveText, { fontSize: 12 }]}>Save Configuration</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: BULK UPLOAD EXCEL GUIDANCE & IMPORT ================= */}
      <Modal
        visible={uploadModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!importingExcel) setUploadModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.strategyModalContainer, { backgroundColor: theme.colors.card }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#0284C715', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="file-excel-box" size={24} color="#0284C7" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Bulk Upload Garages</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>Import workshops via Excel (.xlsx) or CSV</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => !importingExcel && setUploadModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480, paddingHorizontal: 18, paddingTop: 14 }}>
              {/* Guidance Notice */}
              <View style={[styles.uploadInfoBanner, { backgroundColor: '#0284C710', borderColor: '#0284C730' }]}>
                <MaterialCommunityIcons name="information-outline" size={18} color="#0284C7" style={{ marginTop: 2 }} />
                <Text style={[styles.uploadInfoBannerText, { color: theme.colors.text }]}>
                  Ensure your spreadsheet includes the exact columns below. The system automatically validates every row before adding garages to the live platform.
                </Text>
              </View>

              {/* Mandatory Fields Section */}
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                  <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={[styles.sectionHeadingTitle, { color: theme.colors.text }]}>
                    Mandatory Columns (Required)
                  </Text>
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredBadgeText}>6 REQUIRED</Text>
                  </View>
                </View>

                {/* 1. Garage Name */}
                <View style={[styles.fieldRequirementCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.fieldDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.fieldRequirementTitle, { color: theme.colors.text }]}>1. Garage Name</Text>
                    </View>
                    <Text style={styles.fieldTagRed}>Required</Text>
                  </View>
                  <Text style={[styles.fieldRequirementDesc, { color: theme.colors.placeholder }]}>
                    Official workshop or trading business name (minimum 2 characters).
                  </Text>
                  <Text style={[styles.fieldRequirementExample, { color: '#0284C7' }]}>
                    e.g. "Apex MOT & Service Centre"
                  </Text>
                </View>

                {/* 2. Address / Street */}
                <View style={[styles.fieldRequirementCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.fieldDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.fieldRequirementTitle, { color: theme.colors.text }]}>2. Street Address</Text>
                    </View>
                    <Text style={styles.fieldTagRed}>Required</Text>
                  </View>
                  <Text style={[styles.fieldRequirementDesc, { color: theme.colors.placeholder }]}>
                    Workshop physical premises street address (minimum 3 characters).
                  </Text>
                  <Text style={[styles.fieldRequirementExample, { color: '#0284C7' }]}>
                    e.g. "10 Industrial Estate, London Road"
                  </Text>
                </View>

                {/* 3. City / Town */}
                <View style={[styles.fieldRequirementCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.fieldDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.fieldRequirementTitle, { color: theme.colors.text }]}>3. City / Town</Text>
                    </View>
                    <Text style={styles.fieldTagRed}>Required</Text>
                  </View>
                  <Text style={[styles.fieldRequirementDesc, { color: theme.colors.placeholder }]}>
                    Actual city or town name where the workshop is located (minimum 2 characters).
                  </Text>
                  <Text style={[styles.fieldRequirementExample, { color: '#0284C7' }]}>
                    e.g. "London", "Manchester", "Birmingham", "Leeds"
                  </Text>
                </View>

                {/* 4. Postcode */}
                <View style={[styles.fieldRequirementCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.fieldDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.fieldRequirementTitle, { color: theme.colors.text }]}>4. Postcode</Text>
                    </View>
                    <Text style={styles.fieldTagRed}>Required</Text>
                  </View>
                  <Text style={[styles.fieldRequirementDesc, { color: theme.colors.placeholder }]}>
                    Valid UK postcode used to locate and match nearby customers.
                  </Text>
                  <Text style={[styles.fieldRequirementExample, { color: '#0284C7' }]}>
                    e.g. "SE1 7PB", "SW1A 1AA", "EC1A 1BB"
                  </Text>
                </View>

                {/* 5. Internal Phone */}
                <View style={[styles.fieldRequirementCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.fieldDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.fieldRequirementTitle, { color: theme.colors.text }]}>5. Internal Phone</Text>
                    </View>
                    <Text style={styles.fieldTagRed}>Required</Text>
                  </View>
                  <Text style={[styles.fieldRequirementDesc, { color: theme.colors.placeholder }]}>
                    Direct workshop contact number (7 to 15 digits) for helpline coordinators.
                  </Text>
                  <Text style={[styles.fieldRequirementExample, { color: '#0284C7' }]}>
                    e.g. "020 7946 0192" or "07700 900123"
                  </Text>
                </View>

                {/* 6. Email */}
                <View style={[styles.fieldRequirementCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.fieldDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={[styles.fieldRequirementTitle, { color: theme.colors.text }]}>6. Email Address</Text>
                    </View>
                    <Text style={styles.fieldTagRed}>Required</Text>
                  </View>
                  <Text style={[styles.fieldRequirementDesc, { color: theme.colors.placeholder }]}>
                    Valid workshop email address for booking alerts and notifications.
                  </Text>
                  <Text style={[styles.fieldRequirementExample, { color: '#0284C7' }]}>
                    e.g. "info@apexmot.co.uk"
                  </Text>
                </View>
              </View>

              {/* Optional Fields Section */}
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color="#10B981" />
                  <Text style={[styles.sectionHeadingTitle, { color: theme.colors.text }]}>
                    Optional Columns (Leave Blank if None)
                  </Text>
                </View>

                <View style={[styles.optionalGridCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={styles.optionalRow}>
                    <Text style={[styles.optionalLabel, { color: theme.colors.text }]}>• Working Hours:</Text>
                    <Text style={[styles.optionalValue, { color: theme.colors.placeholder }]}>Defaults to 08:30 – 17:30 if omitted</Text>
                  </View>
                  <View style={styles.optionalRow}>
                    <Text style={[styles.optionalLabel, { color: theme.colors.text }]}>• VTS Number:</Text>
                    <Text style={[styles.optionalValue, { color: theme.colors.placeholder }]}>DVSA MOT station site number (optional)</Text>
                  </View>
                  <View style={styles.optionalRow}>
                    <Text style={[styles.optionalLabel, { color: theme.colors.text }]}>• MOT AE Number:</Text>
                    <Text style={[styles.optionalValue, { color: theme.colors.placeholder }]}>Authorised Examiner reference (optional)</Text>
                  </View>
                  <View style={styles.optionalRow}>
                    <Text style={[styles.optionalLabel, { color: theme.colors.text }]}>• Coordinates:</Text>
                    <Text style={[styles.optionalValue, { color: theme.colors.placeholder }]}>Latitude / Longitude (optional)</Text>
                  </View>
                  <View style={styles.optionalRow}>
                    <Text style={[styles.optionalLabel, { color: theme.colors.text }]}>• Description:</Text>
                    <Text style={[styles.optionalValue, { color: theme.colors.placeholder }]}>Workshop specialties & overview (optional)</Text>
                  </View>
                </View>
              </View>

              {/* Download Sample Template Button */}
              <TouchableOpacity
                onPress={handleDownloadSampleExcel}
                style={[styles.templateDownloadBtn, { borderColor: theme.colors.border, marginTop: 16 }]}
              >
                <MaterialCommunityIcons name="file-download-outline" size={18} color="#0284C7" />
                <Text style={[styles.templateDownloadText, { color: '#0284C7' }]}>
                  Download Sample Bulk Import Template (.xlsx)
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Modal Actions */}
            <View style={[styles.modalActionButtons, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                onPress={() => setUploadModalVisible(false)}
                disabled={importingExcel}
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePickAndImportExcel}
                disabled={importingExcel}
                style={[styles.modalSaveBtn, { backgroundColor: '#0284C7' }]}
              >
                {importingExcel ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="cloud-upload" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSaveText}>Select & Upload Spreadsheet</Text>
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
    fontFamily: fonts.extraBold,
    fontSize: 24,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
    fontSize: 12,
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
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  emptyStateSubtitle: {
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
    fontSize: 15.5,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 3,
  },
  locationText: {
    fontFamily: fonts.regular,
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
    fontFamily: fonts.regular,
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
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
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
    fontFamily: fonts.extraBold,
    fontSize: 18,
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
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
    fontFamily: fonts.extraBold,
    fontSize: 13,
  },
  statusBannerSubtitle: {
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
    fontSize: 13,
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
    fontFamily: fonts.regular,
    fontSize: 13,
    flex: 1,
  },
  staffItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  staffNameText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  staffEmailText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
  actionsHeading: {
    fontFamily: fonts.bold,
    fontSize: 13,
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
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 14,
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
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  saveGalleryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  saveGalleryBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 12,
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
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 8,
  },
  presetSectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
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
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  addImageInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  imageUrlInput: {
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 12,
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
  strategyCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  strategyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  strategyBadgeTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
  },
  strategySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    marginTop: 2,
  },
  strategyActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  strategyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  strategyBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  strategyModalContainer: {
    width: '92%',
    maxWidth: 500,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
  },
  compactModeGroup: {
    gap: 6,
  },
  compactModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  compactModeTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  compactModeSub: {
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 1,
  },
  compactInputLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    marginBottom: 4,
  },
  compactInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 38,
  },
  compactTextInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    marginLeft: 6,
    paddingVertical: 0,
  },
  settingSectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    marginBottom: 8,
  },
  modeOptionCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  modeTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  modeDesc: {
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  inputLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    marginBottom: 4,
  },
  inputHint: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  modalTextInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    marginLeft: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 8,
  },
  switchTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
  },
  switchSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 14,
  },
  templateDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 14,
    marginBottom: 16,
  },
  templateDownloadText: {
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  modalCancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  modalSaveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSaveText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  leadFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  leadItemCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  leadCustomerName: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  leadStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  leadStatusText: {
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  leadDetailsText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    marginBottom: 2,
  },
  leadDateText: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    marginTop: 2,
  },
  leadActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB30',
  },
  leadCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  leadCallBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  leadStatusActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  uploadInfoBanner: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: 'flex-start',
  },
  uploadInfoBannerText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 16,
  },
  sectionHeadingTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
  },
  requiredBadge: {
    backgroundColor: '#EF444415',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  fieldRequirementCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  fieldDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  fieldRequirementTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  fieldTagRed: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#EF4444',
  },
  fieldRequirementDesc: {
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  fieldRequirementExample: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    marginTop: 3,
  },
  optionalGridCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  optionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionalLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  optionalValue: {
    fontFamily: fonts.regular,
    fontSize: 11,
  },
});
