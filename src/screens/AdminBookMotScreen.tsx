import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const STANDARD_SLOTS = [
  '08:30', '09:15', '10:00', '10:45',
  '11:30', '12:15', '13:00', '13:45',
  '14:30', '15:15', '16:00', '16:45'
];

const getSlotNumber = (item: any) => {
  if (item?.slotNumber) return item.slotNumber;
  let timeStr = item?.slotTime || '';
  if (!timeStr && item?.makeModel) {
    const match = item.makeModel.match(/Slot:\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i) ||
                  item.makeModel.match(/at\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
    if (match) timeStr = match[1];
  }
  if (timeStr) {
    const start = timeStr.split(' - ')[0].trim();
    const idx = STANDARD_SLOTS.indexOf(start);
    if (idx !== -1) return idx + 1;
  }
  return null;
};

const formatBookingDate = (dateVal: any) => {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch (e) {}
  return String(dateVal);
};

export default function AdminBookMotScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { addAlert, addAudit, refreshData, user, vehicles = [], alerts = [] } = useAppValues();

  // Selected customer and vehicle passed from AdminCustomersScreen
  const customer = route?.params?.customer || {
    id: 'unknown',
    firstName: 'Unknown',
    lastName: 'Customer',
    email: 'N/A',
  };

  const initialVehicle = route?.params?.vehicle || {
    registrationNumber: 'AB18 CDE',
    make: 'FORD',
    model: 'FOCUS TDCI',
    customerId: 'c1',
  };

  // Find all customer vehicles to allow switching & showing booking status
  const customerVehicles = React.useMemo(() => {
    const directList = route?.params?.allVehicles;
    if (Array.isArray(directList) && directList.length > 0) return directList;
    return vehicles.filter((v: any) => 
      v.customerId && (
        String(v.customerId).toLowerCase() === String(customer.id).toLowerCase() ||
        String(v.customerId).toLowerCase() === String(customer._id || '').toLowerCase()
      ) && v.status !== 'Sold' && v.status !== 'Scrapped'
    );
  }, [vehicles, customer, route?.params?.allVehicles]);

  const [selectedVehicle, setSelectedVehicle] = useState<any>(
    initialVehicle || (customerVehicles.length > 0 ? customerVehicles[0] : null)
  );

  // Check if selected vehicle already has an active MOT booking
  const existingBooking = React.useMemo(() => {
    if (!selectedVehicle?.registrationNumber) return null;
    return alerts.find(a => 
      a.type === 'BOOKED' && 
      a.registrationNumber?.toUpperCase() === selectedVehicle.registrationNumber.toUpperCase() && 
      (a.status === 'Approved' || a.status === 'Pending')
    );
  }, [alerts, selectedVehicle]);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [garageSlots, setGarageSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotFilter, setSlotFilter] = useState<'all' | 'available' | 'booked'>('all');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const garageId = user?.garageId;

  // Date and Time options for slot selection
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    const firstDayIndex = date.getDay(); // 0 = Sun, 6 = Sat
    
    // Empty slots before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      days.push(new Date(year, month, d));
    }
    
    return days;
  };

  const isDateSelectable = (date: Date | null) => {
    if (!date) return false;
    const currentToday = new Date();
    currentToday.setHours(0, 0, 0, 0);
    
    // Past days
    if (date < currentToday) return false;
    
    // Sundays
    if (date.getDay() === 0) return false;
    
    return true;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    const prev = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1);
    setCurrentViewDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
    setCurrentViewDate(next);
  };

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const calendarDays = getDaysInMonth(currentViewDate.getFullYear(), currentViewDate.getMonth());

  // Fetch live slots for the garage
  const fetchGarageSlots = React.useCallback(async () => {
    if (!garageId || !selectedDate) {
      setGarageSlots([]);
      return;
    }

    setLoadingSlots(true);
    try {
      const res = await fetch(`${BASE_URL}/garages/${garageId}/slots?date=${selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        setGarageSlots(data.slots || []);
      } else {
        setGarageSlots([]);
      }
    } catch (e) {
      console.error('Error fetching garage slots in AdminBookMot:', e);
      setGarageSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [garageId, selectedDate]);

  React.useEffect(() => {
    fetchGarageSlots();
  }, [fetchGarageSlots]);

  const isTimeSlotPassed = (timeStr: string) => {
    if (!selectedDate) return false;
    const todayStr = formatLocalDate(new Date());
    if (selectedDate !== todayStr) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let hour = parseInt(match12[1], 10);
      const min = parseInt(match12[2], 10);
      const period = match12[3].toUpperCase();
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      return currentHour > hour || (currentHour === hour && currentMin >= min);
    }

    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      const hour = parseInt(match24[1], 10);
      const min = parseInt(match24[2], 10);
      return currentHour > hour || (currentHour === hour && currentMin >= min);
    }

    return false;
  };

  // Only free slots are eligible for selection
  const freeSlots = React.useMemo(() => {
    return garageSlots.filter((s: any) => {
      if (s.isBlocked) return false;
      if (s.status === 'Full' || s.availableCount <= 0) return false;
      if (isTimeSlotPassed(s.time)) return false;
      return true;
    });
  }, [garageSlots, selectedDate]);

  // Slots to display based on staff filter
  const displayedSlots = React.useMemo(() => {
    return garageSlots.filter((s: any) => {
      const isPassed = isTimeSlotPassed(s.time);
      const isAvailable = !s.isBlocked && s.status !== 'Full' && s.availableCount > 0 && !isPassed;
      if (slotFilter === 'available') return isAvailable;
      if (slotFilter === 'booked') return !isAvailable;
      return true;
    });
  }, [garageSlots, slotFilter, selectedDate]);

  React.useEffect(() => {
    if (freeSlots.length > 0) {
      if (!selectedSlot || !freeSlots.some((s: any) => s.time === selectedSlot.time)) {
        setSelectedSlot(freeSlots[0]);
        setSelectedTime(freeSlots[0].time);
      }
    } else {
      setSelectedSlot(null);
      setSelectedTime('');
    }
  }, [freeSlots]);

  const handleConfirmBooking = async () => {
    if (!selectedVehicle) {
      Alert.alert('Vehicle Missing', 'Please select a vehicle to book MOT.');
      return;
    }
    if (!selectedDate) {
      Alert.alert('Selection Missing', 'Please select an appointment date.');
      return;
    }
    if (!selectedTime) {
      Alert.alert('Selection Missing', 'Please select a time slot.');
      return;
    }

    setLoading(true);

    try {
      const parts = selectedDate.split('-');
      const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const displayDateStr = parts.length === 3 
        ? `${parseInt(parts[2])} ${monthsList[parseInt(parts[1]) - 1]}`
        : selectedDate;

      const slotNum = selectedSlot?.slotNumber || getSlotNumber({ slotTime: selectedTime });

      // Add BOOKED alert notification directly with Approved status
      await addAlert({
        type: 'BOOKED',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        garageId: user?.garageId,
        slotTime: selectedSlot?.time || selectedTime,
        slotNumber: slotNum,
        duration: selectedSlot?.slotDuration || 45,
        registrationNumber: selectedVehicle.registrationNumber,
        makeModel: `${selectedVehicle.make} ${selectedVehicle.model} - Slot: ${selectedSlot?.time || selectedTime}`,
        status: 'Approved',
        date: selectedDate,
      });

      // Log to audit history
      await addAudit(
        existingBooking ? 'MOT Booking Rescheduled' : 'MOT Booking Booked',
        `Garage staff ${existingBooking ? 'rescheduled' : 'booked'} MOT slot for ${customer.firstName} ${customer.lastName}'s ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.registrationNumber}) on ${displayDateStr} at Slot #${slotNum || 'Slot'} (${selectedTime})`
      );

      await refreshData();
      setLoading(false);

      // Show Toast Notification
      const successMessage = existingBooking
        ? `MOT Booking successfully rescheduled for ${customer.firstName} ${customer.lastName} (${selectedVehicle.registrationNumber})!`
        : `MOT Booking confirmed and approved for ${customer.firstName} ${customer.lastName}!`;
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: successMessage,
      });

      // Navigate directly to BookedMots screen
      navigation.navigate('BookedMots');
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Error', err.message || 'Failed to confirm booking slot.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>
          Book MOT (Admin Flow)
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Modern Vehicle & Customer Summary Card */}
        <View style={[styles.vehicleMasterCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {/* Card Top: Garage Action Badge */}
          <View style={styles.cardTopBadgeRow}>
            <View style={[styles.staffDirectBadge, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
              <MaterialCommunityIcons name="shield-check" size={14} color="#10B981" />
              <Text style={styles.staffDirectBadgeText}>Garage Staff Direct Booking • Instant Approval</Text>
            </View>
          </View>

          {/* Customer Vehicles Selector Strip (If Multiple Vehicles) */}
          {customerVehicles.length > 1 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.placeholder, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                Select Vehicle to Book ({customerVehicles.length} Registered):
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                {customerVehicles.map((v: any) => {
                  const isSel = selectedVehicle?.registrationNumber === v.registrationNumber;
                  const vBooking = alerts.find(a => 
                    a.type === 'BOOKED' && 
                    a.registrationNumber?.toUpperCase() === v.registrationNumber?.toUpperCase() && 
                    (a.status === 'Approved' || a.status === 'Pending')
                  );
                  const isBk = vBooking?.status === 'Approved';
                  const isPend = vBooking?.status === 'Pending';

                  return (
                    <TouchableOpacity
                      key={v.id || v.registrationNumber}
                      onPress={() => setSelectedVehicle(v)}
                      style={[
                        styles.vehicleSelectorChip,
                        {
                          backgroundColor: isSel ? theme.colors.secondary + '18' : theme.colors.background,
                          borderColor: isSel ? theme.colors.secondary : theme.colors.border,
                          borderWidth: isSel ? 2 : 1,
                        }
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: theme.colors.text }}>
                          {v.registrationNumber}
                        </Text>
                        {isSel && (
                          <MaterialCommunityIcons name="check-circle" size={13} color={theme.colors.secondary} style={{ marginLeft: 4 }} />
                        )}
                      </View>
                      <Text style={{ fontSize: 10, color: theme.colors.placeholder, marginTop: 1 }}>
                        {v.make} {v.model}
                      </Text>
                      {isBk ? (
                        <View style={{ backgroundColor: theme.colors.secondary + '20', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3, marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="calendar-check" size={10} color={theme.colors.secondary} style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: theme.colors.secondary }}>
                            Booked: {formatBookingDate(vBooking.date)}
                          </Text>
                        </View>
                      ) : isPend ? (
                        <View style={{ backgroundColor: theme.colors.warning + '20', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3, marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="clock-outline" size={10} color={theme.colors.warning} style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: theme.colors.warning }}>
                            Pending Approval
                          </Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: '#10B98120', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3, marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="check-circle-outline" size={10} color="#10B981" style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#10B981' }}>
                            Available
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Vehicle Main Section */}
          <View style={styles.vehicleMainSection}>
            {/* Realistic UK Plate */}
            <View style={styles.ukPlateContainer}>
              <View style={styles.ukPlateBlueSide}>
                <Text style={styles.ukPlateFlagText}>🇬🇧</Text>
                <Text style={styles.ukPlateGbText}>UK</Text>
              </View>
              <View style={styles.ukPlateNumberSide}>
                <Text style={styles.ukPlateNumberText}>
                  {(selectedVehicle?.registrationNumber || 'UNKNOWN').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Vehicle Details */}
            <View style={styles.vehicleTextInfo}>
              <Text style={[styles.vehicleTitleText, { color: theme.colors.text }]} numberOfLines={1}>
                {selectedVehicle?.make} {selectedVehicle?.model}
              </Text>
              <View style={styles.vehicleBadgesRow}>
                {selectedVehicle?.year ? (
                  <View style={[styles.specChip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <MaterialCommunityIcons name="calendar" size={11} color={theme.colors.placeholder} />
                    <Text style={[styles.specChipText, { color: theme.colors.placeholder }]}>{selectedVehicle.year}</Text>
                  </View>
                ) : null}
                <View style={[styles.specChip, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
                  <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.specChipText, { color: '#10B981', fontWeight: '700' }]}>
                    {selectedVehicle?.status || 'Active'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Already Booked MOT Alert Banner */}
          {existingBooking && (
            <View style={[styles.existingBookingBanner, { backgroundColor: theme.colors.secondary + '14', borderColor: theme.colors.secondary + '40' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="calendar-clock" size={18} color={theme.colors.secondary} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.text, flex: 1 }}>
                  Vehicle Already Has A Booked MOT Slot
                </Text>
                <View style={[styles.bookingStatusTag, { backgroundColor: existingBooking.status === 'Approved' ? theme.colors.secondary : theme.colors.warning }]}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#FFFFFF' }}>
                    {existingBooking.status === 'Approved' ? 'Confirmed' : 'Pending'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: theme.colors.text, marginTop: 4 }}>
                Existing Appointment: <Text style={{ fontWeight: 'bold' }}>{formatBookingDate(existingBooking.date)}</Text> at <Text style={{ fontWeight: 'bold' }}>{existingBooking.slotTime || 'Slot'}</Text>
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.secondary, marginTop: 4, fontWeight: '600' }}>
                ℹ️ Proceeding with a new slot below will reschedule / update this vehicle's appointment.
              </Text>
            </View>
          )}

          {/* Key Vehicle Dates Row */}
          {(selectedVehicle?.motExpiryDate || selectedVehicle?.lastServiceDate) && (
            <View style={[styles.datesInfoGrid, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              {selectedVehicle?.motExpiryDate && (
                <View style={styles.dateCol}>
                  <View style={styles.dateColHeader}>
                    <MaterialCommunityIcons name="calendar-clock" size={13} color={theme.colors.warning} />
                    <Text style={[styles.dateColLabel, { color: theme.colors.placeholder }]}>MOT Expiry</Text>
                  </View>
                  <Text style={[styles.dateColValue, { color: theme.colors.text }]}>
                    {new Date(selectedVehicle.motExpiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              )}
              {selectedVehicle?.lastServiceDate && (
                <View style={[styles.dateCol, { borderLeftWidth: 1, borderLeftColor: theme.colors.border, paddingLeft: 12 }]}>
                  <View style={styles.dateColHeader}>
                    <MaterialCommunityIcons name="wrench-clock" size={13} color={theme.colors.secondary} />
                    <Text style={[styles.dateColLabel, { color: theme.colors.placeholder }]}>Last Service</Text>
                  </View>
                  <Text style={[styles.dateColValue, { color: theme.colors.text }]}>
                    {new Date(selectedVehicle.lastServiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Customer Strip Footer */}
          <View style={[styles.customerStrip, { borderTopColor: theme.colors.border }]}>
            <View style={[styles.customerAvatar, { backgroundColor: theme.colors.secondary + '20' }]}>
              <Text style={[styles.customerAvatarText, { color: theme.colors.secondary }]}>
                {((customer.firstName?.[0] || '') + (customer.lastName?.[0] || '')).toUpperCase() || 'CU'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={styles.custNameRow}>
                <Text style={[styles.customerNameText, { color: theme.colors.text }]}>
                  {customer.firstName} {customer.lastName}
                </Text>
                {customer.preferredContact && (
                  <View style={[styles.contactPrefBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Text style={[styles.contactPrefText, { color: theme.colors.primary }]}>
                      {customer.preferredContact}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.custContactMeta}>
                {customer.mobile ? (
                  <View style={styles.contactItem}>
                    <MaterialCommunityIcons name="phone" size={12} color={theme.colors.placeholder} />
                    <Text style={[styles.contactItemText, { color: theme.colors.placeholder }]}>{customer.mobile}</Text>
                  </View>
                ) : null}
                {customer.email ? (
                  <View style={[styles.contactItem, { marginLeft: 10 }]}>
                    <MaterialCommunityIcons name="email" size={12} color={theme.colors.placeholder} />
                    <Text style={[styles.contactItemText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                      {customer.email}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Date Selector Section */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>1. Select Appointment Date</Text>
        <View style={[styles.calendarCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {/* Header */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.calNavBtn}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.calendarTitle, { color: theme.colors.text }]}>
              {monthNames[currentViewDate.getMonth()]} {currentViewDate.getFullYear()}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.calNavBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={styles.weekdayRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, index) => (
              <Text key={d} style={[styles.weekdayText, { color: index === 0 ? theme.colors.error : theme.colors.placeholder }]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <View key={`empty-${idx}`} style={styles.dayCell} />;
              }

              const isoString = formatLocalDate(day);
              const isSelected = selectedDate === isoString;
              const selectable = isDateSelectable(day);
              
              const todayObj = new Date();
              const isToday = day.getDate() === todayObj.getDate() && 
                              day.getMonth() === todayObj.getMonth() && 
                              day.getFullYear() === todayObj.getFullYear();

              return (
                <TouchableOpacity
                  key={isoString}
                  disabled={!selectable}
                  onPress={() => setSelectedDate(isoString)}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: theme.colors.secondary, borderRadius: 18 },
                    isToday && !isSelected && { borderWidth: 1, borderColor: theme.colors.secondary, borderRadius: 18 }
                  ]}
                >
                  <Text
                    style={[
                      styles.dayCellText,
                      { color: theme.colors.text },
                      isSelected && { color: '#FFFFFF', fontWeight: 'bold' },
                      !selectable && { color: theme.colors.placeholder + '40' }
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time Selector Section */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>
              2. Choose MOT Test Slot
            </Text>
          </View>
          {loadingSlots && <ActivityIndicator size="small" color={theme.colors.secondary} />}
        </View>

        {!selectedDate ? (
          <View style={[styles.emptyNoticeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="calendar-clock" size={22} color={theme.colors.placeholder} />
            <Text style={{ marginLeft: 8, color: theme.colors.placeholder, fontSize: 13 }}>
              Please select an appointment date above to view garage slots.
            </Text>
          </View>
        ) : loadingSlots ? (
          <View style={[styles.emptyNoticeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <ActivityIndicator size="small" color={theme.colors.secondary} style={{ marginRight: 8 }} />
            <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>
              Checking garage slot schedule...
            </Text>
          </View>
        ) : garageSlots.length === 0 ? (
          <View style={[styles.emptyNoticeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="calendar-remove" size={24} color={theme.colors.error} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontSize: 13.5, fontWeight: '700' }}>
                No Slots Configured
              </Text>
              <Text style={{ color: theme.colors.placeholder, fontSize: 12, marginTop: 2 }}>
                No MOT slots were found for this garage on this date.
              </Text>
            </View>
          </View>
        ) : (
          <View>
            {/* Slot Summary Bar */}
            <View style={[styles.slotSummaryBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.summaryStat}>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{garageSlots.length}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>Total Slots</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.summaryStat}>
                <Text style={[styles.statValue, { color: '#10B981' }]}>{freeSlots.length}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>Available</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.summaryStat}>
                <Text style={[styles.statValue, { color: theme.colors.error }]}>
                  {garageSlots.length - freeSlots.length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.placeholder }]}>Booked / Full</Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <View style={styles.slotFilterRow}>
              <TouchableOpacity
                onPress={() => setSlotFilter('all')}
                style={[
                  styles.slotFilterTab,
                  {
                    backgroundColor: slotFilter === 'all' ? theme.colors.secondary : theme.colors.card,
                    borderColor: slotFilter === 'all' ? theme.colors.secondary : theme.colors.border,
                  }
                ]}
              >
                <Text style={[styles.slotFilterText, { color: slotFilter === 'all' ? '#FFFFFF' : theme.colors.text }]}>
                  All Slots ({garageSlots.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSlotFilter('available')}
                style={[
                  styles.slotFilterTab,
                  {
                    backgroundColor: slotFilter === 'available' ? '#10B981' : theme.colors.card,
                    borderColor: slotFilter === 'available' ? '#10B981' : theme.colors.border,
                  }
                ]}
              >
                <Text style={[styles.slotFilterText, { color: slotFilter === 'available' ? '#FFFFFF' : theme.colors.text }]}>
                  Available ({freeSlots.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSlotFilter('booked')}
                style={[
                  styles.slotFilterTab,
                  {
                    backgroundColor: slotFilter === 'booked' ? theme.colors.error : theme.colors.card,
                    borderColor: slotFilter === 'booked' ? theme.colors.error : theme.colors.border,
                  }
                ]}
              >
                <Text style={[styles.slotFilterText, { color: slotFilter === 'booked' ? '#FFFFFF' : theme.colors.text }]}>
                  Booked / Full ({garageSlots.length - freeSlots.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Slots List */}
            <View style={styles.slotsListContainer}>
              {displayedSlots.map((slot: any, idx: number) => {
                const isPassed = isTimeSlotPassed(slot.time);
                const isAvailable = !slot.isBlocked && slot.status !== 'Full' && slot.availableCount > 0 && !isPassed;
                const isSelected = selectedTime === slot.time;
                const slotNum = slot.slotNumber || (idx + 1);

                return (
                  <TouchableOpacity
                    key={slot.time}
                    disabled={!isAvailable}
                    onPress={() => {
                      setSelectedSlot(slot);
                      setSelectedTime(slot.time);
                    }}
                    style={[
                      styles.detailedSlotCard,
                      {
                        backgroundColor: isSelected 
                          ? theme.colors.secondary + '18' 
                          : isAvailable 
                            ? theme.colors.card 
                            : theme.colors.background,
                        borderColor: isSelected 
                          ? theme.colors.secondary 
                          : isAvailable 
                            ? theme.colors.border 
                            : theme.colors.border + '60',
                        borderWidth: isSelected ? 2 : 1,
                        opacity: isAvailable ? 1 : 0.75,
                      }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.slotIndexBadge, { backgroundColor: isSelected ? theme.colors.secondary : theme.colors.border + '40' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: isSelected ? '#FFFFFF' : theme.colors.text }}>
                            #{slotNum}
                          </Text>
                        </View>
                        <Text style={[styles.slotTimeTitle, { color: theme.colors.text, marginLeft: 8 }]}>
                          {slot.time} - {slot.endTime || '45m'}
                        </Text>
                      </View>

                      {/* Status Tag */}
                      {isSelected ? (
                        <View style={[styles.slotStatusTag, { backgroundColor: theme.colors.secondary }]}>
                          <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" style={{ marginRight: 3 }} />
                          <Text style={[styles.slotStatusTagText, { color: '#FFFFFF' }]}>Selected</Text>
                        </View>
                      ) : isPassed ? (
                        <View style={[styles.slotStatusTag, { backgroundColor: theme.colors.border }]}>
                          <MaterialCommunityIcons name="clock-alert-outline" size={11} color={theme.colors.placeholder} style={{ marginRight: 3 }} />
                          <Text style={[styles.slotStatusTagText, { color: theme.colors.placeholder }]}>Past Time</Text>
                        </View>
                      ) : slot.isBlocked ? (
                        <View style={[styles.slotStatusTag, { backgroundColor: theme.colors.border }]}>
                          <MaterialCommunityIcons name="cancel" size={11} color={theme.colors.error} style={{ marginRight: 3 }} />
                          <Text style={[styles.slotStatusTagText, { color: theme.colors.error }]}>Blocked</Text>
                        </View>
                      ) : isAvailable ? (
                        <View style={[styles.slotStatusTag, { backgroundColor: '#10B98118', borderColor: '#10B98140', borderWidth: 0.5 }]}>
                          <MaterialCommunityIcons name="check-circle" size={11} color="#10B981" style={{ marginRight: 3 }} />
                          <Text style={[styles.slotStatusTagText, { color: '#10B981' }]}>
                            {slot.availableCount} {slot.availableCount === 1 ? 'Bay' : 'Bays'} Available
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.slotStatusTag, { backgroundColor: theme.colors.error + '18', borderColor: theme.colors.error + '40', borderWidth: 0.5 }]}>
                          <MaterialCommunityIcons name="close-circle" size={11} color={theme.colors.error} style={{ marginRight: 3 }} />
                          <Text style={[styles.slotStatusTagText, { color: theme.colors.error }]}>Fully Booked</Text>
                        </View>
                      )}
                    </View>

                    {/* Booked vehicle / customer details if occupied */}
                    {slot.bookings && slot.bookings.length > 0 && (
                      <View style={[styles.slotOccupiedBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.placeholder, textTransform: 'uppercase', marginBottom: 2 }}>
                          Occupied Bays ({slot.bookings.length}/{slot.totalCapacity || slot.bookings.length}):
                        </Text>
                        {slot.bookings.map((b: any, bIdx: number) => (
                          <View key={b.id || bIdx} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <MaterialCommunityIcons name="car-side" size={12} color={theme.colors.secondary} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text }}>
                              {b.registrationNumber || 'Vehicle'} • {b.customerName || 'Customer'}
                            </Text>
                            {b.stationName ? (
                              <Text style={{ fontSize: 10, color: theme.colors.placeholder, marginLeft: 4 }}>
                                ({b.stationName})
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Notes Input */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text, marginTop: 16 }]}>3. Staff Booking Notes (Optional)</Text>
        <TextInput
          style={[styles.notesInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
          placeholder="Enter any customer requests, parts updates or booking comments here..."
          placeholderTextColor={theme.colors.placeholder}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {/* Booking Summary Box Before Confirmation */}
        {selectedDate && selectedTime && (
          <View style={[styles.bookingSummaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <MaterialCommunityIcons name="file-document-check-outline" size={18} color={theme.colors.secondary} style={{ marginRight: 6 }} />
              <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
                Booking Confirmation Summary
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Customer:</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {customer.firstName} {customer.lastName}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Vehicle:</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {selectedVehicle?.registrationNumber} ({selectedVehicle?.make} {selectedVehicle?.model})
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Appointment Date:</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                {formatBookingDate(selectedDate)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Selected Slot:</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.secondary, fontWeight: 'bold' }]}>
                Slot #{selectedSlot?.slotNumber || getSlotNumber({ slotTime: selectedTime })} ({selectedSlot?.time || selectedTime} - {selectedSlot?.endTime || '45m'})
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Action Type:</Text>
              <Text style={[styles.summaryValue, { color: existingBooking ? theme.colors.warning : '#10B981', fontWeight: 'bold' }]}>
                {existingBooking ? 'Reschedule Active Booking' : 'Direct Booking & Instant Approval'}
              </Text>
            </View>
          </View>
        )}

        {/* Submit Action */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            onPress={handleConfirmBooking}
            disabled={loading}
            style={[styles.submitBtn, { backgroundColor: existingBooking ? theme.colors.warning : theme.colors.secondary }]}
          >
            {loading ? (
              <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} />
            ) : (
              <View style={styles.btnContent}>
                <MaterialCommunityIcons name="calendar-check" size={20} color={theme.dark ? theme.colors.background : '#FFFFFF'} style={{ marginRight: 6 }} />
                <Text style={[styles.submitBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>
                  {existingBooking ? 'Confirm & Reschedule Booking' : 'Confirm & Approve Booking'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  vehicleMasterCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
  },
  cardTopBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  staffDirectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  staffDirectBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  vehicleMainSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ukPlateContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFD700',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  ukPlateBlueSide: {
    backgroundColor: '#003399',
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ukPlateFlagText: {
    fontSize: 10,
    lineHeight: 12,
  },
  ukPlateGbText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  ukPlateNumberSide: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ukPlateNumberText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1.5,
  },
  vehicleTextInfo: {
    flex: 1,
  },
  vehicleTitleText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  vehicleBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  specChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  datesInfoGrid: {
    flexDirection: 'row',
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateCol: {
    flex: 1,
  },
  dateColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  dateColLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateColValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  customerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  custNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerNameText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  contactPrefBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  contactPrefText: {
    fontSize: 10,
    fontWeight: '700',
  },
  custContactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactItemText: {
    fontSize: 11.5,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calNavBtn: {
    padding: 4,
  },
  calendarTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    paddingBottom: 6,
    marginBottom: 8,
  },
  weekdayText: {
    width: '14.2%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  dayCell: {
    width: '14.2%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellText: {
    fontSize: 13,
  },
  timePickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  timeCard: {
    width: '48%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  emptyNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 20,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 11,
    marginTop: 1,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 28,
  },
  actionContainer: {
    marginBottom: 20,
  },
  submitBtn: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  vehicleSelectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
  },
  existingBookingBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bookingStatusTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  summaryStat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  slotFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  slotFilterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  slotsListContainer: {
    gap: 10,
    marginBottom: 14,
  },
  detailedSlotCard: {
    padding: 12,
    borderRadius: 10,
  },
  slotIndexBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotTimeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  slotStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotStatusTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  slotOccupiedBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  bookingSummaryCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
});
