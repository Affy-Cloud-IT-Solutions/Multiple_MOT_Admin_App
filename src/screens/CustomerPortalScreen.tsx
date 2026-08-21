import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Switch,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import SearchableDropdown from '../components/SearchableDropdown';
import { SafeAreaView } from 'react-native-safe-area-context';
import { validateMotExpiryDate } from '../utils/validationUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomerPortalScreen({ route, navigation }: any) {
  const { isDarkMode, theme, toggleTheme } = useAppTheme();
  const { customers, vehicles, alerts, addAlert, addVehicle, addAudit, updateVehicleStatus, refreshData, setToken, setUser, token } = useAppValues();

  // Find active customer
  const customerId = route?.params?.customerId || 'c1';
  const customer = customers.find((c) => c.id === customerId) || customers[0];

  if (!customer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10, color: theme.colors.text }}>Loading portal...</Text>
      </SafeAreaView>
    );
  }

  // Active customer vehicles (including Pending and Rejected statuses)
  const customerVehicles = vehicles.filter((v) => 
    v.customerId && (
      String(v.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
      String(v.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
    ) && v.status !== 'Sold' && v.status !== 'Scrapped'
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshData();
    });
    return unsubscribe;
  }, [navigation]);

  // New Vehicle form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [regNo, setRegNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [expiry, setExpiry] = useState('');
  const [expandedBookingReg, setExpandedBookingReg] = useState<string | null>(null);

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
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'profile'>('home');

  const getBookingSlot = (makeModel: string) => {
    const parts = makeModel.split(' - Slot: ');
    return parts.length > 1 ? parts[1] : makeModel;
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (monthIndex >= 0 && monthIndex < 12) {
        return `${day} ${months[monthIndex]} ${year}`;
      }
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

  // Loading spinner states per vehicle/action
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleBookMOT = (vehicle: any) => {
    navigation.navigate('Booking', { vehicle });
  };

  const handleMarkAsSold = (vehicleId: string, reg: string, makeModel: string) => {
    const actionId = `sold_${vehicleId}`;
    
    Alert.alert(
      'Confirm Vehicle Sold',
      `Are you sure you want to mark your ${makeModel} (${reg}) as sold? Future MOT reminders will be stopped.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Sold',
          style: 'destructive',
          onPress: () => {
            setLoadingAction(actionId);
            setTimeout(() => {
              setLoadingAction(null);

              // Update vehicle status in shared DB
              updateVehicleStatus(vehicleId, 'Sold');

              // Add notification to Admin alerts
              addAlert({
                type: 'SOLD',
                customerName: `${customer.firstName} ${customer.lastName}`,
                customerId: customer.id,
                registrationNumber: reg,
                makeModel: makeModel,
              });

              Alert.alert(
                'Status Updated',
                'Vehicle ownership updated. Automated reminders for this vehicle have been permanently deactivated.'
              );
            }, 1200);
          },
        },
      ]
    );
  };

  const handleAddNewVehicle = async () => {
    if (!regNo.trim() || !make.trim() || !model.trim() || !year.trim() || !expiry.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Verify year is a 4-digit number
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

    setLoadingAction('add_vehicle');
    try {
      // 1. Create the vehicle directly in the database
      await addVehicle({
        customerId: customer.id,
        registrationNumber: regNo.trim().toUpperCase(),
        make: make.trim().toUpperCase(),
        model: model.trim().toUpperCase(),
        year: year.trim(),
        motExpiryDate: expiry,
        status: 'Pending'
      });

      // 2. Send alert notification to Admin for log/info
      await addAlert({
        type: 'NEW_VEHICLE',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        registrationNumber: regNo.trim().toUpperCase(),
        makeModel: `${make.trim().toUpperCase()} ${model.trim().toUpperCase()}`,
      });

      await addAudit(
        'New Vehicle Registered', 
        `${customer.firstName} ${customer.lastName} registered vehicle ${make.trim().toUpperCase()} (${regNo.trim().toUpperCase()})`
      );

      setLoadingAction(null);

      // Reset
      setRegNo('');
      setMake('');
      setModel('');
      setYear('');
      setExpiry('');
      setShowAddForm(false);

      Alert.alert(
        'Vehicle Registration Pending',
        'Your new vehicle has been registered successfully and is awaiting approval from the garage staff. You will be able to book an MOT once approved!'
      );
    } catch (error: any) {
      setLoadingAction(null);
      console.error('[PORTAL] handleAddNewVehicle error:', error);
      Alert.alert('Registration Failed', error?.message || 'Could not register vehicle. Please verify registration plate is unique.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Bar / Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, justifyContent: 'flex-start' }]}>
        <Text style={[styles.navTitle, { color: theme.colors.text, textAlign: 'left' }]}>
          {activeTab === 'home' ? 'Customer Dashboard' :
           activeTab === 'history' ? 'MOT History' : 'My Profile'}
        </Text>
      </View>

      {/* Tabs Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Welcome Block */}
            <View style={styles.welcomeBlock}>
              <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
                Hello, {customer.firstName}!
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: theme.colors.placeholder }]}>
                Manage your registered vehicles and request MOT appointment slots.
              </Text>
            </View>

            {/* Add Vehicle Button & Collapsible Form */}
            {showAddForm && (
              <View style={[styles.formCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.formTitle, { color: theme.colors.text }]}>Register New Vehicle</Text>
                
                <Text style={[styles.label, { color: theme.colors.text }]}>Registration Number</Text>
                <TextInput
                  value={regNo}
                  onChangeText={setRegNo}
                  placeholder="E.g. AB12 XYZ"
                  placeholderTextColor={theme.colors.placeholder}
                  autoCapitalize="characters"
                  style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Make</Text>
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Model</Text>
                    <SearchableDropdown
                      placeholder="Model"
                      selectedValue={model}
                      onValueChange={setModel}
                      fetchItems={fetchModelsListForMake(make)}
                      disabled={!make}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>Year</Text>
                    <TextInput
                      value={year}
                      onChangeText={setYear}
                      placeholder="E.g. 2018"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={4}
                      style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.colors.text }]}>MOT Expiry Date</Text>
                    <TextInput
                      value={expiry}
                      onChangeText={(text) => setExpiry(formatDateInput(text))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="numeric"
                      maxLength={10}
                      style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    />
                  </View>
                </View>

                <View style={styles.formActionsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setShowAddForm(false);
                      setRegNo('');
                      setMake('');
                      setModel('');
                      setYear('');
                      setExpiry('');
                    }}
                    style={[styles.cancelFormBtn, { borderColor: theme.colors.border }]}
                  >
                    <Text style={[styles.cancelFormBtnText, { color: theme.colors.text }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleAddNewVehicle}
                    disabled={loadingAction === 'add_vehicle'}
                    style={[styles.submitFormBtn, { backgroundColor: theme.colors.secondary }]}
                  >
                    {loadingAction === 'add_vehicle' ? (
                      <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
                    ) : (
                      <Text style={[styles.submitButtonText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Request Approval</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Vehicles Registry */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>Your Registered Vehicles</Text>
              <TouchableOpacity
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowAddForm(!showAddForm);
                }}
                style={{ padding: 6 }}
              >
                <MaterialCommunityIcons name={showAddForm ? "close" : "plus"} size={22} color={theme.colors.secondary} />
              </TouchableOpacity>
            </View>

            {customerVehicles.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="car-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>
                  You have no active vehicles registered for MOT reminders.
                </Text>
              </View>
            ) : (
              customerVehicles.map((v) => {
                const bookingAlert = alerts.find((a) => a.type === 'BOOKED' && a.registrationNumber === v.registrationNumber);
                const isBooked = bookingAlert && (bookingAlert.status === 'Pending' || bookingAlert.status === 'Approved');
                const isRejected = bookingAlert && bookingAlert.status === 'Rejected';
                
                return (
                  <View key={v.id} style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {/* Header Info */}
                    <View style={styles.vehicleHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <MaterialCommunityIcons name="car-sports" size={20} color={theme.colors.secondary} style={{ marginRight: 8 }} />
                        <Text style={[styles.makeModelText, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
                          {v.make} {v.model} {v.year ? `(${v.year})` : ''}
                        </Text>
                      </View>
                      {v.status === 'Pending' && (
                        <View style={[styles.bookedBadge, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning }]}>
                          <MaterialCommunityIcons name="clock-outline" size={12} color={theme.colors.warning} style={{ marginRight: 2 }} />
                          <Text style={[styles.bookedBadgeText, { color: theme.colors.warning }]}>Pending Approval</Text>
                        </View>
                      )}
                      {v.status === 'Rejected' && (
                        <View style={[styles.bookedBadge, { backgroundColor: theme.colors.error + '15', borderColor: theme.colors.error }]}>
                          <MaterialCommunityIcons name="close-circle" size={12} color={theme.colors.error} style={{ marginRight: 2 }} />
                          <Text style={[styles.bookedBadgeText, { color: theme.colors.error }]}>Rejected</Text>
                        </View>
                      )}
                      {isBooked && (
                        <TouchableOpacity
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setExpandedBookingReg(expandedBookingReg === v.registrationNumber ? null : v.registrationNumber);
                          }}
                          style={[styles.bookedBadge, { backgroundColor: theme.colors.success + '20', borderColor: theme.colors.success }]}
                        >
                          <MaterialCommunityIcons name="check-circle" size={12} color={theme.colors.success} style={{ marginRight: 2 }} />
                          <Text style={[styles.bookedBadgeText, { color: theme.colors.success }]}>Booked</Text>
                          <MaterialCommunityIcons 
                            name={expandedBookingReg === v.registrationNumber ? "chevron-up" : "chevron-down"} 
                            size={14} 
                            color={theme.colors.success} 
                            style={{ marginLeft: 2 }} 
                          />
                        </TouchableOpacity>
                      )}
                      {isRejected && (
                        <TouchableOpacity
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setExpandedBookingReg(expandedBookingReg === v.registrationNumber ? null : v.registrationNumber);
                          }}
                          style={[styles.bookedBadge, { backgroundColor: theme.colors.error + '15', borderColor: theme.colors.error }]}
                        >
                          <MaterialCommunityIcons name="close-circle" size={12} color={theme.colors.error} style={{ marginRight: 2 }} />
                          <Text style={[styles.bookedBadgeText, { color: theme.colors.error }]}>Rejected</Text>
                          <MaterialCommunityIcons 
                            name={expandedBookingReg === v.registrationNumber ? "chevron-up" : "chevron-down"} 
                            size={14} 
                            color={theme.colors.error} 
                            style={{ marginLeft: 2 }} 
                          />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.vehicleBody}>
                      <View style={[styles.infoRow, { justifyContent: 'flex-start', alignItems: 'center' }]}>
                        <MaterialCommunityIcons name="card-text-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.colors.placeholder, fontSize: 13, marginRight: 8 }}>Registration Number:</Text>
                        <View style={styles.smallPlate}>
                          <Text style={styles.smallPlateText}>{v.registrationNumber}</Text>
                        </View>
                      </View>
                      
                      <View style={[styles.infoRow, { marginTop: 6, justifyContent: 'flex-start', alignItems: 'center' }]}>
                        <MaterialCommunityIcons name="calendar-check-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>MOT: </Text>
                        <Text style={{ color: theme.colors.text, fontWeight: 'bold', fontSize: 13 }}>{formatShortDate(v.motExpiryDate)}</Text>
                      </View>
                      
                      {v.lastServiceDate && (
                        <View style={[styles.infoRow, { marginTop: 6, justifyContent: 'flex-start', alignItems: 'center' }]}>
                          <MaterialCommunityIcons name="wrench-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                          <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>Last Service: </Text>
                          <Text style={{ color: theme.colors.text, fontSize: 13 }}>{formatShortDate(v.lastServiceDate)}</Text>
                        </View>
                      )}

                      {isBooked && expandedBookingReg === v.registrationNumber && (() => {
                        if (!bookingAlert) return null;
                        
                        return (
                          <View style={[styles.bookingDetailsContainer, { backgroundColor: theme.colors.primaryContainer + '20', borderColor: theme.colors.border }]}>
                            <View style={styles.bookingDetailsHeader}>
                              <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                              <Text style={[styles.bookingDetailsTitle, { color: theme.colors.text }]}>Booking Details</Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Slot/Date:</Text>
                              <Text style={[styles.bookingInfoValue, { color: theme.colors.text }]}>
                                {getBookingSlot(bookingAlert.makeModel)}
                              </Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Status:</Text>
                              <Text style={[
                                styles.bookingInfoValue, 
                                { 
                                  color: bookingAlert.status === 'Approved' ? theme.colors.success :
                                         bookingAlert.status === 'Pending' ? theme.colors.warning :
                                         theme.colors.placeholder,
                                  fontWeight: 'bold'
                                }
                              ]}>
                                {bookingAlert.status === 'Pending' ? 'Pending Confirmation' : 
                                 bookingAlert.status === 'Approved' ? 'Confirmed ✅' : 
                                 'Acknowledged'}
                              </Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Requested On:</Text>
                              <Text style={[styles.bookingInfoValue, { color: theme.colors.text }]}>
                                {new Date(bookingAlert.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          </View>
                        );
                      })()}

                      {isRejected && expandedBookingReg === v.registrationNumber && (() => {
                        if (!bookingAlert) return null;
                        
                        return (
                          <View style={[styles.bookingDetailsContainer, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error }]}>
                            <View style={styles.bookingDetailsHeader}>
                              <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                              <Text style={[styles.bookingDetailsTitle, { color: theme.colors.error, fontWeight: 'bold' }]}>Booking Rejected</Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Slot/Date:</Text>
                              <Text style={[styles.bookingInfoValue, { color: theme.colors.text }]}>
                                {getBookingSlot(bookingAlert.makeModel)}
                              </Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Reason:</Text>
                              <Text style={[styles.bookingInfoValue, { color: theme.colors.error, fontWeight: 'bold', flex: 1, textAlign: 'right' }]}>
                                {bookingAlert.rejectionReason || 'No reason provided.'}
                              </Text>
                            </View>
                            <View style={styles.bookingInfoRow}>
                              <Text style={[styles.bookingInfoLabel, { color: theme.colors.placeholder }]}>Requested On:</Text>
                              <Text style={[styles.bookingInfoValue, { color: theme.colors.text }]}>
                                {new Date(bookingAlert.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          </View>
                        );
                      })()}
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                    {/* Action Buttons */}
                    {v.status === 'Pending' ? (
                      <View style={[styles.pendingApprovalBox, { backgroundColor: theme.colors.warning + '10', borderColor: theme.colors.warning + '30' }]}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.warning} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: 'bold', flex: 1 }}>
                          Awaiting registration approval from garage staff. Booking will be enabled once approved.
                        </Text>
                      </View>
                    ) : v.status === 'Rejected' ? (
                      <View style={[styles.pendingApprovalBox, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error + '30', flexDirection: 'column', alignItems: 'flex-start' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="close-circle-outline" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                          <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: 'bold', flex: 1 }}>
                            Vehicle registration rejected by garage staff. You cannot book an MOT for this vehicle.
                          </Text>
                        </View>
                        {v.rejectionReason ? (
                          <View style={{ marginTop: 6, paddingLeft: 22 }}>
                            <Text style={{ fontSize: 11, color: theme.colors.error, fontWeight: 'bold' }}>Rejection Reason:</Text>
                            <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2 }}>{v.rejectionReason}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          onPress={() => handleMarkAsSold(v.id, v.registrationNumber, `${v.make} ${v.model}`)}
                          disabled={loadingAction !== null}
                          style={[styles.actionBtn, styles.soldBtn, { borderColor: theme.colors.border }]}
                        >
                          {loadingAction === `sold_${v.id}` ? (
                            <ActivityIndicator size="small" color={theme.colors.error} />
                          ) : (
                            <View style={styles.actionBtnContent}>
                              <MaterialCommunityIcons name="car-off" size={16} color={theme.colors.error} style={{ marginRight: 4 }} />
                              <Text style={[styles.actionBtnText, { color: theme.colors.error }]}>Mark Sold</Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        {isBooked ? (
                          <TouchableOpacity
                            onPress={() => navigation.navigate('Booking', { vehicle: v, isReschedule: true })}
                            disabled={loadingAction !== null}
                            style={[styles.actionBtn, styles.bookBtn, { backgroundColor: theme.colors.warning }]}
                          >
                            <View style={styles.actionBtnContent}>
                              <MaterialCommunityIcons 
                                name="calendar-edit" 
                                size={16} 
                                color={theme.dark ? theme.colors.background : '#FFFFFF'} 
                                style={{ marginRight: 4 }} 
                              />
                              <Text style={[styles.actionBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Reschedule</Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleBookMOT(v)}
                            disabled={loadingAction !== null}
                            style={[styles.actionBtn, styles.bookBtn, { backgroundColor: theme.colors.secondary }]}
                          >
                            <View style={styles.actionBtnContent}>
                              <MaterialCommunityIcons 
                                name="calendar-plus" 
                                size={16} 
                                color={theme.dark ? theme.colors.background : '#FFFFFF'} 
                                style={{ marginRight: 4 }} 
                              />
                              <Text style={[styles.actionBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Book MOT</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {activeTab === 'history' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 16 }]}>MOT Booking History</Text> */}
            {alerts.filter((a) => a.type === 'BOOKED' && a.customerId && (
              String(a.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
              String(a.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
            )).length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="history" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>
                  No booking history found.
                </Text>
              </View>
            ) : (
              alerts
                .filter((a) => a.type === 'BOOKED' && a.customerId && (
                  String(a.customerId).toLowerCase() === String(customer.id || '').toLowerCase() ||
                  String(a.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
                ))
                .map((item) => {
                  const isPending = item.status === 'Pending';
                  const isApproved = item.status === 'Approved';
                  const isRejected = item.status === 'Rejected';

                  let statusText = 'Completed';
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
                      key={item.id}
                      style={[styles.historyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    >
                      <View style={styles.historyCardHeader}>
                        <View style={styles.smallPlate}>
                          <Text style={styles.smallPlateText}>{item.registrationNumber}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
                          <Text style={[styles.statusText, { color: statusColor, fontSize: 10 }]}>{statusText}</Text>
                        </View>
                      </View>

                      <View style={styles.historyCardBody}>
                        <Text style={[styles.historyVehicleText, { color: theme.colors.text }]}>
                          {item.makeModel.split(' - Slot: ')[0]}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                          <MaterialCommunityIcons name="calendar-clock" size={14} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 13, color: theme.colors.text }}>
                            Slot: {getBookingSlot(item.makeModel)}
                          </Text>
                        </View>

                        {item.rescheduled && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.primary }}>Rescheduled</Text>
                          </View>
                        )}

                        {isRejected && (
                          <View style={[styles.rejectionReasonBox, { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error }]}>
                            <Text style={{ fontSize: 11, color: theme.colors.error, fontWeight: 'bold' }}>Rejection Reason:</Text>
                            <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 2 }}>
                              {item.rejectionReason || 'No reason provided.'}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.historyDate, { color: theme.colors.placeholder }]}>
                        Requested: {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  );
                })
            )}
          </ScrollView>
        )}

        {activeTab === 'profile' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Avatar & Verification Header Card */}
            <View style={[styles.profileHeaderCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={[styles.profileAvatar, { backgroundColor: theme.colors.secondary }]}>
                <Text style={styles.avatarText}>
                  {((customer.firstName[0] || '') + (customer.lastName[0] || '')).toUpperCase()}
                </Text>
              </View>
              <View style={{ marginLeft: 16, flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.profileName, { color: theme.colors.text }]} numberOfLines={1}>
                    {customer.firstName} {customer.lastName}
                  </Text>
                  <MaterialCommunityIcons name="check-decagram" size={16} color={theme.colors.success} style={{ marginLeft: 4 }} />
                </View>
                <Text style={{ color: theme.colors.placeholder, fontSize: 12, marginTop: 2 }}>
                  Member since {new Date(customer.createdDate || Date.now()).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
            </View>

            {/* Section: Personal Info */}
            <Text style={[styles.profileSectionTitle, { color: theme.colors.text }]}>Personal Details</Text>
            <View style={[styles.profileInfoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={[styles.profileRow, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.placeholder} style={{ marginRight: 10 }} />
                  <Text style={{ color: theme.colors.text, fontSize: 13 }}>Email</Text>
                </View>
                <Text style={{ color: theme.colors.placeholder, fontSize: 13, fontWeight: '500' }}>{customer.email}</Text>
              </View>

              <View style={[styles.profileRow, { borderBottomColor: 'transparent' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="phone-outline" size={18} color={theme.colors.placeholder} style={{ marginRight: 10 }} />
                  <Text style={{ color: theme.colors.text, fontSize: 13 }}>Mobile</Text>
                </View>
                <Text style={{ color: theme.colors.placeholder, fontSize: 13, fontWeight: '500' }}>{customer.mobile}</Text>
              </View>
            </View>

            {/* Section: Address */}
            {customer.address && (
              <>
                <Text style={[styles.profileSectionTitle, { color: theme.colors.text }]}>Address</Text>
                <View style={[styles.profileInfoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, paddingVertical: 14 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <MaterialCommunityIcons name="map-marker-outline" size={18} color={theme.colors.placeholder} style={{ marginRight: 10, marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.colors.text, fontSize: 13, lineHeight: 18 }}>{customer.address}</Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            {/* Section: Preferences */}
            <Text style={[styles.profileSectionTitle, { color: theme.colors.text }]}>Preferences</Text>
            <View style={[styles.profileInfoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              {/* Preferred Contact method */}
              {/* <View style={[styles.profileRow, { borderBottomColor: theme.colors.border, paddingVertical: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="bell-outline" size={18} color={theme.colors.placeholder} style={{ marginRight: 10 }} />
                  <Text style={{ color: theme.colors.text, fontSize: 13 }}>Preferred Contact</Text>
                </View>
                <View style={styles.contactPillRow}>
                  {['SMS', 'Email', 'WhatsApp'].map((method) => {
                    const isActive = customer.preferredContact === method;
                    const iconName = method === 'SMS' ? 'message-text-outline' :
                                     method === 'Email' ? 'email-outline' : 'whatsapp';
                    return (
                      <View 
                        key={method} 
                        style={[
                          styles.contactPill, 
                          isActive ? { backgroundColor: theme.colors.secondary + '20', borderColor: theme.colors.secondary } :
                                     { backgroundColor: theme.colors.background, borderColor: theme.colors.border }
                        ]}
                      >
                        <MaterialCommunityIcons 
                          name={iconName} 
                          size={11} 
                          color={isActive ? theme.colors.secondary : theme.colors.placeholder} 
                          style={{ marginRight: 2 }} 
                        />
                        <Text 
                          style={[
                            styles.contactPillText, 
                            { color: isActive ? theme.colors.secondary : theme.colors.placeholder }
                          ]}
                        >
                          {method}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View> */}

              {/* Theme Selector */}
              <View style={[styles.profileRow, { borderBottomColor: 'transparent', paddingVertical: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons 
                    name={isDarkMode ? "weather-night" : "weather-sunny"} 
                    size={18} 
                    color={theme.colors.placeholder} 
                    style={{ marginRight: 10 }} 
                  />
                  <Text style={{ color: theme.colors.text, fontSize: 13 }}>Dark Theme</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: theme.colors.border, true: theme.colors.secondary }}
                  thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                />
              </View>
            </View>

            {/* Logout button */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Sign Out',
                  'Are you sure you want to sign out?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign Out',
                      style: 'destructive',
                      onPress: () => {
                        setToken(null);
                        setUser(null);
                        navigation.replace('Login');
                      },
                    },
                  ]
                );
              }}
              style={[styles.profileLogoutBtn, { backgroundColor: theme.colors.error, borderWidth: 1, borderColor: theme.colors.error }]}
            >
              <MaterialCommunityIcons name="logout" size={18} color={"#fff"} style={{ marginRight: 6 }} />
              <Text style={{ color: "#fff", fontWeight: 'bold', fontSize: 14 }}>Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* Bottom Sticky Tab Footer */}
      <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border , borderTopWidth: 1} ]}>
        <TouchableOpacity
          onPress={() => setActiveTab('home')}
          style={styles.tabBtn}
        >
          <MaterialCommunityIcons 
            name={activeTab === 'home' ? "home" : "home-outline"} 
            size={22} 
            color={activeTab === 'home' ? theme.colors.secondary : theme.colors.placeholder} 
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'home' ? theme.colors.secondary : theme.colors.placeholder }]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('history')}
          style={styles.tabBtn}
        >
          <MaterialCommunityIcons 
            name={activeTab === 'history' ? "calendar-clock" : "calendar-clock-outline"} 
            size={22} 
            color={activeTab === 'history' ? theme.colors.secondary : theme.colors.placeholder} 
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'history' ? theme.colors.secondary : theme.colors.placeholder }]}>
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('profile')}
          style={styles.tabBtn}
        >
          <MaterialCommunityIcons 
            name={activeTab === 'profile' ? "account" : "account-outline"} 
            size={22} 
            color={activeTab === 'profile' ? theme.colors.secondary : theme.colors.placeholder} 
          />
          <Text style={[styles.tabLabel, { color: activeTab === 'profile' ? theme.colors.secondary : theme.colors.placeholder }]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  backBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    justifyContent: 'flex-end',
  },
  themeBtn: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  addNavBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeBlock: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  submitButton: {
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  formActionsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  cancelFormBtn: {
    flex: 1,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelFormBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  submitFormBtn: {
    flex: 1.5,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  vehicleCard: {
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
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 8,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 12,
  },
  plateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  makeModelText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  vehicleBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  soldBtn: {
    borderWidth: 1.2,
  },
  bookBtn: {
    elevation: 1,
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  bookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'center',
  },
  bookedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookingDetailsContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  bookingDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: 4,
  },
  bookingDetailsTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  bookingInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  bookingInfoLabel: {
    fontSize: 12,
  },
  bookingInfoValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  smallPlate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  smallPlateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    height: 56,
    borderTopWidth: 1,
    paddingBottom: 4,
    paddingTop: 6,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    borderWidth: 0.5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  statusText: {
    fontWeight: 'bold',
  },
  historyCardBody: {
    marginBottom: 8,
  },
  historyVehicleText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  rejectionReasonBox: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
  },
  historyDate: {
    fontSize: 10,
    textAlign: 'right',
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  profileSectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  contactPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  contactPillText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  profileInfoCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 2,
    marginBottom: 20,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  profileLogoutBtn: {
    height: 46,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // elevation: 1,
    marginBottom: 24,
  },
  pendingApprovalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 12,
    marginVertical: 8,
  },
});
