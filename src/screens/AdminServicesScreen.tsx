import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, GaragePricing, DEFAULT_UK_BENCHMARK_PRICING } from '../context/DataContext';
import { fonts } from '../theme/theme';
import HeaderMenuButton from '../components/HeaderMenuButton';
import TieredPricingConfigurator from '../components/TieredPricingConfigurator';

export default function AdminServicesScreen({ navigation }: any) {
  const { theme, isDarkMode } = useAppTheme();
  const {
    user,
    garages,
    fetchGaragePricing,
    updateGaragePricing,
  } = useAppValues();

  const isGarageAdmin = user?.role === 'garage_admin' || user?.role === 'admin';
  const isStaff = user?.role === 'staff';

  // Selected Garage resolution
  const myGarageId = user?.garageId || (garages.length > 0 ? garages[0]._id || garages[0].id : '');
  const [selectedGarageId] = useState<string>(myGarageId || '');

  const [pricing, setPricing] = useState<GaragePricing>(DEFAULT_UK_BENCHMARK_PRICING);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);

  const isFetchingRef = useRef(false);

  const loadPricing = useCallback(async (targetId?: string, isManualRefresh = false) => {
    const targetGId = targetId || selectedGarageId || user?.garageId || (garages[0]?._id || garages[0]?.id);
    if (!targetGId) {
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (!isManualRefresh) {
        setLoading(true);
      }
      const p = await fetchGaragePricing(targetGId);
      if (p && (p.servicingTiers || p.servicing)) {
        setPricing(p);
      }
    } catch (err: any) {
      console.warn('Could not fetch garage pricing:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [selectedGarageId, user?.garageId, garages, fetchGaragePricing]);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPricing(selectedGarageId, true);
  }, [loadPricing, selectedGarageId]);

  const handleSavePricing = async () => {
    if (!isGarageAdmin) {
      Alert.alert('Permission Denied', 'Only the Garage Owner / Admin can update pricing rates.');
      return;
    }
    const targetGId = selectedGarageId || user?.garageId || (garages[0]?._id || garages[0]?.id);
    if (!targetGId) {
      Alert.alert('Error', 'No garage identified.');
      return;
    }
    setSavingPricing(true);
    try {
      await updateGaragePricing(targetGId, pricing);
      Alert.alert(
        'Pricing Rates Saved! 🏷️',
        'Successfully updated 6-tier routine servicing, MOT bundle discounts, delivery options, and labour rates.'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save pricing rates.');
    } finally {
      setSavingPricing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={{ flex: 1 }}>
        {/* Top Navbar */}
        <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.navLeft}>
            <HeaderMenuButton style={{ marginRight: 8 }} />
            {navigation.canGoBack && navigation.canGoBack() ? (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            ) : null}

            <View style={styles.navTitleGroup}>
              <Text style={[styles.navTitle, { color: theme.colors.text }]}>Servicing & Pricing</Text>
            </View>
          </View>

          {isStaff && (
            <View style={[styles.viewOnlyBadge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <Text style={[styles.viewOnlyText, { color: theme.colors.placeholder }]}>View-Only</Text>
            </View>
          )}
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>
              Loading pricing configuration...
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
            }
          >
            <TieredPricingConfigurator
              pricing={pricing}
              onChange={setPricing}
              onApplyStandardRates={() => setPricing({ ...DEFAULT_UK_BENCHMARK_PRICING })}
              isSaving={savingPricing}
              onSave={handleSavePricing}
              showSaveButton={isGarageAdmin}
            />
          </ScrollView>
        )}
      </View>
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
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 6,
  },
  navTitleGroup: {
    flex: 1,
  },
  navTitle: {
    fontFamily: fonts.bold,
    fontSize: 16.5,
    letterSpacing: -0.3,
  },
  viewOnlyBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewOnlyText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
});
