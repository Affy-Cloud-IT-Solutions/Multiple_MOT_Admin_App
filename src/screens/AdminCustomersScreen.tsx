import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  Switch,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import SearchableDropdown from '../components/SearchableDropdown';
import {
  validateFirstName,
  validateLastName,
  validateEmail,
  validatePhoneNumber,
  validateMotExpiryDate,
} from '../utils/validationUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AdminCustomersScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { customers, vehicles, addCustomer, addVehicle, updateVehicleStatus, lookupVehicle, token } = useAppValues();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  
  // States for new customer's vehicle form
  const [addVehicleNow, setAddVehicleNow] = useState(true);
  const [newCustRegNo, setNewCustRegNo] = useState('');
  const [newCustMake, setNewCustMake] = useState('');
  const [newCustModel, setNewCustModel] = useState('');
  const [newCustYear, setNewCustYear] = useState('');
  const [newCustExpiry, setNewCustExpiry] = useState('');
  const [newCustServiceDate, setNewCustServiceDate] = useState('');
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);

  const [addingVehicleForCustId, setAddingVehicleForCustId] = useState<string | null>(null);
  const [isBookingMotForCustId, setIsBookingMotForCustId] = useState<string | null>(null);
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [expiry, setExpiry] = useState('');
  const [serviceDate, setServiceDate] = useState('');

  const fetchMakesList = async (search: string, pageNum: number) => {
    try {
      const response = await fetch(`${BASE_URL}/vehicles/makes?page=${pageNum}&limit=20&search=${encodeURIComponent(search)}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      return {
        items: data.makes || [],
        hasMore: data.pagination ? data.pagination.page < data.pagination.totalPages : false
      };
    } catch (e) {
      console.error(e);
      return { items: [], hasMore: false };
    }
  };

  const fetchModelsListForMake = (makeVal: string) => async (search: string, pageNum: number) => {
    if (!makeVal) return { items: [], hasMore: false };
    try {
      const response = await fetch(`${BASE_URL}/vehicles/models?make=${encodeURIComponent(makeVal)}&page=${pageNum}&limit=20&search=${encodeURIComponent(search)}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      return {
        items: data.models || [],
        hasMore: data.pagination ? data.pagination.page < data.pagination.totalPages : false
      };
    } catch (e) {
      console.error(e);
      return { items: [], hasMore: false };
    }
  };

  const formatDateInput = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 4 && cleaned.length <= 6) {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    } else if (cleaned.length > 6) {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
    return formatted;
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const toggleExpandCustomer = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCustomerId(expandedCustomerId === id ? null : id);
    setAddingVehicleForCustId(null);
    setIsBookingMotForCustId(null);
  };

  const handleLookupPlate = async () => {
    const vrnClean = newCustRegNo.trim().toUpperCase();
    if (!vrnClean) {
      Alert.alert('Error', 'Please enter a vehicle registration number first');
      return;
    }
    
    setIsSearchingPlate(true);
    try {
      const res = await lookupVehicle(vrnClean);
      if (res && res.found && res.vehicle) {
        const v = res.vehicle;
        setNewCustMake(v.make || '');
        setNewCustModel(v.model || '');
        setNewCustYear(v.year ? String(v.year) : '');
        setNewCustExpiry(v.motExpiryDate || '');
        Alert.alert('Plate Found', `Autofilled details for ${v.make} ${v.model}`);
      } else {
        Alert.alert('Not Found', 'Vehicle details not found. Please enter them manually.');
      }
    } catch (err: any) {
      console.error('[AdminCustomersScreen] lookup error:', err);
      Alert.alert('Lookup Failed', err.message || 'Failed to fetch details from DVLA registry');
    } finally {
      setIsSearchingPlate(false);
    }
  };

  const handleCreateCustomer = async () => {
    const firstVal = validateFirstName(firstName);
    if (firstVal.error) {
      Alert.alert('Validation Error', `First Name: ${firstVal.error}`);
      return;
    }

    if (lastName.trim()) {
      const lastVal = validateLastName(lastName);
      if (lastVal.error) {
        Alert.alert('Validation Error', `Last Name: ${lastVal.error}`);
        return;
      }
    }

    const emailVal = validateEmail(email);
    if (emailVal.error) {
      Alert.alert('Validation Error', emailVal.error);
      return;
    }

    const mobileVal = validatePhoneNumber(mobile);
    if (mobileVal.error) {
      Alert.alert('Validation Error', mobileVal.error);
      return;
    }

    // If adding vehicle details now, validate vehicle inputs first
    if (addVehicleNow) {
      if (!newCustRegNo.trim() || !newCustMake.trim() || !newCustModel.trim() || !newCustYear.trim() || !newCustExpiry.trim()) {
        Alert.alert('Validation Error', 'Please fill in all vehicle details or toggle off "Include Vehicle Details"');
        return;
      }

      if (!/^\d{4}$/.test(newCustYear.trim())) {
        Alert.alert('Validation Error', 'Please enter a valid 4-digit year of manufacture');
        return;
      }

      // Validate MOT Expiry Date
      const expiryVal = validateMotExpiryDate(newCustExpiry);
      if (expiryVal.error) {
        Alert.alert('Validation Error', `MOT Expiry: ${expiryVal.error}`);
        return;
      }

      // Validate Last Service Date (if provided)
      if (newCustServiceDate.trim()) {
        const serviceVal = validateMotExpiryDate(newCustServiceDate);
        if (serviceVal.error) {
          Alert.alert('Validation Error', `Last Service Date: ${serviceVal.error}`);
          return;
        }
      }
    }

    try {
      // 1. Create Customer
      const customerId = await addCustomer({
        firstName: firstName.trim(),
        lastName: lastName.trim() || '',
        email: email.trim(),
        mobile: mobile.trim(),
        address: address.trim() || undefined,
        preferredContact: 'SMS',
      });

      // 2. Create Vehicle if needed
      if (addVehicleNow && customerId) {
        await addVehicle({
          customerId,
          registrationNumber: newCustRegNo.trim().toUpperCase(),
          make: newCustMake.trim().toUpperCase(),
          model: newCustModel.trim().toUpperCase(),
          year: newCustYear.trim(),
          motExpiryDate: newCustExpiry.trim(),
          lastServiceDate: newCustServiceDate.trim() || undefined,
          status: 'Active',
        });
      }

      // 3. Clear inputs
      setFirstName('');
      setLastName('');
      setEmail('');
      setMobile('');
      setAddress('');
      
      setNewCustRegNo('');
      setNewCustMake('');
      setNewCustModel('');
      setNewCustYear('');
      setNewCustExpiry('');
      setNewCustServiceDate('');
      setAddVehicleNow(true);
      
      setShowAddCustomer(false);
      
      if (addVehicleNow) {
        Alert.alert('Success', 'Customer profile and vehicle created successfully!');
      } else {
        Alert.alert('Success', 'Customer profile created successfully!');
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to create customer profile.');
    }
  };

  const handleCreateVehicle = (customerId: string) => {
    if (!regNo.trim() || !make.trim() || !model.trim() || !year.trim() || !expiry.trim()) {
      Alert.alert('Error', 'Please fill in all vehicle details');
      return;
    }

    if (!/^\d{4}$/.test(year.trim())) {
      Alert.alert('Error', 'Please enter a valid 4-digit year of manufacture');
      return;
    }

    // Validate MOT Expiry Date
    const expiryVal = validateMotExpiryDate(expiry);
    if (expiryVal.error) {
      Alert.alert('Validation Error', expiryVal.error);
      return;
    }

    // Validate Last Service Date (if provided)
    if (serviceDate.trim()) {
      const serviceVal = validateMotExpiryDate(serviceDate);
      if (serviceVal.error) {
        Alert.alert('Validation Error', `Last Service Date: ${serviceVal.error}`);
        return;
      }
    }

    addVehicle({
      customerId,
      registrationNumber: regNo.trim().toUpperCase(),
      make: make.trim().toUpperCase(),
      model: model.trim().toUpperCase(),
      year: year.trim(),
      motExpiryDate: expiry.trim(),
      lastServiceDate: serviceDate.trim() || undefined,
      status: 'Active',
    });

    setRegNo('');
    setMake('');
    setModel('');
    setYear('');
    setExpiry('');
    setServiceDate('');
    setAddingVehicleForCustId(null);
    Alert.alert('Success', 'Vehicle added successfully!');
  };

  const handleChangeVehicleStatus = (vehicleId: string, currentStatus: string) => {
    Alert.alert(
      'Update Vehicle Status',
      'Select new status:',
      [
        { text: 'Active', onPress: () => updateVehicleStatus(vehicleId, 'Active') },
        { text: 'Sold', onPress: () => updateVehicleStatus(vehicleId, 'Sold') },
        { text: 'Scrapped', onPress: () => updateVehicleStatus(vehicleId, 'Scrapped') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const filteredCustomers = customers.filter((c) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const nameMatch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(query);
    const emailMatch = c.email.toLowerCase().includes(query);
    const mobileMatch = c.mobile.toLowerCase().includes(query);
    const customerVehicles = vehicles.filter((v) => 
      v.customerId && (
        String(v.customerId).toLowerCase() === String(c.id || '').toLowerCase() ||
        String(v.customerId).toLowerCase() === String(c._id || '').toLowerCase()
      )
    );
    const regMatch = customerVehicles.some((v) =>
      v.registrationNumber.toLowerCase().includes(query)
    );

    return nameMatch || emailMatch || mobileMatch || regMatch;
  });

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'Active': return 'check-circle';
      case 'Sold': return 'cash';
      case 'Scrapped': return 'delete-circle';
      case 'Pending': return 'clock-outline';
      case 'Rejected': return 'close-circle';
      default: return 'circle';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.placeholder} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search customers..."
              placeholderTextColor={theme.colors.placeholder}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.placeholder} />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowAddCustomer(!showAddCustomer);
            }}
            style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          >
            <MaterialCommunityIcons 
              name={showAddCustomer ? 'close' : 'account-plus'} 
              size={24} 
              color={theme.dark ? theme.colors.background : '#FFFFFF'} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Add Customer Form */}
        {showAddCustomer && (
          <View style={[styles.formCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.formHeader}>
              <MaterialCommunityIcons name="account-plus" size={24} color={theme.colors.primary} />
              <Text style={[styles.formTitle, { color: theme.colors.text }]}>New Customer</Text>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={[styles.label, { color: theme.colors.text }]}>First Name</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.formInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>
              <View style={styles.formField}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Last Name</Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  placeholderTextColor={theme.colors.placeholder}
                  style={[styles.formInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />
              </View>
            </View>

            <View style={styles.iconInput}>
              <MaterialCommunityIcons name="email" size={20} color={theme.colors.placeholder} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email Address"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.iconInputField, { color: theme.colors.text }]}
              />
            </View>

            <View style={styles.iconInput}>
              <MaterialCommunityIcons name="phone" size={20} color={theme.colors.placeholder} />
              <TextInput
                value={mobile}
                onChangeText={setMobile}
                placeholder="Mobile Number"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="phone-pad"
                style={[styles.iconInputField, { color: theme.colors.text }]}
              />
            </View>

            <View style={styles.iconInput}>
              <MaterialCommunityIcons name="home" size={20} color={theme.colors.placeholder} />
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Address (Optional)"
                placeholderTextColor={theme.colors.placeholder}
                style={[styles.iconInputField, { color: theme.colors.text }]}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="car" size={20} color={theme.colors.placeholder} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>Include Vehicle Details?</Text>
              </View>
              <Switch
                value={addVehicleNow}
                onValueChange={(val) => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setAddVehicleNow(val);
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={addVehicleNow ? (theme.dark ? theme.colors.background : '#FFFFFF') : theme.colors.placeholder}
              />
            </View>

            {addVehicleNow && (
              <View style={{ marginTop: 4, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, backgroundColor: theme.dark ? '#1C1C1E' : '#F2F2F7', marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text, marginBottom: 10 }}>Vehicle Details</Text>
                
                {/* Plate input & lookup row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', flex: 1, height: 40, backgroundColor: '#FFD300', borderWidth: 1.5, borderColor: '#000000', borderRadius: 6, overflow: 'hidden', alignItems: 'center' }}>
                    <View style={{ width: 28, height: '100%', backgroundColor: '#0A4E9B', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 8 }}>UK</Text>
                    </View>
                    <TextInput
                      value={newCustRegNo}
                      onChangeText={(txt) => setNewCustRegNo(txt.toUpperCase())}
                      placeholder="REG PLATE"
                      placeholderTextColor="#808080"
                      autoCapitalize="characters"
                      maxLength={8}
                      style={{ flex: 1, fontSize: 15, fontWeight: 'bold', color: '#000000', textAlign: 'center', height: '100%', padding: 0 }}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleLookupPlate}
                    disabled={isSearchingPlate}
                    style={{ marginLeft: 8, height: 40, paddingHorizontal: 12, backgroundColor: theme.colors.secondary, borderRadius: 6, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}
                  >
                    {isSearchingPlate ? (
                      <ActivityIndicator size="small" color={theme.dark ? theme.colors.background : '#FFFFFF'} />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="magnify" size={16} color={theme.dark ? theme.colors.background : '#FFFFFF'} style={{ marginRight: 4 }} />
                        <Text style={{ color: theme.dark ? theme.colors.background : '#FFFFFF', fontWeight: 'bold', fontSize: 12 }}>LOOKUP</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Make and Model fields */}
                <View style={styles.formRow}>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>Make / Brand</Text>
                    <SearchableDropdown
                      placeholder="Make"
                      selectedValue={newCustMake}
                      onValueChange={(val) => {
                        setNewCustMake(val);
                        setNewCustModel('');
                      }}
                      fetchItems={fetchMakesList}
                    />
                  </View>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>Model</Text>
                    <SearchableDropdown
                      placeholder="Model"
                      selectedValue={newCustModel}
                      onValueChange={setNewCustModel}
                      fetchItems={fetchModelsListForMake(newCustMake)}
                      disabled={!newCustMake}
                    />
                  </View>
                </View>

                {/* Year and MOT Expiry */}
                <View style={styles.formRow}>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>Year (YYYY)</Text>
                    <TextInput
                      value={newCustYear}
                      onChangeText={setNewCustYear}
                      placeholder="e.g. 2018"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={4}
                      style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    />
                  </View>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>MOT Expiry (YYYY-MM-DD)</Text>
                    <TextInput
                      value={newCustExpiry}
                      onChangeText={(text) => setNewCustExpiry(formatDateInput(text))}
                      placeholder="e.g. 2027-07-12"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={10}
                      style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    />
                  </View>
                </View>

                {/* Last Service Date */}
                <View style={[styles.formRow, { marginBottom: 0 }]}>
                  <View style={styles.formField}>
                    <Text style={[styles.label, { color: theme.colors.text, fontSize: 11 }]}>Last Service (Optional, YYYY-MM-DD)</Text>
                    <TextInput
                      value={newCustServiceDate}
                      onChangeText={(text) => setNewCustServiceDate(formatDateInput(text))}
                      placeholder="e.g. 2026-07-13"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={10}
                      style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    />
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity onPress={handleCreateCustomer} style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.submitButtonText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Create Customer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Customer List */}
        {/* <Text style={[styles.directoryTitle, { color: theme.colors.text }]}>
          <MaterialCommunityIcons name="account-group" size={20} color={theme.colors.text} /> 
          {"  "}Customers ({filteredCustomers.length})
        </Text> */}

        {filteredCustomers.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-off" size={48} color={theme.colors.placeholder} />
            <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No customers found</Text>
          </View>
        ) : (
          filteredCustomers.map((c) => {
            const customerVehicles = vehicles.filter((v) => 
              v.customerId && (
                String(v.customerId).toLowerCase() === String(c.id || '').toLowerCase() ||
                String(v.customerId).toLowerCase() === String(c._id || '').toLowerCase()
              )
            );
            const isExpanded = expandedCustomerId === c.id;

            return (
              <View key={c.id} style={[styles.customerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => toggleExpandCustomer(c.id)} style={styles.customerHeader}>
                  <View style={styles.customerHeaderLeft}>
                    <View style={styles.customerIcon}>
                      <Text style={styles.customerInitial}>
                        {c.firstName[0]}{c.lastName[0]}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.customerNameText, { color: theme.colors.text }]}>
                        {c.firstName} {c.lastName}
                      </Text>
                      <View style={styles.customerInfoCol}>
                        <View style={styles.customerInfoItem}>
                          <MaterialCommunityIcons name="phone" size={12} color={theme.colors.placeholder} />
                          <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginLeft: 4 }}>
                            {c.mobile}
                          </Text>
                        </View>
                        <View style={styles.customerInfoItem}>
                          <MaterialCommunityIcons name="email" size={12} color={theme.colors.placeholder} />
                          <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginLeft: 4 }}>
                            {c.email}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.customerHeaderRight}>
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.colors.placeholder}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                    <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('CustomerDetail', { customerId: c.id })}
                        style={[styles.viewDetailsBtn, { flex: 1, backgroundColor: theme.colors.secondary + '12', borderColor: theme.colors.secondary, marginVertical: 0 }]}
                      >
                        <MaterialCommunityIcons name="account-details-outline" size={18} color={theme.colors.secondary} />
                        <Text style={{ color: theme.colors.secondary, fontWeight: 'bold', fontSize: 12, marginLeft: 6 }} numberOfLines={1}>
                          Details & History
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => {
                          const bookableVehicles = customerVehicles.filter(v => v.status === 'Active');
                          if (bookableVehicles.length === 0) {
                            Alert.alert('No Approved Vehicles', 'This customer has no active/approved vehicles. Please add or approve a vehicle first.');
                            return;
                          }
                          
                          // If they only have 1 active vehicle, directly navigate to booking
                          if (bookableVehicles.length === 1) {
                            navigation.navigate('AdminBookMot', {
                              customer: c,
                              vehicle: bookableVehicles[0]
                            });
                            return;
                          }

                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setIsBookingMotForCustId(c.id);
                        }}
                        style={[styles.viewDetailsBtn, { flex: 1, backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary, marginVertical: 0 }]}
                      >
                        <MaterialCommunityIcons name="calendar-plus" size={18} color={theme.colors.primary} />
                        <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 12, marginLeft: 6 }} numberOfLines={1}>
                          Book MOT
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {isBookingMotForCustId === c.id && (
                      <View style={[styles.vehicleForm, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, marginBottom: 12 }]}>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: theme.colors.text, marginBottom: 10 }}>
                          Select Vehicle for MOT Booking:
                        </Text>
                        {customerVehicles.filter(v => v.status === 'Active').map(v => (
                          <TouchableOpacity
                            key={v.id}
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setIsBookingMotForCustId(null);
                              navigation.navigate('AdminBookMot', {
                                customer: c,
                                vehicle: v
                              });
                            }}
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingVertical: 10,
                              borderBottomWidth: 0.5,
                              borderColor: theme.colors.border
                            }}
                          >
                            <View style={styles.recentPlate}>
                              <Text style={styles.recentPlateText}>{v.registrationNumber}</Text>
                            </View>
                            <Text style={{ color: theme.colors.text, fontWeight: '500', fontSize: 12, flex: 1, marginLeft: 10 }}>
                              {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                            </Text>
                            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.placeholder} />
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setIsBookingMotForCustId(null);
                          }}
                          style={{ marginTop: 10, alignItems: 'center', paddingVertical: 4 }}
                        >
                          <Text style={{ color: theme.colors.error, fontWeight: 'bold', fontSize: 13 }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    {c.address && (
                      <View style={styles.addressBox}>
                        <MaterialCommunityIcons name="map-marker" size={16} color={theme.colors.placeholder} />
                        <Text style={{ fontSize: 13, color: theme.colors.text, marginLeft: 8 }}>{c.address}</Text>
                      </View>
                    )}

                    <View style={styles.vehiclesHeaderRow}>
                      <View style={styles.vehiclesTitle}>
                        <MaterialCommunityIcons name="car" size={18} color={theme.colors.text} />
                        <Text style={[styles.vehiclesTitleText, { color: theme.colors.text }]}>
                          Vehicles ({customerVehicles.length})
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setAddingVehicleForCustId(addingVehicleForCustId === c.id ? null : c.id);
                        }}
                        style={[styles.addVehicleBadge, { borderColor: theme.colors.secondary }]}
                      >
                        <MaterialCommunityIcons name="plus-circle" size={16} color={theme.colors.secondary} />
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.secondary, marginLeft: 4 }}>
                          Add
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {addingVehicleForCustId === c.id && (
                      <View style={[styles.vehicleForm, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: theme.colors.text, marginBottom: 10 }}>
                          <MaterialCommunityIcons name="car" size={16} color={theme.colors.secondary} /> Add Vehicle
                        </Text>
                        
                        <View style={styles.formRow}>
                          <View style={styles.formField}>
                            <TextInput
                              value={regNo}
                              onChangeText={setRegNo}
                              placeholder="Reg Plate"
                              placeholderTextColor={theme.colors.placeholder}
                              autoCapitalize="characters"
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                          <View style={styles.formField}>
                            <SearchableDropdown
                              placeholder="Make"
                              selectedValue={make}
                              onValueChange={(val) => {
                                setMake(val);
                                setModel('');
                              }}
                              fetchItems={fetchMakesList}
                            />
                          </View>
                        </View>

                        <View style={styles.formRow}>
                          <View style={styles.formField}>
                            <SearchableDropdown
                              placeholder="Model"
                              selectedValue={model}
                              onValueChange={setModel}
                              fetchItems={fetchModelsListForMake(make)}
                              disabled={!make}
                            />
                          </View>
                          <View style={styles.formField}>
                            <TextInput
                              value={year}
                              onChangeText={setYear}
                              placeholder="Year (YYYY)"
                              placeholderTextColor={theme.colors.placeholder}
                              keyboardType="numeric"
                              maxLength={4}
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                        </View>

                        <View style={styles.formRow}>
                          <View style={styles.formField}>
                            <TextInput
                              value={expiry}
                              onChangeText={(text) => setExpiry(formatDateInput(text))}
                              placeholder="MOT Expiry (YYYY-MM-DD)"
                              placeholderTextColor={theme.colors.placeholder}
                              keyboardType="numeric"
                              maxLength={10}
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                          <View style={styles.formField}>
                            <TextInput
                              value={serviceDate}
                              onChangeText={(text) => setServiceDate(formatDateInput(text))}
                              placeholder="Last Service (YYYY-MM-DD)"
                              placeholderTextColor={theme.colors.placeholder}
                              keyboardType="numeric"
                              maxLength={10}
                              style={[styles.subFormInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            />
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleCreateVehicle(c.id)}
                          style={[styles.vehicleSubmitBtn, { backgroundColor: theme.colors.secondary }]}
                        >
                          <Text style={{ color: theme.dark ? theme.colors.background : '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>Save Vehicle</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {customerVehicles.length === 0 ? (
                      <View style={styles.emptyVehicleState}>
                        <MaterialCommunityIcons name="car-off" size={20} color={theme.colors.placeholder} />
                        <Text style={{ fontSize: 13, color: theme.colors.placeholder, marginLeft: 8 }}>
                          No vehicles registered
                        </Text>
                      </View>
                    ) : (
                      customerVehicles.map((v) => {
                        const isSold = v.status === 'Sold';
                        const isScrapped = v.status === 'Scrapped';
                        
                        return (
                          <View key={v.id} style={{ borderBottomWidth: 0.8, borderColor: theme.colors.border, paddingVertical: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={styles.vehicleRowLeft}>
                                <View style={styles.recentPlate}>
                                  <Text style={styles.recentPlateText}>{v.registrationNumber}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                  <Text style={[styles.vehicleMakeText, { color: theme.colors.text }]}>
                                    {v.make} {v.model}
                                  </Text>
                                   <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>
                                     {v.year} • MOT: {formatShortDate(v.motExpiryDate)}
                                   </Text>
                                </View>
                              </View>

                              <TouchableOpacity
                                onPress={() => handleChangeVehicleStatus(v.id, v.status)}
                                style={[
                                  styles.statusPill,
                                  {
                                    backgroundColor: isSold
                                      ? theme.colors.placeholder + '20'
                                      : (isScrapped || v.status === 'Rejected')
                                      ? theme.colors.error + '20'
                                      : v.status === 'Pending'
                                      ? theme.colors.warning + '20'
                                      : theme.colors.success + '20',
                                  },
                                ]}
                              >
                                <MaterialCommunityIcons 
                                  name={getStatusIcon(v.status)} 
                                  size={12} 
                                  color={isSold ? theme.colors.placeholder : (isScrapped || v.status === 'Rejected') ? theme.colors.error : v.status === 'Pending' ? theme.colors.warning : theme.colors.success} 
                                />
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 'bold',
                                    marginLeft: 3,
                                    color: isSold
                                      ? theme.colors.placeholder
                                      : (isScrapped || v.status === 'Rejected')
                                      ? theme.colors.error
                                      : v.status === 'Pending'
                                      ? theme.colors.warning
                                      : theme.colors.success,
                                  }}
                                >
                                  {v.status}
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {v.status === 'Rejected' && v.rejectionReason && (
                              <View style={[styles.custRejectionReasonBox, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error }]}>
                                <Text style={{ fontSize: 11, color: theme.colors.error, fontWeight: 'bold' }}>Rejection Reason:</Text>
                                <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2 }}>{v.rejectionReason}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingHorizontal: 8,
    padding: 0,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  formField: {
    flex: 1,
    marginHorizontal: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  formInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  subFormInput: {
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    height: 40,
  },
  iconInputField: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingHorizontal: 8,
    padding: 0,
  },
  submitButton: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  directoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  customerCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  customerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD300',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerInitial: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  customerInfoCol: {
    flexDirection: 'column',
    marginTop: 4,
    gap: 3,
  },
  customerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  customerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehiclesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  vehiclesTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehiclesTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  addVehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vehicleForm: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  vehicleSubmitBtn: {
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.8,
  },
  vehicleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentPlate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  recentPlateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 10,
  },
  custRejectionReasonBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  vehicleMakeText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  statusPill: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyVehicleState: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
});