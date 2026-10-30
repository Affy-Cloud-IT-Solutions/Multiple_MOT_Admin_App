import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Modal,
  AppState,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { pick, types } from '@react-native-documents/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL, ServiceCatalogGroup } from '../context/DataContext';
import { fonts } from '../theme/theme';
import {
  detectGarageLocation,
  DetectedGarageLocation,
  LocationError,
  LocationErrorCode,
  openAppSettings,
  openLocationSettings,
} from '../utils/garageLocation';

// Customers see these photos on the garage profile
const MIN_GARAGE_PHOTOS = 3;
const MAX_GARAGE_PHOTOS = 8;
const PHOTO_GAP = 10;
// Uploaded files are served from the API host (e.g. https://api.example.com/uploads/...)
const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

const DOCUMENT_CHECKLIST = [
  { type: 'VTS Certificate', label: 'DVLA VTS Authorisation Certificate', required: true, icon: 'shield-car' },
  { type: 'AE Certificate', label: 'MOT Authorised Examiner (AE) Certificate', required: true, icon: 'card-account-details-outline' },
  { type: 'Public Liability Insurance', label: 'Public Liability Insurance', required: true, icon: 'shield-account-outline' },
  { type: 'Business Registration', label: 'Company / Business Registration Proof', required: false, icon: 'office-building-outline' },
];

interface ServiceItemState {
  id: string;
  name: string;
  /** Super Admin category name */
  category: string;
  defaultPrice: number;
  price: string;
  selected: boolean;
  duration: number;
  icon: string;
  isCustom: boolean;
}

const normaliseName = (value: string = '') => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const firstWordStem = (value: string = '') => {
  const word = normaliseName(value).split(' ')[0] || '';
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
};
// Same matching as the backend: exact category name first, then the same leading word (Tyres ~ Tyre replacement)
const findCatalogGroup = (catalog: ServiceCatalogGroup[], categoryName?: string) => {
  const wanted = normaliseName(categoryName);
  if (!wanted) return undefined;
  return catalog.find(g => normaliseName(g.name) === wanted) || catalog.find(g => firstWordStem(g.name) === firstWordStem(categoryName));
};

/** Catalog services (selected if the garage already offers them) plus the garage's own custom services. */
function buildServiceItems(catalog: ServiceCatalogGroup[], garage: any) {
  const saved: any[] = garage?.servicesConfigured ? (garage?.services || []) : [];
  const findSaved = (name: string) => saved.find(s => normaliseName(s.name) === normaliseName(name));
  const items: ServiceItemState[] = [];

  catalog.forEach(group => {
    group.services.forEach((svc, idx) => {
      const found = findSaved(svc.name);
      items.push({
        id: `${group.id}_${idx}`,
        name: svc.name,
        category: group.name,
        defaultPrice: svc.price,
        price: String(found ? found.price : svc.price),
        selected: Boolean(found),
        duration: Number(found?.duration) || svc.duration || 45,
        icon: svc.icon || group.icon,
        isCustom: false,
      });
    });
  });

  let notOffered = 0;
  saved.forEach((svc, idx) => {
    if (items.some(item => normaliseName(item.name) === normaliseName(svc.name))) return;
    const group = findCatalogGroup(catalog, svc.category);
    if (!group) {
      // Its category was removed by the Super Admin, so it can no longer be offered
      notOffered += 1;
      return;
    }
    items.push({
      id: `saved_${idx}`,
      name: svc.name,
      category: group.name,
      defaultPrice: Number(svc.price) || 0,
      price: String(svc.price ?? ''),
      selected: true,
      duration: Number(svc.duration) || 45,
      icon: group.icon,
      isCustom: true,
    });
  });
  return { items, notOffered };
}

// Shown at the top of a setup step that has to be done again after a rejection
function RedoNotice({ text }: { text: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.redoNotice, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error + '50' }]}>
      <MaterialCommunityIcons name="restart-alert" size={18} color={theme.colors.error} />
      <Text style={[styles.redoNoticeText, { color: theme.colors.text }]}>{text}</Text>
    </View>
  );
}

// What we ask the user to do when their live location can't be read
const LOCATION_PROMPTS: Record<LocationErrorCode, { icon: string; title: string; message: string; action: string }> = {
  disabled: {
    icon: 'map-marker-off-outline',
    title: 'Turn On Location',
    message: "Your phone's location is off. Turn it on and we'll fill in your garage address and map pin automatically.",
    action: 'Turn On Location',
  },
  permission: {
    icon: 'map-marker-question-outline',
    title: 'Allow Location Access',
    message: 'Ondoorcarservice Hub needs your location to find your garage address and map pin. Tap Allow when asked.',
    action: 'Allow Location',
  },
  blocked: {
    icon: 'map-marker-alert-outline',
    title: 'Location Access Is Off',
    message: 'Location access is turned off for this app. Open Settings, go to Location and choose "Allow while using the app".',
    action: 'Open Settings',
  },
  timeout: {
    icon: 'crosshairs-question',
    title: "Couldn't Find You Yet",
    message: "We couldn't get a GPS signal in time. Move near a window or step outside, then try again.",
    action: 'Try Again',
  },
};

function LocationPromptModal({
  code,
  found,
  onAction,
  onClose,
}: {
  code: LocationErrorCode | null;
  found: DetectedGarageLocation | null;
  onAction: () => void;
  onClose: () => void;
}) {
  const { theme } = useAppTheme();
  const prompt = code ? LOCATION_PROMPTS[code] : null;
  const missing = found ? [!found.address && 'street address', !found.postcode && 'postcode'].filter(Boolean) : [];
  return (
    <Modal visible={Boolean(prompt || found)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.promptCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {found && !prompt && (
            <>
              <View style={[styles.promptIconCircle, { backgroundColor: theme.colors.success + '18' }]}>
                <MaterialCommunityIcons name="map-marker-check-outline" size={34} color={theme.colors.success} />
              </View>
              <Text style={[styles.promptTitle, { color: theme.colors.text }]}>Location Found</Text>
              <View style={[styles.foundBox, { backgroundColor: theme.colors.success + '10', borderColor: theme.colors.success + '50' }]}>
                {found.address ? (
                  <Text style={[styles.foundAddress, { color: theme.colors.success }]}>{found.address}</Text>
                ) : null}
                {found.city || found.postcode ? (
                  <Text style={[styles.foundLine, { color: theme.colors.success }]}>
                    {[found.city, found.postcode.toUpperCase()].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
                <Text style={[styles.foundCoords, { color: theme.colors.success }]}>
                  {found.latitude.toFixed(6)}, {found.longitude.toFixed(6)}
                </Text>
              </View>
              <Text style={[styles.promptMessage, { color: theme.colors.placeholder }]}>
                {missing.length > 0
                  ? `We couldn't find your ${missing.join(' and ')} - please type it in.`
                  : "We've filled these in for you. Check they're correct, then save."}
              </Text>
              <TouchableOpacity
                style={[styles.saveBtn, styles.promptActionBtn, { backgroundColor: theme.colors.primary }]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={[styles.saveBtnText, { color: theme.colors.card }]}>Done</Text>
              </TouchableOpacity>
            </>
          )}
          {prompt && (
            <>
              <View style={[styles.promptIconCircle, { backgroundColor: theme.colors.primary + '12' }]}>
                <MaterialCommunityIcons name={prompt.icon as any} size={34} color={theme.colors.primary} />
              </View>
              <Text style={[styles.promptTitle, { color: theme.colors.text }]}>{prompt.title}</Text>
              <Text style={[styles.promptMessage, { color: theme.colors.placeholder }]}>{prompt.message}</Text>
              <TouchableOpacity
                style={[styles.saveBtn, styles.promptActionBtn, { backgroundColor: theme.colors.primary }]}
                onPress={onAction}
                activeOpacity={0.85}
              >
                <Text style={[styles.saveBtnText, { color: theme.colors.card }]}>{prompt.action}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promptCancelBtn} onPress={onClose}>
                <Text style={[styles.promptCancelText, { color: theme.colors.placeholder }]}>Not Now</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Red dot on a setup tab that needs action
function TabDot({ show }: { show: boolean }) {
  const { theme } = useAppTheme();
  return show ? <View style={[styles.tabDot, { backgroundColor: theme.colors.error }]} /> : null;
}

export default function GarageSetupScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const {
    user,
    currentGarage,
    fetchCurrentGarage,
    updateGarageProfile,
    uploadGarageDocument,
    submitCurrentGarageForReview,
    fetchServiceCatalog
  } = useAppValues();
  // Text/icons on primary buttons - readable in both light and dark themes
  const onPrimary = theme.colors.card;

  const initialTab = route?.params?.initialTab || 'location';
  const [activeTab, setActiveTab] = useState<'location' | 'services' | 'documents'>(initialTab);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingServices, setSavingServices] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(0);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationPrompt, setLocationPrompt] = useState<LocationErrorCode | null>(null);
  const [foundLocation, setFoundLocation] = useState<DetectedGarageLocation | null>(null);
  // Set when we sent the user to Settings - we try again automatically when they come back
  const retryLocationOnReturn = React.useRef(false);
  const [photoGridWidth, setPhotoGridWidth] = useState(0);
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

  // Tab 2: Services
  const [servicesList, setServicesList] = useState<ServiceItemState[]>([]);
  const [catalog, setCatalog] = useState<ServiceCatalogGroup[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [notOfferedCount, setNotOfferedCount] = useState(0);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('');
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

  // Fill the form from the garage once. The garage reloads after every upload/save, and re-filling then
  // would wipe anything typed but not saved yet (e.g. the VTS / AE numbers, which save on Submit).
  const formFilledForGarage = React.useRef<string | null>(null);
  useEffect(() => {
    if (!currentGarage) {
      fetchCurrentGarage();
      return;
    }
    // Document statuses always follow the server
    setVerificationDocuments(currentGarage.verificationDocuments || []);

    const garageKey = String(currentGarage.id || currentGarage._id || '');
    if (formFilledForGarage.current === garageKey) return;
    formFilledForGarage.current = garageKey;
    setAddress(currentGarage.address === 'Pending Location Setup' ? '' : (currentGarage.address || ''));
    setCity(currentGarage.city || 'London');
    setPostcode(currentGarage.postcode || '');
    if (currentGarage.latitude) setLatitude(String(currentGarage.latitude));
    if (currentGarage.longitude) setLongitude(String(currentGarage.longitude));
    setImages(currentGarage.images || []);
    setVtsNumber(currentGarage.vtsNumber || '');
    setMotAuthorisedExaminerNumber(currentGarage.motAuthorisedExaminerNumber || '');
    setBusinessRegistrationNumber(currentGarage.businessRegistrationNumber || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGarage]);

  // Services come from the categories the Super Admin has created
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      setCatalog(await fetchServiceCatalog());
    } catch (err: any) {
      setCatalogError(err.message || 'Could not load service categories.');
    } finally {
      setCatalogLoading(false);
    }
  }, [fetchServiceCatalog]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Rebuild the list only when the catalog or the saved services change, so unsaved ticks aren't lost
  const savedServicesKey = JSON.stringify([currentGarage?.servicesConfigured, currentGarage?.services || []]);
  useEffect(() => {
    if (!catalog) return;
    const { items, notOffered } = buildServiceItems(catalog, currentGarage);
    setServicesList(items);
    setNotOfferedCount(notOffered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, savedServicesKey]);

  const servicesByCategory = useMemo(
    () => (catalog || []).map(group => ({ group, items: servicesList.filter(item => item.category === group.name) })),
    [catalog, servicesList]
  );

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
    if (data.relativeUrl) return `${API_ORIGIN}${data.relativeUrl}`;
    if (data.fileUrl || data.url) return data.fileUrl || data.url;
    throw new Error('Upload failed on server.');
  };

  // Live GPS location -> map pin, street, city and postcode
  const handleUseCurrentLocation = async () => {
    setDetectingLocation(true);
    try {
      const loc = await detectGarageLocation();
      setLatitude(loc.latitude.toFixed(6));
      setLongitude(loc.longitude.toFixed(6));
      if (loc.address) setAddress(loc.address);
      if (loc.city) setCity(loc.city);
      if (loc.postcode) setPostcode(loc.postcode.toUpperCase());
      setLocationPrompt(null);
      setFoundLocation(loc);
    } catch (err: any) {
      if (err instanceof LocationError) {
        setLocationPrompt(err.code);
      } else {
        Alert.alert('Location Unavailable', err?.message || 'Could not get your current location.');
      }
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleLocationPromptAction = async () => {
    const code = locationPrompt;
    setLocationPrompt(null);
    if (code === 'disabled') {
      retryLocationOnReturn.current = true;
      await openLocationSettings();
    } else if (code === 'blocked') {
      retryLocationOnReturn.current = true;
      await openAppSettings();
    } else {
      // 'permission' shows the system "Allow location?" dialog again; 'timeout' simply retries
      handleUseCurrentLocation();
    }
  };

  // Back from Settings with location turned on -> fetch it straight away
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && retryLocationOnReturn.current) {
        retryLocationOnReturn.current = false;
        handleUseCurrentLocation();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Garage photos from the gallery - uploaded straight away, saved with the location step
  const handleAddPhotos = async () => {
    const remaining = MAX_GARAGE_PHOTOS - images.length;
    if (remaining <= 0) {
      Alert.alert('Photo Limit Reached', `You can add up to ${MAX_GARAGE_PHOTOS} photos. Remove one to add another.`);
      return;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
      maxWidth: 1600,
      maxHeight: 1600,
      selectionLimit: remaining,
    });
    if (result.didCancel) return;
    if (result.errorCode) {
      Alert.alert(
        'Photos Unavailable',
        result.errorCode === 'permission'
          ? 'Photo access was denied. Allow photo access for Ondoorcarservice Hub in Settings.'
          : result.errorMessage || 'Could not open your photo gallery.'
      );
      return;
    }

    const assets = (result.assets || []).filter(a => a.uri).slice(0, remaining);
    if (assets.length === 0) return;
    setUploadingPhotos(assets.length);
    const uploaded: string[] = [];
    for (const asset of assets) {
      try {
        uploaded.push(await uploadToBackend(asset.uri!, asset.fileName || `garage_${Date.now()}.jpg`, asset.type || 'image/jpeg', 'image'));
      } catch (e) {
        console.warn('Garage photo upload failed:', e);
      }
    }
    setUploadingPhotos(0);
    if (uploaded.length > 0) {
      setImages(prev => [...prev, ...uploaded].slice(0, MAX_GARAGE_PHOTOS));
    }
    if (uploaded.length < assets.length) {
      Alert.alert('Upload Problem', `${assets.length - uploaded.length} photo(s) could not be uploaded. Please try again.`);
    }
  };

  const handleRemovePhoto = (url: string) => {
    setImages(prev => prev.filter(img => img !== url));
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
    if (images.length < MIN_GARAGE_PHOTOS) {
      const needed = MIN_GARAGE_PHOTOS - images.length;
      Alert.alert('Add Garage Photos', `Please add at least ${MIN_GARAGE_PHOTOS} photos of your garage (${needed} more needed).`);
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
        images,
        locationConfigured: true
      });
      await AsyncStorage.setItem(`garage_loc_${garageId}`, 'true');
      await fetchCurrentGarage();
      Alert.alert('Location Saved! 📍', 'Garage address, map pin and photos have been saved successfully.');
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

  const openCustomServiceModal = (categoryName: string) => {
    setCustomCategory(categoryName);
    setCustomName('');
    setCustomPrice('');
    setCustomDuration('45');
    setCustomModalVisible(true);
  };

  const handleAddCustomService = () => {
    if (!customName.trim()) {
      Alert.alert('Required', 'Please enter the service name.');
      return;
    }
    if (!customCategory) {
      Alert.alert('Required', 'Please choose a category for this service.');
      return;
    }
    if (servicesList.some(item => normaliseName(item.name) === normaliseName(customName))) {
      Alert.alert('Already Listed', `"${customName.trim()}" is already in your list - just tick it and set your price.`);
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
      duration: parseInt(customDuration.trim(), 10) || 45,
      icon: findCatalogGroup(catalog || [], customCategory)?.icon || 'cog-outline',
      isCustom: true
    };

    setServicesList(prev => [...prev, newItem]);
    setCustomName('');
    setCustomPrice('');
    setCustomModalVisible(false);
  };

  // Save Services (Tab 2)
  const handleSaveServices = async () => {
    const selected = servicesList.filter(s => s.selected);
    const badPrice = selected.find(s => !s.price.trim() || isNaN(parseFloat(s.price)) || parseFloat(s.price) < 0);
    if (badPrice) {
      Alert.alert('Check Your Prices', `Please enter a valid price for "${badPrice.name}".`);
      return;
    }
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
        price: parseFloat(s.price),
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

      // Replaces the earlier copy of this document on the server; the card then shows "Uploaded (Pending Review)"
      await uploadGarageDocument(garageId, docType, uploadedUrl, docType);
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

    // After a full rejection every step has to be saved again before resubmitting
    if (redoSteps.includes('location')) {
      Alert.alert('Location Not Saved Yet', 'Please review your garage location and save it again before resubmitting.');
      setActiveTab('location');
      return;
    }
    if (redoSteps.includes('services')) {
      Alert.alert('Services Not Saved Yet', 'Please review your services & prices and save them again before resubmitting.');
      setActiveTab('services');
      return;
    }
    if (rejectedDocCount > 0) {
      Alert.alert(
        'Documents Still Rejected',
        `Please upload a new copy of the ${rejectedDocCount === 1 ? 'rejected document' : `${rejectedDocCount} rejected documents`} before submitting.`
      );
      setActiveTab('documents');
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
        isRejected ? 'Application Resubmitted! 🎉' : 'Submitted for Review! 🎉',
        isRejected
          ? 'Your updated application has been sent back to Super Admin for review. Your garage will go live once it is approved.'
          : 'Your garage location, services, and MOT authorization documents have been sent to Super Admin for verification. Once approved, your slots will go live on the customer app.',
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

  // Rejection feedback: a full rejection flags location/services for redo; documents carry their own status
  const photoTileSize = photoGridWidth > 0
    ? { width: Math.floor((photoGridWidth - PHOTO_GAP * 2) / 3), height: Math.floor((photoGridWidth - PHOTO_GAP * 2) / 3) }
    : styles.photoTileFallback;

  const redoSteps = currentGarage?.redoSteps || [];
  const rejectedDocCount = (verificationDocuments || []).filter(d => d.status === 'Rejected').length;
  const needsAction = {
    location: redoSteps.includes('location'),
    services: redoSteps.includes('services'),
    documents: rejectedDocCount > 0,
  };
  const hasDocIssuesOnly = !isRejected && rejectedDocCount > 0;
  const bannerColor = isApproved && !hasDocIssuesOnly
    ? theme.colors.success
    : (isRejected || hasDocIssuesOnly) ? theme.colors.error : theme.colors.warning;

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
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Status Banner */}
        <View style={[
          styles.statusCard,
          { backgroundColor: bannerColor + '12', borderColor: bannerColor }
        ]}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons
              name={isRejected ? 'alert-octagon-outline' : hasDocIssuesOnly ? 'file-alert-outline' : isApproved ? 'check-decagram' : 'clock-alert-outline'}
              size={28}
              color={bannerColor}
            />
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusTitle, { color: bannerColor }]}>
                {isRejected
                  ? 'Application Rejected - Start Again'
                  : hasDocIssuesOnly
                    ? (rejectedDocCount === 1 ? '1 Document Needs a New Copy' : `${rejectedDocCount} Documents Need a New Copy`)
                    : isApproved ? 'Garage Approved & Live' : 'Pending Verification (Sandbox Mode)'}
              </Text>
              {isRejected && currentGarage?.rejectionReason ? (
                <Text style={[styles.statusReason, { color: theme.colors.text }]}>
                  Reason: {currentGarage.rejectionReason}
                </Text>
              ) : null}
              <Text style={[styles.statusSubtitle, { color: theme.colors.placeholder }]}>
                {isRejected
                  ? 'Go through each step again (tabs marked with a red dot), upload new documents and resubmit your application.'
                  : hasDocIssuesOnly
                    ? 'Only the rejected document needs updating - open Legal Docs and upload a new copy. Nothing else has to change.'
                    : isApproved
                      ? 'Your garage is live. Drivers can discover your garage and book MOT slots online.'
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
            <TabDot show={needsAction.location} />
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
            <TabDot show={needsAction.services} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'documents' && [styles.activeTabItem, { borderColor: theme.colors.primary }]]}
            onPress={() => setActiveTab('documents')}
          >
            <MaterialCommunityIcons
              name="file-document"
              size={18}
              color={activeTab === 'documents' ? theme.colors.primary : theme.colors.placeholder}
            />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'documents' ? theme.colors.primary : theme.colors.placeholder }
            ]}>
              3. Legal Docs
            </Text>
            <TabDot show={needsAction.documents} />
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

            {needsAction.location && (
              <RedoNotice text="Your application was rejected. Check your address and map pin, then save this step again." />
            )}

            <TouchableOpacity
              style={[styles.saveBtn, styles.liveLocationBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleUseCurrentLocation}
              disabled={detectingLocation}
              activeOpacity={0.85}
            >
              {detectingLocation ? (
                <>
                  <ActivityIndicator color={onPrimary} />
                  <Text style={[styles.saveBtnText, { color: onPrimary }]}>Finding your location...</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="crosshairs-gps" size={20} color={onPrimary} />
                  <Text style={[styles.saveBtnText, { color: onPrimary }]}>Use My Current Location</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={[styles.liveLocationHint, { color: theme.colors.placeholder }]}>
              Stand at your garage and tap above - we'll fill in the address, postcode and map pin for you.
            </Text>

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
                    <ActivityIndicator size="small" color={onPrimary} />
                  ) : (
                    <Text style={[styles.linkFetchBtnText, { color: onPrimary }]}>Fetch Pin</Text>
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

            {/* Garage photos - at least 3 */}
            <View style={styles.photoHeaderRow}>
              <Text style={[styles.fieldLabel, styles.photoHeaderLabel, { color: theme.colors.text }]}>Garage Photos *</Text>
              <Text style={[styles.photoCount, { color: images.length >= MIN_GARAGE_PHOTOS ? theme.colors.success : theme.colors.placeholder }]}>
                {images.length >= MIN_GARAGE_PHOTOS ? `${images.length} added ✓` : `${images.length} / ${MIN_GARAGE_PHOTOS} minimum`}
              </Text>
            </View>
            <Text style={[styles.photoHint, { color: theme.colors.placeholder }]}>
              Add at least {MIN_GARAGE_PHOTOS} clear photos (outside, workshop / MOT bay, reception). Customers see these on your profile.
            </Text>
            {images.length === 0 && uploadingPhotos === 0 ? (
              // Nothing yet: one large, centred add area
              <TouchableOpacity
                style={[styles.photoDropZone, { borderColor: theme.colors.primary, backgroundColor: theme.colors.background }]}
                onPress={handleAddPhotos}
                activeOpacity={0.7}
              >
                <View style={[styles.photoDropIcon, { backgroundColor: theme.colors.primary + '12' }]}>
                  <MaterialCommunityIcons name="image-plus" size={28} color={theme.colors.primary} />
                </View>
                <Text style={[styles.photoDropTitle, { color: theme.colors.text }]}>Add Garage Photos</Text>
                <Text style={[styles.photoDropSubtitle, { color: theme.colors.placeholder }]}>
                  Tap to choose {MIN_GARAGE_PHOTOS} or more from your gallery
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.photoGrid} onLayout={e => setPhotoGridWidth(e.nativeEvent.layout.width)}>
                {images.map(url => (
                  <View key={url} style={[styles.photoTile, photoTileSize, { borderColor: theme.colors.border }]}>
                    <Image source={{ uri: url }} style={styles.photoImage} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.photoRemoveBtn}
                      onPress={() => handleRemovePhoto(url)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {uploadingPhotos > 0 && (
                  <View style={[styles.photoTile, photoTileSize, styles.photoAddTile, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text style={[styles.photoAddText, { color: theme.colors.placeholder }]}>Uploading {uploadingPhotos}...</Text>
                  </View>
                )}
                {uploadingPhotos === 0 && images.length < MAX_GARAGE_PHOTOS && (
                  <TouchableOpacity
                    style={[styles.photoTile, photoTileSize, styles.photoAddTile, { borderColor: theme.colors.primary, backgroundColor: theme.colors.background }]}
                    onPress={handleAddPhotos}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="image-plus" size={26} color={theme.colors.primary} />
                    <Text style={[styles.photoAddText, { color: theme.colors.primary }]}>Add Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleSaveLocation}
              disabled={savingLocation || uploadingPhotos > 0}
            >
              {savingLocation ? (
                <ActivityIndicator color={onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-check" size={20} color={onPrimary} />
                  <Text style={[styles.saveBtnText, { color: onPrimary }]}>Save Location & Continue to Services ➔</Text>
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

            {needsAction.services && (
              <RedoNotice text="Your application was rejected. Review your services and prices, then save this step again." />
            )}

            {notOfferedCount > 0 && (
              <View style={[styles.infoNotice, { backgroundColor: theme.colors.warning + '14', borderColor: theme.colors.warning + '60' }]}>
                <MaterialCommunityIcons name="information-outline" size={18} color={theme.colors.warning} />
                <Text style={[styles.redoNoticeText, { color: theme.colors.text }]}>
                  {notOfferedCount === 1 ? '1 of your services is' : `${notOfferedCount} of your services are`} in a category that is no longer offered, so {notOfferedCount === 1 ? 'it' : 'they'} will be removed when you save.
                </Text>
              </View>
            )}

            {catalogLoading ? (
              <View style={styles.catalogState}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={[styles.catalogStateText, { color: theme.colors.placeholder }]}>Loading service categories...</Text>
              </View>
            ) : catalogError ? (
              <View style={styles.catalogState}>
                <MaterialCommunityIcons name="cloud-alert" size={30} color={theme.colors.placeholder} />
                <Text style={[styles.catalogStateText, { color: theme.colors.text }]}>{catalogError}</Text>
                <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={loadCatalog}>
                  <Text style={[styles.retryBtnText, { color: onPrimary }]}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : servicesByCategory.length === 0 ? (
              <View style={styles.catalogState}>
                <MaterialCommunityIcons name="shape-outline" size={30} color={theme.colors.placeholder} />
                <Text style={[styles.catalogStateText, { color: theme.colors.text }]}>No service categories are available yet.</Text>
                <Text style={[styles.catalogStateText, { color: theme.colors.placeholder }]}>Please check back soon or contact support.</Text>
              </View>
            ) : (
              servicesByCategory.map(({ group, items }) => {
                const selectedCount = items.filter(item => item.selected).length;
                return (
                  <View key={group.id} style={[styles.categorySection, { borderColor: theme.colors.border }]}>
                    <View style={styles.categoryHeaderRow}>
                      <View style={[styles.categoryIconBox, { backgroundColor: group.iconBg }]}>
                        <MaterialCommunityIcons name={group.icon as any} size={18} color={group.iconColor} />
                      </View>
                      <View style={styles.categoryHeaderText}>
                        <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>{group.name}</Text>
                        {group.description ? (
                          <Text style={[styles.categoryDesc, { color: theme.colors.placeholder }]} numberOfLines={2}>{group.description}</Text>
                        ) : null}
                      </View>
                      {selectedCount > 0 && (
                        <View style={[styles.selectedPill, { backgroundColor: theme.colors.primary + '14' }]}>
                          <Text style={[styles.selectedPillText, { color: theme.colors.primary }]}>{selectedCount} selected</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.servicesContainer}>
                      {items.length === 0 && (
                        <Text style={[styles.categoryEmpty, { color: theme.colors.placeholder }]}>
                          No suggested services yet - add the ones you offer below.
                        </Text>
                      )}
                      {items.map((item) => (
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
                            <MaterialCommunityIcons
                              name={item.selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                              size={24}
                              color={item.selected ? theme.colors.primary : theme.colors.placeholder}
                            />
                            <View style={styles.serviceInfo}>
                              <Text style={[styles.serviceName, { color: theme.colors.text }]}>{item.name}</Text>
                              <Text style={[styles.serviceMeta, { color: theme.colors.placeholder }]}>
                                {item.duration} mins{item.isCustom ? ' · Your service' : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>

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

                    <TouchableOpacity
                      style={[styles.addCustomBtn, { borderColor: theme.colors.primary }]}
                      onPress={() => openCustomServiceModal(group.name)}
                    >
                      <MaterialCommunityIcons name="plus-circle-outline" size={18} color={theme.colors.primary} />
                      <Text style={[styles.addCustomBtnText, { color: theme.colors.primary }]}>Add a {group.name} service</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
              onPress={handleSaveServices}
              disabled={savingServices || catalogLoading || Boolean(catalogError)}
            >
              {savingServices ? (
                <ActivityIndicator color={onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-check" size={20} color={onPrimary} />
                  <Text style={[styles.saveBtnText, { color: onPrimary }]}>Save Services & Continue to Docs ➔</Text>
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

            {needsAction.documents && (
              <RedoNotice
                text={isRejected
                  ? 'Your application was rejected. Upload a new copy of each document marked "Rejected", then resubmit.'
                  : `Upload a new copy of the ${rejectedDocCount === 1 ? 'document' : 'documents'} marked "Rejected". Your other documents stay as they are.`}
              />
            )}

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
              // Latest upload for this document (older app versions could leave a rejected copy behind)
              const uploaded = [...(verificationDocuments || [])].reverse().find(d => d.name === doc.type || d.documentType === doc.type);
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
                      { backgroundColor: theme.colors.primaryContainer }
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
                        color={theme.colors.primary}
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
                { backgroundColor: theme.colors.primary }
              ]}
              onPress={handleSubmitForReview}
              disabled={submittingReview}
            >
              {submittingReview ? (
                <ActivityIndicator color={onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="send-check" size={22} color={onPrimary} />
                  <Text style={[styles.submitReviewBtnText, { color: onPrimary }]}>
                    {isRejected ? 'Resubmit Application for Approval' : isApproved ? 'Update & Re-Submit' : 'Submit for Super Admin Approval'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <LocationPromptModal
        code={locationPrompt}
        found={foundLocation}
        onAction={handleLocationPromptAction}
        onClose={() => {
          setLocationPrompt(null);
          setFoundLocation(null);
        }}
      />

      {/* Custom Service Modal */}
      <Modal visible={customModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add a Service</Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Category *</Text>
              <View style={styles.categoryChips}>
                {(catalog || []).map(group => {
                  const active = customCategory === group.name;
                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: active ? theme.colors.primary : theme.colors.background,
                          borderColor: active ? theme.colors.primary : theme.colors.border
                        }
                      ]}
                      onPress={() => setCustomCategory(group.name)}
                    >
                      <MaterialCommunityIcons name={group.icon as any} size={14} color={active ? onPrimary : group.iconColor} />
                      <Text style={[styles.categoryChipText, { color: active ? onPrimary : theme.colors.text }]}>{group.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

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
                <Text style={[styles.modalAddText, { color: onPrimary }]}>Add Service</Text>
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
    fontFamily: fonts.bold,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginTop: 2,
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
    fontFamily: fonts.bold,
  },
  statusSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginTop: 4,
    lineHeight: 17,
  },
  statusReason: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    marginTop: 6,
    lineHeight: 18,
  },
  tabDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  redoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  redoNoticeText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: fonts.medium,
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
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.bold,
  },
  sectionDesc: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
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
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  liveLocationBtn: {
    marginTop: 0,
  },
  liveLocationHint: {
    fontSize: 11.5,
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 16,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  photoHeaderLabel: {
    marginBottom: 0,
  },
  photoCount: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  photoHint: {
    fontSize: 11.5,
    fontFamily: fonts.regular,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 10,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GAP,
    marginBottom: 16,
  },
  photoTile: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photoTileFallback: {
    width: '30%',
    aspectRatio: 1,
  },
  photoDropZone: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  photoDropIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  photoDropTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  photoDropSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginTop: 3,
  },
  promptCard: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 14,
  },
  promptIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  promptTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    textAlign: 'center',
  },
  promptMessage: {
    fontSize: 13.5,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 18,
  },
  promptActionBtn: {
    alignSelf: 'stretch',
  },
  foundBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  foundAddress: {
    fontSize: 15,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  foundLine: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
    marginTop: 2,
  },
  foundCoords: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.85,
  },
  promptCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  promptCancelText: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddTile: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  // Services Styles
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  catalogState: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  catalogStateText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 4,
  },
  retryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  categorySection: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginBottom: 16,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  categoryIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeaderText: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  categoryDesc: {
    fontSize: 11.5,
    fontFamily: fonts.regular,
    marginTop: 1,
  },
  selectedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  selectedPillText: {
    fontSize: 10.5,
    fontFamily: fonts.bold,
  },
  categoryEmpty: {
    fontSize: 12,
    fontFamily: fonts.regular,
    fontStyle: 'italic',
  },
  serviceMeta: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    marginTop: 2,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  categoryChipText: {
    fontSize: 12.5,
    fontFamily: fonts.semiBold,
  },
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.bold,
    marginRight: 4,
  },
  priceInput: {
    fontSize: 14,
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  // Document Styles
  docSubheader: {
    fontSize: 14,
    fontFamily: fonts.bold,
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
    fontFamily: fonts.semiBold,
  },
  docStatusRow: {
    marginTop: 3,
  },
  docStatusText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  rejectDocReason: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 2,
    fontStyle: 'italic',
    fontFamily: fonts.regular,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.bold,
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
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.bold,
    fontSize: 14,
  },
});
