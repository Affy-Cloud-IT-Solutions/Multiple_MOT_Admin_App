import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Image,
  Dimensions,
  Linking,
  Modal,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pick, types } from '@react-native-documents/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';

const { width } = Dimensions.get('window');

const DOCUMENT_CHECKLIST = [
  { type: 'VTS Certificate', label: 'DVLA VTS Authorisation Certificate', required: true, icon: 'shield-car' },
  { type: 'AE Certificate', label: 'MOT Authorised Examiner (AE) Certificate', required: true, icon: 'card-account-details-outline' },
  { type: 'Public Liability Insurance', label: 'Public Liability Insurance', required: true, icon: 'shield-account-outline' },
  { type: 'Business Registration', label: 'Company / Business Registration Proof', required: false, icon: 'office-building-outline' },
];

interface ServiceItemState {
  id: string;
  name: string;
  category: string;
  defaultPrice: number;
  price: string;
  selected: boolean;
  duration: number;
  icon: string;
}

const PRESET_SERVICES = [
  { id: 'mot_4', name: 'Class 4 MOT Test', category: 'MOT', defaultPrice: 54.85, duration: 45, icon: 'shield-check' },
  { id: 'interim', name: 'Interim Service', category: 'Servicing', defaultPrice: 89.00, duration: 60, icon: 'car-wrench' },
  { id: 'full', name: 'Full Service', category: 'Servicing', defaultPrice: 149.00, duration: 90, icon: 'car-cog' },
  { id: 'major', name: 'Major Service', category: 'Servicing', defaultPrice: 199.00, duration: 120, icon: 'wrench-clock' },
  { id: 'diag', name: 'Engine Diagnostic Check', category: 'Diagnostics', defaultPrice: 45.00, duration: 40, icon: 'laptop' },
  { id: 'brakes', name: 'Brake Pads & Discs Service', category: 'Brakes', defaultPrice: 75.00, duration: 60, icon: 'car-brake-alert' },
  { id: 'ac', name: 'Air Conditioning Regas / Service', category: 'Air Conditioning', defaultPrice: 60.00, duration: 45, icon: 'snowflake' },
  { id: 'align', name: 'Wheel Alignment & Tracking', category: 'Tyres', defaultPrice: 40.00, duration: 30, icon: 'tire' },
  { id: 'tyre', name: 'Tyre Replacement & Fitment', category: 'Tyres', defaultPrice: 30.00, duration: 30, icon: 'tire' },
  { id: 'battery', name: 'Battery Health Check & Replacement', category: 'Repairs', defaultPrice: 65.00, duration: 30, icon: 'car-battery' },
  { id: 'exhaust', name: 'Exhaust System Inspection & Repair', category: 'Exhaust', defaultPrice: 85.00, duration: 45, icon: 'smoke' },
  { id: 'clutch', name: 'Clutch Inspection & Replacement', category: 'Repairs', defaultPrice: 350.00, duration: 180, icon: 'cogs' },
];

export default function GarageSetupScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const {
    user,
    token,
    currentGarage,
    fetchCurrentGarage,
    updateGarageProfile,
    uploadGarageDocument,
    submitCurrentGarageForReview,
    refreshData
  } = useAppValues();

  const initialTab = route?.params?.initialTab || 'location';
  const [activeTab, setActiveTab] = useState<'location' | 'services' | 'documents'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingServices, setSavingServices] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // Tab 1: Location & Map Pin
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('London');
  const [postcode, setPostcode] = useState('');
  const [latitude, setLatitude] = useState('51.5074');
  const [longitude, setLongitude] = useState('-0.1278');
  const [locationLink, setLocationLink] = useState('');
  const [resolvingLink, setResolvingLink] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [showPhotoSection, setShowPhotoSection] = useState(false);

  // Tab 2: Services
  const [servicesList, setServicesList] = useState<ServiceItemState[]>([]);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Servicing');
  const [customPrice, setCustomPrice] = useState('');
  const [customDuration, setCustomDuration] = useState('45');

  // Tab 3: Documents & Identification
  const [vtsNumber, setVtsNumber] = useState('');
  const [motAuthorisedExaminerNumber, setMotAuthorisedExaminerNumber] = useState('');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [verificationDocuments, setVerificationDocuments] = useState<any[]>([]);

  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  // Populate data when garage is loaded
  useEffect(() => {
    if (currentGarage) {
      setAddress(currentGarage.address === 'Pending Location Setup' ? '' : (currentGarage.address || ''));
      setCity(currentGarage.city || 'London');
      setPostcode(currentGarage.postcode || '');
      if (currentGarage.latitude) setLatitude(String(currentGarage.latitude));
      if (currentGarage.longitude) setLongitude(String(currentGarage.longitude));
      setImages(currentGarage.images || []);
      setVtsNumber(currentGarage.vtsNumber || '');
      setMotAuthorisedExaminerNumber(currentGarage.motAuthorisedExaminerNumber || '');
      setBusinessRegistrationNumber(currentGarage.businessRegistrationNumber || '');
      setVerificationDocuments(currentGarage.verificationDocuments || []);

      // Build services list: If not yet configured by the owner, start with clean unselected list
      const isAlreadyConfigured = Boolean(currentGarage.servicesConfigured);
      const existing = isAlreadyConfigured ? (currentGarage.services || []) : [];
      const presetsMapped: ServiceItemState[] = PRESET_SERVICES.map(p => {
        const found = existing.find((s: any) => s.name?.toLowerCase().trim() === p.name.toLowerCase().trim());
        return {
          ...p,
          selected: isAlreadyConfigured && Boolean(found),
          price: found ? String(found.price) : String(p.defaultPrice),
        };
      });

      // Find any custom services that aren't in presets (only if already configured)
      const customOnes: ServiceItemState[] = isAlreadyConfigured
        ? existing
            .filter((s: any) => !PRESET_SERVICES.some(p => p.name.toLowerCase().trim() === (s.name || '').toLowerCase().trim()))
            .map((s: any, idx: number) => ({
              id: `custom_${idx}_${Date.now()}`,
              name: s.name,
              category: s.category || 'Custom',
              defaultPrice: s.price,
              price: String(s.price),
              selected: true,
              duration: s.duration || 45,
              icon: 'cog-outline'
            }))
        : [];

      setServicesList([...presetsMapped, ...customOnes]);
    } else {
      fetchCurrentGarage();
    }
  }, [currentGarage]);

  // Upload file helper
  const uploadToBackend = async (fileUri: string, fileName: string, fileType: string, endpoint: 'image' | 'document') => {
    const formData = new FormData();
    formData.append(endpoint, {
      uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
      name: fileName || `upload_${Date.now()}.${fileType?.split('/')[1] || (endpoint === 'image' ? 'jpg' : 'pdf')}`,
      type: fileType || (endpoint === 'image' ? 'image/jpeg' : 'application/pdf')
    } as any);

    const res = await fetch(`${BASE_URL}/upload/${endpoint}`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload failed on server.');
    }

    const data = await res.json();
    return data.url || fileUri;
  };

  // Google Maps link parser
  const handleResolveLocationLink = async () => {
    if (!locationLink.trim()) {
      Alert.alert('Empty Link', 'Please paste a Google Maps or location share link.');
      return;
    }

    setResolvingLink(true);
    try {
      const link = locationLink.trim();
      const coordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      const qRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const llRegex = /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/;

      const match = link.match(coordRegex) || link.match(qRegex) || link.match(llRegex);
      if (match) {
        setLatitude(match[1]);
        setLongitude(match[2]);
        Alert.alert('Coordinates Found! 📍', `Pin location coordinates captured: \nLat: ${match[1]}, Lng: ${match[2]}`);
        setLocationLink('');
      } else {
        Alert.alert('Manual Pin Entry', 'Could not parse exact coordinates from this link format. Please enter coordinates or street address directly.');
      }
    } catch (e: any) {
      Alert.alert('Link Parse Error', 'Could not parse location link.');
    } finally {
      setResolvingLink(false);
    }
  };

  // Save Location (Tab 1)
  const handleSaveLocation = async () => {
    if (!address.trim()) {
      Alert.alert('Validation Error', 'Please enter your street address.');
      return;
    }
    if (!postcode.trim()) {
      Alert.alert('Validation Error', 'Please enter your garage postcode.');
      return;
    }

    setSavingLocation(true);
    try {
      const garageId = currentGarage?.id || currentGarage?._id || user?.garageId;
      if (!garageId) throw new Error('No garage account identified.');

      await updateGarageProfile(garageId, {
        address: address.trim(),
        city: city.trim(),
        postcode: postcode.trim().toUpperCase(),
        latitude: parseFloat(latitude) || 51.5074,
        longitude: parseFloat(longitude) || -0.1278,
        locationConfigured: true
      });
      await AsyncStorage.setItem(`garage_loc_${garageId}`, 'true');
      await fetchCurrentGarage();
      Alert.alert('Location Saved! 📍', 'Garage address and map pin have been saved successfully.');
      setActiveTab('services');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save location.');
    } finally {
      setSavingLocation(false);
    }
  };

  // Service toggle & price edit (Tab 2)
  const handleToggleService = (id: string) => {
    setServicesList(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const handlePriceChange = (id: string, newPrice: string) => {
    setServicesList(prev => prev.map(item => item.id === id ? { ...item, price: newPrice } : item));
  };

  const handleAddCustomService = () => {
    if (!customName.trim()) {
      Alert.alert('Required', 'Please enter the service name.');
      return;
    }
    const numPrice = parseFloat(customPrice.trim());
    if (isNaN(numPrice) || numPrice < 0) {
      Alert.alert('Required', 'Please enter a valid price/rate.');
      return;
    }

    const newItem: ServiceItemState = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      category: customCategory,
      defaultPrice: numPrice,
      price: String(numPrice),
      selected: true,
      duration: parseInt(customDuration.trim()) || 45,
      icon: 'cog-outline'
    };

    setServicesList(prev => [newItem, ...prev]);
    setCustomName('');
    setCustomPrice('');
    setCustomModalVisible(false);
  };

  // Save Services (Tab 2)
  const handleSaveServices = async () => {
    const selected = servicesList.filter(s => s.selected);
    if (selected.length === 0) {
      Alert.alert('No Services Selected', 'Please select at least one service you offer and set its price.');
      return;
    }

    setSavingServices(true);
    try {
      const garageId = currentGarage?.id || currentGarage?._id || user?.garageId;
      if (!garageId) throw new Error('No garage account identified.');

      const payload = selected.map(s => ({
        name: s.name,
        category: s.category,
        price: parseFloat(s.price) || s.defaultPrice,
        duration: s.duration || 45,
        description: `${s.name} at ${currentGarage?.name || 'our garage'}`,
        availability: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        isActive: true
      }));

      await updateGarageProfile(garageId, { 
        services: payload,
        servicesConfigured: true 
      });
      await AsyncStorage.setItem(`garage_srv_${garageId}`, 'true');
      await fetchCurrentGarage();
      Alert.alert('Services Saved! 🏷️', `You have saved ${payload.length} service(s) with your custom pricing rates.`);
      setActiveTab('documents');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save services.');
    } finally {
      setSavingServices(false);
    }
  };

  // Document upload handler (Tab 3)
  const handlePickDocument = async (docType: string) => {
    const garageId = currentGarage?.id || currentGarage?._id || user?.garageId;
    if (!garageId) return;

    try {
      const results = await pick({
        type: [types.pdf, types.images, types.doc, types.docx],
        allowMultiSelection: false,
      });

      if (!results || results.length === 0) return;
      const file = results[0];
      if (!file.uri) return;

      setUploadingDocType(docType);
      const uploadedUrl = await uploadToBackend(
        file.uri,
        file.name || `${docType}.pdf`,
        file.type || 'application/pdf',
        'document'
      );

      await uploadGarageDocument(garageId, docType, uploadedUrl, docType);
      Alert.alert('Uploaded ✓', `"${docType}" uploaded successfully.`);
      await fetchCurrentGarage();
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Could not upload document.');
    } finally {
      setUploadingDocType(null);
    }
  };

  // Submit all for Super Admin Review
  const handleSubmitForReview = async () => {
    if (!address.trim() || !postcode.trim() || address === 'Pending Location Setup') {
      Alert.alert('Location Missing', 'Please fill in and save your garage address and postcode before submitting.');
      setActiveTab('location');
      return;
    }

    const currentServices = currentGarage?.services || [];
    if (currentServices.length === 0) {
      Alert.alert('Services Missing', 'Please select the services you offer and save your rates in Step 2.');
      setActiveTab('services');
      return;
    }

    setSubmittingReview(true);
    try {
      const garageId = currentGarage?.id || currentGarage?._id || user?.garageId;
      if (garageId) {
        await updateGarageProfile(garageId, {
          vtsNumber: vtsNumber.trim().toUpperCase(),
          motAuthorisedExaminerNumber: motAuthorisedExaminerNumber.trim().toUpperCase(),
          businessRegistrationNumber: businessRegistrationNumber.trim().toUpperCase(),
          documentsConfigured: true
        });
        await AsyncStorage.setItem(`garage_doc_${garageId}`, 'true');
      }
      await submitCurrentGarageForReview();
      Alert.alert(
        'Submitted for Review! 🎉',
        'Your garage location, services, and MOT authorization documents have been sent to Super Admin for verification. Once approved, your slots will go live on the customer app.',
        [{ text: 'Great!', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not submit for review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const isApproved = currentGarage?.status === 'Approved';
  const isPending = currentGarage?.status === 'Pending';
  const isRejected = currentGarage?.status === 'Rejected';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Finish Your Garage Profile</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.placeholder }]}>
            {currentGarage?.name || 'Garage Portal'}
          </Text>
        </View>
        <TouchableOpacity onPress={fetchCurrentGarage} style={styles.refreshButton}>
          <MaterialCommunityIcons name="refresh" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Status Banner */}
        <View style={[
          styles.statusCard,
          {
            backgroundColor: isApproved ? '#ECFDF5' : isRejected ? '#FEF2F2' : '#FFFBEB',
            borderColor: isApproved ? '#10B981' : isRejected ? '#EF4444' : '#F59E0B'
          }
        ]}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons
              name={isApproved ? 'check-decagram' : isRejected ? 'alert-circle' : 'clock-alert-outline'}
              size={28}
              color={isApproved ? '#059669' : isRejected ? '#DC2626' : '#D97706'}
            />
            <View style={styles.statusTextWrap}>
              <Text style={[
                styles.statusTitle,
                { color: isApproved ? '#065F46' : isRejected ? '#991B1B' : '#92400E' }
              ]}>
                {isApproved ? 'Garage Approved & Live' : isRejected ? 'Application Needs Revision' : 'Pending Verification (Sandbox Mode)'}
              </Text>
              <Text style={[styles.statusSubtitle, { color: isApproved ? '#047857' : isRejected ? '#B91C1C' : '#B45309' }]}>
                {isApproved
                  ? 'Your garage is live. Drivers can discover your garage and book MOT slots online.'
                  : isRejected
                    ? (currentGarage?.rejectionReason || 'Please review your uploaded documents and resubmit.')
                    : 'Complete your Location, Services & Docs below to request Super Admin approval and go live!'}
              </Text>
            </View>
          </View>
        </View>

        {/* 3 Core Profile Tabs: Location, Services, Docs */}
        <View style={[styles.tabBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'location' && [styles.activeTabItem, { borderColor: theme.colors.primary }]]}
            onPress={() => setActiveTab('location')}
          >
            <MaterialCommunityIcons
              name="map-marker-radius"
              size={18}
              color={activeTab === 'location' ? theme.colors.primary : theme.colors.placeholder}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'location' ? theme.colors.primary : theme.colors.placeholder }
            ]}>
              1. Location
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'services' && [styles.activeTabItem, { borderColor: theme.colors.primary }]]}
            onPress={() => setActiveTab('services')}
          >
            <MaterialCommunityIcons
              name="tag-multiple"
              size={18}
              color={activeTab === 'services' ? theme.colors.primary : theme.colors.placeholder}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'services' ? theme.colors.primary : theme.colors.placeholder }
            ]}>
              2. Services
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'documents' && [styles.activeTabItem, { borderColor: theme.colors.primary }]]}
            onPress={() => setActiveTab('documents')}
          >
            <MaterialCommunityIcons
              name="file-document-check-outline"
              size={18}
              color={activeTab === 'documents' ? theme.colors.primary : theme.colors.placeholder}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'documents' ? theme.colors.primary : theme.colors.placeholder }
            ]}>
              3. Legal Docs
            </Text>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* TAB 1: LOCATION OF YOUR GARAGE                          */}
        {/* ======================================================== */}
        {activeTab === 'location' && (
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="map-marker-check" size={24} color={theme.colors.primary} />
              <View style={styles.sectionTitleWrap}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Location of Your Garage</Text>
                <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
                  Enter your physical workshop address and pin location for customer GPS directions.
                </Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Street Address *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g. Unit 4, Commercial Trading Estate"
                placeholderTextColor={theme.colors.placeholder}
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>City *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. London"
                  placeholderTextColor={theme.colors.placeholder}
                  value={city}
                  onChangeText={setCity}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Postcode *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. SW1A 1AA"
                  placeholderTextColor={theme.colors.placeholder}
                  value={postcode}
                  autoCapitalize="characters"
                  onChangeText={setPostcode}
                />
              </View>
            </View>

            {/* Quick Google Maps Coordinate Autofill */}
            <View style={[styles.linkBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={[styles.linkLabel, { color: theme.colors.text }]}>Paste Google Maps Share Link (Optional)</Text>
              <View style={styles.linkRow}>
                <TextInput
                  style={[styles.linkInput, { color: theme.colors.text }]}
                  placeholder="https://maps.app.goo.gl/..."
                  placeholderTextColor={theme.colors.placeholder}
                  value={locationLink}
                  onChangeText={setLocationLink}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.linkFetchBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={handleResolveLocationLink}
                  disabled={resolvingLink}
                >
                  {resolvingLink ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.linkFetchBtnText}>Fetch Pin</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Latitude</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="51.5074"
                  placeholderTextColor={theme.colors.placeholder}
                  keyboardType="numeric"
                  value={latitude}
                  onChangeText={setLatitude}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Longitude</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="-0.1278"
                  placeholderTextColor={theme.colors.placeholder}
                  keyboardType="numeric"
                  value={longitude}
                  onChangeText={setLongitude}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleSaveLocation}
              disabled={savingLocation}
            >
              {savingLocation ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-check" size={20} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Location & Continue to Services ➔</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 2: YOUR SERVICES & RATES                            */}
        {/* ======================================================== */}
        {activeTab === 'services' && (
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="tag-multiple" size={24} color={theme.colors.primary} />
              <View style={styles.sectionTitleWrap}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your Services & Pricing</Text>
                <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
                  Select the services your garage offers from the list and enter your custom price/rate in GBP (£).
                </Text>
              </View>
            </View>

            {/* Service Selection Checklist */}
            <View style={styles.servicesContainer}>
              {servicesList.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.serviceCard,
                    {
                      backgroundColor: item.selected ? theme.colors.primary + '0A' : theme.colors.background,
                      borderColor: item.selected ? theme.colors.primary : theme.colors.border
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={styles.serviceHeaderRow}
                    onPress={() => handleToggleService(item.id)}
                    activeOpacity={0.7}
                  >
                    {/* Checkbox */}
                    <MaterialCommunityIcons
                      name={item.selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={24}
                      color={item.selected ? theme.colors.primary : theme.colors.placeholder}
                    />

                    {/* Name & Category */}
                    <View style={styles.serviceInfo}>
                      <Text style={[styles.serviceName, { color: theme.colors.text }]}>
                        {item.name}
                      </Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{item.category}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Price Rate Input */}
                  {item.selected && (
                    <View style={styles.priceRow}>
                      <Text style={[styles.priceLabel, { color: theme.colors.placeholder }]}>
                        Your Price:
                      </Text>
                      <View style={[styles.priceInputWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                        <Text style={[styles.currencyPrefix, { color: theme.colors.text }]}>£</Text>
                        <TextInput
                          style={[styles.priceInput, { color: theme.colors.text }]}
                          keyboardType="decimal-pad"
                          value={item.price}
                          placeholder={String(item.defaultPrice)}
                          placeholderTextColor={theme.colors.placeholder}
                          onChangeText={(text) => handlePriceChange(item.id, text)}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Add Custom Service Button */}
            <TouchableOpacity
              style={[styles.addCustomBtn, { borderColor: theme.colors.primary }]}
              onPress={() => setCustomModalVisible(true)}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.addCustomBtnText, { color: theme.colors.primary }]}>+ Add Custom Service</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
              onPress={handleSaveServices}
              disabled={savingServices}
            >
              {savingServices ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-check" size={20} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Services & Continue to Docs ➔</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 3: LEGAL & MOT DOCUMENTS                            */}
        {/* ======================================================== */}
        {activeTab === 'documents' && (
          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="file-certificate" size={24} color={theme.colors.primary} />
              <View style={styles.sectionTitleWrap}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>MOT Authorizations & Legal Docs</Text>
                <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
                  Upload your DVLA VTS certification and liability insurance to receive Super Admin approval.
                </Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>DVLA VTS Site Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g. VTS-104928"
                placeholderTextColor={theme.colors.placeholder}
                value={vtsNumber}
                autoCapitalize="characters"
                onChangeText={setVtsNumber}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>MOT Authorised Examiner (AE) Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g. AE-884920"
                placeholderTextColor={theme.colors.placeholder}
                value={motAuthorisedExaminerNumber}
                autoCapitalize="characters"
                onChangeText={setMotAuthorisedExaminerNumber}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Company / Business Registration Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g. 12938475"
                placeholderTextColor={theme.colors.placeholder}
                value={businessRegistrationNumber}
                autoCapitalize="characters"
                onChangeText={setBusinessRegistrationNumber}
              />
            </View>

            <Text style={[styles.docSubheader, { color: theme.colors.text }]}>Document Upload Checklist</Text>

            {DOCUMENT_CHECKLIST.map((doc, index) => {
              const uploaded = (verificationDocuments || []).find(d => d.name === doc.type || d.documentType === doc.type);
              const isRejectedDoc = uploaded?.status === 'Rejected';
              const isVerifiedDoc = uploaded?.status === 'Verified';

              return (
                <View key={index} style={[styles.docCard, { backgroundColor: theme.colors.background, borderColor: isRejectedDoc ? '#EF4444' : theme.colors.border }]}>
                  <View style={styles.docIconBox}>
                    <MaterialCommunityIcons name={doc.icon as any} size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={[styles.docLabel, { color: theme.colors.text }]}>{doc.label}</Text>
                    <View style={styles.docStatusRow}>
                      <Text style={[
                        styles.docStatusText,
                        {
                          color: isVerifiedDoc
                            ? '#059669'
                            : isRejectedDoc
                              ? '#DC2626'
                              : uploaded
                                ? '#D97706'
                                : theme.colors.placeholder
                        }
                      ]}>
                        {isVerifiedDoc ? 'Verified ✓' : isRejectedDoc ? 'Rejected - Re-upload' : uploaded ? 'Uploaded (Pending Review)' : 'Not Uploaded'}
                      </Text>
                    </View>
                    {isRejectedDoc && uploaded?.rejectionReason && (
                      <Text style={styles.rejectDocReason}>Reason: {uploaded.rejectionReason}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.uploadSmallBtn,
                      { backgroundColor: isRejectedDoc ? '#FEE2E2' : theme.colors.primaryContainer }
                    ]}
                    onPress={() => handlePickDocument(doc.type)}
                    disabled={uploadingDocType === doc.type}
                  >
                    {uploadingDocType === doc.type ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <MaterialCommunityIcons
                        name={uploaded ? 'file-replace-outline' : 'upload'}
                        size={18}
                        color={isRejectedDoc ? '#DC2626' : theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Master Submission Button */}
            <TouchableOpacity
              style={[
                styles.submitReviewBtn,
                { backgroundColor: isApproved ? '#059669' : '#F59E0B' }
              ]}
              onPress={handleSubmitForReview}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send-check" size={22} color="#FFFFFF" />
                  <Text style={styles.submitReviewBtnText}>
                    {isApproved ? 'Update & Re-Submit' : 'Submit for Super Admin Approval'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Custom Service Modal */}
      <Modal visible={customModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Custom Service</Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Service Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g. Timing Belt Replacement"
                placeholderTextColor={theme.colors.placeholder}
                value={customName}
                onChangeText={setCustomName}
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Price (£) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. 195.00"
                  placeholderTextColor={theme.colors.placeholder}
                  keyboardType="decimal-pad"
                  value={customPrice}
                  onChangeText={setCustomPrice}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Duration (Mins)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. 60"
                  placeholderTextColor={theme.colors.placeholder}
                  keyboardType="numeric"
                  value={customDuration}
                  onChangeText={setCustomDuration}
                />
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setCustomModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalAddBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleAddCustomService}
              >
                <Text style={styles.modalAddText}>Add Service</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  refreshButton: {
    padding: 6,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  activeTabItem: {
    borderBottomWidth: 2.5,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  sectionTitleWrap: {
    flex: 1,
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  rowFields: {
    flexDirection: 'row',
  },
  linkBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 14,
  },
  linkLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
  },
  linkInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    paddingHorizontal: 8,
  },
  linkFetchBtn: {
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkFetchBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 10,
    gap: 8,
    marginTop: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  // Services Styles
  servicesContainer: {
    gap: 10,
    marginBottom: 14,
  },
  serviceCard: {
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 12,
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0284C715',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 36,
    minWidth: 90,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 4,
  },
  priceInput: {
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
    minWidth: 50,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    gap: 6,
  },
  addCustomBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  // Document Styles
  docSubheader: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 12,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  docIconBox: {
    marginRight: 10,
  },
  docInfo: {
    flex: 1,
  },
  docLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  docStatusRow: {
    marginTop: 3,
  },
  docStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rejectDocReason: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 2,
    fontStyle: 'italic',
  },
  uploadSmallBtn: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  submitReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 10,
    gap: 8,
    marginTop: 20,
  },
  submitReviewBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  modalAddBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAddText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
