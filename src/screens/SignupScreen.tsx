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

const DOCUMENT_CHECKLIST = [
  { type: 'VTS Certificate', label: 'DVLA VTS Authorisation Certificate', required: true, icon: 'shield-car' },
  { type: 'AE Certificate', label: 'MOT Authorised Examiner (AE) Certificate', required: true, icon: 'card-account-details-outline' },
  { type: 'Public Liability Insurance', label: 'Public Liability Insurance', required: true, icon: 'shield-account-outline' },
  { type: 'Business Registration', label: 'Company / Business Proof', required: false, icon: 'office-building-outline' },
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

  // STEP 2: Location & 3 Garage Images
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('London');
  const [postcode, setPostcode] = useState('');
  const [latitude, setLatitude] = useState('51.5074');
  const [longitude, setLongitude] = useState('-0.1278');
  const [fetchingGPS, setFetchingGPS] = useState(false);
  const [locationLink, setLocationLink] = useState('');
  const [resolvingLink, setResolvingLink] = useState(false);
  const [lastAutofilledSource, setLastAutofilledSource] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // STEP 3: Legal & MOT Authorization Verification
  const [vtsNumber, setVtsNumber] = useState(''); // e.g. VTS-104928
  const [motAuthorisedExaminerNumber, setMotAuthorisedExaminerNumber] = useState(''); // e.g. AE-884920
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(''); // e.g. GB-9928174
  const [verificationDocuments, setVerificationDocuments] = useState<any[]>([]);
  const [additionalDocName, setAdditionalDocName] = useState('');
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
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

  // Device Camera Photo Capture
  const handleTakePhoto = async () => {
    if (images.length >= 3) {
      Alert.alert('Limit Reached', 'You have already uploaded 3 photos. Tap the (X) on any photo to remove or replace it.');
      return;
    }
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
          asset.fileName || `garage_photo_${images.length + 1}.jpg`,
          asset.type || 'image/jpeg',
          'image'
        );
        setImages(prev => [...prev, uploadedUrl]);
      } catch (uploadErr: any) {
        setImages(prev => [...prev, asset.uri!]);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      Alert.alert('Camera Error', err.message || 'Could not access device camera.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Upload Photo from Device Gallery
  const handleUploadFromGallery = async () => {
    if (images.length >= 3) {
      Alert.alert('Limit Reached', 'You have already uploaded 3 photos. Tap the (X) on any photo to remove or replace it.');
      return;
    }
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 3 - images.length,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      setUploadingImage(true);
      try {
        const newUrls: string[] = [];
        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          if (!asset.uri) continue;
          try {
            const uploadedUrl = await uploadToBackend(
              asset.uri,
              asset.fileName || `garage_photo_${images.length + i + 1}.jpg`,
              asset.type || 'image/jpeg',
              'image'
            );
            newUrls.push(uploadedUrl);
          } catch {
            newUrls.push(asset.uri);
          }
        }
        setImages(prev => [...prev, ...newUrls].slice(0, 3));
      } catch (uploadErr: any) {
        console.error('Upload error:', uploadErr);
      }
    } catch (err: any) {
      console.error('Gallery picker error:', err);
      Alert.alert('Gallery Error', err.message || 'Could not open device photo gallery.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Document Upload Handler
  const handleUploadDocument = async (docType: string, defaultTitle: string) => {
    try {
      const results = await pick({
        type: [types.pdf, types.images, types.doc, types.docx],
        allowMultiSelection: false,
      });

      if (!results || results.length === 0) return;
      const result = results[0];
      if (!result.uri) return;

      setUploadingDocType(docType);
      const fileName = result.name || `${defaultTitle}.pdf`;

      try {
        const uploadedUrl = await uploadToBackend(
          result.uri,
          fileName,
          result.type || 'application/pdf',
          'document'
        );

        setVerificationDocuments(prev => {
          const filtered = prev.filter(d => d.documentType !== docType);
          return [
            ...filtered,
            {
              name: fileName,
              fileUrl: uploadedUrl,
              documentType: docType,
              status: 'Pending',
              uploadDate: new Date().toISOString()
            }
          ];
        });
        Alert.alert('Upload Successful', `"${fileName}" attached.`);
      } catch (uploadErr: any) {
        setVerificationDocuments(prev => {
          const filtered = prev.filter(d => d.documentType !== docType);
          return [
            ...filtered,
            {
              name: fileName,
              fileUrl: result.uri,
              documentType: docType,
              status: 'Pending',
              uploadDate: new Date().toISOString()
            }
          ];
        });
        Alert.alert('File Attached', `"${fileName}" selected.`);
      }
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      console.error('Document picker error:', err);
      Alert.alert('Document Error', err.message || 'Could not open document picker.');
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleRemoveDocument = (docType: string) => {
    setVerificationDocuments(prev => prev.filter(d => d.documentType !== docType));
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
    if (validImages.length < 3) {
      setErrorMessage('Please upload all 3 required garage photos before proceeding.');
      return;
    }

    setCurrentStep(3);
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

    const validImages = images.filter(img => Boolean(img && img.trim()));
    if (validImages.length < 3) {
      setErrorMessage('All 3 garage facility photos are required to complete registration.');
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
        images: validImages,
        logoUrl: validImages[0] || '',
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

              {/* Garage Photos Section */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>
                  Garage Photos (3 Required)
                </Text>
                <View style={[
                  styles.countBadge, 
                  { 
                    backgroundColor: images.length === 3 
                      ? '#10B98120' 
                      : theme.colors.primary + '15' 
                  }
                ]}>
                  <Text style={{ 
                    fontSize: 11, 
                    fontWeight: 'bold', 
                    color: images.length === 3 ? '#10B981' : theme.colors.primary 
                  }}>
                    {images.length}/3 Uploaded
                  </Text>
                </View>
              </View>
              <Text style={[styles.helperText, { color: theme.colors.placeholder }]}>
                Take or upload 3 photos of your garage facility.
              </Text>

              {/* Just TWO buttons: Take Photo & Upload Photo */}
              <View style={styles.twoBtnsRow}>
                <TouchableOpacity
                  onPress={handleTakePhoto}
                  disabled={uploadingImage || images.length >= 3}
                  style={[
                    styles.mainPhotoBtn,
                    { 
                      backgroundColor: images.length >= 3 ? theme.colors.border : theme.colors.primary, 
                      opacity: uploadingImage ? 0.6 : 1 
                    }
                  ]}
                >
                  <MaterialCommunityIcons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.mainPhotoBtnText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUploadFromGallery}
                  disabled={uploadingImage || images.length >= 3}
                  style={[
                    styles.mainPhotoBtn,
                    { 
                      backgroundColor: theme.colors.card, 
                      borderColor: images.length >= 3 ? theme.colors.border : theme.colors.primary, 
                      borderWidth: 1.5,
                      opacity: uploadingImage ? 0.6 : 1 
                    }
                  ]}
                >
                  <MaterialCommunityIcons 
                    name="image-plus" 
                    size={18} 
                    color={images.length >= 3 ? theme.colors.placeholder : theme.colors.primary} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={[
                    styles.mainPhotoBtnText, 
                    { color: images.length >= 3 ? theme.colors.placeholder : theme.colors.primary }
                  ]}>
                    Upload Photo
                  </Text>
                </TouchableOpacity>
              </View>

              {uploadingImage && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '600' }}>Uploading photo...</Text>
                </View>
              )}

              {/* Show What's Uploaded (3 preview boxes) */}
              <View style={styles.photoThumbGrid}>
                {[0, 1, 2].map((idx) => {
                  const photoUri = images[idx];
                  const hasPhoto = Boolean(photoUri && photoUri.trim());

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.photoThumbBox,
                        {
                          backgroundColor: theme.colors.card,
                          borderColor: hasPhoto ? '#10B981' : theme.colors.border,
                        }
                      ]}
                    >
                      {hasPhoto ? (
                        <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                          <Image
                            source={{ uri: photoUri }}
                            style={{ width: '100%', height: '100%', borderRadius: 8 }}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            onPress={() => handleRemovePhoto(idx)}
                            style={styles.thumbDeleteBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={handleUploadFromGallery}
                          disabled={uploadingImage}
                          style={styles.thumbEmptyContent}
                        >
                          <MaterialCommunityIcons name="camera-plus-outline" size={24} color={theme.colors.placeholder} />
                          <Text style={{ fontSize: 10, color: theme.colors.placeholder, marginTop: 4, fontWeight: '600' }}>
                            Photo {idx + 1}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
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
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>UK MOT Testing & Legal Authorisation</Text>
              <Text style={[styles.stepDesc, { color: theme.colors.placeholder }]}>
                Provide your official DVLA license numbers and upload verification certificates.
              </Text>

              {/* License Numbers Section */}
              <View style={[styles.cleanCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.cardSectionTitle, { color: theme.colors.text }]}>License & Registration Numbers</Text>

                <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 8 }]}>
                  VTS Site Number *
                </Text>
                <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                  <MaterialCommunityIcons name="numeric" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                  <TextInput
                    value={vtsNumber}
                    onChangeText={setVtsNumber}
                    placeholder="E.g. VTS-104928"
                    placeholderTextColor={theme.colors.placeholder}
                    autoCapitalize="characters"
                    style={[styles.input, { color: theme.colors.text }]}
                  />
                </View>

                <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 8 }]}>
                  MOT Authorised Examiner (AE) Number *
                </Text>
                <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                  <MaterialCommunityIcons name="badge-account-horizontal-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                  <TextInput
                    value={motAuthorisedExaminerNumber}
                    onChangeText={setMotAuthorisedExaminerNumber}
                    placeholder="E.g. AE-884920"
                    placeholderTextColor={theme.colors.placeholder}
                    autoCapitalize="characters"
                    style={[styles.input, { color: theme.colors.text }]}
                  />
                </View>

                <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 8 }]}>
                  Company / Business Registration Number (Optional)
                </Text>
                <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                  <MaterialCommunityIcons name="briefcase-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
                  <TextInput
                    value={businessRegistrationNumber}
                    onChangeText={setBusinessRegistrationNumber}
                    placeholder="E.g. GB-9928174 or 12345678"
                    placeholderTextColor={theme.colors.placeholder}
                    autoCapitalize="characters"
                    style={[styles.input, { color: theme.colors.text }]}
                  />
                </View>
              </View>

              {/* Documents Checklist Card */}
              <View style={[styles.cleanCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View>
                    <Text style={[styles.cardSectionTitle, { color: theme.colors.text }]}>Verification Documents</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 2 }}>
                      Upload certificate copies (PDF, JPG, PNG)
                    </Text>
                  </View>
                  <View style={[styles.countBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.primary }}>
                      {verificationDocuments.length} Attached
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  {DOCUMENT_CHECKLIST.map((item) => {
                    const doc = verificationDocuments.find(d => d.documentType === item.type);
                    const isUploadingThis = uploadingDocType === item.type;

                    return (
                      <View
                        key={item.type}
                        style={[
                          styles.simpleDocRow,
                          {
                            backgroundColor: theme.colors.background,
                            borderColor: doc ? '#10B981' : theme.colors.border,
                          }
                        ]}
                      >
                        <View style={[styles.docRowIconWrapper, { backgroundColor: doc ? '#10B98115' : theme.colors.primary + '12' }]}>
                          <MaterialCommunityIcons
                            name={doc ? 'check-circle' : (item.icon as any)}
                            size={20}
                            color={doc ? '#10B981' : theme.colors.primary}
                          />
                        </View>

                        <View style={{ flex: 1, paddingHorizontal: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Text style={[styles.simpleDocTitle, { color: theme.colors.text }]}>
                              {item.label}
                            </Text>
                            {item.required && (
                              <Text style={{ color: '#EF4444', fontSize: 12, marginLeft: 2, fontWeight: 'bold' }}>*</Text>
                            )}
                          </View>
                          {doc ? (
                            <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                              ✓ {doc.name}
                            </Text>
                          ) : (
                            <Text style={{ fontSize: 10.5, color: theme.colors.placeholder, marginTop: 1 }}>
                              {item.required ? 'Required document' : 'Optional'}
                            </Text>
                          )}
                        </View>

                        {isUploadingThis ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginHorizontal: 8 }} />
                        ) : doc ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              onPress={() => handleUploadDocument(item.type, item.label)}
                              style={[styles.docMiniBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                            >
                              <Text style={[styles.docMiniBtnText, { color: theme.colors.text }]}>Change</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRemoveDocument(item.type)}
                              style={[styles.docMiniBtn, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                            >
                              <MaterialCommunityIcons name="close" size={14} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleUploadDocument(item.type, item.label)}
                            style={[styles.docUploadBtn, { backgroundColor: theme.colors.primary }]}
                          >
                            <MaterialCommunityIcons name="cloud-upload-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.docUploadBtnText}>Upload</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Additional Supporting Documents uploaded */}
                {verificationDocuments
                  .filter(d => !DOCUMENT_CHECKLIST.some(item => item.type === d.documentType))
                  .map((extraDoc, extraIdx) => (
                    <View
                      key={extraIdx}
                      style={[
                        styles.simpleDocRow,
                        {
                          backgroundColor: theme.colors.background,
                          borderColor: '#10B981',
                          marginTop: 8,
                        }
                      ]}
                    >
                      <View style={[styles.docRowIconWrapper, { backgroundColor: '#10B98115' }]}>
                        <MaterialCommunityIcons name="file-check-outline" size={20} color="#10B981" />
                      </View>
                      <View style={{ flex: 1, paddingHorizontal: 8 }}>
                        <Text style={[styles.simpleDocTitle, { color: theme.colors.text }]} numberOfLines={1}>
                          {extraDoc.name}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: '#10B981', fontWeight: '500' }}>Extra Document</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setVerificationDocuments(prev => prev.filter((_, i) => prev.indexOf(extraDoc) !== i))}
                        style={[styles.docMiniBtn, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                      >
                        <MaterialCommunityIcons name="close" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}

                {/* Add Extra Document Button */}
                <TouchableOpacity
                  onPress={() => handleUploadDocument('Additional Document', 'Supporting Document')}
                  disabled={uploadingDocType === 'Additional Document'}
                  style={[styles.addExtraDocSimpleBtn, { borderColor: theme.colors.border }]}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.primary }}>
                    + Add Another Supporting Document (Optional)
                  </Text>
                </TouchableOpacity>
              </View>

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

              {/* Step 3 Navigation Buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
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
                Your garage onboarding application with 3 facility photos and DVLA MOT certification credentials has been submitted for Platform Super Admin review.
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
  stepDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
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
  twoBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  mainPhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
  },
  mainPhotoBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoThumbGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoThumbBox: {
    flex: 1,
    aspectRatio: 1.1,
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbDeleteBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  cleanCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  simpleDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  docRowIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleDocTitle: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  docMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docMiniBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  docUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  docUploadBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addExtraDocSimpleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 10,
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
