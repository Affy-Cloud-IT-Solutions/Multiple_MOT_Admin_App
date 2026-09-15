import React, { useState } from 'react';
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
  PermissionsAndroid,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { useAppTheme } from '../context/ThemeContext';
import { BASE_URL } from '../context/DataContext';
import {
  validatePhoneNumber,
  validateEmail,
  validatePassword
} from '../utils/validationUtils';

const DEFAULT_SLOT_PRESETS = [
  { label: 'Exterior / Frontage', url: 'https://images.unsplash.com/photo-1617886322168-72b886573c3c?w=800&h=500&fit=crop' },
  { label: 'MOT Testing Bay', url: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=500&fit=crop' },
  { label: 'Reception & Waiting Area', url: 'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=800&h=500&fit=crop' },
  { label: 'Workshop & Ramp Lifts', url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&h=500&fit=crop' },
  { label: 'Brake & Headlamp Testing Bay', url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=500&fit=crop' },
];

export default function SignupScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // STEP 1: Personal & Garage Info (Single Email & Single Phone)
  const [ownerName, setOwnerName] = useState('');
  const [garageName, setGarageName] = useState('');
  const [garageEmail, setGarageEmail] = useState('');
  const [garagePhone, setGaragePhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('18:00');
  const [description, setDescription] = useState('');

  // STEP 2: Location & 5 Garage Images
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('London');
  const [postcode, setPostcode] = useState('');
  const [latitude, setLatitude] = useState('51.5074');
  const [longitude, setLongitude] = useState('-0.1278');
  const [fetchingGPS, setFetchingGPS] = useState(false);
  const [locationLink, setLocationLink] = useState('');
  const [resolvingLink, setResolvingLink] = useState(false);
  const [lastAutofilledSource, setLastAutofilledSource] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([
    DEFAULT_SLOT_PRESETS[0].url,
    DEFAULT_SLOT_PRESETS[1].url,
    DEFAULT_SLOT_PRESETS[2].url,
    DEFAULT_SLOT_PRESETS[3].url,
    DEFAULT_SLOT_PRESETS[4].url,
  ]);
  const [activeImageSlot, setActiveImageSlot] = useState<number>(0);
  const [uploadingImage, setUploadingImage] = useState(false);

  // STEP 3: Legal & MOT Authorization Verification
  const [vtsNumber, setVtsNumber] = useState(''); // e.g. VTS-104928
  const [motAuthorisedExaminerNumber, setMotAuthorisedExaminerNumber] = useState(''); // e.g. AE-884920
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(''); // e.g. GB-9928174
  const [verificationDocuments, setVerificationDocuments] = useState<any[]>([
    { name: 'DVLA MOT Authorisation Certificate', fileUrl: 'https://mot-reminders.co.uk/docs/sample_mot_cert.pdf', documentType: 'MOT Certificate', status: 'Pending' },
    { name: 'Public Liability Insurance Certificate', fileUrl: 'https://mot-reminders.co.uk/docs/sample_liability_insurance.pdf', documentType: 'Public Liability Insurance', status: 'Pending' },
    { name: 'Local Council Trade License', fileUrl: 'https://mot-reminders.co.uk/docs/sample_trade_license.pdf', documentType: 'Trade Licence', status: 'Pending' }
  ]);
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('MOT Certificate');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [legalDeclaration, setLegalDeclaration] = useState(false);

  // Status & Navigation states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  // Helper for uploading files directly to backend
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
    return data.fileUrl || data.relativeUrl;
  };

  // Device Gallery Image Picker
  const handlePickImageFromGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      setUploadingImage(true);
      try {
        const uploadedUrl = await uploadToBackend(
          asset.uri, 
          asset.fileName || `garage_bay_${activeImageSlot + 1}.jpg`, 
          asset.type || 'image/jpeg', 
          'image'
        );
        handleUpdateImageSlot(uploadedUrl);
        Alert.alert('Upload Success', `Photo #${activeImageSlot + 1} uploaded from device gallery.`);
      } catch (uploadErr: any) {
        // Fallback to local URI
        handleUpdateImageSlot(asset.uri);
        Alert.alert('Device Photo Selected', `Photo #${activeImageSlot + 1} set from local device.`);
      }
    } catch (err: any) {
      console.error('Gallery picker error:', err);
      Alert.alert('Gallery Error', err.message || 'Could not open device photo gallery.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Device Camera Photo Capture
  const handleTakePhotoWithCamera = async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: false,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset.uri) return;

      setUploadingImage(true);
      try {
        const uploadedUrl = await uploadToBackend(
          asset.uri, 
          asset.fileName || `camera_bay_${activeImageSlot + 1}.jpg`, 
          asset.type || 'image/jpeg', 
          'image'
        );
        handleUpdateImageSlot(uploadedUrl);
        Alert.alert('Photo Captured', `Photo #${activeImageSlot + 1} captured and uploaded.`);
      } catch (uploadErr: any) {
        handleUpdateImageSlot(asset.uri);
        Alert.alert('Photo Selected', `Camera photo set for slot #${activeImageSlot + 1}.`);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      Alert.alert('Camera Notice', err.message || 'Could not access device camera.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Device Document Picker (PDF / DOC / Image certificates)
  const handlePickDocumentFromDevice = async () => {
    try {
      const results = await pick({
        type: [
          types.pdf,
          types.images,
          types.doc,
          types.docx,
          types.plainText
        ],
        allowMultiSelection: false
      });

      if (!results || results.length === 0) return;
      const result = results[0];
      if (!result.uri) return;

      setUploadingDoc(true);
      const title = newDocName.trim() || result.name || `${selectedDocType} Document`;
      try {
        const uploadedUrl = await uploadToBackend(
          result.uri,
          result.name || 'verification_cert.pdf',
          result.type || 'application/pdf',
          'document'
        );

        setVerificationDocuments([
          ...verificationDocuments,
          {
            name: title,
            fileUrl: uploadedUrl,
            documentType: selectedDocType,
            status: 'Pending',
            uploadDate: new Date().toISOString()
          }
        ]);
        setNewDocName('');
        Alert.alert('Document Uploaded', `"${title}" successfully uploaded and attached.`);
      } catch (uploadErr: any) {
        setVerificationDocuments([
          ...verificationDocuments,
          {
            name: title,
            fileUrl: result.uri,
            documentType: selectedDocType,
            status: 'Pending',
            uploadDate: new Date().toISOString()
          }
        ]);
        setNewDocName('');
        Alert.alert('Document Added', `"${title}" selected from device.`);
      }
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      console.error('Document picker error:', err);
      Alert.alert('Picker Notice', 'Could not open document picker. You can also paste document links directly.');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Validate Step 1
  const handleNextStep1 = () => {
    setErrorMessage(null);
    if (!garageName.trim()) {
      setErrorMessage('Please enter the official Garage Trade Name.');
      return;
    }
    const nameParts = ownerName.trim().split(/\s+/);
    if (nameParts.length < 2) {
      setErrorMessage('Please enter the owner / manager full name (first and last name).');
      return;
    }
    const emailVal = validateEmail(garageEmail);
    if (emailVal.error) {
      setErrorMessage(emailVal.error);
      return;
    }
    const mobileVal = validatePhoneNumber(garagePhone);
    if (mobileVal.error) {
      setErrorMessage(mobileVal.error);
      return;
    }
    const passwordVal = validatePassword(password);
    if (passwordVal.error) {
      setErrorMessage(passwordVal.error);
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setCurrentStep(2);
  };

  // Validate Step 2
  const handleNextStep2 = () => {
    setErrorMessage(null);
    if (!address.trim()) {
      setErrorMessage('Street address is required.');
      return;
    }
    if (!city.trim()) {
      setErrorMessage('City is required.');
      return;
    }
    if (!postcode.trim()) {
      setErrorMessage('Postcode is required.');
      return;
    }
    if (!latitude.trim() || isNaN(Number(latitude)) || !longitude.trim() || isNaN(Number(longitude))) {
      setErrorMessage('Valid latitude and longitude coordinates are required.');
      return;
    }

    const validImages = images.filter(img => Boolean(img && img.trim()));
    if (validImages.length < 5) {
      setErrorMessage('All 5 garage facility images are required.');
      return;
    }

    setCurrentStep(3);
  };

  // Set preset or custom image for slot
  const handleUpdateImageSlot = (url: string) => {
    if (!url.trim()) return;
    const next = [...images];
    next[activeImageSlot] = url.trim();
    setImages(next);
  };

  // Auto-fetch GPS coordinates from UK Postcode when user finishes typing
  const handlePostcodeBlur = async () => {
    if (!postcode.trim()) return;
    try {
      const clean = postcode.trim().replace(/\s+/g, '');
      const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          setLatitude(data.result.latitude.toFixed(6));
          setLongitude(data.result.longitude.toFixed(6));
          if (data.result.admin_district && (!city.trim() || city === 'London')) {
            setCity(data.result.admin_district);
          }
        }
      }
    } catch (e) {
      // Non-blocking background lookup
    }
  };

  // Helper: Reverse Geocode and Auto-fill Address, City, Postcode, Lat, Lon
  const reverseGeocodeAndAutofill = async (lat: number, lon: number, sourceLabel = 'Live GPS') => {
    const latStr = lat.toFixed(6);
    const lonStr = lon.toFixed(6);
    setLatitude(latStr);
    setLongitude(lonStr);

    let detectedAddress = '';
    let detectedCity = '';
    let detectedPostcode = '';

    // 1. Try UK Postcodes API if within UK territory
    try {
      const ukPcRes = await fetch(`https://api.postcodes.io/postcodes?lon=${lon}&lat=${lat}`);
      if (ukPcRes.ok) {
        const ukPcData = await ukPcRes.json();
        if (ukPcData.result && ukPcData.result.length > 0) {
          const match = ukPcData.result[0];
          if (match.postcode) detectedPostcode = match.postcode;
          if (match.admin_district || match.parish) detectedCity = match.admin_district || match.parish;
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. OpenStreetMap Nominatim for exact street & road address
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        {
          headers: { 'User-Agent': 'MultipleMOT-AdminApp/1.0' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (osmRes.ok) {
        const osmData = await osmRes.json();
        const addr = osmData.address || {};

        // Construct building & road address
        const streetParts = [
          addr.house_number || addr.building,
          addr.road || addr.street || addr.industrial || addr.commercial,
          addr.neighbourhood || addr.suburb || addr.quarter,
        ].filter(Boolean);

        if (streetParts.length > 0) {
          detectedAddress = streetParts.join(', ');
        } else if (osmData.display_name) {
          detectedAddress = osmData.display_name.split(',').slice(0, 3).join(',').trim();
        }

        if (!detectedCity) {
          detectedCity = addr.city || addr.town || addr.village || addr.municipality || addr.state_district || addr.county || '';
        }

        if (!detectedPostcode) {
          detectedPostcode = addr.postcode || '';
        }
      }
    } catch (e) {
      // ignore
    }

    // Apply auto-filled fields
    if (detectedAddress) setAddress(detectedAddress);
    if (detectedCity) setCity(detectedCity);
    if (detectedPostcode) setPostcode(detectedPostcode);
    setLastAutofilledSource(sourceLabel);

    Alert.alert(
      'Location Auto-Filled',
      `Details successfully fetched from ${sourceLabel}:\n\n` +
      `📍 Address: ${detectedAddress || address || 'Coordinates set'}\n` +
      `🏙️ City: ${detectedCity || city || 'N/A'}\n` +
      `📮 Postcode: ${detectedPostcode || postcode || 'N/A'}\n` +
      `🌐 Coordinates: ${latStr}, ${lonStr}`
    );
  };

  // Helper: Extract Coordinates from Google Maps / Apple Maps / Raw Coordinates Link
  const handleExtractFromLocationLink = async () => {
    const raw = locationLink.trim();
    if (!raw) {
      Alert.alert('Empty Link', 'Please paste a Google Maps link, share URL, or latitude/longitude coordinates.');
      return;
    }

    setResolvingLink(true);
    try {
      let targetText = raw;

      // If shortened URL (e.g. maps.app.goo.gl or goo.gl/maps), try to fetch redirect location
      if (raw.includes('maps.app.goo.gl') || raw.includes('goo.gl/maps')) {
        try {
          const redirectRes = await fetch(raw, { method: 'HEAD' } as any);
          if (redirectRes.url) {
            targetText = redirectRes.url;
          }
        } catch (e) {
          // continue with raw
        }
      }

      // Regex 1: /@(-?\d+\.\d+),(-?\d+\.\d+)
      const atMatch = targetText.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        const lat = parseFloat(atMatch[1]);
        const lon = parseFloat(atMatch[2]);
        await reverseGeocodeAndAutofill(lat, lon, 'Google Maps Link');
        return;
      }

      // Regex 2: [?&](?:q|ll|destination|center)=(-?\d+\.\d+)[,+](-?\d+\.\d+)
      const qMatch = targetText.match(/[?&](?:q|ll|destination|center|point)=(-?\d+\.\d+)[,+](-?\d+\.\d+)/);
      if (qMatch) {
        const lat = parseFloat(qMatch[1]);
        const lon = parseFloat(qMatch[2]);
        await reverseGeocodeAndAutofill(lat, lon, 'Maps Link');
        return;
      }

      // Regex 3: geo:(-?\d+\.\d+),(-?\d+\.\d+)
      const geoMatch = targetText.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (geoMatch) {
        const lat = parseFloat(geoMatch[1]);
        const lon = parseFloat(geoMatch[2]);
        await reverseGeocodeAndAutofill(lat, lon, 'Geo URI');
        return;
      }

      // Regex 4: Direct pair e.g. "51.5014, -0.0910" or "51.5014 -0.0910"
      const pairMatch = targetText.match(/(-?\d+\.\d{3,})[\s,]+(-?\d+\.\d{3,})/);
      if (pairMatch) {
        const lat = parseFloat(pairMatch[1]);
        const lon = parseFloat(pairMatch[2]);
        await reverseGeocodeAndAutofill(lat, lon, 'Coordinate Text');
        return;
      }

      Alert.alert(
        'Could Not Parse Link',
        'Could not find coordinates in this link. Please ensure it is a Google Maps pin link (e.g. maps.google.com/?q=51.5014,-0.0910) or enter Latitude and Longitude directly.'
      );
    } catch (err: any) {
      Alert.alert('Link Error', err.message || 'Failed to process location link.');
    } finally {
      setResolvingLink(false);
    }
  };

  // Live GPS Location Fetcher (Hardware GPS -> UK Postcode Geocoding -> Live Network fallback)
  const handleUseCurrentGPS = async () => {
    setFetchingGPS(true);

    const tryDeviceGPS = (): Promise<{ latitude: number; longitude: number } | null> => {
      return new Promise(async (resolve) => {
        try {
          if (Platform.OS === 'android') {
            try {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                  title: 'Location Permission',
                  message: 'Multiple MOT needs access to your GPS to automatically set your garage location.',
                  buttonNeutral: 'Ask Later',
                  buttonNegative: 'Cancel',
                  buttonPositive: 'Allow',
                }
              );
              if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                resolve(null);
                return;
              }
            } catch (pErr) {
              // permission request failed/cancelled
            }
          }

          // Try native geolocation if linked
          try {
            const Geo = require('@react-native-community/geolocation');
            const geoInstance = Geo?.default || Geo;
            if (geoInstance && geoInstance.getCurrentPosition) {
              geoInstance.getCurrentPosition(
                (pos: any) => {
                  if (pos && pos.coords) {
                    resolve({
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                    });
                  } else {
                    resolve(null);
                  }
                },
                () => {
                  resolve(null);
                },
                { enableHighAccuracy: true, timeout: 7000, maximumAge: 10000 }
              );
              return;
            }
          } catch (geoModuleErr) {
            // Geolocation native module not yet linked in running binary, continue to network geolocation
          }

          // Try navigator.geolocation if polyfilled
          const globalNav = (globalThis as any).navigator;
          if (globalNav && globalNav.geolocation) {
            globalNav.geolocation.getCurrentPosition(
              (pos: any) => {
                if (pos && pos.coords) {
                  resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  });
                } else {
                  resolve(null);
                }
              },
              () => resolve(null),
              { enableHighAccuracy: true, timeout: 6000 }
            );
            return;
          }

          resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    };

    try {
      // 1. Hardware GPS Detection
      const coords = await tryDeviceGPS();

      if (coords && coords.latitude && coords.longitude) {
        await reverseGeocodeAndAutofill(coords.latitude, coords.longitude, 'Live Device GPS');
        return;
      }

      // 2. Fallback: Live IP / Network Geolocation via ipwho.is
      try {
        const ipRes = await fetch('https://ipwho.is/');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.success !== false && ipData.latitude && ipData.longitude) {
            await reverseGeocodeAndAutofill(Number(ipData.latitude), Number(ipData.longitude), 'Live Network Location');
            return;
          }
        }
      } catch (ipErr) {
        // ignore
      }

      // 3. Fallback: If user has entered a UK postcode
      if (postcode.trim()) {
        const cleanPostcode = postcode.trim().replace(/\s+/g, '');
        const pcRes = await fetch(`https://api.postcodes.io/postcodes/${cleanPostcode}`);
        if (pcRes.ok) {
          const pcData = await pcRes.json();
          if (pcData.result) {
            await reverseGeocodeAndAutofill(pcData.result.latitude, pcData.result.longitude, `UK Postcode (${postcode.toUpperCase()})`);
            return;
          }
        }
      }

      // 4. Default fallback if all offline
      await reverseGeocodeAndAutofill(51.5074, -0.1278, 'London Default');
    } catch (finalErr: any) {
      console.error('GPS lookup error:', finalErr);
      Alert.alert('Location Notice', 'Could not retrieve live GPS location. You can paste a Google Maps link or enter address manually.');
    } finally {
      setFetchingGPS(false);
    }
  };

  // Add custom doc
  const handleAddDocument = () => {
    if (!newDocName.trim() || !newDocUrl.trim()) {
      Alert.alert('Incomplete Document', 'Please enter both the document title and certificate link/URL.');
      return;
    }
    setVerificationDocuments([
      ...verificationDocuments,
      { name: newDocName.trim(), fileUrl: newDocUrl.trim(), documentType: selectedDocType, status: 'Pending' }
    ]);
    setNewDocName('');
    setNewDocUrl('');
  };

  const handleRemoveDoc = (index: number) => {
    setVerificationDocuments(verificationDocuments.filter((_, i) => i !== index));
  };

  // Submit complete 3-Step Garage Admin Registration
  const handleSubmitRegistration = async () => {
    setErrorMessage(null);
    if (!vtsNumber.trim()) {
      setErrorMessage('DVLA Vehicle Testing Station (VTS) Site Number is required.');
      return;
    }
    if (!motAuthorisedExaminerNumber.trim()) {
      setErrorMessage('MOT Authorised Examiner (AE) Number is required.');
      return;
    }
    if (!legalDeclaration) {
      setErrorMessage('You must certify the legal declaration to submit your application.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: garageName.trim(),
        address: address.trim(),
        city: city.trim(),
        postcode: postcode.trim().toUpperCase(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        phone: garagePhone.trim(),
        email: garageEmail.trim().toLowerCase(),
        openingTime,
        closingTime,
        description: description.trim() || `Official UK MOT Testing Station and Vehicle Service Hub (${vtsNumber.trim()}).`,
        ownerName: ownerName.trim(),
        ownerEmail: garageEmail.trim().toLowerCase(),
        ownerPassword: password.trim(),
        images,
        logoUrl: images[0],
        vtsNumber: vtsNumber.trim().toUpperCase(),
        motAuthorisedExaminerNumber: motAuthorisedExaminerNumber.trim().toUpperCase(),
        businessRegistrationNumber: businessRegistrationNumber.trim().toUpperCase(),
        verificationDocuments,
        legalDeclaration: true
      };

      const res = await fetch(`${BASE_URL}/garages/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to submit garage registration.');
        return;
      }

      setSuccessModalVisible(true);
    } catch (err: any) {
      setLoading(false);
      console.error('Registration submission error:', err);
      setErrorMessage('Could not connect to the backend server. Please verify your network.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Header Branding */}
        <View style={styles.headerContainer}>
          <View style={[styles.badgeContainer, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="shield-car" size={32} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Garage Admin Onboarding</Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            Register your authorized MOT testing station in 3 simple steps
          </Text>
        </View>

        {/* 3-Step Progress Indicator */}
        <View style={styles.stepperWrapper}>
          <View style={styles.stepperContainer}>
            {/* Step 1 */}
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle, 
                currentStep === 1 
                  ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } 
                  : currentStep > 1 
                    ? { backgroundColor: theme.colors.success, borderColor: theme.colors.success } 
                    : { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
              ]}>
                {currentStep > 1 ? (
                  <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.stepNumber, { color: currentStep === 1 ? '#FFFFFF' : theme.colors.placeholder }]}>1</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, { color: currentStep === 1 ? theme.colors.primary : theme.colors.placeholder }]}>
                Personal & Garage
              </Text>
            </View>

            {/* Line 1 */}
            <View style={[styles.stepLine, { backgroundColor: currentStep > 1 ? theme.colors.success : theme.colors.border }]} />

            {/* Step 2 */}
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle, 
                currentStep === 2 
                  ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } 
                  : currentStep > 2 
                    ? { backgroundColor: theme.colors.success, borderColor: theme.colors.success } 
                    : { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
              ]}>
                {currentStep > 2 ? (
                  <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.stepNumber, { color: currentStep === 2 ? '#FFFFFF' : theme.colors.placeholder }]}>2</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, { color: currentStep === 2 ? theme.colors.primary : theme.colors.placeholder }]}>
                Location & 5 Photos
              </Text>
            </View>

            {/* Line 2 */}
            <View style={[styles.stepLine, { backgroundColor: currentStep > 2 ? theme.colors.success : theme.colors.border }]} />

            {/* Step 3 */}
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle, 
                currentStep === 3 
                  ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } 
                  : { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
              ]}>
                <Text style={[styles.stepNumber, { color: currentStep === 3 ? '#FFFFFF' : theme.colors.placeholder }]}>3</Text>
              </View>
              <Text style={[styles.stepLabel, { color: currentStep === 3 ? theme.colors.primary : theme.colors.placeholder }]}>
                Legal & Verification
              </Text>
            </View>
          </View>
        </View>

        {/* Form Container Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>

          {errorMessage && (
            <View style={[styles.errorBox, { borderColor: theme.colors.error + '40', backgroundColor: theme.colors.error + '10' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.colors.error} style={{ marginRight: 8 }} />
              <Text style={[styles.errorBoxText, { color: theme.colors.error }]}>{errorMessage}</Text>
            </View>
          )}

          {/* ================= STEP 1: PERSONAL & GARAGE INFO ================= */}
          {currentStep === 1 && (
            <View>
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Garage & Account Details</Text>
              
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Garage Trade Name *</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="store-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  value={garageName}
                  onChangeText={setGarageName}
                  placeholder="E.g. Apex MOT & Service Centre"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Owner / Manager Full Name *</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="account-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  value={ownerName}
                  onChangeText={setOwnerName}
                  placeholder="E.g. David Harrison"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Garage Email (Login & Contact) *</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  value={garageEmail}
                  onChangeText={setGarageEmail}
                  placeholder="E.g. info@apexmot.co.uk"
                  placeholderTextColor={theme.colors.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Garage Phone Number *</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="phone-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  value={garagePhone}
                  onChangeText={setGaragePhone}
                  placeholder="E.g. 020 7946 0192"
                  placeholderTextColor={theme.colors.placeholder}
                  keyboardType="phone-pad"
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Password *</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor={theme.colors.placeholder}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      style={[styles.input, { color: theme.colors.text }]}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.placeholder} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Confirm *</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      placeholderTextColor={theme.colors.placeholder}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      style={[styles.input, { color: theme.colors.text }]}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                      <MaterialCommunityIcons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.placeholder} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Operating Hours & Bio</Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Opening Time</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <TextInput
                      value={openingTime}
                      onChangeText={setOpeningTime}
                      placeholder="08:00"
                      placeholderTextColor={theme.colors.placeholder}
                      style={[styles.input, { color: theme.colors.text }]}
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Closing Time</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <TextInput
                      value={closingTime}
                      onChangeText={setClosingTime}
                      placeholder="18:00"
                      placeholderTextColor={theme.colors.placeholder}
                      style={[styles.input, { color: theme.colors.text }]}
                    />
                  </View>
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Garage Bio / Description</Text>
              <View style={[styles.textAreaContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your testing station facilities, certified technicians, and MOT services..."
                  placeholderTextColor={theme.colors.placeholder}
                  multiline
                  numberOfLines={3}
                  style={[styles.textArea, { color: theme.colors.text }]}
                />
              </View>

              <TouchableOpacity
                onPress={handleNextStep1}
                style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={styles.primaryButtonText}>Next: Location & 5 Photos →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= STEP 2: LOCATION & 5 GARAGE IMAGES ================= */}
          {currentStep === 2 && (
            <View>
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Garage Location & GPS</Text>
              
              {/* Smart Auto-Fill Location Options Card */}
              <View style={[styles.autofillCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.autofillHeader}>
                  <MaterialCommunityIcons name="map-marker-radius" size={20} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.autofillTitle, { color: theme.colors.text }]}>Smart Location Auto-Fill</Text>
                </View>
                <Text style={[styles.autofillSubtitle, { color: theme.colors.placeholder }]}>
                  Auto-fill street address, city, postcode and exact coordinates from your live GPS or by pasting a Google Maps link.
                </Text>

                {/* Option 1: Live GPS Button */}
                <TouchableOpacity
                  onPress={handleUseCurrentGPS}
                  disabled={fetchingGPS || resolvingLink}
                  style={[styles.liveGpsBtn, { backgroundColor: theme.colors.primary, opacity: (fetchingGPS || resolvingLink) ? 0.7 : 1 }]}
                >
                  {fetchingGPS ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  ) : (
                    <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.liveGpsBtnText}>
                    {fetchingGPS ? 'Detecting & Auto-Filling...' : 'Auto-Fill from Live GPS Location'}
                  </Text>
                </TouchableOpacity>

                {/* OR Divider */}
                <View style={styles.orDividerRow}>
                  <View style={[styles.orDividerLine, { backgroundColor: theme.colors.border }]} />
                  <Text style={[styles.orDividerText, { color: theme.colors.placeholder }]}>OR PASTE MAPS LINK</Text>
                  <View style={[styles.orDividerLine, { backgroundColor: theme.colors.border }]} />
                </View>

                {/* Option 2: Paste Google Maps Link */}
                <View style={styles.linkInputRow}>
                  <View style={[styles.linkInputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <MaterialCommunityIcons name="link-variant" size={18} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                    <TextInput
                      value={locationLink}
                      onChangeText={setLocationLink}
                      placeholder="Paste Google Maps URL or coordinates..."
                      placeholderTextColor={theme.colors.placeholder}
                      style={[styles.linkInput, { color: theme.colors.text }]}
                      autoCapitalize="none"
                    />
                    {locationLink.length > 0 && (
                      <TouchableOpacity onPress={() => setLocationLink('')} style={{ padding: 4 }}>
                        <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={handleExtractFromLocationLink}
                    disabled={fetchingGPS || resolvingLink}
                    style={[styles.linkFetchBtn, { backgroundColor: theme.colors.secondary, opacity: (fetchingGPS || resolvingLink) ? 0.7 : 1 }]}
                  >
                    {resolvingLink ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="cloud-download-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.linkFetchBtnText}>Auto-Fill</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Success pill if auto-filled */}
                {lastAutofilledSource && (
                  <View style={[styles.autofillSuccessBanner, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
                    <MaterialCommunityIcons name="check-circle" size={14} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={styles.autofillSuccessText} numberOfLines={1}>
                      Auto-filled via {lastAutofilledSource}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Street Address *</Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="E.g. 10 Industrial Estate, London Road"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>City *</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholder="London"
                      placeholderTextColor={theme.colors.placeholder}
                      style={[styles.input, { color: theme.colors.text }]}
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Postcode *</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <TextInput
                      value={postcode}
                      onChangeText={setPostcode}
                      onBlur={handlePostcodeBlur}
                      placeholder="SE1 7PB"
                      placeholderTextColor={theme.colors.placeholder}
                      autoCapitalize="characters"
                      style={[styles.input, { color: theme.colors.text }]}
                    />
                  </View>
                </View>
              </View>

              {/* Coordinates Section */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={[styles.inputLabel, { color: theme.colors.text, marginBottom: 0 }]}>GPS Coordinates *</Text>
                <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: '600' }}>
                  {fetchingGPS ? 'Locating...' : 'Auto-filled or manual'}
                </Text>
              </View>

              <View style={styles.gpsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.placeholder, fontSize: 11 }]}>Latitude</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <TextInput
                      value={latitude}
                      onChangeText={setLatitude}
                      placeholder="51.5074"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      style={[styles.input, { color: theme.colors.text }]}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, marginHorizontal: 8 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.placeholder, fontSize: 11 }]}>Longitude</Text>
                  <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                    <TextInput
                      value={longitude}
                      onChangeText={setLongitude}
                      placeholder="-0.1278"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      style={[styles.input, { color: theme.colors.text }]}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleUseCurrentGPS}
                  disabled={fetchingGPS}
                  style={[styles.gpsButton, { backgroundColor: theme.colors.primary + '20', opacity: fetchingGPS ? 0.6 : 1 }]}
                >
                  {fetchingGPS ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <MaterialCommunityIcons name="crosshairs-gps" size={22} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              </View>


              <View style={styles.divider} />

              {/* 5 Mandatory Garage Images Gallery Section */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>
                  Garage Photos (5 Required)
                </Text>
                <View style={[styles.countBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.primary }}>5/5 Ready</Text>
                </View>
              </View>
              <Text style={[styles.helperText, { color: theme.colors.placeholder }]}>
                These 5 photos are presented to customers on the portal and reviewed by Super Admin for authorization.
              </Text>

              {/* 5 Image Slots Selector */}
              <View style={styles.slotsRow}>
                {images.map((imgUrl, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setActiveImageSlot(idx)}
                    style={[
                      styles.slotThumbWrapper,
                      {
                        borderColor: activeImageSlot === idx ? theme.colors.primary : theme.colors.border,
                        borderWidth: activeImageSlot === idx ? 2 : 1,
                      }
                    ]}
                  >
                    <Image source={{ uri: imgUrl }} style={styles.slotThumbImage} />
                    <View style={[styles.slotBadge, { backgroundColor: activeImageSlot === idx ? theme.colors.primary : 'rgba(0,0,0,0.6)' }]}>
                      <Text style={styles.slotBadgeText}>#{idx + 1}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Active Image Slot Editor */}
              <View style={[styles.activeSlotCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="camera" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.activeSlotTitle, { color: theme.colors.text }]}>
                      Photo #{activeImageSlot + 1}: {DEFAULT_SLOT_PRESETS[activeImageSlot]?.label || 'Facility View'}
                    </Text>
                  </View>
                  {uploadingImage && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: 'bold' }}>Uploading...</Text>
                    </View>
                  )}
                </View>

                {/* Device Upload Action Buttons */}
                <View style={styles.deviceBtnRow}>
                  <TouchableOpacity
                    onPress={handleTakePhotoWithCamera}
                    disabled={uploadingImage}
                    style={[styles.deviceUploadBtn, { backgroundColor: theme.colors.primary, opacity: uploadingImage ? 0.6 : 1 }]}
                  >
                    <MaterialCommunityIcons name="camera-plus" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.deviceUploadBtnText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handlePickImageFromGallery}
                    disabled={uploadingImage}
                    style={[styles.deviceUploadBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary, borderWidth: 1, opacity: uploadingImage ? 0.6 : 1 }]}
                  >
                    <MaterialCommunityIcons name="image-album" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.deviceUploadBtnText, { color: theme.colors.primary }]}>Device Gallery</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
                  <Text style={{ marginHorizontal: 8, fontSize: 10, color: theme.colors.placeholder, fontWeight: '600' }}>OR CUSTOM URL / PRESET</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
                </View>

                <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                  <TextInput
                    value={images[activeImageSlot]}
                    onChangeText={(val) => {
                      const next = [...images];
                      next[activeImageSlot] = val;
                      setImages(next);
                    }}
                    placeholder="Enter Image URL for this photo slot"
                    placeholderTextColor={theme.colors.placeholder}
                    style={[styles.input, { color: theme.colors.text }]}
                  />
                </View>

                {/* Preset quick picker */}
                <Text style={[styles.subLabel, { color: theme.colors.placeholder }]}>Quick stock preset photos:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 4 }}>
                  {DEFAULT_SLOT_PRESETS.map((preset, pIdx) => (
                    <TouchableOpacity
                      key={pIdx}
                      onPress={() => handleUpdateImageSlot(preset.url)}
                      style={[styles.presetChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    >
                      <Text style={[styles.presetChipText, { color: theme.colors.text }]}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Step Navigation Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={() => setCurrentStep(1)}
                  style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>← Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNextStep2}
                  style={[styles.primaryButton, { flex: 1, backgroundColor: theme.colors.primary }]}
                >
                  <Text style={styles.primaryButtonText}>Next: Verification Documents →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================= STEP 3: LEGAL & MOT AUTHORIZATION VERIFICATION ================= */}
          {currentStep === 3 && (
            <View>
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>DVLA MOT Authorization</Text>
              
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                DVLA Vehicle Testing Station (VTS) Number *
              </Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="card-account-details-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  value={vtsNumber}
                  onChangeText={setVtsNumber}
                  placeholder="E.g. VTS-104928"
                  placeholderTextColor={theme.colors.placeholder}
                  autoCapitalize="characters"
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                MOT Authorised Examiner (AE) Number *
              </Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="shield-check-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  value={motAuthorisedExaminerNumber}
                  onChangeText={setMotAuthorisedExaminerNumber}
                  placeholder="E.g. AE-884920"
                  placeholderTextColor={theme.colors.placeholder}
                  autoCapitalize="characters"
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Companies House / Business Registration Number
              </Text>
              <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="office-building-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  value={businessRegistrationNumber}
                  onChangeText={setBusinessRegistrationNumber}
                  placeholder="E.g. GB-9928174"
                  placeholderTextColor={theme.colors.placeholder}
                  autoCapitalize="characters"
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>

              <View style={styles.divider} />
              
              {/* Verification Documents List */}
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>Verification Certificates ({verificationDocuments.length})</Text>
              <Text style={[styles.helperText, { color: theme.colors.placeholder }]}>
                Super Admin will examine these documents before granting platform authorization.
              </Text>

              {verificationDocuments.map((doc, dIdx) => (
                <View key={dIdx} style={[styles.docItemCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <View style={[styles.docIconWrapper, { backgroundColor: theme.colors.primary + '15' }]}>
                    <MaterialCommunityIcons 
                      name={doc.fileUrl?.endsWith('.pdf') ? 'file-pdf-box' : 'file-certificate-outline'} 
                      size={22} 
                      color={theme.colors.primary} 
                    />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.docNameText, { color: theme.colors.text }]} numberOfLines={1}>{doc.name}</Text>
                    <Text style={[styles.docUrlText, { color: theme.colors.placeholder }]} numberOfLines={1}>{doc.fileUrl}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveDoc(dIdx)} style={styles.docRemoveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Upload Document from Device Box */}
              <View style={[styles.deviceUploadCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <MaterialCommunityIcons name="cloud-upload" size={20} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.deviceCardTitle, { color: theme.colors.text }]}>Upload Document from Device</Text>
                </View>

                <TextInput
                  value={newDocName}
                  onChangeText={setNewDocName}
                  placeholder="Document Name / Title (Optional)"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.smallInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background, marginBottom: 10 }]}
                />

                <TouchableOpacity
                  onPress={handlePickDocumentFromDevice}
                  disabled={uploadingDoc}
                  style={[styles.primaryButton, { backgroundColor: theme.colors.primary, opacity: uploadingDoc ? 0.6 : 1, flexDirection: 'row' }]}
                >
                  {uploadingDoc ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryButtonText}>Uploading from Device...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="upload" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryButtonText}>Browse & Upload File</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Add Custom Document Link Box */}
              <View style={[styles.addDocBox, { borderColor: theme.colors.border }]}>
                <Text style={[styles.subLabel, { color: theme.colors.text, fontWeight: 'bold' }]}>Or Attach Direct Document Link / URL:</Text>
                <TextInput
                  value={newDocName}
                  onChangeText={setNewDocName}
                  placeholder="Document Title (e.g. Health & Safety Certificate)"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.smallInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                />
                <TextInput
                  value={newDocUrl}
                  onChangeText={setNewDocUrl}
                  placeholder="Certificate Link / URL (PDF/Image)"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.smallInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                />
                <TouchableOpacity onPress={handleAddDocument} style={[styles.addDocBtn, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="plus" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                  <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 13 }}>Add Link Document</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Legal Declaration Checkbox */}
              <TouchableOpacity
                onPress={() => setLegalDeclaration(!legalDeclaration)}
                style={styles.declarationRow}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={legalDeclaration ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={24}
                  color={legalDeclaration ? theme.colors.primary : theme.colors.placeholder}
                  style={{ marginRight: 10, marginTop: 2 }}
                />
                <Text style={[styles.declarationText, { color: theme.colors.text }]}>
                  I legally declare that this facility is officially authorized by the DVLA to conduct MOT tests and all submitted license certifications are valid, authentic, and up to date.
                </Text>
              </TouchableOpacity>

              {/* Submit Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity
                  onPress={() => setCurrentStep(2)}
                  style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>← Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmitRegistration}
                  disabled={loading}
                  style={[styles.primaryButton, { flex: 1, backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit for Approval ✓</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Footer Navigation */}
        <View style={styles.footerContainer}>
          <Text style={{ color: theme.colors.placeholder }}>Already an approved garage? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.loginText, { color: theme.colors.secondary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Success / Pending Approval Modal */}
        <Modal
          visible={successModalVisible}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.successModalCard, { backgroundColor: theme.colors.card }]}>
              <View style={[styles.modalIconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
                <MaterialCommunityIcons name="clock-check-outline" size={54} color={theme.colors.primary} />
              </View>

              <Text style={[styles.modalSuccessTitle, { color: theme.colors.text }]}>
                Application Submitted!
              </Text>
              <Text style={[styles.modalSuccessSubtitle, { color: theme.colors.placeholder }]}>
                Your garage onboarding application with 5 facility photos and DVLA MOT certification credentials has been submitted for Platform Super Admin review.
              </Text>

              <View style={[styles.modalInfoBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <View style={styles.modalInfoRow}>
                  <Text style={[styles.modalInfoLabel, { color: theme.colors.placeholder }]}>Status:</Text>
                  <Text style={[styles.modalInfoValue, { color: '#F59E0B', fontWeight: 'bold' }]}>Pending Approval</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={[styles.modalInfoLabel, { color: theme.colors.placeholder }]}>VTS Number:</Text>
                  <Text style={[styles.modalInfoValue, { color: theme.colors.text }]}>{vtsNumber || 'VTS Registered'}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={[styles.modalInfoLabel, { color: theme.colors.placeholder }]}>Login Access:</Text>
                  <Text style={[styles.modalInfoValue, { color: theme.colors.placeholder }]}>Enabled upon approval</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setSuccessModalVisible(false);
                  navigation.navigate('Login');
                }}
                style={[styles.primaryButton, { width: '100%', backgroundColor: theme.colors.primary }]}
              >
                <Text style={styles.primaryButtonText}>Return to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 18,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  badgeContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  stepperWrapper: {
    marginBottom: 18,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  stepItem: {
    alignItems: 'center',
    width: 90,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginTop: -16,
  },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    padding: 0,
  },
  eyeIcon: {
    padding: 4,
  },
  textAreaContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  textArea: {
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 60,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.2)',
    marginVertical: 14,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  gpsButton: {
    height: 44,
    width: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  helperText: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  slotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  slotThumbWrapper: {
    width: 54,
    height: 54,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  slotThumbImage: {
    width: '100%',
    height: '100%',
  },
  slotBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 1,
  },
  slotBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  activeSlotCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  activeSlotTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  deviceBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  deviceUploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 7,
  },
  deviceUploadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  deviceUploadCard: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  deviceCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  docIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  docNameText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  docUrlText: {
    fontSize: 11,
    marginTop: 2,
  },
  docRemoveBtn: {
    padding: 4,
    marginLeft: 4,
  },
  addDocBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  smallInput: {
    borderWidth: 1,
    borderRadius: 6,
    height: 38,
    paddingHorizontal: 10,
    fontSize: 12,
    marginTop: 6,
  },
  addDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  declarationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  declarationText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  primaryButton: {
    height: 46,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  secondaryButton: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    fontWeight: 'bold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorBoxText: {
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalSuccessTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSuccessSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInfoBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalInfoLabel: {
    fontSize: 12,
  },
  modalInfoValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  autofillCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  autofillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  autofillTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  autofillSubtitle: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  liveGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    elevation: 1,
  },
  liveGpsBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
  },
  orDividerText: {
    fontSize: 10,
    fontWeight: '700',
    marginHorizontal: 8,
    letterSpacing: 0.5,
  },
  linkInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  linkInput: {
    flex: 1,
    fontSize: 12,
    height: '100%',
    paddingVertical: 0,
  },
  linkFetchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 8,
  },
  linkFetchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  autofillSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  autofillSuccessText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
});
