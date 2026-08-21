import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StaffListScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { fetchStaffList, deleteStaffAccount } = useAppValues();
  
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadStaff = async () => {
    try {
      const data = await fetchStaffList();
      setStaffList(data);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load staff list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStaff();
  };

  const handleDeleteStaff = (staffId: string, name: string) => {
    Alert.alert(
      'Delete Staff Account',
      `Are you sure you want to delete staff account for ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(staffId);
            try {
              await deleteStaffAccount(staffId);
              Alert.alert('Success', 'Staff account deleted successfully.');
              loadStaff();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete staff account.');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>Staff Directory</Text>
        <View style={styles.badgeCount}>
          <Text style={[styles.badgeText, { color: theme.colors.secondary }]}>{staffList.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.secondary]} />
          }
        >
          {staffList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-group-outline" size={60} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No staff accounts found.</Text>
            </View>
          ) : (
            staffList.map((staff) => (
              <View
                key={staff._id}
                style={[styles.staffCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <View style={[styles.avatar, { backgroundColor: theme.colors.secondary + '20' }]}>
                  <Text style={[styles.avatarText, { color: theme.colors.secondary }]}>
                    {staff.username.slice(0, 2).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.staffMeta}>
                  <Text style={[styles.staffName, { color: theme.colors.text }]}>{staff.username}</Text>
                  <Text style={[styles.staffEmail, { color: theme.colors.placeholder }]}>{staff.email}</Text>
                  <Text style={{ fontSize: 10, color: theme.colors.placeholder, marginTop: 4 }}>
                    Registered: {new Date(staff.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleDeleteStaff(staff._id, staff.username)}
                  disabled={deletingId !== null}
                  style={[styles.deleteBtn, { borderColor: theme.colors.error + '40' }]}
                >
                  {deletingId === staff._id ? (
                    <ActivityIndicator size="small" color={theme.colors.error} />
                  ) : (
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.colors.error} />
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  badgeCount: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  staffMeta: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  staffEmail: {
    fontSize: 12.5,
    marginTop: 1,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
