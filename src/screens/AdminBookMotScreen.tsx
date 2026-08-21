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
import { useAppValues } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminBookMotScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { addAlert, addAudit, refreshData } = useAppValues();

  // Selected customer and vehicle passed from AdminCustomersScreen
  const customer = route?.params?.customer || {
    id: 'unknown',
    firstName: 'Unknown',
    lastName: 'Customer',
    email: 'N/A',
  };

  const vehicle = route?.params?.vehicle || {
    registrationNumber: 'AB18 CDE',
    make: 'FORD',
    model: 'FOCUS TDCI',
    customerId: 'c1',
  };

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Available slots logic (Morning, Afternoon, Evening)
  const timeSlots = [
    { id: 't1', time: '09:00 AM', label: 'Early Morning' },
    { id: 't2', time: '11:30 AM', label: 'Late Morning' },
    { id: 't3', time: '02:00 PM', label: 'Early Afternoon' },
    { id: 't4', time: '04:30 PM', label: 'Late Afternoon' },
  ];

  const isTimeSlotPassed = (timeStr: string) => {
    if (!selectedDate) return false;
    const todayStr = formatLocalDate(new Date());
    if (selectedDate !== todayStr) return false;

    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    const slotDateTime = new Date();
    slotDateTime.setHours(hours, minutes, 0, 0);

    return slotDateTime < new Date();
  };

  const handleConfirmBooking = async () => {
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

      // Add BOOKED alert notification directly with Approved status
      await addAlert({
        type: 'BOOKED',
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerId: customer.id,
        registrationNumber: vehicle.registrationNumber,
        makeModel: `${vehicle.make} ${vehicle.model} - Slot: ${displayDateStr} at ${selectedTime}`,
        status: 'Approved',
        date: selectedDate,
      });

      // Log to audit history
      await addAudit(
        'MOT Booking Booked',
        `Garage staff booked MOT booking slot for ${customer.firstName} ${customer.lastName}'s ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber}) on ${displayDateStr} at ${selectedTime}`
      );

      await refreshData();
      setLoading(false);

      // Show Toast Notification
      const successMessage = `MOT Booking confirmed and approved for ${customer.firstName} ${customer.lastName}!`;
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Customer & Vehicle Summary Header Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons name="account" size={18} color={theme.colors.secondary} />
            <Text style={[styles.summaryLabel, { color: theme.colors.text }]}>
              Customer: <Text style={{ fontWeight: 'bold' }}>{customer.firstName} {customer.lastName}</Text>
            </Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 4 }]}>
            <MaterialCommunityIcons name="email" size={16} color={theme.colors.placeholder} />
            <Text style={[styles.summarySubLabel, { color: theme.colors.placeholder }]}>
              {customer.email}
            </Text>
          </View>
          <View style={[styles.divider, { borderColor: theme.colors.border }]} />
          <View style={styles.summaryRow}>
            <View style={styles.plate}>
              <Text style={styles.plateText}>{vehicle.registrationNumber}</Text>
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.vehicleMakeModel, { color: theme.colors.text }]}>
                {vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>
                Booking appointment directly to Confirmed status
              </Text>
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
              marginBottom: 20
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
                        backgroundColor: isSelected ? theme.colors.secondary + '12' : theme.colors.card,
                        borderColor: isSelected ? theme.colors.secondary : theme.colors.border,
                      }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? 'clock-check' : 'clock-outline'}
                      size={20}
                      color={isSelected ? theme.colors.secondary : theme.colors.placeholder}
                    />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={[styles.timeLabel, { color: theme.colors.text }]}>{slot.label}</Text>
                      <Text style={[styles.timeText, { color: theme.colors.placeholder }]}>{slot.time}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {/* Notes Input */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>3. Staff Booking Notes (Optional)</Text>
        <TextInput
          style={[styles.notesInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
          placeholder="Enter any customer requests, parts updates or booking comments here..."
          placeholderTextColor={theme.colors.placeholder}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {/* Submit Action */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            onPress={handleConfirmBooking}
            disabled={loading}
            style={[styles.submitBtn, { backgroundColor: theme.colors.secondary }]}
          >
            {loading ? (
              <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} />
            ) : (
              <View style={styles.btnContent}>
                <MaterialCommunityIcons name="calendar-check" size={20} color={theme.dark ? theme.colors.background : '#FFFFFF'} style={{ marginRight: 6 }} />
                <Text style={[styles.submitBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>
                  Confirm & Approve Booking
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
  summaryCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13.5,
    marginLeft: 6,
  },
  summarySubLabel: {
    fontSize: 12,
    marginLeft: 24,
  },
  divider: {
    borderBottomWidth: 0.5,
    marginVertical: 12,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  plateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  vehicleMakeModel: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
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
});
