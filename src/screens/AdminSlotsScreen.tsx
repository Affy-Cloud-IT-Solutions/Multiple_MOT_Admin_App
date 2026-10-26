import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Linking,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';

interface Station {
  id?: string;
  _id?: string;
  name: string;
  type: string;
  slotDuration: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  isActive?: boolean;
}

interface SlotBooking {
  id: string;
  slotTime?: string;
  customerName: string;
  customerMobile?: string;
  customerEmail?: string;
  registrationNumber: string;
  makeModel: string;
  serviceName?: string;
  services?: any[];
  hasMot?: boolean;
  isDateOnly?: boolean;
  stationName?: string;
  status: string;
  price?: number;
  duration?: number;
}

interface SlotItem {
  time: string;
  endTime?: string;
  slotLabel?: string;
  slotDuration?: number;
  totalCapacity: number;
  bookedCount: number;
  blockedCount?: number;
  availableCount: number;
  isBlocked: boolean;
  isPartiallyBlocked?: boolean;
  status: 'Available' | 'Full' | 'Blocked';
  bookings: SlotBooking[];
}

export interface GarageServiceItem {
  _id?: string;
  id?: string;
  name: string;
  category?: string;
  price?: number;
  duration?: number;
  description?: string;
  availability?: string[];
  isActive?: boolean;
}

interface SlotsResponse {
  garageId: string;
  garageName: string;
  date: string; // DD-MM-YYYY format
  isoDate: string;
  workingHours: string;
  slotDuration: number;
  totalApprovedStations: number;
  totalSlots?: number;
  totalCapacityToday?: number;
  totalBookedToday?: number;
  availableCapacityToday?: number;
  todayBookingsSummary?: SlotBooking[];
  stations: Station[];
  allStations: Station[];
  slots: SlotItem[];
  blockedSlots?: { date: string; slot: string; stationId?: string }[];
  services?: GarageServiceItem[];
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  'ALL': { bg: '#EEF2FF', text: '#4F46E5', icon: 'view-grid-plus-outline' },
  'MOT': { bg: '#E0F2FE', text: '#0284C7', icon: 'shield-check' },
  'Servicing': { bg: '#FEF3C7', text: '#D97706', icon: 'car-wrench' },
  'Repairs': { bg: '#FEE2E2', text: '#DC2626', icon: 'hammer-wrench' },
  'Tyre replacement': { bg: '#F3E8FF', text: '#9333EA', icon: 'tire' },
  'Tyres': { bg: '#F3E8FF', text: '#9333EA', icon: 'tire' },
  'Diagnostics': { bg: '#ECFDF5', text: '#059669', icon: 'laptop' },
  'Brakes': { bg: '#FFE4E6', text: '#E11D48', icon: 'car-brake-alert' },
  'Exhaust': { bg: '#F1F5F9', text: '#475569', icon: 'smoke' },
  'Air Conditioning': { bg: '#E0F7FA', text: '#00838F', icon: 'snowflake' },
  'Custom': { bg: '#F3F4F6', text: '#374151', icon: 'cog-outline' },
};

const ALL_SERVICES_ITEM: GarageServiceItem = {
  name: 'All Services',
  category: 'ALL',
  price: 0,
  duration: 0,
  isActive: true,
};

const DEFAULT_SERVICES: GarageServiceItem[] = [
  { name: 'MOT Test (Class 4)', category: 'MOT', price: 45, duration: 45, isActive: true },
  { name: 'Interim Service', category: 'Servicing', price: 85, duration: 60, isActive: true },
  { name: 'Full Service', category: 'Servicing', price: 155, duration: 120, isActive: true },
  { name: 'Major Service', category: 'Servicing', price: 220, duration: 180, isActive: true },
  { name: 'Engine Diagnostic & Scan', category: 'Diagnostics', price: 50, duration: 45, isActive: true },
  { name: 'Front Brake Pads & Discs', category: 'Brakes', price: 130, duration: 60, isActive: true },
  { name: 'Tyre Replacement & Balancing', category: 'Tyre replacement', price: 65, duration: 45, isActive: true },
];

// Format Date object to DD-MM-YYYY string
function formatToDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Format DD-MM-YYYY string to human readable e.g. "22 Oct 2026"
function formatDisplayDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d} ${months[m]} ${y}`;
    }
  } catch (e) {}
  return dateStr;
}

export default function AdminSlotsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { user, token, refreshData, garages, fetchGarageServices, alerts } = useAppValues();

  const garageId = user?.garageId || (garages.length > 0 ? garages[0]._id || garages[0].id : '');

  // Selected service (defaults to All Services)
  const [selectedService, setSelectedService] = useState<GarageServiceItem>(ALL_SERVICES_ITEM);

  // Dropdown & Calendar modals visibility
  const [serviceDropdownVisible, setServiceDropdownVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);

  const [garageServices, setGarageServices] = useState<GarageServiceItem[]>([]);
  const [processingDateBlock, setProcessingDateBlock] = useState(false);

  // Current calendar view month/year navigation (unlimited years ahead e.g. 2026, 2027, 2028...)
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());

  // Selected date in DD-MM-YYYY format (default today)
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatToDDMMYYYY(new Date())
  );

  // Set of dates (in DD-MM-YYYY format) that have historical bookings
  const datesWithBookingsSet = useMemo(() => {
    const set = new Set<string>();
    (alerts || []).forEach((a: any) => {
      if (a.type === 'BOOKED' && a.date) {
        try {
          if (typeof a.date === 'string') {
            const matchIso = a.date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (matchIso) {
              const y = matchIso[1];
              const m = matchIso[2].padStart(2, '0');
              const d = matchIso[3].padStart(2, '0');
              set.add(`${d}-${m}-${y}`);
              return;
            }
            const matchUk = a.date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
            if (matchUk) {
              const d = matchUk[1].padStart(2, '0');
              const m = matchUk[2].padStart(2, '0');
              const y = matchUk[3];
              set.add(`${d}-${m}-${y}`);
              return;
            }
          }
          const d = new Date(a.date);
          if (!isNaN(d.getTime())) {
            set.add(formatToDDMMYYYY(d));
          }
        } catch (e) {}
      }
    });
    return set;
  }, [alerts]);

  // Is currently selected date in the past?
  const isSelectedDateInPast = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const dateStart = new Date(y, m, d);
        const todayObj = new Date();
        const todayStart = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
        return dateStart < todayStart;
      }
    } catch (e) {}
    return false;
  }, [selectedDate]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [slotData, setSlotData] = useState<SlotsResponse | null>(null);

  // Add station modal
  const [modalVisible, setModalVisible] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationType, setNewStationType] = useState('Class 4 MOT Bay');
  const [submittingStation, setSubmittingStation] = useState(false);

  // Action loading for slot block/unblock
  const [processingSlot, setProcessingSlot] = useState<string | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Month navigation (allows inspecting 2026, 2027, 2028, or historical dates)
  const handlePrevMonth = () => {
    setCurrentViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentViewDate(today);
    setSelectedDate(formatToDDMMYYYY(today));
  };

  // Generate days grid for current viewed month
  const calendarDays = useMemo(() => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    // Leading empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Days of the month
    for (let d = 1; d <= lastDate; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentViewDate]);


  const fetchSlots = useCallback(async () => {
    if (!garageId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await fetch(
        `${BASE_URL}/garages/${garageId}/slots?date=${selectedDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSlotData(data);
        if (data.services && data.services.length > 0) {
          setGarageServices(data.services);
        }
      } else {
        const err = await res.json();
        console.error('Failed to fetch slots:', err);
      }
    } catch (e) {
      console.error('Error fetching slots:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [garageId, selectedDate, token]);

  useEffect(() => {
    setLoading(true);
    fetchSlots();
  }, [fetchSlots]);

  // Fetch garage services from API on mount
  useEffect(() => {
    if (garageId && fetchGarageServices) {
      fetchGarageServices(garageId)
        .then((svcs: any[]) => {
          if (Array.isArray(svcs) && svcs.length > 0) {
            setGarageServices(svcs);
          }
        })
        .catch(() => {});
    }
  }, [garageId, fetchGarageServices]);

  // Auto-refresh whenever screen gains focus so any new customer booking shows up instantly
  useFocusEffect(
    useCallback(() => {
      fetchSlots();
    }, [fetchSlots])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSlots();
    refreshData();
  }, [fetchSlots, refreshData]);

  // Computed available services list for the selector
  const availableServices = useMemo<GarageServiceItem[]>(() => {
    const raw: GarageServiceItem[] = (garageServices.length > 0
      ? garageServices
      : (slotData?.services && slotData.services.length > 0 ? slotData.services : DEFAULT_SERVICES));

    const motItems = raw.filter(s => (s.category || '').toUpperCase() === 'MOT' || (s.name || '').toUpperCase().includes('MOT'));
    const nonMotItems = raw.filter(s => (s.category || '').toUpperCase() !== 'MOT' && !(s.name || '').toUpperCase().includes('MOT'));

    const list: GarageServiceItem[] = [ALL_SERVICES_ITEM];
    if (motItems.length > 0) {
      list.push(...motItems);
    } else {
      list.push({ name: 'MOT Test (Class 4)', category: 'MOT', price: 45, duration: 45, isActive: true });
    }
    list.push(...nonMotItems);
    return list;
  }, [garageServices, slotData?.services]);

  // Is "All Services" selected?
  const isAllSelected = useMemo(() => {
    return (selectedService.category || '').toUpperCase() === 'ALL' || selectedService.name === 'All Services';
  }, [selectedService]);

  // Is active service MOT?
  const isMotSelected = useMemo(() => {
    if (isAllSelected) return false;
    const cat = (selectedService.category || '').toUpperCase();
    const name = (selectedService.name || '').toUpperCase();
    return cat === 'MOT' || name.includes('MOT');
  }, [selectedService, isAllSelected]);

  // Category visual attributes
  const getCategoryDetails = (cat?: string, name?: string) => {
    if (cat === 'ALL' || name === 'All Services') return CATEGORY_COLORS['ALL'];
    if (cat && CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
    const n = (name || '').toLowerCase();
    if (n.includes('mot')) return CATEGORY_COLORS['MOT'];
    if (n.includes('service')) return CATEGORY_COLORS['Servicing'];
    if (n.includes('brake')) return CATEGORY_COLORS['Brakes'];
    if (n.includes('tyre')) return CATEGORY_COLORS['Tyre replacement'];
    if (n.includes('diagnostic')) return CATEGORY_COLORS['Diagnostics'];
    if (n.includes('repair')) return CATEGORY_COLORS['Repairs'];
    if (n.includes('air')) return CATEGORY_COLORS['Air Conditioning'];
    return { bg: '#F3F4F6', text: '#374151', icon: 'wrench' };
  };

  const currentCatDetails = getCategoryDetails(selectedService.category, selectedService.name);

  // Check if selected date is blocked for this service
  const isDateBlockedForService = useMemo(() => {
    if (!slotData?.blockedSlots) return false;
    const isoDate = slotData.isoDate;
    const serviceSlotKey = `SERVICE_DATE_${selectedService.name}`;
    return slotData.blockedSlots.some(
      (b: any) =>
        (b.date === isoDate || b.date === selectedDate) &&
        (b.slot === serviceSlotKey || b.slot === 'FULL_DAY' || b.slot === selectedService.name || b.slot === 'ALL_SERVICES')
    );
  }, [slotData, selectedDate, selectedService]);

  // Handle blocking/unblocking the selected date for this service
  const handleToggleDateBlockForService = async () => {
    if (isSelectedDateInPast) {
      Alert.alert('Past Date', 'Past dates cannot be blocked or unblocked.');
      return;
    }
    if (!garageId) {
      Alert.alert('Error', 'No garage found.');
      return;
    }
    setProcessingDateBlock(true);
    const serviceSlotKey = `SERVICE_DATE_${selectedService.name}`;
    const endpoint = isDateBlockedForService ? 'unblock-slot' : 'block-slot';
    const actionText = isDateBlockedForService ? 'unblocked' : 'blocked';

    try {
      const res = await fetch(`${BASE_URL}/garages/${garageId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          slot: serviceSlotKey,
        }),
      });

      if (res.ok) {
        Alert.alert(
          'Date Status Updated',
          `Date ${selectedDate} is now ${actionText} for ${selectedService.name}.`
        );
        fetchSlots();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || `Could not ${actionText} date.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || `Failed to ${actionText} date.`);
    } finally {
      setProcessingDateBlock(false);
    }
  };

  const allBookingsToday = slotData?.todayBookingsSummary || [];

  // Filter bookings for MOT (single MOT or multi-service including MOT)
  const motBookings = useMemo(() => {
    return allBookingsToday.filter(b => {
      if (b.hasMot === true) return true;
      if (b.isDateOnly === true && b.hasMot === false) return false;
      if (Array.isArray(b.services) && b.services.length > 0) {
        return b.services.some((s: any) => {
          const sName = (s.name || '').toUpperCase();
          const sCat = (s.category || '').toUpperCase();
          return sName.includes('MOT') || sCat === 'MOT';
        });
      }
      const sName = (b.serviceName || '').toUpperCase();
      return !b.serviceName || sName.includes('MOT');
    });
  }, [allBookingsToday]);

  // Filter bookings for the selected Date-Only service (single or multi-service)
  const serviceBookings = useMemo(() => {
    const targetName = (selectedService.name || '').toLowerCase().trim();
    const targetCat = (selectedService.category || '').toLowerCase().trim();

    return allBookingsToday.filter(b => {
      if (Array.isArray(b.services) && b.services.length > 0) {
        const matchesInServices = b.services.some((s: any) => {
          const sName = (s.name || '').toLowerCase().trim();
          const sCat = (s.category || '').toLowerCase().trim();
          return (
            sName === targetName ||
            sName.includes(targetName) ||
            targetName.includes(sName) ||
            (targetCat && (sCat === targetCat || sName.includes(targetCat)))
          );
        });
        if (matchesInServices) return true;
      }
      const bName = (b.serviceName || '').toLowerCase().trim();
      if (!bName) return false;
      return (
        bName === targetName ||
        bName.includes(targetName) ||
        targetName.includes(bName) ||
        (targetCat && bName.includes(targetCat))
      );
    });
  }, [allBookingsToday, selectedService]);

  // Bookings to display according to the active service filter
  const displayedBookings = useMemo(() => {
    if (isAllSelected) {
      return allBookingsToday;
    }
    if (isMotSelected) {
      return motBookings;
    }
    return serviceBookings;
  }, [isAllSelected, isMotSelected, allBookingsToday, motBookings, serviceBookings]);

  const stations = slotData?.allStations || slotData?.stations || [];
  const approvedStationsCount = slotData?.totalApprovedStations || 0;
  const totalBookedToday = motBookings.length;
  const totalCapacityToday = slotData?.totalCapacityToday ?? (approvedStationsCount * 12);
  const availableCapacityToday = Math.max(0, totalCapacityToday - totalBookedToday);
  const todayBookings = displayedBookings;

  // Request new station
  const handleAddStation = async () => {
    if (!newStationName.trim()) {
      Alert.alert('Validation', 'Please enter a name for the station (e.g. Station 2).');
      return;
    }
    if (!garageId) {
      Alert.alert('Error', 'No associated garage found for this account.');
      return;
    }

    setSubmittingStation(true);
    try {
      const res = await fetch(`${BASE_URL}/garages/${garageId}/stations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newStationName.trim(),
          type: newStationType,
          slotDuration: 45,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        Alert.alert(
          'Station Submitted',
          `"${newStationName}" has been submitted for Platform Super Admin approval. Once approved, it will automatically increase your MOT booking capacity.`
        );
        setNewStationName('');
        setModalVisible(false);
        fetchSlots();
        refreshData();
      } else {
        Alert.alert('Submission Failed', json.error || 'Could not submit station.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit station.');
    } finally {
      setSubmittingStation(false);
    }
  };

  // Helper to execute block/unblock API call
  const executeSlotBlock = async (slot: SlotItem, action: 'block' | 'unblock', count?: number, unblockAll?: boolean) => {
    if (!garageId) return;
    setProcessingSlot(slot.time);

    try {
      const res = await fetch(`${BASE_URL}/garages/${garageId}/${action === 'block' ? 'block-slot' : 'unblock-slot'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          slot: slot.time,
          count,
          unblockAll,
        }),
      });

      if (res.ok) {
        fetchSlots();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || `Could not ${action} slot.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || `Failed to ${action} slot.`);
    } finally {
      setProcessingSlot(null);
    }
  };

  // Toggle or manage slot block / unblock (supports single and multi-bay setups)
  const handleToggleSlotBlock = async (slot: SlotItem) => {
    if (isSelectedDateInPast) {
      Alert.alert('Past Date', 'Past slots cannot be blocked or unblocked.');
      return;
    }
    if (!garageId) return;

    const totalCapacity = slot.totalCapacity || 1;
    const blockedCount = slot.blockedCount !== undefined ? slot.blockedCount : (slot.isBlocked ? totalCapacity : 0);

    // If garage has only 1 bay, use straightforward single-click toggle
    if (totalCapacity <= 1) {
      const isCurrentlyBlocked = slot.isBlocked;
      executeSlotBlock(slot, isCurrentlyBlocked ? 'unblock' : 'block');
      return;
    }

    // Multi-bay setup (totalCapacity >= 2, e.g. 2 bays: block 1/2 then 2/2)
    if (blockedCount === 0) {
      // 0 bays blocked: Option to block 1 bay (1/N) or all bays (N/N)
      Alert.alert(
        `Manage Slot ${slot.time}`,
        `This slot has ${totalCapacity} MOT bays. Choose how many bays to block:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Block 1 Bay (1/${totalCapacity})`,
            onPress: () => executeSlotBlock(slot, 'block', 1),
          },
          {
            text: `Block All Bays (${totalCapacity}/${totalCapacity})`,
            style: 'destructive',
            onPress: () => executeSlotBlock(slot, 'block', totalCapacity),
          },
        ]
      );
    } else if (blockedCount < totalCapacity) {
      // Partially blocked (e.g. 1/2 blocked)
      const nextBlockCount = blockedCount + 1;
      const buttons: any[] = [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Block Bay (${nextBlockCount}/${totalCapacity})`,
          onPress: () => executeSlotBlock(slot, 'block', nextBlockCount),
        },
      ];

      // If more than 2 bays, allow jumping straight to blocking all
      if (nextBlockCount < totalCapacity) {
        buttons.push({
          text: `Block All (${totalCapacity}/${totalCapacity})`,
          style: 'destructive',
          onPress: () => executeSlotBlock(slot, 'block', totalCapacity),
        });
      }

      buttons.push({
        text: 'Unblock 1 Bay',
        onPress: () => executeSlotBlock(slot, 'unblock', 1),
      });

      buttons.push({
        text: 'Unblock All Bays',
        onPress: () => executeSlotBlock(slot, 'unblock', undefined, true),
      });

      Alert.alert(
        `Manage Slot ${slot.time}`,
        `Currently ${blockedCount} of ${totalCapacity} bays are blocked. Remaining ${slot.availableCount} bay(s) are available for bookings.`,
        buttons
      );
    } else {
      // All bays blocked (e.g. 2/2 blocked)
      Alert.alert(
        `Manage Slot ${slot.time}`,
        `All ${totalCapacity} bays are currently blocked (${totalCapacity}/${totalCapacity}).`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Unblock 1 Bay (1/${totalCapacity} Open)`,
            onPress: () => executeSlotBlock(slot, 'unblock', 1),
          },
          {
            text: 'Unblock All Bays (All Open)',
            onPress: () => executeSlotBlock(slot, 'unblock', undefined, true),
          },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header Controls */}
      <View style={styles.header}>
        {/* Station Count Chip */}
        <View style={[styles.stationCountChip, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '35' }]}>
          <MaterialCommunityIcons name="garage" size={16} color={theme.colors.primary} />
          <Text style={[styles.stationCountChipText, { color: theme.colors.primary }]}>
            {approvedStationsCount} {approvedStationsCount === 1 ? 'MOT Bay' : 'MOT Bays'} Active
          </Text>
        </View>

        {/* Add MOT Station Button (garage_admin only) */}
        {user?.role === 'garage_admin' && (
          <TouchableOpacity
            style={[styles.addStationHeaderBtn, { backgroundColor: theme.colors.primary }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.addStationHeaderBtnText}>Add Bay</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Top Filter Bar: Service Dropdown (Left) & Today Date / Calendar (Right) */}
      <View style={[styles.topFilterBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {/* Left: Service Dropdown Selector */}
        <TouchableOpacity
          style={[styles.dropdownBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
          onPress={() => setServiceDropdownVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.dropdownIconCircle, { backgroundColor: currentCatDetails.bg }]}>
            <MaterialCommunityIcons name={currentCatDetails.icon} size={15} color={currentCatDetails.text} />
          </View>
          <View style={styles.dropdownTextBox}>
            <Text style={[styles.dropdownLabel, { color: theme.colors.placeholder }]}>Service</Text>
            <Text style={[styles.dropdownValue, { color: theme.colors.text }]} numberOfLines={1}>
              {selectedService.name}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.placeholder} />
        </TouchableOpacity>

        {/* Right: Date Picker with Calendar Icon */}
        <TouchableOpacity
          style={[styles.datePickerBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
          onPress={() => setCalendarModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.dateIconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
            <MaterialCommunityIcons name="calendar-month-outline" size={16} color={theme.colors.primary} />
          </View>
          <View style={styles.dateTextBox}>
            <Text style={[styles.dateLabel, { color: theme.colors.placeholder }]}>
              {selectedDate === formatToDDMMYYYY(new Date()) ? 'Today' : 'Date'}
            </Text>
            <Text style={[styles.dateValue, { color: theme.colors.text }]} numberOfLines={1}>
              {formatDisplayDate(selectedDate)}
            </Text>
          </View>
          <MaterialCommunityIcons name="calendar-cursor" size={15} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Past Date Banner */}
      {isSelectedDateInPast && (
        <View style={styles.pastDateBanner}>
          <MaterialCommunityIcons name="history" size={18} color="#D97706" />
          <Text style={styles.pastDateBannerText}>
            Viewing past record for {formatDisplayDate(selectedDate)}. Slot modifications are locked for past dates.
          </Text>
        </View>
      )}

      {(isMotSelected || isAllSelected) ? (
        <>
          {/* SECTION 1: TODAY'S BOOKINGS & WHOSE VEHICLES (Summary Banner) */}
          <View style={[styles.bookingSummaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.summaryTopRow}>
              <View style={styles.summaryTitleBox}>
                <MaterialCommunityIcons name="clipboard-text-clock" size={20} color={theme.colors.primary} />
                <Text style={[styles.summaryCardTitle, { color: theme.colors.text }]}>
                  {isAllSelected ? `Bookings for ${selectedDate}` : `Bookings for ${selectedDate}`}
                </Text>
              </View>
              <View style={[styles.bookingCountBadge, { backgroundColor: displayedBookings.length > 0 ? '#10B98120' : '#6B728020' }]}>
                <Text style={[styles.bookingCountBadgeText, { color: displayedBookings.length > 0 ? '#10B981' : '#6B7280' }]}>
                  {displayedBookings.length} Booked
                </Text>
              </View>
            </View>

            {/* 3 Metric Cards */}
            <View style={styles.metricGrid}>
              {isAllSelected ? (
                <>
                  {/* Total Bookings Card */}
                  <View style={[styles.metricCardModern, { backgroundColor: theme.colors.background, borderColor: '#6366F135' }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBox, { backgroundColor: '#6366F115' }]}>
                        <MaterialCommunityIcons name="clipboard-list-outline" size={13} color="#6366F1" />
                      </View>
                      <View style={[styles.metricDotIndicator, { backgroundColor: '#6366F1' }]} />
                    </View>
                    <Text style={[styles.metricValueModern, { color: theme.colors.text }]}>
                      {displayedBookings.length}
                    </Text>
                    <Text style={[styles.metricLabelModern, { color: theme.colors.placeholder }]}>
                      Total Bookings
                    </Text>
                  </View>

                  {/* MOT Slots Card */}
                  <View style={[styles.metricCardModern, { backgroundColor: theme.colors.background, borderColor: '#0284C735' }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBox, { backgroundColor: '#0284C715' }]}>
                        <MaterialCommunityIcons name="shield-check" size={13} color="#0284C7" />
                      </View>
                      <View style={[styles.metricDotIndicator, { backgroundColor: '#0284C7' }]} />
                    </View>
                    <Text style={[styles.metricValueModern, { color: '#0284C7' }]}>
                      {motBookings.length}
                    </Text>
                    <Text style={[styles.metricLabelModern, { color: theme.colors.placeholder }]}>
                      MOT Slots
                    </Text>
                  </View>

                  {/* Drop-offs Card */}
                  <View style={[styles.metricCardModern, { backgroundColor: theme.colors.background, borderColor: '#D9770635' }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBox, { backgroundColor: '#D9770615' }]}>
                        <MaterialCommunityIcons name="car-clock" size={13} color="#D97706" />
                      </View>
                      <View style={[styles.metricDotIndicator, { backgroundColor: '#D97706' }]} />
                    </View>
                    <Text style={[styles.metricValueModern, { color: '#D97706' }]}>
                      {Math.max(0, displayedBookings.length - motBookings.length)}
                    </Text>
                    <Text style={[styles.metricLabelModern, { color: theme.colors.placeholder }]}>
                      Drop-Offs
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  {/* Slots Booked Card */}
                  <View style={[styles.metricCardModern, { backgroundColor: theme.colors.background, borderColor: '#0284C735' }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBox, { backgroundColor: '#0284C715' }]}>
                        <MaterialCommunityIcons name="car-clock" size={13} color="#0284C7" />
                      </View>
                      <View style={[styles.metricDotIndicator, { backgroundColor: '#0284C7' }]} />
                    </View>
                    <Text style={[styles.metricValueModern, { color: '#0284C7' }]}>
                      {totalBookedToday} <Text style={{ fontSize: 10.5, fontWeight: '500', color: theme.colors.placeholder }}>/ {totalCapacityToday}</Text>
                    </Text>
                    <Text style={[styles.metricLabelModern, { color: theme.colors.placeholder }]}>
                      Slots Booked
                    </Text>
                  </View>

                  {/* Slots Free Card */}
                  <View style={[styles.metricCardModern, { backgroundColor: theme.colors.background, borderColor: '#10B98135' }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBox, { backgroundColor: '#10B98115' }]}>
                        <MaterialCommunityIcons name="check-circle-outline" size={13} color="#10B981" />
                      </View>
                      <View style={[styles.metricDotIndicator, { backgroundColor: '#10B981' }]} />
                    </View>
                    <Text style={[styles.metricValueModern, { color: '#10B981' }]}>
                      {availableCapacityToday}
                    </Text>
                    <Text style={[styles.metricLabelModern, { color: theme.colors.placeholder }]}>
                      Slots Free
                    </Text>
                  </View>

                  {/* Active Bays Card */}
                  <View style={[styles.metricCardModern, { backgroundColor: theme.colors.background, borderColor: '#8B5CF635' }]}>
                    <View style={styles.metricCardHeader}>
                      <View style={[styles.metricIconBox, { backgroundColor: '#8B5CF615' }]}>
                        <MaterialCommunityIcons name="garage" size={13} color="#8B5CF6" />
                      </View>
                      <View style={[styles.metricDotIndicator, { backgroundColor: '#8B5CF6' }]} />
                    </View>
                    <Text style={[styles.metricValueModern, { color: '#8B5CF6' }]}>
                      {approvedStationsCount}
                    </Text>
                    <Text style={[styles.metricLabelModern, { color: theme.colors.placeholder }]}>
                      Active Bays
                    </Text>
                  </View>
                </>
              )}
            </View>

        {/* WHOSE SLOTS ARE BOOKED (List of Booked Customers & Vehicles) */}
        <View style={styles.whoseBookingsSection}>
          <Text style={[styles.whoseBookingsTitle, { color: theme.colors.text }]}>
            Whose Vehicles are Booked Today:
          </Text>

          {displayedBookings.length === 0 ? (
            <View style={[styles.emptyBookingBox, { backgroundColor: theme.colors.background }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={24} color="#10B981" />
              <Text style={[styles.emptyBookingText, { color: theme.colors.placeholder }]}>
                No bookings scheduled yet for {selectedDate}. {isMotSelected ? `All ${totalCapacityToday} slots are open.` : 'All workshop capacity is currently open.'}
              </Text>
            </View>
          ) : (
            displayedBookings.map((b, idx) => {
              const isDateOnlyBooking = b.isDateOnly === true || b.hasMot === false || b.slotTime === 'Full Day Drop-off';

              return (
                <View
                  key={b.id || idx}
                  style={[styles.bookingItemCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                >
                  <View style={styles.bookingItemHeader}>
                    {/* Slot Time Tag or Date Drop-off Tag */}
                    <View style={[
                      styles.slotTimeBadge,
                      isDateOnlyBooking ? { backgroundColor: '#F59E0B18' } : {}
                    ]}>
                      <MaterialCommunityIcons
                        name={isDateOnlyBooking ? "car-clock" : "clock-outline"}
                        size={11}
                        color={isDateOnlyBooking ? "#D97706" : "#6366F1"}
                      />
                      <Text style={[
                        styles.slotTimeBadgeText,
                        isDateOnlyBooking ? { color: "#D97706" } : {}
                      ]}>
                        {isDateOnlyBooking ? 'Drop-Off' : (b.slotTime || 'MOT Slot')}
                      </Text>
                    </View>

                    {/* UK Yellow License Plate */}
                    <View style={styles.regPlateBadge}>
                      <Text style={styles.regPlateText}>{b.registrationNumber}</Text>
                    </View>

                    {/* Bay Tag or Drop-off pill */}
                    {!isDateOnlyBooking ? (
                      <View style={[styles.bayBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                        <MaterialCommunityIcons name="garage" size={11} color={theme.colors.primary} />
                        <Text style={[styles.bayBadgeText, { color: theme.colors.primary }]}>
                          {b.stationName || `Bay ${(idx % Math.max(1, approvedStationsCount)) + 1}`}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.bayBadge, { backgroundColor: '#10B98115' }]}>
                        <MaterialCommunityIcons name="wrench-outline" size={11} color="#10B981" />
                        <Text style={[styles.bayBadgeText, { color: '#10B981' }]}>
                          Workshop
                        </Text>
                      </View>
                    )}

                    {/* Status Pill */}
                    <View style={[styles.bookingStatusPill, {
                      backgroundColor: b.status === 'Completed' ? '#10B98118' : b.status === 'Approved' ? '#0284C718' : '#F59E0B18',
                    }]}>
                      <Text style={{
                        color: b.status === 'Completed' ? '#10B981' : b.status === 'Approved' ? '#0284C7' : '#F59E0B',
                        fontSize: 9.5,
                        fontWeight: '700'
                      }}>
                        {b.status || 'Pending'}
                      </Text>
                    </View>
                  </View>

                  {/* Customer Details */}
                  <View style={styles.customerRow}>
                    <MaterialCommunityIcons
                      name={b.status === 'Completed' ? 'check-decagram' : b.status === 'Approved' ? 'account-check' : 'account-clock-outline'}
                      size={13}
                      color={b.status === 'Completed' ? '#10B981' : b.status === 'Approved' ? theme.colors.text : '#F59E0B'}
                    />
                    <Text
                      style={[
                        styles.customerNameText,
                        {
                          color: b.status === 'Completed' ? '#10B981' : b.status === 'Approved' ? theme.colors.text : '#F59E0B',
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {b.customerName || 'Customer'}
                    </Text>
                    {b.customerMobile ? (
                      <TouchableOpacity
                        style={styles.phoneChip}
                        onPress={() => Linking.openURL(`tel:${b.customerMobile}`)}
                      >
                        <MaterialCommunityIcons name="phone" size={10} color="#10B981" />
                        <Text style={styles.phoneChipText}>{b.customerMobile}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Vehicle Make/Model & Service */}
                  <View style={styles.vehicleDetailsRow}>
                    <MaterialCommunityIcons name="car-info" size={12} color={theme.colors.placeholder} />
                    <Text style={[styles.vehicleModelText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                      {b.makeModel ? b.makeModel.split(' - ')[0] : 'Vehicle'} • {b.serviceName || (isDateOnlyBooking ? 'Workshop Service' : 'MOT Test')}
                    </Text>
                  </View>

                  {/* Multiple Services tags if more than 1 service booked */}
                  {Array.isArray(b.services) && b.services.length > 1 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                      {b.services.map((s: any, sIdx: number) => {
                        const name = typeof s === 'string' ? s : s?.name || '';
                        return (
                          <View key={sIdx} style={{ backgroundColor: theme.colors.primary + '15', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 }}>
                            <Text style={{ fontSize: 9, color: theme.colors.primary, fontWeight: '600' }}>{name}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* SECTION 3: DAILY 45-MINUTE SLOTS (2-BY-2 GRID LAYOUT) */}
      <View style={styles.timelineSection}>
        <View style={styles.timelineHeader}>
          <View style={styles.timelineHeaderLeft}>
            <MaterialCommunityIcons name="view-grid-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Daily 45-Min Slots ({selectedDate})
            </Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.placeholder }]}>
            2-Column Grid • Tap 'Block' / 'Unblock' to toggle bay availability
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loaderText, { color: theme.colors.placeholder }]}>
              Loading 45-min slots for {selectedDate}...
            </Text>
          </View>
        ) : (slotData?.slots || []).length === 0 ? (
          <View style={[styles.emptySlotsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="calendar-clock" size={44} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptySlotsTitle, { color: theme.colors.text }]}>No Slots Configured</Text>
            <Text style={[styles.emptySlotsSubtitle, { color: theme.colors.placeholder }]}>
              This garage does not have any active MOT bays or time slots configured for {selectedDate}.
            </Text>
            <TouchableOpacity
              style={[styles.emptyAddStationBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyAddStationBtnText}>Add MOT Bay Station</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.slotsGrid2x2}>
            {(slotData?.slots || []).map((slot) => {
              const isProcessing = processingSlot === slot.time;
              const isBlocked = slot.isBlocked;
              const isPartiallyBlocked = Boolean(slot.isPartiallyBlocked || ((slot.blockedCount || 0) > 0 && !isBlocked));
              const isFull = slot.status === 'Full';
              const hasBookings = slot.bookedCount > 0;
              const blockedCount = slot.blockedCount !== undefined ? slot.blockedCount : (isBlocked ? slot.totalCapacity : 0);
              const totalBays = slot.totalCapacity || 1;

              return (
                <View
                  key={slot.time}
                  style={[
                    styles.slotCard2x2,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: isBlocked
                        ? '#9CA3AF50'
                        : isPartiallyBlocked
                        ? '#F59E0B60'
                        : isFull
                        ? '#EF444460'
                        : hasBookings
                        ? '#6366F160'
                        : '#10B98150',
                      opacity: isBlocked ? 0.75 : 1,
                    },
                  ]}
                >
                  {/* Card Top: Time & Status Badge */}
                  <View style={styles.gridCardTop}>
                    <View style={styles.timeTag}>
                      <MaterialCommunityIcons name="clock-outline" size={11} color={theme.colors.primary} />
                      <Text style={[styles.gridTimeText, { color: theme.colors.text }]}>
                        {slot.time}
                      </Text>
                      <Text style={[styles.gridMinTag, { color: theme.colors.placeholder }]}>
                        45m
                      </Text>
                    </View>

                    {/* Small Status Indicator */}
                    <View
                      style={[
                        styles.gridStatusPill,
                        {
                          backgroundColor: isBlocked
                            ? '#6B728020'
                            : isPartiallyBlocked
                            ? '#FEF3C7'
                            : isFull
                            ? '#EF444420'
                            : hasBookings
                            ? '#6366F120'
                            : '#10B98120',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.gridStatusPillText,
                          {
                            color: isBlocked
                              ? '#6B7280'
                              : isPartiallyBlocked
                              ? '#D97706'
                              : isFull
                              ? '#EF4444'
                              : hasBookings
                              ? '#6366F1'
                              : '#10B981',
                          },
                        ]}
                      >
                        {isBlocked
                          ? (totalBays > 1 ? `${totalBays}/${totalBays} Blocked` : 'Blocked')
                          : isPartiallyBlocked
                          ? `${blockedCount}/${totalBays} Blocked`
                          : isFull
                          ? 'Full'
                          : `${slot.availableCount} Free`}
                      </Text>
                    </View>
                  </View>

                  {/* Card Middle: Capacity & Bookings details */}
                  <View style={styles.gridCardMiddle}>
                    <View style={styles.capacityRow}>
                      <Text style={[styles.capacityText, { color: theme.colors.text }]}>
                        {isBlocked
                          ? (totalBays > 1 ? `All ${totalBays} Bays Blocked` : 'Bay Closed')
                          : isPartiallyBlocked
                          ? `${slot.bookedCount} Booked • ${blockedCount}/${totalBays} Blocked`
                          : `${slot.bookedCount}/${totalBays} Booked`}
                      </Text>
                    </View>

                    {/* Compact Booked Vehicle Plates if booked */}
                    {slot.bookings && slot.bookings.length > 0 ? (
                      <View style={styles.gridBookingsList}>
                        {slot.bookings.map((b, bIdx) => (
                          <View key={b.id || bIdx} style={styles.gridBookingRow}>
                            <View style={styles.gridRegBadge}>
                              <Text style={styles.gridRegText}>{b.registrationNumber}</Text>
                            </View>
                            <Text
                              style={[
                                styles.gridCustName,
                                {
                                  color: b.status === 'Approved' ? theme.colors.text : '#F59E0B',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {b.customerName || 'Customer'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.freeBayIndicator}>
                        <MaterialCommunityIcons
                          name={isBlocked ? 'lock-outline' : isPartiallyBlocked ? 'alert-circle-outline' : 'check-circle'}
                          size={11}
                          color={isBlocked ? '#6B7280' : isPartiallyBlocked ? '#D97706' : '#10B981'}
                        />
                        <Text
                          style={[
                            styles.freeBayText,
                            { color: isBlocked ? '#6B7280' : isPartiallyBlocked ? '#D97706' : '#10B981' },
                          ]}
                        >
                          {isBlocked
                            ? 'Closed'
                            : isPartiallyBlocked
                            ? `${slot.availableCount} Bay(s) Open`
                            : 'Bays Open'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Card Bottom: Compact Action Toggle */}
                  <View style={styles.gridCardBottom}>
                    {isSelectedDateInPast ? (
                      <View style={[styles.gridActionBtn, { backgroundColor: '#6B728015', borderColor: '#6B728030' }]}>
                        <MaterialCommunityIcons name="lock-clock" size={10} color="#6B7280" />
                        <Text style={[styles.gridActionBtnText, { color: '#6B7280' }]}>
                          Past
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.gridActionBtn,
                          {
                            backgroundColor: isBlocked
                              ? '#10B98115'
                              : isPartiallyBlocked
                              ? '#FEF3C7'
                              : '#EF444415',
                            borderColor: isBlocked
                              ? '#10B981'
                              : isPartiallyBlocked
                              ? '#F59E0B'
                              : '#EF4444',
                          },
                        ]}
                        disabled={isProcessing}
                        onPress={() => handleToggleSlotBlock(slot)}
                      >
                        {isProcessing ? (
                          <ActivityIndicator
                            size="small"
                            color={isBlocked ? '#10B981' : isPartiallyBlocked ? '#D97706' : '#EF4444'}
                          />
                        ) : (
                          <>
                            <MaterialCommunityIcons
                              name={isBlocked ? 'lock-open-outline' : isPartiallyBlocked ? 'lock-clock' : 'lock-outline'}
                              size={10}
                              color={isBlocked ? '#10B981' : isPartiallyBlocked ? '#D97706' : '#EF4444'}
                            />
                            <Text
                              style={[
                                styles.gridActionBtnText,
                                {
                                  color: isBlocked ? '#10B981' : isPartiallyBlocked ? '#D97706' : '#EF4444',
                                },
                              ]}
                            >
                              {totalBays > 1
                                ? (isBlocked
                                    ? `Unblock (${totalBays}/${totalBays})`
                                    : isPartiallyBlocked
                                    ? `Block (${blockedCount}/${totalBays})`
                                    : `Block (0/${totalBays})`)
                                : (isBlocked ? 'Unblock' : 'Block')}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </>
  ) : (
    <View style={styles.dateOnlySection}>
      {/* 1. Service Overview & "Book by Date Only" Mode Banner */}
      <View style={[styles.serviceOverviewCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.serviceOverviewTop}>
          <View style={[styles.serviceIconLarge, { backgroundColor: currentCatDetails.bg }]}>
            <MaterialCommunityIcons name={currentCatDetails.icon} size={28} color={currentCatDetails.text} />
          </View>
          <View style={styles.serviceOverviewInfo}>
            <View style={styles.serviceNameRow}>
              <Text style={[styles.serviceOverviewTitle, { color: theme.colors.text }]}>
                {selectedService.name}
              </Text>
              <View style={[styles.serviceCategoryBadge, { backgroundColor: currentCatDetails.bg }]}>
                <Text style={[styles.serviceCategoryBadgeText, { color: currentCatDetails.text }]}>
                  {selectedService.category || 'Service'}
                </Text>
              </View>
            </View>
            <View style={styles.serviceMetaRow}>
              <View style={[styles.serviceMetaChip, { backgroundColor: theme.colors.primary + '12' }]}>
                <MaterialCommunityIcons name="currency-gbp" size={13} color={theme.colors.primary} />
                <Text style={[styles.serviceMetaChipText, { color: theme.colors.primary, fontWeight: '700' }]}>
                  £{(selectedService.price ?? 45).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.serviceMetaChip, { backgroundColor: theme.colors.background }]}>
                <MaterialCommunityIcons name="timer-sand" size={13} color={theme.colors.placeholder} />
                <Text style={[styles.serviceMetaChipText, { color: theme.colors.placeholder }]}>
                  ~{selectedService.duration || 60} mins duration
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Book by Date Only Explanation Banner */}
        <View style={[styles.dateOnlyBannerBox, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '30' }]}>
          <View style={styles.dateOnlyBannerHeader}>
            <MaterialCommunityIcons name="calendar-check" size={18} color={theme.colors.primary} />
            <Text style={[styles.dateOnlyBannerTitle, { color: theme.colors.primary }]}>
              Book By Date Only • Full-Day Workshop Intake
            </Text>
          </View>
          <Text style={[styles.dateOnlyBannerBody, { color: theme.colors.text }]}>
            Unlike MOT tests which require strict 45-minute lane intervals, this service is booked for the entire date. Customers drop their vehicle off on {selectedDate}, and your mechanics work on it during normal workshop hours.
          </Text>
        </View>
      </View>

      {/* 2. Date Intake Status & Daily Capacity Management */}
      <View style={[styles.dateIntakeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.intakeHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.intakeCardTitle, { color: theme.colors.text }]}>
              Intake Availability ({selectedDate})
            </Text>
            <Text style={[styles.intakeCardSubtitle, { color: theme.colors.placeholder }]}>
              Manage workshop capacity & accept drop-offs on this date
            </Text>
          </View>
          <View style={[
            styles.intakeStatusPill,
            { backgroundColor: isDateBlockedForService ? '#EF444420' : '#10B98120' }
          ]}>
            <MaterialCommunityIcons
              name={isDateBlockedForService ? "lock-alert" : "check-circle"}
              size={14}
              color={isDateBlockedForService ? "#EF4444" : "#10B981"}
            />
            <Text style={[
              styles.intakeStatusPillText,
              { color: isDateBlockedForService ? "#EF4444" : "#10B981" }
            ]}>
              {isDateBlockedForService ? 'Date Blocked' : 'Open for Intake'}
            </Text>
          </View>
        </View>

        {/* Intake Metrics Row */}
        <View style={styles.metricGrid}>
          <View style={[styles.metricBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.metricBoxValue, { color: theme.colors.primary }]}>
              {serviceBookings.length}
            </Text>
            <Text style={[styles.metricBoxLabel, { color: theme.colors.placeholder }]}>
              Vehicles Booked
            </Text>
          </View>

          <View style={[styles.metricBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.metricBoxValue, { color: isDateBlockedForService ? '#EF4444' : '#10B981' }]}>
              {isDateBlockedForService ? 0 : Math.max(0, 5 - serviceBookings.length)}
            </Text>
            <Text style={[styles.metricBoxLabel, { color: theme.colors.placeholder }]}>
              Spots Free
            </Text>
          </View>

          <View style={[styles.metricBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.metricBoxValue, { color: '#8B5CF6' }]}>
              5 / day
            </Text>
            <Text style={[styles.metricBoxLabel, { color: theme.colors.placeholder }]}>
              Daily Limit
            </Text>
          </View>
        </View>

        {/* Capacity Progress Bar */}
        <View style={styles.capacityProgressContainer}>
          <View style={[styles.capacityProgressBg, { backgroundColor: theme.colors.border + '50' }]}>
            <View 
              style={[
                styles.capacityProgressFill, 
                { 
                  width: `${Math.min(100, (serviceBookings.length / 5) * 100)}%`,
                  backgroundColor: isDateBlockedForService 
                    ? '#EF4444' 
                    : serviceBookings.length >= 5 
                    ? '#EF4444' 
                    : '#10B981'
                }
              ]} 
            />
          </View>
          <Text style={[styles.capacityProgressText, { color: theme.colors.placeholder }]}>
            {isDateBlockedForService 
              ? 'Intake is closed on this date - customers cannot book this service' 
              : `${serviceBookings.length} of 5 daily vehicle intake spots filled for ${selectedDate}`}
          </Text>
        </View>

        {/* Block / Unblock Date Action Button */}
        {isSelectedDateInPast ? (
          <View
            style={[
              styles.dateBlockActionBtn,
              {
                backgroundColor: '#6B728015',
                borderColor: '#6B728030',
              }
            ]}
          >
            <MaterialCommunityIcons
              name="lock-clock"
              size={16}
              color="#6B7280"
            />
            <Text style={[styles.dateBlockActionBtnText, { color: '#6B7280' }]}>
              Past Date (Modifications Locked)
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.dateBlockActionBtn,
              {
                backgroundColor: isDateBlockedForService ? '#10B98115' : '#EF444415',
                borderColor: isDateBlockedForService ? '#10B981' : '#EF4444',
              }
            ]}
            onPress={handleToggleDateBlockForService}
            disabled={processingDateBlock}
            activeOpacity={0.8}
          >
            {processingDateBlock ? (
              <ActivityIndicator size="small" color={isDateBlockedForService ? '#10B981' : '#EF4444'} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={isDateBlockedForService ? "lock-open-variant-outline" : "lock-outline"}
                  size={16}
                  color={isDateBlockedForService ? '#10B981' : '#EF4444'}
                />
                <Text style={[
                  styles.dateBlockActionBtnText,
                  { color: isDateBlockedForService ? '#10B981' : '#EF4444' }
                ]}>
                  {isDateBlockedForService 
                    ? `Re-Open ${selectedDate} for ${selectedService.name}` 
                    : `Block / Close ${selectedDate} for ${selectedService.name}`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Vehicles Booked for this Service on this Date */}
      <View style={[styles.serviceBookingsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryTitleBox}>
            <MaterialCommunityIcons name="car-multiple" size={22} color={theme.colors.primary} />
            <Text style={[styles.summaryCardTitle, { color: theme.colors.text }]}>
              Vehicles Booked ({serviceBookings.length})
            </Text>
          </View>
          <View style={[styles.bookingCountBadge, { backgroundColor: serviceBookings.length > 0 ? '#10B98120' : '#6B728020' }]}>
            <Text style={[styles.bookingCountBadgeText, { color: serviceBookings.length > 0 ? '#10B981' : '#6B7280' }]}>
              {serviceBookings.length} Scheduled
            </Text>
          </View>
        </View>

        {serviceBookings.length === 0 ? (
          <View style={[styles.emptyDateOnlyBox, { backgroundColor: theme.colors.background }]}>
            <MaterialCommunityIcons name="car-clock" size={40} color={theme.colors.placeholder} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyDateOnlyTitle, { color: theme.colors.text }]}>
              No {selectedService.name} Bookings
            </Text>
            <Text style={[styles.emptyDateOnlySubtitle, { color: theme.colors.placeholder }]}>
              No vehicles scheduled for {selectedService.name} on {selectedDate}. {isDateBlockedForService ? 'This date is currently blocked.' : 'Intake is open to accept customer bookings.'}
            </Text>
          </View>
        ) : (
          serviceBookings.map((b, idx) => (
            <View
              key={b.id || idx}
              style={[styles.bookingItemCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            >
              <View style={styles.bookingItemHeader}>
                {/* UK Yellow License Plate */}
                <View style={styles.regPlateBadge}>
                  <Text style={styles.regPlateText}>{b.registrationNumber}</Text>
                </View>

                {/* Status Pill */}
                <View style={[
                  styles.statusPillSmall, 
                  { backgroundColor: b.status === 'Completed' ? '#10B98120' : b.status === 'Approved' ? '#0284C720' : '#F59E0B20' }
                ]}>
                  <Text style={[
                    styles.statusPillSmallText, 
                    { color: b.status === 'Completed' ? '#10B981' : b.status === 'Approved' ? '#0284C7' : '#F59E0B' }
                  ]}>
                    {b.status || 'Pending'}
                  </Text>
                </View>

                {/* Price Tag */}
                <View style={[styles.priceTagBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Text style={[styles.priceTagBadgeText, { color: theme.colors.primary }]}>
                    £{Number(b.price || selectedService.price || 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Customer Details */}
              <View style={styles.customerRow}>
                <MaterialCommunityIcons
                  name={b.status === 'Approved' ? 'account-check' : 'account-clock-outline'}
                  size={16}
                  color={b.status === 'Approved' ? theme.colors.text : '#F59E0B'}
                />
                <Text
                  style={[
                    styles.customerNameText,
                    {
                      color: b.status === 'Approved' ? theme.colors.text : '#F59E0B',
                      fontWeight: '600',
                    },
                  ]}
                >
                  {b.customerName || 'Customer'}
                </Text>
                {b.customerMobile ? (
                  <TouchableOpacity
                    style={styles.phoneChip}
                    onPress={() => Linking.openURL(`tel:${b.customerMobile}`)}
                  >
                    <MaterialCommunityIcons name="phone" size={12} color="#10B981" />
                    <Text style={styles.phoneChipText}>{b.customerMobile}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Vehicle Make/Model & Drop-off info */}
              <View style={styles.vehicleDetailsRow}>
                <MaterialCommunityIcons name="car-info" size={14} color={theme.colors.placeholder} />
                <Text style={[styles.vehicleModelText, { color: theme.colors.placeholder }]}>
                  {b.makeModel ? b.makeModel.split(' - ')[0] : 'Vehicle'} • Booked by Date (Drop-off on {selectedDate})
                </Text>
              </View>

              {/* Multiple Services tags if more than 1 service booked */}
              {Array.isArray(b.services) && b.services.length > 1 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {b.services.map((s: any, sIdx: number) => {
                    const name = typeof s === 'string' ? s : s?.name || '';
                    return (
                      <View key={sIdx} style={{ backgroundColor: theme.colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: '600' }}>{name}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* 4. Workshop Drop-off & Operating Hours Guide Card */}
      <View style={[styles.guideCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.guideCardHeader}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color="#F59E0B" />
          <Text style={[styles.guideCardTitle, { color: theme.colors.text }]}>
            Workshop Operating Guidance
          </Text>
        </View>
        <View style={styles.guideBulletRow}>
          <MaterialCommunityIcons name="clock-in" size={15} color={theme.colors.primary} />
          <Text style={[styles.guideCardText, { color: theme.colors.text }]}>
            Recommended Drop-Off Window: <Text style={{ fontWeight: '700' }}>08:00 AM – 10:30 AM</Text>
          </Text>
        </View>
        <View style={styles.guideBulletRow}>
          <MaterialCommunityIcons name="clock-out" size={15} color="#10B981" />
          <Text style={[styles.guideCardText, { color: theme.colors.text }]}>
            Target Collection Window: <Text style={{ fontWeight: '700' }}>04:00 PM – 05:30 PM</Text>
          </Text>
        </View>
        <View style={styles.guideBulletRow}>
          <MaterialCommunityIcons name="cog-outline" size={15} color={theme.colors.placeholder} />
          <Text style={[styles.guideCardText, { color: theme.colors.placeholder }]}>
            Need to modify pricing, description, or available days for {selectedService.name}?
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.manageServicesBtn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }]}
          onPress={() => navigation.navigate('AdminServices')}
        >
          <MaterialCommunityIcons name="tune-vertical" size={16} color={theme.colors.primary} />
          <Text style={[styles.manageServicesBtnText, { color: theme.colors.primary }]}>
            Manage Service Details in Services Screen
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )}

      {/* Service Selection Dropdown Modal */}
      <Modal visible={serviceDropdownVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setServiceDropdownVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.dropdownModalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.dropdownModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="tune-vertical" size={20} color={theme.colors.primary} />
                <Text style={[styles.dropdownModalTitle, { color: theme.colors.text }]}>
                  Select Service
                </Text>
              </View>
              <TouchableOpacity onPress={() => setServiceDropdownVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {availableServices.map((svc, idx) => {
                const isSelected = (svc.category === 'ALL' && isAllSelected) ||
                  (!isAllSelected && selectedService.name.toLowerCase() === svc.name.toLowerCase());
                const isSvcMot = (svc.category || '').toUpperCase() === 'MOT' || svc.name.toLowerCase().includes('mot');
                const isSvcAll = (svc.category || '').toUpperCase() === 'ALL' || svc.name === 'All Services';
                const catDetails = getCategoryDetails(svc.category, svc.name);

                return (
                  <TouchableOpacity
                    key={svc._id || svc.name || idx}
                    style={[
                      styles.serviceDropdownItem,
                      {
                        backgroundColor: isSelected ? theme.colors.primary + '15' : 'transparent',
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border + '50',
                      }
                    ]}
                    onPress={() => {
                      setSelectedService(svc);
                      setServiceDropdownVisible(false);
                    }}
                  >
                    <View style={[styles.dropdownItemIconBox, { backgroundColor: catDetails.bg }]}>
                      <MaterialCommunityIcons name={catDetails.icon} size={18} color={catDetails.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dropdownItemName, { color: isSelected ? theme.colors.primary : theme.colors.text, fontWeight: isSelected ? '700' : '600' }]}>
                        {svc.name}
                      </Text>
                      <Text style={[styles.dropdownItemTag, { color: theme.colors.placeholder }]}>
                        {isSvcAll ? 'View all MOT & workshop bookings' : isSvcMot ? '45-Min Fixed Bays' : 'Book by Date (Drop-off)'}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Exact Calendar Picker Modal */}
      <Modal visible={calendarModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCalendarModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.calendarModalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
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
                  Select date to view schedule
                </Text>
              </View>

              <TouchableOpacity onPress={handleNextMonth} style={[styles.calNavBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Quick Toolbar: Jump to Today & Active Date */}
            <View style={styles.calToolbarRow}>
              <TouchableOpacity
                style={[styles.todayQuickBtn, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary + '40' }]}
                onPress={() => {
                  handleJumpToToday();
                  setCalendarModalVisible(false);
                }}
              >
                <MaterialCommunityIcons name="calendar-today" size={14} color={theme.colors.primary} />
                <Text style={[styles.todayQuickBtnText, { color: theme.colors.primary }]}>Select Today</Text>
              </TouchableOpacity>

              <View style={[styles.activeDateTag, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="calendar-check" size={14} color="#10B981" />
                <Text style={[styles.activeDateTagText, { color: theme.colors.text }]}>
                  Selected: <Text style={{ fontWeight: '800', color: theme.colors.primary }}>{selectedDate}</Text>
                </Text>
              </View>
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

                const dateStr = formatToDDMMYYYY(day);
                const isSelected = selectedDate === dateStr;
                const todayObj = new Date();
                const todayStart = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
                const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                const isToday = dayStart.getTime() === todayStart.getTime();
                const isPast = dayStart.getTime() < todayStart.getTime();
                const hasPastBookings = isPast && datesWithBookingsSet.has(dateStr);
                const isDisabled = isPast && !hasPastBookings;
                const isSunday = day.getDay() === 0;

                return (
                  <View key={dateStr} style={styles.dayCell}>
                    <TouchableOpacity
                      disabled={isDisabled}
                      onPress={() => {
                        setSelectedDate(dateStr);
                        setCalendarModalVisible(false);
                      }}
                      style={[
                        styles.dayBtn,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : isToday
                            ? theme.colors.primary + '18'
                            : hasPastBookings
                            ? '#8B5CF618'
                            : 'transparent',
                          borderColor: isSelected
                            ? theme.colors.primary
                            : isToday
                            ? theme.colors.primary
                            : hasPastBookings
                            ? '#8B5CF6'
                            : isDisabled
                            ? 'transparent'
                            : theme.colors.border + '60',
                          borderWidth: isSelected || isToday || hasPastBookings ? 1.5 : 1,
                          opacity: isDisabled ? 0.28 : 1,
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : isDisabled
                              ? theme.colors.placeholder
                              : hasPastBookings
                              ? '#8B5CF6'
                              : isSunday
                              ? '#EF4444'
                              : isToday
                              ? theme.colors.primary
                              : theme.colors.text,
                            fontWeight: isSelected || isToday || hasPastBookings ? '800' : '600',
                          }
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                      {isToday && !isSelected && (
                        <View style={[styles.todayDot, { backgroundColor: theme.colors.primary }]} />
                      )}
                      {hasPastBookings && !isSelected && (
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
                <View style={[styles.legendDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={[styles.legendText, { color: theme.colors.text }]}>Today / Open</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.legendText, { color: '#8B5CF6' }]}>Has Bookings</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#9CA3AF50' }]} />
                <Text style={[styles.legendText, { color: theme.colors.placeholder }]}>Past (Disabled)</Text>
              </View>
            </View>

            {/* Close Modal Button */}
            <TouchableOpacity
              style={[styles.closeCalModalBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => setCalendarModalVisible(false)}
            >
              <Text style={[styles.closeCalModalBtnText, { color: theme.colors.text }]}>Close Calendar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add Station Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Add MOT Testing Station
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
              Adding a new station unlocks 1 extra vehicle per 45-minute slot once approved by Platform Super Admin.
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Station Name</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  },
                ]}
                placeholder="e.g. Station 2, MOT Bay 2, Class 7 Bay"
                placeholderTextColor={theme.colors.placeholder}
                value={newStationName}
                onChangeText={setNewStationName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Bay Type</Text>
              <View style={styles.typeSelectorRow}>
                {['Class 4 MOT Bay', 'Class 4 & 7 Dual Bay', 'Dedicated MOT Ramp'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeOptionPill,
                      {
                        backgroundColor:
                          newStationType === t ? theme.colors.primary : theme.colors.background,
                        borderColor:
                          newStationType === t ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                    onPress={() => setNewStationType(t)}
                  >
                    <Text
                      style={[
                        styles.typeOptionText,
                        { color: newStationType === t ? '#FFFFFF' : theme.colors.text },
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.approvalNotice, { backgroundColor: '#F59E0B15' }]}>
              <MaterialCommunityIcons name="shield-alert-outline" size={18} color="#F59E0B" />
              <Text style={styles.approvalNoticeText}>
                Super Admin approval is required before this station will take bookings.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtnCancel, { borderColor: theme.colors.border }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSubmit, { backgroundColor: theme.colors.primary }]}
                disabled={submittingStation}
                onPress={handleAddStation}
              >
                {submittingStation ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnSubmitText}>Submit for Approval</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '400',
  },
  bellHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginRight: 8,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stationCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  stationCountChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addStationHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  addStationHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  topFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  dropdownBtn: {
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  dropdownIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownTextBox: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dropdownValue: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  datePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTextBox: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateValue: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  dropdownModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    width: '90%',
    maxHeight: 460,
    alignSelf: 'center',
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB25',
  },
  dropdownModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  serviceDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  dropdownItemIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemName: {
    fontSize: 13.5,
  },
  dropdownItemTag: {
    fontSize: 11,
    marginTop: 2,
  },
  calendarModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    width: '92%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  closeCalModalBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCalModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  calendarCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calTitleBox: {
    alignItems: 'center',
  },
  calendarTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  calSubTitle: {
    fontSize: 11,
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
    fontWeight: '700',
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
  },
  calGridContainer: {
    marginBottom: 12,
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
    fontSize: 12,
    fontWeight: '700',
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
    fontWeight: '600',
  },
  pastDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#D9770615',
    borderWidth: 1,
    borderColor: '#D9770640',
  },
  pastDateBannerText: {
    color: '#D97706',
    fontSize: 12.5,
    fontWeight: '600',
    flex: 1,
    lineHeight: 17,
  },
  bookingSummaryCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
    marginBottom: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryCardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  bookingCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  bookingCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  metricCardModern: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1.2,
    justifyContent: 'space-between',
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricIconBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDotIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  metricValueModern: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  metricLabelModern: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
  metricBox: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricBoxValue: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 1,
  },
  metricBoxLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  whoseBookingsSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB25',
  },
  whoseBookingsTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyBookingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  emptyBookingText: {
    fontSize: 11.5,
    flex: 1,
    lineHeight: 15,
  },
  bookingItemCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 6,
  },
  bookingItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  slotTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#6366F115',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotTimeBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6366F1',
  },
  regPlateBadge: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  regPlateText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
  bayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    marginLeft: 'auto',
  },
  bayBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  bookingStatusPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    marginLeft: 4,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  customerNameText: {
    fontSize: 12,
    fontWeight: '600',
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#10B98115',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 4,
  },
  phoneChipText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
  },
  vehicleDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vehicleModelText: {
    fontSize: 11,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  addStationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addStationBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  stationsList: {
    gap: 8,
    marginBottom: 12,
  },
  stationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: 14,
    fontWeight: '600',
  },
  stationType: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
  },
  summaryBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  timelineSection: {
    paddingHorizontal: 20,
  },
  timelineHeader: {
    marginBottom: 14,
  },
  timelineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 10,
    fontSize: 13,
  },
  // 2x2 Grid Styling
  slotsGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  slotCard2x2: {
    width: '48.5%',
    borderRadius: 10,
    borderWidth: 1.2,
    padding: 7,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  gridCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridTimeText: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  gridMinTag: {
    fontSize: 9.5,
    fontWeight: '600',
    marginLeft: 2,
  },
  gridStatusPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  gridStatusPillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  gridDurationText: {
    fontSize: 9.5,
    marginTop: 1,
    fontWeight: '500',
  },
  gridCardMiddle: {
    marginVertical: 3,
  },
  capacityRow: {
    marginBottom: 2,
  },
  capacityText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  gridBookingsList: {
    gap: 2,
    marginTop: 1,
  },
  gridBookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridRegBadge: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2.5,
  },
  gridRegText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  gridCustName: {
    fontSize: 9.5,
    fontWeight: '600',
    flex: 1,
  },
  freeBayIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  freeBayText: {
    fontSize: 9.5,
    fontWeight: '500',
  },
  gridCardBottom: {
    marginTop: 3,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB15',
    paddingTop: 3,
  },
  gridActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  gridActionBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12.5,
    marginBottom: 16,
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOptionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeOptionText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  approvalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 18,
  },
  approvalNoticeText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtnCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalBtnSubmit: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalBtnSubmitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptySlotsCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  emptySlotsTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySlotsSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    maxWidth: 280,
  },
  emptyAddStationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyAddStationBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },

  // Service Selector Styles
  serviceSelectorContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  serviceSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceSelectorTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  modeIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modeIndicatorText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  servicePillsScroll: {
    paddingRight: 20,
    gap: 10,
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 9,
  },
  servicePillIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicePillTextBox: {
    justifyContent: 'center',
  },
  servicePillName: {
    fontSize: 13,
    fontWeight: '700',
  },
  servicePillModeTag: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
  activeCheckDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  // Date-Only Service Section Styles
  dateOnlySection: {
    paddingHorizontal: 20,
    gap: 16,
  },
  serviceOverviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  serviceOverviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  serviceIconLarge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceOverviewInfo: {
    flex: 1,
  },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  serviceOverviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  serviceCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  serviceCategoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  serviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  serviceMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  serviceMetaChipText: {
    fontSize: 12,
  },
  dateOnlyBannerBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  dateOnlyBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dateOnlyBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  dateOnlyBannerBody: {
    fontSize: 12,
    lineHeight: 17,
  },

  // Intake Card Styles
  dateIntakeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  intakeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  intakeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  intakeCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  intakeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  intakeStatusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  capacityProgressContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  capacityProgressBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  capacityProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  capacityProgressText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  dateBlockActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  dateBlockActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Service Bookings Card Styles
  serviceBookingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  emptyDateOnlyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  emptyDateOnlyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyDateOnlySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  statusPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillSmallText: {
    fontSize: 11,
    fontWeight: '700',
  },
  priceTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priceTagBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },

  // Guide Card Styles
  guideCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  guideCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  guideBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  guideCardText: {
    fontSize: 12.5,
    flex: 1,
    lineHeight: 17,
  },
  manageServicesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  manageServicesBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
