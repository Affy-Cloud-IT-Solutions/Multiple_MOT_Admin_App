import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

export default function SuperAdminAuditsScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { audits, refreshData } = useAppValues();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'GARAGE' | 'CUSTOMER' | 'BOOKING' | 'VEHICLE' | 'REMINDER'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshData();
    });
    return unsubscribe;
  }, [navigation]);

  const matchesCategory = (au: any, filterType: string) => {
    const act = (au.activity || '').toLowerCase();
    const det = (au.details || '').toLowerCase();

    if (filterType === 'ALL') return true;
    if (filterType === 'GARAGE') {
      return act.includes('garage') || det.includes('garage') || act.includes('staff') || act.includes('template');
    }
    if (filterType === 'CUSTOMER') {
      return act.includes('customer') || det.includes('customer') || act.includes('login') || act.includes('signup');
    }
    if (filterType === 'BOOKING') {
      return act.includes('booked') || act.includes('booking') || act.includes('reschedule') || det.includes('booked') || det.includes('booking') || det.includes('rescheduled');
    }
    if (filterType === 'VEHICLE') {
      return act.includes('vehicle') || det.includes('vehicle') || act.includes('transferred') || act.includes('sold');
    }
    if (filterType === 'REMINDER') {
      return act.includes('reminder') || det.includes('reminder') || act.includes('sent');
    }
    return true;
  };

  const filteredAudits = audits.filter((au) => {
    const act = (au.activity || '').toLowerCase();
    const det = (au.details || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();

    const matchesFilter = matchesCategory(au, selectedFilter);
    const matchesSearch = !q || act.includes(q) || det.includes(q);
    return matchesFilter && matchesSearch;
  });

  const getFilterCount = (filterType: string) => {
    return audits.filter((au) => matchesCategory(au, filterType)).length;
  };

  const getEventIcon = (activity: string) => {
    const a = activity.toLowerCase();
    if (a.includes('garage')) return { icon: 'garage', color: '#6366F1' };
    if (a.includes('customer')) return { icon: 'account', color: '#3B82F6' };
    if (a.includes('booking') || a.includes('booked')) return { icon: 'calendar-check', color: '#0EA5E9' };
    if (a.includes('vehicle')) return { icon: 'car', color: '#10B981' };
    if (a.includes('reminder')) return { icon: 'bell-ring', color: '#F59E0B' };
    if (a.includes('login')) return { icon: 'login', color: '#8B5CF6' };
    return { icon: 'clipboard-text-clock', color: '#EC4899' };
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Platform Audits</Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            Real-time System Event History & Activity Trail ({audits.length})
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
          disabled={isRefreshing}
          onPress={async () => {
            setIsRefreshing(true);
            try {
              await refreshData();
            } finally {
              setIsRefreshing(false);
            }
          }}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={theme.colors.secondary} />
          ) : (
            <MaterialCommunityIcons name="refresh" size={20} color={theme.colors.secondary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.placeholder} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search activity, garage, customer, or plate..."
            placeholderTextColor={theme.colors.placeholder}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.placeholder} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs - Horizontal Scroll */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {([
            { id: 'ALL', label: 'All Events' },
            { id: 'GARAGE', label: 'Garages' },
            { id: 'CUSTOMER', label: 'Customers' },
            { id: 'BOOKING', label: 'Bookings' },
            { id: 'VEHICLE', label: 'Vehicles' },
            { id: 'REMINDER', label: 'Reminders' },
          ] as const).map((filter) => {
            const isActive = selectedFilter === filter.id;
            const count = getFilterCount(filter.id);
            return (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setSelectedFilter(filter.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.colors.secondary : theme.colors.card,
                    borderColor: isActive ? theme.colors.secondary : theme.colors.border,
                  }
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isActive ? '#FFFFFF' : theme.colors.text }
                  ]}
                >
                  {filter.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Audits Feed */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredAudits.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={44} color={theme.colors.placeholder} />
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No Logs Found</Text>
            <Text style={[styles.emptyStateSubtitle, { color: theme.colors.placeholder }]}>
              There are no audit records matching the search criteria.
            </Text>
          </View>
        ) : (
          filteredAudits.map((item, index) => {
            const { icon, color } = getEventIcon(item.activity);
            return (
              <View
                key={item.id || `audit_${index}`}
                style={[
                  styles.auditCard,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                ]}
              >
                <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
                  <MaterialCommunityIcons name={icon as any} size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTopRow}>
                    <Text style={[styles.activityTitle, { color: theme.colors.text }]}>
                      {item.activity}
                    </Text>
                    <Text style={[styles.timestampText, { color: theme.colors.placeholder }]}>
                      {formatDate(item.date)}
                    </Text>
                  </View>
                  <Text style={[styles.detailsText, { color: theme.colors.placeholder }]}>
                    {item.details}
                  </Text>
                </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    padding: 0,
  },
  filterChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  auditCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  timestampText: {
    fontSize: 11,
  },
  detailsText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyStateSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
});
