import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme/theme';
import { useAppValues, AlertNotification } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDateWithWeekday, formatShortDate } from '../utils/dateUtils';

const { width } = Dimensions.get('window');

const STANDARD_SLOTS = [
  '08:30', '09:15', '10:00', '10:45',
  '11:30', '12:15', '13:00', '13:45',
  '14:30', '15:15', '16:00', '16:45'
];

const getSlotNumber = (item: any): number | null => {
  if (item?.slotNumber && typeof item.slotNumber === 'number' && item.slotNumber > 0) {
    return item.slotNumber;
  }
  let timeStr = typeof item?.slotTime === 'string' ? item.slotTime : '';
  if (!timeStr && item?.makeModel && typeof item.makeModel === 'string') {
    const match = item.makeModel.match(/Slot:\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i) ||
                  item.makeModel.match(/at\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
    if (match) timeStr = match[1];
  }
  if (timeStr && typeof timeStr === 'string') {
    const start = timeStr.split(' - ')[0].trim();
    const idx = STANDARD_SLOTS.indexOf(start);
    if (idx !== -1) return idx + 1;
  }
  return null;
};

const isMotBooking = (item: any): boolean => {
  if (item?.hasMot === true) return true;
  if (item?.isDateOnly === true && !item?.slotTime && (!item?.serviceName || typeof item.serviceName !== 'string' || !item.serviceName.toUpperCase().includes('MOT'))) {
    return false;
  }

  // Check serviceName safely
  const sName = typeof item?.serviceName === 'string' ? item.serviceName.toUpperCase() : '';
  if (sName.includes('MOT')) return true;

  // Check multi-services array safely
  if (Array.isArray(item?.services) && item.services.length > 0) {
    const hasMot = item.services.some((s: any) => {
      const name = (typeof s === 'string' ? s : (s && typeof s.name === 'string' ? s.name : '')).toUpperCase();
      const cat = (typeof s === 'object' && s && typeof s.category === 'string' ? s.category : '').toUpperCase();
      return name.includes('MOT') || cat === 'MOT';
    });
    if (hasMot) return true;
  }

  // Check slotNumber or slotTime safely
  if (item?.slotNumber && typeof item.slotNumber === 'number' && item.slotNumber > 0) return true;
  if (item?.slotTime && typeof item.slotTime === 'string' && item.slotTime !== 'Full Day Drop-off' && item.slotTime !== 'Drop-off (Full Day)') return true;

  // Check makeModel string for slot info safely (e.g. "AUDI A6 - Slot: 08:00")
  if (typeof item?.makeModel === 'string' && /Slot:\s*\d{1,2}:\d{2}/i.test(item.makeModel)) return true;

  return false;
};

const getMotSlotDisplay = (item: any): string => {
  const num = getSlotNumber(item);
  let timeStr = typeof item?.slotTime === 'string' ? item.slotTime : '';
  if (!timeStr && typeof item?.makeModel === 'string') {
    const match = item.makeModel.match(/(?:MOT\s+)?Slot:\s*([^\n\r&]+)/i);
    if (match) timeStr = match[1].trim();
  } else if (timeStr && typeof timeStr === 'string' && timeStr.includes(' & Service:')) {
    timeStr = timeStr.split(' & Service:')[0].replace(/^(?:MOT\s+)?Slot:\s*/i, '').trim();
  }

  if (num && timeStr && timeStr !== 'Full Day Drop-off' && timeStr !== 'Drop-off (Full Day)') {
    return `Slot #${num} • ${timeStr}`;
  }
  if (num) {
    return `Slot #${num}`;
  }
  if (timeStr && timeStr !== 'Full Day Drop-off' && timeStr !== 'Drop-off (Full Day)') {
    return `MOT Slot: ${timeStr}`;
  }
  return 'MOT Slot';
};

const formatBookingDate = (dateVal: any) => formatDateWithWeekday(dateVal);

// Search Helper: Matches Date strictly (formatted, raw, DD-MM-YYYY, DD/MM/YYYY, month name, year)
const matchesDate = (dateVal: any, query: string) => {
  if (!dateVal || !query) return false;
  const q = query.toLowerCase().trim();

  // 1. Formatted display string (e.g. "Wed, 21 Oct 2026")
  const formatted = formatBookingDate(dateVal).toLowerCase();
  if (formatted.includes(q)) return true;

  // 2. Raw string (e.g. "2026-10-21")
  const rawStr = String(dateVal).toLowerCase();
  if (rawStr.includes(q)) return true;

  // 3. Date variations
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const dayNoPad = String(d.getDate());
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear());

      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

      const monthName = months[d.getMonth()];
      const shortMonthName = shortMonths[d.getMonth()];

      const variations = [
        `${day}-${month}-${year}`,
        `${day}/${month}/${year}`,
        `${dayNoPad}-${month}-${year}`,
        `${dayNoPad}/${month}/${year}`,
        `${day} ${monthName} ${year}`,
        `${dayNoPad} ${monthName} ${year}`,
        `${day} ${shortMonthName} ${year}`,
        `${dayNoPad} ${shortMonthName} ${year}`,
        `${day} ${shortMonthName}`,
        `${dayNoPad} ${shortMonthName}`,
        `${day} ${monthName}`,
        `${dayNoPad} ${monthName}`,
        monthName,
        shortMonthName,
        year
      ];

      if (variations.some(v => v.includes(q))) return true;
    }
  } catch (e) {}

  return false;
};

// Search Helper: Matches VRN strictly
const matchesVrn = (vrn: any, query: string) => {
  if (!vrn || !query || typeof query !== 'string') return false;
  const vrnStr = typeof vrn === 'string' ? vrn : (typeof vrn === 'object' && vrn?.registrationNumber ? String(vrn.registrationNumber) : String(vrn));
  const cleanVrn = vrnStr.toLowerCase().replace(/\s+/g, '');
  const cleanQ = query.toLowerCase().replace(/\s+/g, '');
  return cleanVrn.includes(cleanQ) || vrnStr.toLowerCase().includes(query.toLowerCase().trim());
};

// Search Helper: Matches Customer Name strictly
const matchesCustomer = (name: any, query: string) => {
  if (!name || !query || typeof query !== 'string') return false;
  const nameStr = typeof name === 'string' ? name : (typeof name === 'object' ? `${name?.firstName || ''} ${name?.lastName || ''}`.trim() : String(name));
  return nameStr.toLowerCase().includes(query.toLowerCase().trim());
};

const getFilterLabel = (status: string) => {
  switch (status) {
    case 'PENDING': return 'Pending';
    case 'APPROVED': return 'Confirmed';
    case 'REJECTED': return 'Rejected';
    case 'CANCELLED': return 'Cancelled';
    default: return 'All';
  }
};

const getFilterIcon = (status: string) => {
  switch (status) {
    case 'PENDING': return 'clock-alert-outline';
    case 'APPROVED': return 'check-circle-outline';
    case 'REJECTED': return 'close-circle-outline';
    case 'CANCELLED': return 'calendar-remove';
    default: return 'clipboard-list-outline';
  }
};

const getFilterColor = (status: string) => {
  switch (status) {
    case 'PENDING': return '#F59E0B';
    case 'APPROVED': return '#10B981';
    case 'REJECTED': return '#EF4444';
    case 'CANCELLED': return '#DC2626';
    default: return '#3B82F6';
  }
};

export type DateFilterType = 'ALL' | 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'CUSTOM';

const toYMD = (dateVal: any): string | null => {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    const matchIso = dateVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchIso) {
      return `${matchIso[1]}-${matchIso[2].padStart(2, '0')}-${matchIso[3].padStart(2, '0')}`;
    }
    const matchUk = dateVal.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (matchUk) {
      return `${matchUk[3]}-${matchUk[2].padStart(2, '0')}-${matchUk[1].padStart(2, '0')}`;
    }
  }
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) {}
  return null;
};

const formatYMDToDisplay = (ymd: string): string => formatShortDate(ymd);

const getDateFilterLabel = (type: DateFilterType, customDate?: string | null) => {
  switch (type) {
    case 'TODAY': return 'Today';
    case 'TOMORROW': return 'Tomorrow';
    case 'THIS_WEEK': return 'Next 7 Days';
    case 'CUSTOM': return customDate ? formatYMDToDisplay(customDate) : 'Custom Date';
    default: return 'All Dates';
  }
};

const getDateFilterIcon = (type: DateFilterType) => {
  switch (type) {
    case 'TODAY': return 'calendar-today';
    case 'TOMORROW': return 'calendar-arrow-right';
    case 'THIS_WEEK': return 'calendar-week';
    case 'CUSTOM': return 'calendar-check';
    default: return 'calendar-blank-outline';
  }
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function BookedMotsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { alerts, customers, approveAlert, acknowledgeAlert, rejectAlert, cancelBooking, startServiceBooking, completeServiceBooking, refreshData } = useAppValues();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('ALL');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);
  const [filterBottomSheetVisible, setFilterBottomSheetVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshData();
    });
    return unsubscribe;
  }, [navigation]);

  // Rejection modal states
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Complete Service modal states
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedCompleteItem, setSelectedCompleteItem] = useState<any>(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [submittingComplete, setSubmittingComplete] = useState(false);

  // Filter alerts of type BOOKED
  const bookedMots = useMemo(() => alerts.filter((a) => a.type === 'BOOKED'), [alerts]);

  const pendingCount = useMemo(() => bookedMots.filter(a => a.status === 'Pending').length, [bookedMots]);
  const approvedCount = useMemo(() => bookedMots.filter(a => a.status === 'Approved').length, [bookedMots]);
  const inProgressCount = useMemo(() => bookedMots.filter(a => a.status === 'In Progress' || a.status === 'InProgress').length, [bookedMots]);
  const completedCount = useMemo(() => bookedMots.filter(a => a.status === 'Completed').length, [bookedMots]);
  const rejectedCount = useMemo(() => bookedMots.filter(a => a.status === 'Rejected' || a.status === 'Acknowledged').length, [bookedMots]);
  const cancelledCount = useMemo(() => bookedMots.filter(a => a.status === 'Cancelled').length, [bookedMots]);

  // Date constants & helpers
  const todayDateObj = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => toYMD(todayDateObj) || '', [todayDateObj]);
  const tomorrowYMD = useMemo(() => {
    const tom = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), todayDateObj.getDate() + 1);
    return toYMD(tom) || '';
  }, [todayDateObj]);
  const weekEndYMD = useMemo(() => {
    const wk = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), todayDateObj.getDate() + 7);
    return toYMD(wk) || '';
  }, [todayDateObj]);

  const todayCount = useMemo(() => bookedMots.filter(a => toYMD(a.date) === todayYMD).length, [bookedMots, todayYMD]);
  const tomorrowCount = useMemo(() => bookedMots.filter(a => toYMD(a.date) === tomorrowYMD).length, [bookedMots, tomorrowYMD]);
  const thisWeekCount = useMemo(() => bookedMots.filter(a => {
    const ymd = toYMD(a.date);
    return ymd && ymd >= todayYMD && ymd <= weekEndYMD;
  }).length, [bookedMots, todayYMD, weekEndYMD]);
  const customDateCount = useMemo(() => {
    if (!selectedCustomDate) return 0;
    return bookedMots.filter(a => toYMD(a.date) === selectedCustomDate).length;
  }, [bookedMots, selectedCustomDate]);

  // Set of dates with bookings for calendar dots
  const datesWithBookingsSet = useMemo(() => {
    const set = new Set<string>();
    bookedMots.forEach((a) => {
      const ymd = toYMD(a.date);
      if (ymd) set.add(ymd);
    });
    return set;
  }, [bookedMots]);

  // Calendar month navigation
  const handlePrevMonth = () => {
    setCurrentViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentViewDate(today);
    setDateFilter('CUSTOM');
    setSelectedCustomDate(todayYMD);
    setCalendarModalVisible(false);
  };

  // Generate days grid for current viewed month
  const calendarDays = useMemo(() => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= lastDate; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentViewDate]);

  const filterOptions = [
    {
      key: 'ALL' as const,
      label: 'All',
      icon: 'clipboard-list-outline',
      color: theme.colors.secondary,
      count: bookedMots.length,
    },
    {
      key: 'PENDING' as const,
      label: 'Pending',
      icon: 'clock-alert-outline',
      color: '#F59E0B',
      count: pendingCount,
    },
    {
      key: 'APPROVED' as const,
      label: 'Confirmed',
      icon: 'check-circle-outline',
      color: '#0284C7',
      count: approvedCount,
    },
    {
      key: 'IN_PROGRESS' as const,
      label: 'In Progress',
      icon: 'progress-wrench',
      color: '#8B5CF6',
      count: inProgressCount,
    },
    {
      key: 'COMPLETED' as const,
      label: 'Completed',
      icon: 'check-decagram',
      color: '#10B981',
      count: completedCount,
    },
    {
      key: 'REJECTED' as const,
      label: 'Rejected',
      icon: 'close-circle-outline',
      color: '#EF4444',
      count: rejectedCount,
    },
    {
      key: 'CANCELLED' as const,
      label: 'Cancelled',
      icon: 'calendar-remove',
      color: '#DC2626',
      count: cancelledCount,
    },
  ];

  // Filtered list based on status, date, and search query
  const filteredBookings = useMemo(() => {
    return bookedMots.filter((item) => {
      // 1. Status filter
      if (statusFilter === 'PENDING' && item.status !== 'Pending') return false;
      if (statusFilter === 'APPROVED' && item.status !== 'Approved') return false;
      if (statusFilter === 'IN_PROGRESS' && item.status !== 'In Progress' && item.status !== 'InProgress') return false;
      if (statusFilter === 'COMPLETED' && item.status !== 'Completed') return false;
      if (statusFilter === 'REJECTED' && (item.status !== 'Rejected' && item.status !== 'Acknowledged')) return false;
      if (statusFilter === 'CANCELLED' && item.status !== 'Cancelled') return false;

      // 2. Date filter
      const itemYMD = toYMD(item.date);
      if (dateFilter === 'TODAY') {
        if (itemYMD !== todayYMD) return false;
      } else if (dateFilter === 'TOMORROW') {
        if (itemYMD !== tomorrowYMD) return false;
      } else if (dateFilter === 'THIS_WEEK') {
        if (!itemYMD || itemYMD < todayYMD || itemYMD > weekEndYMD) return false;
      } else if (dateFilter === 'CUSTOM' && selectedCustomDate) {
        if (itemYMD !== selectedCustomDate) return false;
      }

      // 3. Search filter: Strictly according to Date, Registration Number, and Customer Name ONLY
      if (searchQuery.trim()) {
        const query = searchQuery.trim();
        const matchesReg = matchesVrn(item.registrationNumber, query);
        const matchesCust = matchesCustomer(item.customerName, query);
        const matchesDateVal = matchesDate(item.date, query);
        return matchesReg || matchesCust || matchesDateVal;
      }
      return true;
    });
  }, [bookedMots, statusFilter, dateFilter, selectedCustomDate, searchQuery, todayYMD, tomorrowYMD, weekEndYMD]);

  // Individual bookings sorted by appointment date / newest created
  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      const createA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createB - createA;
    });
  }, [filteredBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (error) {
      console.error('[BOOKED MOTS] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirm = async (alertId: string) => {
    setLoadingAction(alertId);
    try {
      await approveAlert(alertId);
      Alert.alert('Approved', 'MOT Booking has been confirmed successfully!');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not approve booking.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartService = (alertId: string, regText: string) => {
    Alert.alert(
      'Start Service',
      `Move vehicle ${regText} into the workshop ramp and start service?\n\nThe customer will be notified in real-time that service is underway.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Service',
          onPress: async () => {
            setLoadingAction(`start_${alertId}`);
            try {
              await startServiceBooking(alertId);
              Alert.alert('Service Started', `Vehicle ${regText} is now In Progress in the workshop.`);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Could not start service.');
            } finally {
              setLoadingAction(null);
            }
          }
        }
      ]
    );
  };

  const openCompleteModal = (item: any) => {
    setSelectedCompleteItem(item);
    setCompleteNotes('');
    setCompleteModalVisible(true);
  };

  const submitCompleteService = async () => {
    if (!selectedCompleteItem) return;
    const bookingId = selectedCompleteItem.id || selectedCompleteItem._id;
    const reg = (typeof selectedCompleteItem.registrationNumber === 'string' && selectedCompleteItem.registrationNumber.trim())
      ? selectedCompleteItem.registrationNumber
      : (typeof selectedCompleteItem.vrn === 'string' ? selectedCompleteItem.vrn : 'Vehicle');
    setSubmittingComplete(true);
    try {
      await completeServiceBooking(bookingId, completeNotes);
      setCompleteModalVisible(false);
      setSelectedCompleteItem(null);
      Alert.alert('Service Completed', `Service on ${reg} has been completed! Customer has been notified that the vehicle is ready for pickup.`);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not complete service.');
    } finally {
      setSubmittingComplete(false);
    }
  };

  const openRejectModal = (alertId: string) => {
    setSelectedAlertId(alertId);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const submitRejection = async () => {
    if (!selectedAlertId) return;
    const alertId = selectedAlertId;
    setRejectModalVisible(false);
    setLoadingAction(alertId);
    try {
      await rejectAlert(alertId, rejectionReason || 'Unavailable slot / Garage busy');
      Alert.alert('Rejected', 'Booking request has been rejected.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not reject booking.');
    } finally {
      setLoadingAction(null);
      setSelectedAlertId(null);
    }
  };

  const handleAdminCancelBooking = (item: any) => {
    const alertId = item.id || item._id;
    const reg = (typeof item.registrationNumber === 'string' && item.registrationNumber.trim())
      ? item.registrationNumber
      : (typeof item.vrn === 'string' && item.vrn.trim() ? item.vrn : 'Vehicle');
    const dateStr = formatBookingDate(item.date);
    const slotStr = isMotBooking(item) ? getMotSlotDisplay(item) : 'Workshop Drop-off';

    Alert.alert(
      'Cancel Booking?',
      `Are you sure you want to cancel the booking for ${reg} on ${dateStr} (${slotStr})?\n\nThis will immediately free up the slot and notify the customer via email.`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setLoadingAction(`cancel_${alertId}`);
            try {
              await cancelBooking(alertId, 'Cancelled by garage staff');
              Alert.alert('Booking Cancelled', `Booking for ${reg} has been cancelled and customer notified.`);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Could not cancel booking.');
            } finally {
              setLoadingAction(null);
            }
          }
        }
      ]
    );
  };

  const callCustomer = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Navbar Header */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Main', { screen: 'Dashboard' })} 
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity> 
        <View style={styles.navTitleContainer}>
          <Text style={[styles.navTitle, { color: theme.colors.text }]}>Booked Appointments</Text>
          <Text style={[styles.navSubtitle, { color: theme.colors.placeholder }]}>
            {sortedBookings.length} {sortedBookings.length === 1 ? 'booking' : 'bookings'}
            {statusFilter !== 'ALL' ? ` • ${getFilterLabel(statusFilter)}` : ''}
            {dateFilter !== 'ALL' ? ` • ${getDateFilterLabel(dateFilter, selectedCustomDate)}` : ''}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={onRefresh} 
          style={[styles.refreshIconBtn, { borderColor: theme.colors.border }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="refresh" size={18} color={theme.colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar with Calendar and Filter Icon Buttons */}
      <View style={styles.searchFilterRow}>
        <View style={[styles.searchWrapper, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.placeholder} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search by date, VRN or customer..."
            placeholderTextColor={theme.colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
            </TouchableOpacity>
          )}
        </View>

        {/* Calendar Picker Button */}
        <TouchableOpacity
          style={[
            styles.filterIconBtn,
            {
              backgroundColor: (dateFilter === 'CUSTOM' && selectedCustomDate) ? theme.colors.secondary : theme.colors.card,
              borderColor: (dateFilter === 'CUSTOM' && selectedCustomDate) ? theme.colors.secondary : theme.colors.border,
            }
          ]}
          onPress={() => setCalendarModalVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={20}
            color={(dateFilter === 'CUSTOM' && selectedCustomDate) ? '#FFFFFF' : theme.colors.text}
          />
          {(dateFilter === 'CUSTOM' && selectedCustomDate) && (
            <View style={styles.filterActiveDot} />
          )}
        </TouchableOpacity>

        {/* Filter (Status) Button */}
        <TouchableOpacity
          style={[
            styles.filterIconBtn,
            {
              backgroundColor: statusFilter !== 'ALL' ? theme.colors.secondary : theme.colors.card,
              borderColor: statusFilter !== 'ALL' ? theme.colors.secondary : theme.colors.border,
            }
          ]}
          onPress={() => setFilterBottomSheetVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={20}
            color={statusFilter !== 'ALL' ? '#FFFFFF' : theme.colors.text}
          />
          {statusFilter !== 'ALL' && (
            <View style={styles.filterActiveDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filter Pills (Visible when status or date is filtered) */}
      {(statusFilter !== 'ALL' || dateFilter !== 'ALL') && (
        <View style={styles.activeFilterPillRow}>
          {statusFilter !== 'ALL' && (
            <TouchableOpacity
              style={[
                styles.activeFilterPill,
                {
                  backgroundColor: getFilterColor(statusFilter) + '15',
                  borderColor: getFilterColor(statusFilter),
                }
              ]}
              onPress={() => setFilterBottomSheetVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name={getFilterIcon(statusFilter)} size={14} color={getFilterColor(statusFilter)} />
              <Text style={[styles.activeFilterPillText, { color: getFilterColor(statusFilter) }]}>
                {getFilterLabel(statusFilter)}
              </Text>
              <TouchableOpacity
                onPress={() => setStatusFilter('ALL')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.clearFilterCross}
              >
                <MaterialCommunityIcons name="close" size={14} color={getFilterColor(statusFilter)} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {dateFilter !== 'ALL' && (
            <TouchableOpacity
              style={[
                styles.activeFilterPill,
                {
                  backgroundColor: '#0284C715',
                  borderColor: '#0284C7',
                }
              ]}
              onPress={() => setCalendarModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name={getDateFilterIcon(dateFilter)} size={14} color="#0284C7" />
              <Text style={[styles.activeFilterPillText, { color: '#0284C7' }]}>
                {getDateFilterLabel(dateFilter, selectedCustomDate)}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setDateFilter('ALL');
                  setSelectedCustomDate(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.clearFilterCross}
              >
                <MaterialCommunityIcons name="close" size={14} color="#0284C7" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.secondary]} />
        }
      >
        {sortedBookings.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 10 }} />
            <Text style={[styles.emptyText, { color: theme.colors.text }]}>No bookings found</Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.placeholder }]}>
              {searchQuery ? `No appointments matching "${searchQuery}"` : 'No appointments in this category'}
            </Text>
          </View>
        ) : (
          sortedBookings.map((item, index) => {
            const isPending = item.status === 'Pending';
            const isApproved = item.status === 'Approved';
            const isInProgress = item.status === 'In Progress' || item.status === 'InProgress';
            const isRejected = item.status === 'Rejected' || item.status === 'Acknowledged';
            const isCompleted = item.status === 'Completed';
            const isCancelled = item.status === 'Cancelled';

            let statusText = 'Pending';
            let statusColor = '#F59E0B';
            let statusBg = '#F59E0B15';
            let statusIcon = 'clock-alert-outline';

            if (isCompleted) {
              statusText = 'Completed';
              statusColor = '#10B981';
              statusBg = '#10B98115';
              statusIcon = 'check-decagram';
            } else if (isInProgress) {
              statusText = 'In Progress';
              statusColor = '#8B5CF6';
              statusBg = '#8B5CF615';
              statusIcon = 'car-wrench';
            } else if (isPending) {
              statusText = 'Pending';
              statusColor = '#F59E0B';
              statusBg = '#F59E0B15';
              statusIcon = 'clock-alert-outline';
            } else if (isApproved) {
              statusText = 'Confirmed';
              statusColor = '#0284C7';
              statusBg = '#0284C715';
              statusIcon = 'check-circle';
            } else if (isRejected) {
              statusText = 'Rejected';
              statusColor = '#EF4444';
              statusBg = '#EF444415';
              statusIcon = 'close-circle';
            } else if (isCancelled) {
              statusText = 'Cancelled';
              statusColor = '#DC2626';
              statusBg = '#DC262615';
              statusIcon = 'calendar-remove';
            } else {
              statusText = item.status || 'Pending';
              statusColor = '#6B7280';
              statusBg = '#6B728015';
              statusIcon = 'help-circle-outline';
            }

            const anyItem = item as any;
            const customer = anyItem.customerId
              ? customers.find(c =>
                  (c.id && String(c.id).toLowerCase() === String(anyItem.customerId).toLowerCase()) ||
                  (c._id && String(c._id).toLowerCase() === String(anyItem.customerId).toLowerCase())
                )
              : null;
            const custName = typeof anyItem.customerName === 'string' && anyItem.customerName.trim()
              ? anyItem.customerName.trim()
              : (customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() : '') || 'Customer';
            const custPhone = typeof anyItem.customerMobile === 'string' && anyItem.customerMobile.trim()
              ? anyItem.customerMobile.trim()
              : (typeof customer?.mobile === 'string' ? customer.mobile.trim() : '');

            let cleanMake = 'Vehicle';
            if (typeof anyItem.makeModel === 'string' && anyItem.makeModel.trim()) {
              cleanMake = anyItem.makeModel
                .split(' (Slot:')[0]
                .split(' at ')[0]
                .split(' - Slot:')[0]
                .split(' - MOT Slot:')[0]
                .split(' - Workshop Drop-off')[0]
                .trim() || 'Vehicle';
            } else if (typeof anyItem.makeModel === 'object' && anyItem.makeModel) {
              cleanMake = `${anyItem.makeModel.make || ''} ${anyItem.makeModel.model || ''}`.trim() || 'Vehicle';
            } else if (typeof anyItem.vehicle === 'object' && anyItem.vehicle) {
              cleanMake = `${anyItem.vehicle.make || ''} ${anyItem.vehicle.model || ''}`.trim() || 'Vehicle';
            }

            const vrnText = typeof anyItem.registrationNumber === 'string' && anyItem.registrationNumber.trim()
              ? anyItem.registrationNumber.toUpperCase()
              : (typeof anyItem.vrn === 'string' && anyItem.vrn.trim() ? anyItem.vrn.toUpperCase() : 'VRN');

            const isMot = isMotBooking(anyItem);

            const servicesList: any[] = Array.isArray(anyItem.services) ? anyItem.services : [];
            const otherServices = servicesList.filter((s: any) => {
              const name = (typeof s === 'string' ? s : s?.name || '').toUpperCase();
              const cat = (typeof s === 'object' && s?.category ? s.category : '').toUpperCase();
              return !name.includes('MOT') && cat !== 'MOT';
            });
            const otherServicesNames = otherServices.map((s: any) => typeof s === 'string' ? s : s?.name || '').filter(Boolean).join(', ') ||
              (typeof anyItem.makeModel === 'string' && anyItem.makeModel.includes('& Service:') ? anyItem.makeModel.split('& Service:')[1]?.trim() : '');
            const hasBothMotAndService = isMot && (otherServices.length > 0 || Boolean(otherServicesNames));

            const serviceNameText = typeof anyItem.serviceName === 'string' && anyItem.serviceName.trim()
              ? anyItem.serviceName
              : (isMot ? 'MOT' : 'Service');
            const rawPrice = anyItem.price !== undefined && anyItem.price !== null ? Number(anyItem.price) : null;
            const priceDisplay = rawPrice !== null && !isNaN(rawPrice) && rawPrice > 0 ? ` • £${rawPrice.toFixed(0)}` : '';
            const bookingId = String(anyItem.id || anyItem._id || '');
            const bookingKey = bookingId || `${vrnText}_${anyItem.date}_${index}`;

            return (
              <View
                key={bookingKey}
                style={[
                  styles.bookingCard,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: isPending ? '#F59E0B50' : theme.colors.border,
                    borderLeftColor: statusColor,
                  }
                ]}
              >
                {/* 1. Header: Plate + Vehicle Model + Status Pill */}
                <View style={styles.bookingCardHeader}>
                  <View style={styles.vehicleHeaderLeft}>
                    <View style={styles.plate}>
                      <Text style={styles.plateText}>{vrnText}</Text>
                    </View>
                    <Text style={[styles.vehicleModelText, { color: theme.colors.text }]} numberOfLines={1}>
                      {cleanMake}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '30' }]}>
                    <MaterialCommunityIcons name={statusIcon as any} size={11} color={statusColor} style={{ marginRight: 3 }} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                  </View>
                </View>

                {/* 2. Middle Row: Date & Time & Service Badge */}
                <View style={styles.compactMetaRow}>
                  <View style={styles.dateTimeWrap}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={12} color={theme.colors.secondary} />
                    <Text style={[styles.compactDateText, { color: theme.colors.text }]}>
                      {formatBookingDate(item.date)}
                    </Text>
                    <Text style={[styles.metaDot, { color: theme.colors.placeholder }]}>•</Text>
                    <MaterialCommunityIcons name="clock-outline" size={12} color="#2563EB" />
                    <Text style={[styles.compactSlotText, { color: '#2563EB' }]}>
                      {isMot ? getMotSlotDisplay(item) : 'Drop-off'}
                    </Text>
                  </View>

                  <View style={[styles.serviceTagBadge, { backgroundColor: isMot ? '#8B5CF612' : '#0284C712', borderColor: isMot ? '#8B5CF630' : '#0284C730' }]}>
                    <Text style={[styles.serviceTagText, { color: isMot ? '#8B5CF6' : '#0284C7' }]} numberOfLines={1}>
                      {serviceNameText}{priceDisplay}
                    </Text>
                  </View>
                </View>

                {/* 3. Customer Info Row & Bay / Extra Service */}
                <View style={styles.compactCustomerRow}>
                  <View style={styles.customerMetaBox}>
                    <MaterialCommunityIcons name="account-outline" size={13} color={theme.colors.placeholder} />
                    <Text style={[styles.customerMetaName, { color: theme.colors.text }]} numberOfLines={1}>
                      {custName}
                    </Text>
                    {custPhone ? (
                      <TouchableOpacity
                        onPress={() => callCustomer(custPhone)}
                        style={[styles.phoneChipCompact, { backgroundColor: theme.colors.secondary + '12', borderColor: theme.colors.secondary + '30' }]}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <MaterialCommunityIcons name="phone" size={10} color={theme.colors.secondary} />
                        <Text style={[styles.phoneChipTextCompact, { color: theme.colors.secondary }]}>
                          {custPhone}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.rightTagGroup}>
                    {item.stationName ? (
                      <View style={styles.stationTag}>
                        <MaterialCommunityIcons name="garage" size={11} color="#059669" />
                        <Text style={styles.stationTagText} numberOfLines={1}>
                          {item.stationName}
                        </Text>
                      </View>
                    ) : null}

                    {hasBothMotAndService ? (
                      <View style={styles.extraServiceTag}>
                        <MaterialCommunityIcons name="wrench-outline" size={11} color="#059669" />
                        <Text style={styles.extraServiceTagText} numberOfLines={1}>
                          + {otherServicesNames || 'Service'}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* 4. Multi-Service Pills (if multiple services booked) */}
                {Array.isArray(item.services) && item.services.length > 1 && (
                  <View style={styles.multiServicesRow}>
                    {item.services.map((s: any, sIdx: number) => {
                      const sName = typeof s === 'string' ? s : s?.name || '';
                      return (
                        <View key={sIdx} style={[styles.multiServicePill, { backgroundColor: theme.colors.secondary + '12' }]}>
                          <Text style={[styles.multiServicePillText, { color: theme.colors.secondary }]}>{sName}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* 5. In-Progress Workshop Banner */}
                {isInProgress && (
                  <View style={[styles.compactAlertBanner, { backgroundColor: '#8B5CF612', borderColor: '#8B5CF635', marginTop: 5 }]}>
                    <MaterialCommunityIcons name="car-wrench" size={13} color="#8B5CF6" />
                    <Text style={[styles.compactAlertText, { color: theme.colors.text }]} numberOfLines={1}>
                      <Text style={{ fontFamily: fonts.bold, color: '#8B5CF6' }}>In Workshop: </Text>
                      Active on ramp{item.serviceStartedBy ? ` (started by ${item.serviceStartedBy})` : ''}
                    </Text>
                  </View>
                )}

                {/* 6. Completed Service Banner */}
                {isCompleted && (
                  <View style={[styles.compactAlertBanner, { backgroundColor: '#10B98110', borderColor: '#10B98130', marginTop: 5 }]}>
                    <MaterialCommunityIcons name="check-decagram" size={13} color="#10B981" />
                    <Text style={[styles.compactAlertText, { color: theme.colors.text }]} numberOfLines={2}>
                      <Text style={{ fontFamily: fonts.bold, color: '#10B981' }}>Completed: </Text>
                      {item.serviceNotes ? item.serviceNotes : 'Service finished & ready for customer collection.'}
                    </Text>
                  </View>
                )}

                {/* 7. Rejection Notice Banner */}
                {isRejected && item.rejectionReason ? (
                  <View style={styles.compactAlertBanner}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={12} color="#EF4444" />
                    <Text style={styles.compactAlertText} numberOfLines={1}>
                      <Text style={{ fontFamily: fonts.bold, color: '#EF4444' }}>Declined: </Text>
                      {item.rejectionReason}
                    </Text>
                  </View>
                ) : null}

                {/* 8. Cancellation Notice Banner */}
                {isCancelled ? (
                  <View style={[styles.compactAlertBanner, { backgroundColor: '#DC262610', borderColor: '#DC262625' }]}>
                    <MaterialCommunityIcons name="calendar-remove" size={12} color="#DC2626" />
                    <Text style={[styles.compactAlertText, { color: theme.colors.text }]} numberOfLines={1}>
                      <Text style={{ fontFamily: fonts.bold, color: '#DC2626' }}>Cancelled by {item.cancelledBy || 'Customer'}: </Text>
                      {item.cancellationReason || 'Slot has been released.'}
                    </Text>
                  </View>
                ) : null}

                {/* 9. Action Buttons (Pending) */}
                {isPending && (
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      onPress={() => openRejectModal(bookingId)}
                      disabled={loadingAction !== null}
                      style={[styles.cardActionBtn, styles.cardRejectBtn, { borderColor: '#EF444450' }]}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="close" size={12} color="#EF4444" />
                      <Text style={styles.cardRejectBtnText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        navigation.navigate('AdminBookMot', {
                          customer: customer || {
                            id: item.customerId,
                            _id: item.customerId,
                            firstName: custName.split(' ')[0] || 'Customer',
                            lastName: custName.split(' ').slice(1).join(' ') || '',
                            email: item.customerEmail || '',
                            mobile: custPhone || '',
                          },
                          vehicle: {
                            registrationNumber: vrnText,
                            make: cleanMake.split(' ')[0] || 'Vehicle',
                            model: cleanMake.split(' ').slice(1).join(' ') || '',
                            customerId: item.customerId,
                          },
                          serviceName: serviceNameText,
                          bookedDate: item.date,
                          slotTime: item.slotTime,
                          isReschedule: true,
                          bookingId: bookingId,
                        });
                      }}
                      disabled={loadingAction !== null}
                      style={[styles.cardActionBtn, { borderColor: theme.colors.secondary + '60', backgroundColor: theme.colors.secondary + '12' }]}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="calendar-clock" size={12} color={theme.colors.secondary} />
                      <Text style={[styles.cardConfirmBtnText, { color: theme.colors.secondary }]}>Reschedule</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleConfirm(bookingId)}
                      disabled={loadingAction !== null}
                      style={[styles.cardActionBtn, styles.cardConfirmBtn, { backgroundColor: theme.colors.secondary }]}
                      activeOpacity={0.7}
                    >
                      {loadingAction === bookingId ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />
                          <Text style={styles.cardConfirmBtnText}>Confirm</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 10. Action Buttons (Confirmed / Approved -> Start Service) */}
                {isApproved && (
                  <View style={[styles.cardActionsRow, { justifyContent: 'flex-end', marginTop: 4 }]}>
                    <TouchableOpacity
                      onPress={() => handleStartService(bookingId, vrnText)}
                      disabled={loadingAction !== null}
                      style={[styles.cardActionBtnCompact, { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6', marginRight: 6 }]}
                      activeOpacity={0.7}
                    >
                      {loadingAction === `start_${bookingId}` ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="play-circle-outline" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: '#FFFFFF' }}>Start Service</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        navigation.navigate('AdminBookMot', {
                          customer: customer || {
                            id: item.customerId,
                            _id: item.customerId,
                            firstName: custName.split(' ')[0] || 'Customer',
                            lastName: custName.split(' ').slice(1).join(' ') || '',
                            email: item.customerEmail || '',
                            mobile: custPhone || '',
                          },
                          vehicle: {
                            registrationNumber: vrnText,
                            make: cleanMake.split(' ')[0] || 'Vehicle',
                            model: cleanMake.split(' ').slice(1).join(' ') || '',
                            customerId: item.customerId,
                          },
                          serviceName: serviceNameText,
                          bookedDate: item.date,
                          slotTime: item.slotTime,
                          isReschedule: true,
                          bookingId: bookingId,
                        });
                      }}
                      disabled={loadingAction !== null}
                      style={[styles.cardActionBtnCompact, { borderColor: theme.colors.secondary + '60', backgroundColor: theme.colors.secondary + '12', marginRight: 6 }]}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="calendar-clock" size={12} color={theme.colors.secondary} style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: theme.colors.secondary }}>Reschedule</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleAdminCancelBooking(item)}
                      disabled={loadingAction !== null}
                      style={styles.cardCancelBookingBtnCompact}
                      activeOpacity={0.7}
                    >
                      {loadingAction === `cancel_${bookingId}` ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="calendar-remove" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                          <Text style={styles.cardCancelBookingTextCompact}>Cancel</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 11. Action Buttons (In Progress -> Complete Service) */}
                {isInProgress && (
                  <View style={[styles.cardActionsRow, { justifyContent: 'flex-end', marginTop: 4 }]}>
                    <TouchableOpacity
                      onPress={() => openCompleteModal(item)}
                      disabled={loadingAction !== null}
                      style={[styles.cardActionBtnCompact, { backgroundColor: '#10B981', borderColor: '#10B981', marginRight: 6 }]}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="check-circle-outline" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: '#FFFFFF' }}>Complete Service</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        navigation.navigate('AdminBookMot', {
                          customer: customer || {
                            id: item.customerId,
                            _id: item.customerId,
                            firstName: custName.split(' ')[0] || 'Customer',
                            lastName: custName.split(' ').slice(1).join(' ') || '',
                            email: item.customerEmail || '',
                            mobile: custPhone || '',
                          },
                          vehicle: {
                            registrationNumber: vrnText,
                            make: cleanMake.split(' ')[0] || 'Vehicle',
                            model: cleanMake.split(' ').slice(1).join(' ') || '',
                            customerId: item.customerId,
                          },
                          serviceName: serviceNameText,
                          bookedDate: item.date,
                          slotTime: item.slotTime,
                          isReschedule: true,
                          bookingId: bookingId,
                        });
                      }}
                      disabled={loadingAction !== null}
                      style={[styles.cardActionBtnCompact, { borderColor: theme.colors.secondary + '60', backgroundColor: theme.colors.secondary + '12', marginRight: 6 }]}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="calendar-clock" size={12} color={theme.colors.secondary} style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: theme.colors.secondary }}>Reschedule</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleAdminCancelBooking(item)}
                      disabled={loadingAction !== null}
                      style={styles.cardCancelBookingBtnCompact}
                      activeOpacity={0.7}
                    >
                      {loadingAction === `cancel_${bookingId}` ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="calendar-remove" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                          <Text style={styles.cardCancelBookingTextCompact}>Cancel</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Reject Reason Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={rejectModalVisible}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrapper, { backgroundColor: '#EF444415' }]}>
                <MaterialCommunityIcons name="calendar-remove" size={22} color="#EF4444" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Reject Booking Request</Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                  Customer will be notified of this cancellation reason.
                </Text>
              </View>
            </View>

            {/* Quick Reason Chips */}
            <Text style={[styles.presetTitle, { color: theme.colors.placeholder }]}>Quick reasons:</Text>
            <View style={styles.presetChips}>
              {['Slot already booked', 'Garage closed', 'Staff unavailable', 'Equipment maintenance'].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setRejectionReason(reason)}
                  style={[
                    styles.presetChip,
                    { 
                      backgroundColor: rejectionReason === reason ? '#EF444420' : theme.colors.background,
                      borderColor: rejectionReason === reason ? '#EF4444' : theme.colors.border,
                    }
                  ]}
                >
                  <Text style={[styles.presetChipText, { color: rejectionReason === reason ? '#EF4444' : theme.colors.text }]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              placeholder="Or enter custom reason..."
              placeholderTextColor={theme.colors.placeholder}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setRejectModalVisible(false)}
                style={[styles.modalBtn, styles.modalCancelBtn, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitRejection}
                style={[styles.modalBtn, styles.modalConfirmBtn, { backgroundColor: '#EF4444' }]}
              >
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Complete Service Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={completeModalVisible}
        onRequestClose={() => setCompleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrapper, { backgroundColor: '#10B98115' }]}>
                <MaterialCommunityIcons name="check-decagram" size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Complete Service</Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                  {selectedCompleteItem?.registrationNumber || 'Vehicle'} • {selectedCompleteItem?.serviceName || 'Service'}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, color: theme.colors.placeholder, marginTop: 4, marginBottom: 8 }}>
              Mark this vehicle as inspected & finished. The customer will receive an alert that their vehicle is ready for pickup.
            </Text>

            {/* Quick Note Presets */}
            <Text style={[styles.presetTitle, { color: theme.colors.placeholder }]}>Quick service notes:</Text>
            <View style={styles.presetChips}>
              {['MOT & Service Passed', 'All Checks Completed', 'Air & Oil Filter Replaced', 'Brakes Checked - Good', 'Ready for Collection'].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  onPress={() => setCompleteNotes(preset)}
                  style={[
                    styles.presetChip,
                    { 
                      backgroundColor: completeNotes === preset ? '#10B98120' : theme.colors.background,
                      borderColor: completeNotes === preset ? '#10B981' : theme.colors.border,
                    }
                  ]}
                >
                  <Text style={[styles.presetChipText, { color: completeNotes === preset ? '#10B981' : theme.colors.text }]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              placeholder="Or enter mechanic notes / advisories..."
              placeholderTextColor={theme.colors.placeholder}
              value={completeNotes}
              onChangeText={setCompleteNotes}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setCompleteModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1 }]}
                disabled={submittingComplete}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitCompleteService}
                style={[styles.modalBtn, { backgroundColor: '#10B981' }]}
                disabled={submittingComplete}
              >
                {submittingComplete ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Confirm Complete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={filterBottomSheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterBottomSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.bottomSheetBackdrop}
          activeOpacity={1}
          onPress={() => setFilterBottomSheetVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.bottomSheetContainer, { backgroundColor: theme.colors.card }]}>
            {/* Sheet Handle */}
            <View style={styles.bottomSheetHandle} />

            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <Text style={[styles.bottomSheetTitle, { color: theme.colors.text }]}>Filters</Text>
              <TouchableOpacity
                onPress={() => setFilterBottomSheetVisible(false)}
                style={[styles.sheetCloseBtn, { backgroundColor: theme.colors.background }]}
              >
                <MaterialCommunityIcons name="close" size={18} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* SECTION 1: FILTER BY STATUS (Tags with rounded border radius, wrapping naturally) */}
            <View style={styles.sheetSection}>
              <Text style={[styles.sheetSectionLabel, { color: theme.colors.placeholder }]}>STATUS</Text>
              <View style={styles.filterTagsWrap}>
                {filterOptions.map((opt) => {
                  const isSelected = statusFilter === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.filterTag,
                        {
                          backgroundColor: isSelected ? opt.color : theme.colors.background,
                          borderColor: isSelected ? opt.color : theme.colors.border,
                        }
                      ]}
                      onPress={() => setStatusFilter(opt.key)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={opt.icon}
                        size={15}
                        color={isSelected ? '#FFFFFF' : opt.color}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.filterTagText,
                          {
                            color: isSelected ? '#FFFFFF' : theme.colors.text,
                            fontFamily: isSelected ? fonts.bold : fonts.semiBold,
                          }
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <View
                        style={[
                          styles.filterTagBadge,
                          {
                            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.28)' : (opt.color + '18'),
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterTagBadgeText,
                            { color: isSelected ? '#FFFFFF' : opt.color }
                          ]}
                        >
                          {opt.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={[styles.bottomSheetActions, { marginTop: 16 }]}>
              <TouchableOpacity
                style={[styles.sheetResetBtn, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setStatusFilter('ALL');
                }}
              >
                <MaterialCommunityIcons name="restart" size={16} color={theme.colors.placeholder} />
                <Text style={[styles.sheetResetBtnText, { color: theme.colors.placeholder }]}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetApplyBtn, { backgroundColor: theme.colors.secondary }]}
                onPress={() => setFilterBottomSheetVisible(false)}
              >
                <Text style={styles.sheetApplyBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Calendar Picker Modal */}
      <Modal visible={calendarModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCalendarModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.calendarModalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
          >
            {/* Calendar Month & Year Controls */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={handlePrevMonth} style={[styles.calNavBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.text} />
              </TouchableOpacity>

              <View style={styles.calTitleBox}>
                <Text style={[styles.calendarTitle, { color: theme.colors.text }]}>
                  {monthNames[currentViewDate.getMonth()]} {currentViewDate.getFullYear()}
                </Text>
                <Text style={[styles.calSubTitle, { color: theme.colors.placeholder }]}>
                  Select date to filter appointments
                </Text>
              </View>

              <TouchableOpacity onPress={handleNextMonth} style={[styles.calNavBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Quick Toolbar: Jump to Today */}
            <View style={styles.calToolbarRow}>
              <TouchableOpacity
                style={[styles.todayQuickBtn, { backgroundColor: theme.colors.secondary + '18', borderColor: theme.colors.secondary + '40' }]}
                onPress={handleJumpToToday}
              >
                <MaterialCommunityIcons name="calendar-today" size={14} color={theme.colors.secondary} />
                <Text style={[styles.todayQuickBtnText, { color: theme.colors.secondary }]}>Select Today</Text>
              </TouchableOpacity>

              {selectedCustomDate && (
                <View style={[styles.activeDateTag, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <MaterialCommunityIcons name="calendar-check" size={14} color="#10B981" />
                  <Text style={[styles.activeDateTagText, { color: theme.colors.text }]}>
                    Selected: <Text style={{ fontFamily: fonts.extraBold, color: theme.colors.secondary }}>{formatYMDToDisplay(selectedCustomDate)}</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setDateFilter('ALL');
                      setSelectedCustomDate(null);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginLeft: 6 }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={14} color={theme.colors.placeholder} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Weekday labels */}
            <View style={styles.weekdayRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, index) => (
                <Text
                  key={d}
                  style={[
                    styles.weekdayText,
                    { color: index === 0 ? '#EF4444' : theme.colors.placeholder }
                  ]}
                >
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

                const dateYMD = toYMD(day);
                if (!dateYMD) return null;

                const isSelected = dateFilter === 'CUSTOM' && selectedCustomDate === dateYMD;
                const isToday = dateYMD === todayYMD;
                const hasBookings = datesWithBookingsSet.has(dateYMD);
                const isSunday = day.getDay() === 0;

                return (
                  <View key={dateYMD} style={styles.dayCell}>
                    <TouchableOpacity
                      onPress={() => {
                        setDateFilter('CUSTOM');
                        setSelectedCustomDate(dateYMD);
                        setCalendarModalVisible(false);
                      }}
                      style={[
                        styles.dayBtn,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.secondary
                            : isToday
                            ? theme.colors.secondary + '18'
                            : hasBookings
                            ? '#8B5CF618'
                            : 'transparent',
                          borderColor: isSelected
                            ? theme.colors.secondary
                            : isToday
                            ? theme.colors.secondary
                            : hasBookings
                            ? '#8B5CF6'
                            : theme.colors.border + '60',
                          borderWidth: isSelected || isToday || hasBookings ? 1.5 : 1,
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : hasBookings
                              ? '#8B5CF6'
                              : isSunday
                              ? '#EF4444'
                              : isToday
                              ? theme.colors.secondary
                              : theme.colors.text,
                            fontFamily: isSelected || isToday || hasBookings ? fonts.extraBold : fonts.semiBold,
                          }
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                      {isToday && !isSelected && (
                        <View style={[styles.todayDot, { backgroundColor: theme.colors.secondary }]} />
                      )}
                      {hasBookings && !isSelected && (
                        <View style={[styles.pastBookingDot, { backgroundColor: '#8B5CF6' }]} />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Calendar Legend */}
            <View style={[styles.calendarLegendRow, { borderTopColor: theme.colors.border + '40' }]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.secondary }]} />
                <Text style={[styles.legendText, { color: theme.colors.text }]}>Today</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.legendText, { color: '#8B5CF6' }]}>Has Bookings</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.legendText, { color: theme.colors.placeholder }]}>Empty Day</Text>
              </View>
            </View>

            {/* Calendar Bottom Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {selectedCustomDate ? (
                <TouchableOpacity
                  style={[styles.closeCalModalBtn, { flex: 1, marginTop: 0, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#EF444415', borderColor: '#EF444440' }]}
                  onPress={() => {
                    setDateFilter('ALL');
                    setSelectedCustomDate(null);
                    setCalendarModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="calendar-remove" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.closeCalModalBtnText, { color: '#EF4444', fontFamily: fonts.bold }]}>Clear Date</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.closeCalModalBtn, { flex: 1, marginTop: 0, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => setCalendarModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.closeCalModalBtnText, { color: theme.colors.text }]}>Close Calendar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  navTitleContainer: {
    flex: 1,
  },
  navTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  navSubtitle: {
    fontSize: 11.5,
    fontFamily: fonts.regular,
    marginTop: 1,
  },
  refreshIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    gap: 8,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    padding: 0,
  },
  filterIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  activeFilterPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeFilterPillText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  clearFilterCross: {
    marginLeft: 4,
    padding: 2,
  },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomSheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9CA3AF50',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  bottomSheetTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSection: {
    marginBottom: 14,
  },
  sheetSectionLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  filterTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterTagText: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    marginRight: 6,
  },
  filterTagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  filterTagBadgeText: {
    fontSize: 10.5,
    fontFamily: fonts.bold,
  },
  bottomSheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  sheetResetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  sheetResetBtnText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
  sheetApplyBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  sheetApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: fonts.bold,
  },
  calendarModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    width: '92%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calTitleBox: {
    alignItems: 'center',
  },
  calendarTitle: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    letterSpacing: -0.2,
  },
  calSubTitle: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 1,
  },
  calToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  todayQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  todayQuickBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  activeDateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeDateTagText: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB20',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11.5,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 3,
  },
  pastBookingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 3,
  },
  calendarLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  closeCalModalBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeCalModalBtnText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  bookingCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3.5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginBottom: 8,
    elevation: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  vehicleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginRight: 6,
  },
  plate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  plateText: {
    color: '#000',
    fontFamily: fonts.extraBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
  },
  vehicleModelText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 9.5,
    fontFamily: fonts.bold,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 5,
    flexWrap: 'wrap',
  },
  dateTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  compactDateText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  metaDot: {
    fontSize: 10,
    marginHorizontal: 1,
  },
  compactSlotText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  serviceTagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
    flexShrink: 0,
  },
  serviceTagText: {
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  compactCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  customerMetaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  customerMetaName: {
    fontSize: 11.5,
    fontFamily: fonts.medium,
    flexShrink: 1,
  },
  phoneChipCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
    marginLeft: 3,
  },
  phoneChipTextCompact: {
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  rightTagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  stationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#10B98115',
    borderColor: '#10B98140',
    borderWidth: 0.5,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  stationTagText: {
    fontSize: 9.5,
    fontFamily: fonts.semiBold,
    color: '#059669',
  },
  extraServiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#10B98115',
    borderColor: '#10B98140',
    borderWidth: 0.5,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  extraServiceTagText: {
    fontSize: 9.5,
    fontFamily: fonts.bold,
    color: '#059669',
  },
  multiServicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  multiServicePill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  multiServicePillText: {
    fontSize: 9.5,
    fontFamily: fonts.semiBold,
  },
  compactAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF444410',
    borderWidth: 0.5,
    borderColor: '#EF444430',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 4,
  },
  compactAlertText: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    flex: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB20',
    flexWrap: 'wrap',
  },
  cardActionBtn: {
    flex: 1,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
    borderRadius: 5,
  },
  cardActionBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: 5,
    borderWidth: 1,
  },
  cardRejectBtn: {
    borderWidth: 1,
    backgroundColor: '#EF444410',
  },
  cardRejectBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  cardConfirmBtn: {
    elevation: 1,
  },
  cardConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  cardCancelBookingBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: 5,
  },
  cardCancelBookingTextCompact: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  modalSubtitle: {
    fontSize: 11.5,
    fontFamily: fonts.regular,
    marginTop: 1,
  },
  presetTitle: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  presetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 10.5,
    fontFamily: fonts.semiBold,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 12.5,
    fontFamily: fonts.regular,
    height: 60,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  modalCancelBtn: {
    borderWidth: 1,
  },
  modalConfirmBtn: {
    elevation: 1,
  },
  modalBtnText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
});

