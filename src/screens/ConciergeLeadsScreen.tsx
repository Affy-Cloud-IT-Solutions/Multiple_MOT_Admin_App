import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Linking,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import { fonts } from '../theme/theme';
import { formatShortDate, formatDateTime } from '../utils/dateUtils';

interface LeadItem {
  id?: string;
  _id?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleRegistration?: string;
  garageName?: string;
  garageId?: any;
  serviceName?: string;
  leadType?: string;
  status?: string;
  createdAt?: string;
  managerNotes?: string;
}

export default function ConciergeLeadsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const {
    bookingLeads,
    fetchBookingLeads,
    convertLeadToBooking,
    updateBookingLead,
    conciergePhoneNumber,
  } = useAppValues();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'ALL' | 'PENDING' | 'BOOKED'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);

  // Load leads on mount
  useEffect(() => {
    fetchBookingLeads().catch((err: any) =>
      console.error('[ConciergeLeadsScreen] Fetch error:', err)
    );
  }, [fetchBookingLeads]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchBookingLeads();
    } catch (err: any) {
      console.error('[ConciergeLeadsScreen] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBookingLeads]);

  // KPI Metrics
  const stats = useMemo(() => {
    const list = bookingLeads || [];
    const total = list.length;
    const booked = list.filter((l: LeadItem) => l.status === 'CONVERTED').length;
    const pending = list.filter((l: LeadItem) => l.status !== 'CONVERTED').length;
    const rate = total > 0 ? Math.round((booked / total) * 100) : 0;
    return { total, pending, booked, rate };
  }, [bookingLeads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    let list: LeadItem[] = bookingLeads || [];

    // Filter by tab
    if (selectedTab === 'PENDING') {
      list = list.filter((l) => l.status !== 'CONVERTED');
    } else if (selectedTab === 'BOOKED') {
      list = list.filter((l) => l.status === 'CONVERTED');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((l) => {
        const name = (l.customerName || '').toLowerCase();
        const phone = (l.customerPhone || '').toLowerCase();
        const reg = (l.vehicleRegistration || '').toLowerCase();
        const garage = (l.garageName || '').toLowerCase();
        const service = (l.serviceName || '').toLowerCase();
        return (
          name.includes(q) ||
          phone.includes(q) ||
          reg.includes(q) ||
          garage.includes(q) ||
          service.includes(q)
        );
      });
    }

    return list;
  }, [bookingLeads, selectedTab, searchQuery]);

  // Safe Phone Calling Helper with sanitization & error handling
  const handleCallCustomer = (phone?: string) => {
    if (!phone || !phone.trim() || phone === 'No Phone Recorded') {
      Alert.alert('No Phone Number', 'No contact phone number is recorded for this customer.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const url = `tel:${cleanPhone}`;
    Linking.openURL(url).catch((err) => {
      console.error('[ConciergeLeadsScreen] Dial error:', err);
      Alert.alert(
        'Unable to Open Phone Dialer',
        `Could not launch phone app on this device for ${phone}.\n\nManual Number: ${phone}`
      );
    });
  };

  // 1-Click Convert to Booking
  const handleConvertLead = (lead: LeadItem) => {
    const leadId = lead.id || lead._id;
    if (!leadId) return;

    Alert.alert(
      'Confirm Customer Appointment',
      `Convert call inquiry for ${lead.customerName || 'Customer'} into an official booking at ${lead.garageName || 'the garage'}?\n\nThis will instantly generate a confirmed appointment inside the customer's "My Bookings" screen.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Booking',
          onPress: async () => {
            setConvertingLeadId(leadId);
            try {
              await convertLeadToBooking(leadId, {
                bookingDate: new Date().toISOString(),
                slotTime: '10:00 AM',
                managerNotes: 'Confirmed by Concierge Desk',
              });
              await fetchBookingLeads();
              Alert.alert(
                'Booking Confirmed',
                'Appointment successfully created! The customer can now see it in their "My Bookings" tab.'
              );
            } catch (err: any) {
              Alert.alert('Conversion Failed', err.message || 'Could not convert lead.');
            } finally {
              setConvertingLeadId(null);
            }
          },
        },
      ]
    );
  };

  // Lead Type Icon & Color Helper
  const getLeadTypeInfo = (leadType?: string) => {
    switch (leadType) {
      case 'WHATSAPP_CHAT':
        return { icon: 'whatsapp', color: '#10B981', label: 'WhatsApp' };
      case 'WEB_CALLBACK':
        return { icon: 'web', color: '#0284C7', label: 'Web Request' };
      default:
        return { icon: 'phone-incoming', color: '#6366F1', label: 'Direct Call' };
    }
  };

  const renderLeadCard = ({ item }: { item: LeadItem }) => {
    const isConverted = item.status === 'CONVERTED';
    const typeInfo = getLeadTypeInfo(item.leadType);
    const leadId = item.id || item._id;

    return (
      <View
        style={[
          styles.leadCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: isConverted ? '#10B98140' : theme.colors.border,
          },
        ]}
      >
        {/* Card Header: Customer Avatar + Name + Status */}
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: isConverted ? '#10B98115' : typeInfo.color + '15',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={isConverted ? 'check-decagram' : typeInfo.icon}
                size={18}
                color={isConverted ? '#059669' : typeInfo.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.customerName, { color: theme.colors.text }]} numberOfLines={1}>
                {item.customerName || 'Inquiring Customer'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={[styles.leadMetaText, { color: theme.colors.placeholder }]}>
                  {typeInfo.label} • {item.createdAt ? formatShortDate(item.createdAt) : 'Recently'}
                </Text>
              </View>
            </View>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isConverted ? '#10B98118' : '#0284C718',
                borderColor: isConverted ? '#10B981' : '#0284C7',
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: isConverted ? '#059669' : '#0284C7' },
              ]}
            >
              {isConverted ? '✓ Booked' : 'Action Needed'}
            </Text>
          </View>
        </View>

        {/* Details Grid Box */}
        <View
          style={[
            styles.detailsBox,
            { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
          ]}
        >
          {/* Phone & UK Plate */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => handleCallCustomer(item.customerPhone)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              activeOpacity={0.7}
            >
              <View style={styles.phoneIconCircle}>
                <MaterialCommunityIcons name="phone" size={13} color="#FFFFFF" />
              </View>
              <Text style={[styles.phoneNumberText, { color: '#059669' }]}>
                {item.customerPhone || 'No Phone Recorded'}
              </Text>
            </TouchableOpacity>

            {item.vehicleRegistration ? (
              <View style={styles.ukPlateBadge}>
                <Text style={styles.ukPlateText}>{item.vehicleRegistration}</Text>
              </View>
            ) : null}
          </View>

          {/* Garage Name */}
          {item.garageName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <MaterialCommunityIcons name="storefront" size={15} color={theme.colors.placeholder} />
              <Text style={[styles.garageNameText, { color: theme.colors.text }]} numberOfLines={1}>
                {item.garageName}
              </Text>
            </View>
          ) : null}

          {/* Service Requested */}
          {item.serviceName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <MaterialCommunityIcons name="wrench-outline" size={14} color="#0284C7" />
              <Text style={[styles.serviceNameText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                {item.serviceName}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Action Row */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            onPress={() => handleCallCustomer(item.customerPhone)}
            style={[styles.callButton, { backgroundColor: '#059669' }]}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="phone" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.callButtonText}>Call Customer</Text>
          </TouchableOpacity>

          {convertingLeadId === leadId ? (
            <ActivityIndicator size="small" color="#0284C7" style={{ paddingHorizontal: 16 }} />
          ) : isConverted ? (
            <View style={styles.bookedBanner}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#059669" />
              <Text style={styles.bookedBannerText}>Confirmed Appointment</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => handleConvertLead(item)}
              style={[styles.convertButton, { backgroundColor: '#0284C7' }]}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="calendar-check" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.convertButtonText}>Book for Customer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.card}
      />

      {/* Top Header */}
      <View style={[styles.headerContainer, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
          </TouchableOpacity>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Call Inquiries & Leads</Text>
              <View style={styles.livePulseDot} />
            </View>
            <Text style={[styles.headerSubtitle, { color: theme.colors.placeholder }]}>
              Customer calls & booking conversions
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleRefresh}
          style={[styles.refreshIconButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#0284C7" />
          ) : (
            <MaterialCommunityIcons name="refresh" size={20} color={theme.colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {/* KPI Stats Bar */}
      <View style={[styles.kpiContainer, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: '#0284C7' }]}>{stats.total}</Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.placeholder }]}>Total Calls</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>{stats.pending}</Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.placeholder }]}>Pending Action</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: '#059669' }]}>{stats.booked}</Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.placeholder }]}>Confirmed</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiValue, { color: '#6366F1' }]}>{stats.rate}%</Text>
          <Text style={[styles.kpiLabel, { color: theme.colors.placeholder }]}>Conversion</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.placeholder} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search customer, plate, phone, or garage..."
            placeholderTextColor={theme.colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Segmented Tabs */}
      <View style={styles.segmentedTabsRow}>
        {[
          { key: 'ALL', label: 'All Leads', count: stats.total },
          { key: 'PENDING', label: 'Pending Action', count: stats.pending },
          { key: 'BOOKED', label: 'Confirmed', count: stats.booked },
        ].map((tab) => {
          const isSelected = selectedTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setSelectedTab(tab.key as any)}
              style={[
                styles.tabButton,
                {
                  backgroundColor: isSelected ? '#059669' : theme.colors.card,
                  borderColor: isSelected ? '#059669' : theme.colors.border,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  { color: isSelected ? '#FFFFFF' : theme.colors.text },
                ]}
              >
                {tab.label} ({tab.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Leads List */}
      <FlatList
        data={filteredLeads}
        keyExtractor={(item, index) => item.id || item._id || String(index)}
        renderItem={renderLeadCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#059669']}
            tintColor="#059669"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="phone-off" size={36} color={theme.colors.placeholder} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No inquiries found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.placeholder }]}>
              {searchQuery
                ? 'No leads matching your search criteria.'
                : selectedTab === 'PENDING'
                ? 'All incoming customer inquiries have been confirmed!'
                : 'Incoming customer call inquiries will appear here.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 1,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  refreshIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
  },
  kpiValue: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
  },
  kpiLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 2,
  },
  kpiDivider: {
    width: 1,
    height: 24,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    paddingVertical: 0,
  },
  segmentedTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  leadCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  leadMetaText: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  detailsBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginVertical: 4,
  },
  phoneIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneNumberText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  ukPlateBadge: {
    backgroundColor: '#FEF08A',
    borderColor: '#EAB308',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ukPlateText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#1E293B',
    letterSpacing: 0.8,
  },
  garageNameText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  serviceNameText: {
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB40',
    gap: 10,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  callButtonText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  convertButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  convertButtonText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#FFFFFF',
  },
  bookedBanner: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  bookedBannerText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#059669',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
});
