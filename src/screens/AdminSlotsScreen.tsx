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
  stationName?: string;
  status: string;
}

interface SlotItem {
  time: string;
  endTime?: string;
  slotLabel?: string;
  slotDuration?: number;
  totalCapacity: number;
  bookedCount: number;
  availableCount: number;
  isBlocked: boolean;
  status: 'Available' | 'Full' | 'Blocked';
  bookings: SlotBooking[];
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
}

// Format Date object to DD-MM-YYYY string
function formatToDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export default function AdminSlotsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { user, token, refreshData } = useAppValues();

  const garageId = user?.garageId;

  // Selected date in DD-MM-YYYY format (default today)
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatToDDMMYYYY(new Date())
  );
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

  // Generate next 14 days in DD-MM-YYYY format for the date strip
  const dateOptions = useMemo(() => {
    const dates: {
      dateStr: string;
      dayName: string;
      dayNum: number;
      month: string;
      year: number;
    }[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = formatToDDMMYYYY(d);
      const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' });
      const dayNum = d.getDate();
      const month = d.toLocaleDateString('en-GB', { month: 'short' });
      const year = d.getFullYear();
      dates.push({ dateStr, dayName, dayNum, month, year });
    }
    return dates;
  }, []);

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

  // Toggle slot block / unblock
  const handleToggleSlotBlock = async (slot: SlotItem) => {
    if (!garageId) return;
    setProcessingSlot(slot.time);

    const isCurrentlyBlocked = slot.isBlocked;
    const endpoint = isCurrentlyBlocked ? 'unblock-slot' : 'block-slot';
    const actionName = isCurrentlyBlocked ? 'unblock' : 'block';

    try {
      const res = await fetch(`${BASE_URL}/garages/${garageId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          slot: slot.time,
        }),
      });

      if (res.ok) {
        Alert.alert('Success', `Slot ${slot.time} successfully ${actionName}ed for ${selectedDate}.`);
        fetchSlots();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || `Could not ${actionName} slot.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || `Failed to ${actionName} slot.`);
    } finally {
      setProcessingSlot(null);
    }
  };

  const stations = slotData?.allStations || slotData?.stations || [];
  const approvedStationsCount = slotData?.totalApprovedStations || 0;
  const totalBookedToday = slotData?.totalBookedToday ?? 0;
  const totalCapacityToday = slotData?.totalCapacityToday ?? (approvedStationsCount * 12);
  const availableCapacityToday = slotData?.availableCapacityToday ?? Math.max(0, totalCapacityToday - totalBookedToday);
  const todayBookings = slotData?.todayBookingsSummary || [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Slots & Stations
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            45-Min MOT Intervals • 9-Hour Workday Capacity
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.bellHeaderBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
          onPress={() => navigation.navigate('AdminAlerts')}
        >
          <MaterialCommunityIcons name="bell-outline" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Date Selector Strip (Day-Month-Year format) */}
      <View style={styles.dateStripContainer}>
        <View style={styles.dateStripHeader}>
          <Text style={[styles.dateStripLabel, { color: theme.colors.text }]}>
            Select Date (DD-MM-YYYY):
          </Text>
          <View style={[styles.currentDateBadge, { backgroundColor: theme.colors.primary + '15' }]}>
            <MaterialCommunityIcons name="calendar" size={14} color={theme.colors.primary} />
            <Text style={[styles.currentDateBadgeText, { color: theme.colors.primary }]}>
              {selectedDate}
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
          {dateOptions.map((item) => {
            const isSelected = item.dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={item.dateStr}
                style={[
                  styles.datePill,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.card,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                onPress={() => setSelectedDate(item.dateStr)}
              >
                <Text
                  style={[
                    styles.datePillDay,
                    { color: isSelected ? '#FFFFFF' : theme.colors.placeholder },
                  ]}
                >
                  {item.dayName}
                </Text>
                <Text
                  style={[
                    styles.datePillNum,
                    { color: isSelected ? '#FFFFFF' : theme.colors.text },
                  ]}
                >
                  {item.dayNum}
                </Text>
                <Text
                  style={[
                    styles.datePillMonth,
                    { color: isSelected ? '#FFFFFF' : theme.colors.placeholder },
                  ]}
                >
                  {item.month}
                </Text>
                <Text
                  style={[
                    styles.datePillYear,
                    { color: isSelected ? '#FFFFFFcc' : theme.colors.placeholder },
                  ]}
                >
                  {item.year}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* SECTION 1: TODAY'S BOOKINGS & WHOSE VEHICLES (Summary Banner) */}
      <View style={[styles.bookingSummaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryTitleBox}>
            <MaterialCommunityIcons name="clipboard-text-clock" size={22} color={theme.colors.primary} />
            <Text style={[styles.summaryCardTitle, { color: theme.colors.text }]}>
              Bookings for {selectedDate}
            </Text>
          </View>
          <View style={[styles.bookingCountBadge, { backgroundColor: totalBookedToday > 0 ? '#10B98120' : '#6B728020' }]}>
            <Text style={[styles.bookingCountBadgeText, { color: totalBookedToday > 0 ? '#10B981' : '#6B7280' }]}>
              {totalBookedToday} Booked
            </Text>
          </View>
        </View>

        {/* 3 Metric Chips */}
        <View style={styles.metricGrid}>
          <View style={[styles.metricBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.metricBoxValue, { color: theme.colors.primary }]}>
              {totalBookedToday} / {totalCapacityToday}
            </Text>
            <Text style={[styles.metricBoxLabel, { color: theme.colors.placeholder }]}>
              Slots Booked
            </Text>
          </View>

          <View style={[styles.metricBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.metricBoxValue, { color: '#10B981' }]}>
              {availableCapacityToday}
            </Text>
            <Text style={[styles.metricBoxLabel, { color: theme.colors.placeholder }]}>
              Slots Free
            </Text>
          </View>

          <View style={[styles.metricBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.metricBoxValue, { color: '#8B5CF6' }]}>
              {approvedStationsCount}
            </Text>
            <Text style={[styles.metricBoxLabel, { color: theme.colors.placeholder }]}>
              Active Bays
            </Text>
          </View>
        </View>

        {/* WHOSE SLOTS ARE BOOKED (List of Booked Customers & Vehicles) */}
        <View style={styles.whoseBookingsSection}>
          <Text style={[styles.whoseBookingsTitle, { color: theme.colors.text }]}>
            Whose Vehicles are Booked Today:
          </Text>

          {todayBookings.length === 0 ? (
            <View style={[styles.emptyBookingBox, { backgroundColor: theme.colors.background }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={24} color="#10B981" />
              <Text style={[styles.emptyBookingText, { color: theme.colors.placeholder }]}>
                No bookings scheduled yet for {selectedDate}. All {totalCapacityToday} slots are open.
              </Text>
            </View>
          ) : (
            todayBookings.map((b, idx) => (
              <View
                key={b.id || idx}
                style={[styles.bookingItemCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              >
                <View style={styles.bookingItemHeader}>
                  {/* Slot Time Tag */}
                  <View style={styles.slotTimeBadge}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#6366F1" />
                    <Text style={styles.slotTimeBadgeText}>{b.slotTime || 'MOT Slot'}</Text>
                  </View>

                  {/* UK Yellow License Plate */}
                  <View style={styles.regPlateBadge}>
                    <Text style={styles.regPlateText}>{b.registrationNumber}</Text>
                  </View>

                  {/* Bay Tag */}
                  <View style={[styles.bayBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <MaterialCommunityIcons name="garage" size={13} color={theme.colors.primary} />
                    <Text style={[styles.bayBadgeText, { color: theme.colors.primary }]}>
                      {b.stationName || `Bay ${(idx % Math.max(1, approvedStationsCount)) + 1}`}
                    </Text>
                  </View>
                </View>

                {/* Customer Details */}
                <View style={styles.customerRow}>
                  <MaterialCommunityIcons
                    name={b.status === 'Approved' ? 'account' : 'account-clock-outline'}
                    size={16}
                    color={b.status === 'Approved' ? theme.colors.text : '#F59E0B'}
                  />
                  <Text
                    style={[
                      styles.customerNameText,
                      {
                        color: b.status === 'Approved' ? theme.colors.text : '#F59E0B',
                        fontStyle: b.status === 'Approved' ? 'normal' : 'italic',
                      },
                    ]}
                  >
                    {b.status === 'Approved' ? b.customerName : 'Pending Approval'}
                  </Text>
                  {b.status === 'Approved' && b.customerMobile ? (
                    <TouchableOpacity
                      style={styles.phoneChip}
                      onPress={() => Linking.openURL(`tel:${b.customerMobile}`)}
                    >
                      <MaterialCommunityIcons name="phone" size={12} color="#10B981" />
                      <Text style={styles.phoneChipText}>{b.customerMobile}</Text>
                    </TouchableOpacity>
                  ) : b.status !== 'Approved' ? (
                    <View style={{ backgroundColor: '#F59E0B18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                      <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: '700' }}>
                        Awaiting Approval
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Vehicle Make/Model & Service */}
                <View style={styles.vehicleDetailsRow}>
                  <MaterialCommunityIcons name="car-info" size={14} color={theme.colors.placeholder} />
                  <Text style={[styles.vehicleModelText, { color: theme.colors.placeholder }]}>
                    {b.makeModel.split(' - ')[0]} • {b.serviceName || 'MOT Test'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* SECTION 2: TESTING STATIONS / BAYS OVERVIEW */}
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <MaterialCommunityIcons name="garage" size={22} color={theme.colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              MOT Testing Stations
            </Text>
          </View>
          {user?.role === 'garage_admin' && (
            <TouchableOpacity
              style={[styles.addStationBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setModalVisible(true)}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addStationBtnText}>Add Station</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.cardDescription, { color: theme.colors.placeholder }]}>
          Each approved station takes 1 vehicle per 45-minute slot. Adding a station increases your capacity once approved by Super Admin.
        </Text>

        {/* Stations List */}
        <View style={styles.stationsList}>
          {stations.map((st, idx) => {
            const isApproved = st.status === 'Approved';
            const isPending = st.status === 'Pending';

            return (
              <View
                key={st.id || st._id || idx}
                style={[
                  styles.stationItem,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: isApproved
                      ? theme.colors.success + '40'
                      : isPending
                      ? theme.colors.warning + '40'
                      : theme.colors.error + '40',
                  },
                ]}
              >
                <View style={styles.stationInfo}>
                  <Text style={[styles.stationName, { color: theme.colors.text }]}>
                    {st.name}
                  </Text>
                  <Text style={[styles.stationType, { color: theme.colors.placeholder }]}>
                    {st.type || 'Class 4 MOT Bay'} • {st.slotDuration || 45} mins/test
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isApproved
                        ? '#10B98120'
                        : isPending
                        ? '#F59E0B20'
                        : '#EF444420',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isApproved ? 'check-circle' : isPending ? 'clock-alert' : 'close-circle'}
                    size={14}
                    color={isApproved ? '#10B981' : isPending ? '#F59E0B' : '#EF4444'}
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color: isApproved ? '#10B981' : isPending ? '#F59E0B' : '#EF4444',
                      },
                    ]}
                  >
                    {st.status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Capacity Summary Banner */}
        <View style={[styles.summaryBanner, { backgroundColor: theme.colors.primary + '15' }]}>
          <MaterialCommunityIcons name="information" size={18} color={theme.colors.primary} />
          <Text style={[styles.summaryBannerText, { color: theme.colors.primary }]}>
            Capacity: {approvedStationsCount} vehicle{approvedStationsCount === 1 ? '' : 's'} per 45-min slot ({totalCapacityToday} total MOTs/day).
          </Text>
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
        ) : (
          <View style={styles.slotsGrid2x2}>
            {(slotData?.slots || []).map((slot) => {
              const isProcessing = processingSlot === slot.time;
              const isBlocked = slot.isBlocked;
              const isFull = slot.status === 'Full';
              const hasBookings = slot.bookedCount > 0;

              return (
                <View
                  key={slot.time}
                  style={[
                    styles.slotCard2x2,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: isBlocked
                        ? '#9CA3AF50'
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
                      <MaterialCommunityIcons name="clock-outline" size={13} color={theme.colors.primary} />
                      <Text style={[styles.gridTimeText, { color: theme.colors.text }]}>
                        {slot.time}
                      </Text>
                    </View>

                    {/* Small Status Indicator */}
                    <View
                      style={[
                        styles.gridStatusPill,
                        {
                          backgroundColor: isBlocked
                            ? '#6B728020'
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
                              : isFull
                              ? '#EF4444'
                              : hasBookings
                              ? '#6366F1'
                              : '#10B981',
                          },
                        ]}
                      >
                        {isBlocked
                          ? 'Blocked'
                          : isFull
                          ? 'Full'
                          : `${slot.availableCount} Free`}
                      </Text>
                    </View>
                  </View>

                  {/* Card Sub-time: 45 min interval e.g. 08:30 - 09:15 */}
                  <Text style={[styles.gridDurationText, { color: theme.colors.placeholder }]}>
                    {slot.slotLabel || `${slot.time} (45 mins)`}
                  </Text>

                  {/* Card Middle: Capacity & Bookings details */}
                  <View style={styles.gridCardMiddle}>
                    <View style={styles.capacityRow}>
                      <Text style={[styles.capacityText, { color: theme.colors.text }]}>
                        {isBlocked
                          ? 'Bay Closed'
                          : `${slot.bookedCount}/${slot.totalCapacity} Booked`}
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
                                  fontStyle: b.status === 'Approved' ? 'normal' : 'italic',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {b.status === 'Approved' ? b.customerName : 'Pending Approval'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.freeBayIndicator}>
                        <MaterialCommunityIcons
                          name={isBlocked ? 'lock-outline' : 'check-circle'}
                          size={13}
                          color={isBlocked ? '#6B7280' : '#10B981'}
                        />
                        <Text
                          style={[
                            styles.freeBayText,
                            { color: isBlocked ? '#6B7280' : '#10B981' },
                          ]}
                        >
                          {isBlocked ? 'Not Taking MOTs' : 'All Bays Open'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Card Bottom: Compact Action Toggle */}
                  <View style={styles.gridCardBottom}>
                    <TouchableOpacity
                      style={[
                        styles.gridActionBtn,
                        {
                          backgroundColor: isBlocked ? '#10B98115' : '#EF444415',
                          borderColor: isBlocked ? '#10B981' : '#EF4444',
                        },
                      ]}
                      disabled={isProcessing}
                      onPress={() => handleToggleSlotBlock(slot)}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={isBlocked ? '#10B981' : '#EF4444'} />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name={isBlocked ? 'lock-open-outline' : 'lock-outline'}
                            size={12}
                            color={isBlocked ? '#10B981' : '#EF4444'}
                          />
                          <Text
                            style={[
                              styles.gridActionBtnText,
                              { color: isBlocked ? '#10B981' : '#EF4444' },
                            ]}
                          >
                            {isBlocked ? 'Unblock' : 'Block'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Add Station Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
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
    paddingTop: 20,
    paddingBottom: 12,
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
  dateStripContainer: {
    marginBottom: 16,
  },
  dateStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  dateStripLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  currentDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentDateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateStrip: {
    paddingHorizontal: 20,
    gap: 10,
  },
  datePill: {
    width: 66,
    height: 82,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  datePillDay: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  datePillNum: {
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 1,
  },
  datePillMonth: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  datePillYear: {
    fontSize: 9.5,
    marginTop: 1,
  },
  bookingSummaryCard: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  bookingCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bookingCountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricBoxValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricBoxLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  whoseBookingsSection: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB25',
  },
  whoseBookingsTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyBookingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
  },
  emptyBookingText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  bookingItemCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  bookingItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  slotTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366F115',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  slotTimeBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6366F1',
  },
  regPlateBadge: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  regPlateText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 11.5,
    letterSpacing: 0.5,
  },
  bayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  bayBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  customerNameText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#10B98115',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  phoneChipText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  vehicleDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  vehicleModelText: {
    fontSize: 11.5,
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
    rowGap: 12,
  },
  slotCard2x2: {
    width: '48.5%',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    minHeight: 144,
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
    gap: 4,
  },
  gridTimeText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  gridStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  gridStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  gridDurationText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  gridCardMiddle: {
    marginVertical: 6,
  },
  capacityRow: {
    marginBottom: 4,
  },
  capacityText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  gridBookingsList: {
    gap: 4,
    marginTop: 2,
  },
  gridBookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gridRegBadge: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  gridRegText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  gridCustName: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  freeBayIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  freeBayText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  gridCardBottom: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB20',
    paddingTop: 6,
  },
  gridActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  gridActionBtnText: {
    fontSize: 11,
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
});
