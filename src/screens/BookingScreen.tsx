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
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BookingScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { customers, addAlert, addAudit, user } = useAppValues();

  // Selected vehicle passed from CustomerPortalScreen
  const vehicle = route?.params?.vehicle || {
    registrationNumber: 'AB18 CDE',
    make: 'FORD',
    model: 'FOCUS TDCI',
    customerId: 'c1',
  };

  const isReschedule = route?.params?.isReschedule || false;

  const customer = customers.find((c) => 
    vehicle.customerId && (
      String(c.id).toLowerCase() === String(vehicle.customerId || '').toLowerCase() ||
      String(c._id).toLowerCase() === String(vehicle.customerId || '').toLowerCase()
    )
  ) || customers[0];

  if (!customer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10, color: theme.colors.text }}>Loading booking details...</Text>
      </SafeAreaView>
    );
  }

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
    const now = new Date();
    if (prev.getFullYear() < now.getFullYear() || (prev.getFullYear() === now.getFullYear() && prev.getMonth() < now.getMonth())) {
      return;
    }
    setCurrentViewDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
    setCurrentViewDate(next);
  };

  const calendarDays = getDaysInMonth(currentViewDate.getFullYear(), currentViewDate.getMonth());

  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTodayISOString = () => {
    const d = new Date();
    // If today is Sunday, default to tomorrow (Monday)
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    return formatLocalDate(d);
  };

  const [selectedDate, setSelectedDate] = useState(getTodayISOString());
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [garageSlots, setGarageSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const garageId = user?.garageId;

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
      console.error('Error fetching garage slots:', e);
      setGarageSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [garageId, selectedDate]);

  useEffect(() => {
    fetchGarageSlots();
  }, [fetchGarageSlots]);

  const isTimeSlotPassed = (slotTimeStr: string) => {
    const todayISO = formatLocalDate(new Date());
    if (selectedDate !== todayISO) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const match12 = slotTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let hour = parseInt(match12[1], 10);
      const min = parseInt(match12[2], 10);
      const period = match12[3].toUpperCase();
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      return currentHour > hour || (currentHour === hour && currentMin >= min);
    }

    const match24 = slotTimeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
      const hour = parseInt(match24[1], 10);
      const min = parseInt(match24[2], 10);
      return currentHour > hour || (currentHour === hour && currentMin >= min);
    }

    return false;
  };

  // Only free slots are shown to user/staff
  const freeSlots = React.useMemo(() => {
    return garageSlots.filter((s: any) => {
      if (s.isBlocked) return false;
      if (s.status === 'Full' || s.availableCount <= 0) return false;
      if (isTimeSlotPassed(s.time)) return false;
      return true;
    });
  }, [garageSlots, selectedDate]);

  useEffect(() => {
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
    if (!selectedDate || !selectedTime) {
      Alert.alert('Error', 'Please select a date and time slot.');
      return;
    }

    setLoading(true);
    try {
      const parts = selectedDate.split('-');
      const monthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const displayDateStr = parts.length === 3 
        ? `${parseInt(parts[2])} ${monthsList[parseInt(parts[1]) - 1]}`
        : selectedDate;

      const isAdmin = route?.params?.isAdmin || false;

      // Add BOOKED alert notification to Admin alerts list
      await addAlert({
        type: 'BOOKED',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        garageId: user?.garageId,
        slotTime: selectedSlot?.time || selectedTime,
        duration: selectedSlot?.slotDuration || 45,
        registrationNumber: vehicle.registrationNumber,
        makeModel: `${vehicle.make} ${vehicle.model} - Slot: ${selectedSlot?.time || selectedTime}`,
        status: isAdmin ? 'Approved' : 'Pending',
        date: selectedDate,
      });

      // Log to audit history
      await addAudit(
        isReschedule ? 'MOT Booking Rescheduled' : (isAdmin ? 'MOT Booking Booked' : 'MOT Booking Requested'),
        isAdmin
          ? `Garage staff booked MOT booking slot for ${customer.firstName} ${customer.lastName}'s ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}) on ${displayDateStr} at ${selectedTime}`
          : `${customer.firstName} ${customer.lastName} ${isReschedule ? 'rescheduled' : 'requested'} MOT booking slot for ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}) on ${displayDateStr} at ${selectedTime}`
      );

      setLoading(false);

      // Show Toast Notification
      const successMessage = isReschedule
        ? `MOT Booking rescheduled successfully for ${displayDateStr}!`
        : (isAdmin 
            ? `MOT Booking confirmed and approved for ${customer.firstName} ${customer.lastName}!`
            : `MOT Booking request submitted successfully for ${displayDateStr}!`);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: successMessage,
      });

      // Navigate back
      try {
        if (route?.params?.sourceScreen) {
          navigation.navigate(route.params.sourceScreen, route.params.sourceScreenParams || {});
        } else {
          navigation.navigate('CustomerPortal', { customerId: customer.id });
        }
      } catch (navErr) {
        console.warn('Navigation redirect failed, falling back to goBack:', navErr);
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Main', { screen: 'Customers' });
        }
      }
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
          {/* <Text style={[styles.backBtnText, { color: theme.colors.text }]}>Back</Text> */}
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>
          {isReschedule ? 'Reschedule MOT Slot' : 'Book MOT Slot'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Vehicle Summary Header Card */}
        <View style={[styles.vehicleCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.ukPlateContainer}>
            <View style={styles.ukPlateBlueSide}>
              <Text style={styles.ukPlateFlagText}>🇬🇧</Text>
              <Text style={styles.ukPlateGbText}>UK</Text>
            </View>
            <View style={styles.ukPlateNumberSide}>
              <Text style={styles.ukPlateNumberText}>
                {(vehicle.registrationNumber || 'UNKNOWN').toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.vehicleMakeModel, { color: theme.colors.text }]} numberOfLines={1}>
              {vehicle.make} {vehicle.model}
            </Text>
            <Text style={[styles.vehicleSubText, { color: theme.colors.placeholder }]}>
              {isReschedule ? 'Rescheduling appointment for this vehicle' : 'Booking an MOT appointment for this vehicle'}
            </Text>
          </View>
        </View>

        {isReschedule && (
          <View style={[styles.rescheduleNotice, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
            <Text style={[styles.rescheduleNoticeText, { color: theme.colors.text }]}>
              You are rescheduling your existing MOT booking. The new date and slot will replace your current reservation upon confirmation.
            </Text>
          </View>
        )}

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

        {/* Time Selector Section (Only Free 45-Min Slots) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
            <Text style={[styles.sectionHeading, { color: theme.colors.text, marginBottom: 0 }]}>
              2. Choose Time Slot (45 Mins)
            </Text>
          </View>
          {loadingSlots && <ActivityIndicator size="small" color={theme.colors.secondary} />}
        </View>

        {loadingSlots ? (
          <View style={[styles.emptyNoticeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <ActivityIndicator size="small" color={theme.colors.secondary} style={{ marginRight: 8 }} />
            <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>
              Checking free slots...
            </Text>
          </View>
        ) : freeSlots.length === 0 ? (
          <View style={[styles.emptyNoticeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="calendar-remove" size={24} color={theme.colors.error} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontSize: 13.5, fontWeight: '700' }}>
                No Free Slots Available
              </Text>
              <Text style={{ color: theme.colors.placeholder, fontSize: 12, marginTop: 2 }}>
                All MOT slots are fully booked or closed on this date. Please select another date.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.timePickerContainer}>
            {freeSlots.map((slot: any) => {
              const isSelected = selectedTime === slot.time;
              return (
                <TouchableOpacity
                  key={slot.time}
                  onPress={() => {
                    setSelectedSlot(slot);
                    setSelectedTime(slot.time);
                  }}
                  style={[
                    styles.timeCard,
                    {
                      backgroundColor: isSelected ? theme.colors.secondary + '18' : theme.colors.card,
                      borderColor: isSelected ? theme.colors.secondary : theme.colors.border,
                      borderWidth: isSelected ? 2 : 1.5,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.timeLabel, { color: theme.colors.text, fontSize: 14, fontWeight: '800' }]}>
                        {slot.time}
                      </Text>
                      {isSelected ? (
                        <MaterialCommunityIcons name="check-circle" size={16} color={theme.colors.secondary} />
                      ) : (
                        <View style={{ backgroundColor: '#10B98115', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                          <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '700' }}>
                            {slot.availableCount} Open
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.timeText, { color: theme.colors.placeholder, fontSize: 11, marginTop: 2 }]}>
                      {slot.slotLabel || `${slot.time} - ${slot.endTime || '45m'}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Notes/Comments Section */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>3. Special Requests / Notes (Optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="E.g., Rear brakes squealing, please check them during test."
          placeholderTextColor={theme.colors.placeholder}
          multiline
          numberOfLines={4}
          style={[
            styles.notesInput,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            },
          ]}
        />

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            onPress={handleConfirmBooking}
            disabled={loading}
            style={[styles.submitBtn, { backgroundColor: isReschedule ? theme.colors.warning : theme.colors.secondary }]}
          >
            {loading ? (
              <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
            ) : (
              <View style={styles.btnContent}>
                <MaterialCommunityIcons 
                  name="calendar-check" 
                  size={20} 
                  color={theme.dark ? theme.colors.background : '#FFFFFF'} 
                  style={{ marginRight: 8 }} 
                />
                <Text style={[styles.submitBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>
                  {isReschedule ? 'Confirm Rescheduling' : 'Confirm Appointment Booking'}
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
  backBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    gap: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
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
    fontSize: 14,
    letterSpacing: 1.5,
  },
  vehicleMakeModel: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  vehicleSubText: {
    fontSize: 12,
  },
  sectionHeading: {
    fontSize: 14,
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
    marginBottom: 16,
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
    height: 90,
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
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rescheduleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  rescheduleNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
