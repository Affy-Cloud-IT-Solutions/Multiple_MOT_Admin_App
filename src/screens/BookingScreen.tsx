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
import { useAppValues } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BookingScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { customers, addAlert, addAudit } = useAppValues();

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

  const timeSlots = [
    { id: 't1', label: 'Morning', time: '09:00 AM' },
    { id: 't2', label: 'Late Morning', time: '11:30 AM' },
    { id: 't3', label: 'Afternoon', time: '02:00 PM' },
    { id: 't4', label: 'Late Afternoon', time: '04:30 PM' },
  ];

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
  const [selectedTime, setSelectedTime] = useState(timeSlots[0]?.time || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const isTimeSlotPassed = (slotTimeStr: string) => {
    const todayISO = formatLocalDate(new Date());
    if (selectedDate !== todayISO) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const match = slotTimeStr.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return false;

    let hour = parseInt(match[1]);
    const min = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }

    if (currentHour > hour) {
      return true;
    } else if (currentHour === hour) {
      return currentMin >= min;
    }
    return false;
  };

  useEffect(() => {
    const available = timeSlots.filter(slot => !isTimeSlotPassed(slot.time));
    if (available.length > 0) {
      if (!available.some(s => s.time === selectedTime)) {
        setSelectedTime(available[0].time);
      }
    } else {
      setSelectedTime('');
    }
  }, [selectedDate]);

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
        registrationNumber: vehicle.registrationNumber,
        makeModel: `${vehicle.make} ${vehicle.model} - Slot: ${displayDateStr} at ${selectedTime}`,
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

        {/* Time Selector Section */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>2. Choose Time Slot</Text>
        {timeSlots.filter(slot => !isTimeSlotPassed(slot.time)).length === 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
              marginTop: 8,
            }}
          >
            <MaterialCommunityIcons name="clock-alert-outline" size={24} color={theme.colors.error} />
            <Text style={{ marginLeft: 8, color: theme.colors.placeholder, fontSize: 13 }}>
              No slots available for today. Please choose a future date.
            </Text>
          </View>
        ) : (
          <View style={styles.timePickerContainer}>
            {timeSlots
              .filter(slot => !isTimeSlotPassed(slot.time))
              .map((slot) => {
                const isSelected = selectedTime === slot.time;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    onPress={() => setSelectedTime(slot.time)}
                    style={[
                      styles.timeCard,
                      {
                        backgroundColor: isSelected ? theme.colors.secondary + '15' : theme.colors.card,
                        borderColor: isSelected ? theme.colors.secondary : theme.colors.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? 'clock' : 'clock-outline'}
                      size={16}
                      color={isSelected ? theme.colors.secondary : theme.colors.placeholder}
                      style={{ marginRight: 6 }}
                    />
                    <View>
                      <Text style={[styles.timeLabel, { color: theme.colors.text }]}>{slot.label}</Text>
                      <Text style={[styles.timeText, { color: theme.colors.placeholder }]}>{slot.time}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
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
