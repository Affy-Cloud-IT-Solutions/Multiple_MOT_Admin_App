import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Switch,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, ServiceCatalogGroup } from '../context/DataContext';
import { fonts } from '../theme/theme';

const { width, height } = Dimensions.get('window');

interface ServiceItem {
  id?: string;
  _id?: string;
  name: string;
  category?: string;
  price: number;
  duration: number;
  description?: string;
  availability?: string[];
  isActive?: boolean;
  isCustom?: boolean;
  status?: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  serviceId?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
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
  'Others': { bg: '#F3E8FF', text: '#7C3AED', icon: 'dots-horizontal-circle-outline' },
  'Other': { bg: '#F3E8FF', text: '#7C3AED', icon: 'dots-horizontal-circle-outline' },
};

export default function AdminServicesScreen({ navigation }: any) {
  const { theme, isDarkMode } = useAppTheme();
  const {
    user,
    garages,
    serviceCategories,
    fetchServiceCategories,
    fetchGarageServices,
    addGarageService,
    updateGarageService,
    deleteGarageService,
    fetchServiceCatalog,
    selectCatalogServices,
  } = useAppValues();

  const isSuperAdmin = user?.role === 'admin';

  // Dynamic Categories from Super Admin master collection
  const availableCategories = useMemo(() => {
    if (serviceCategories && serviceCategories.length > 0) {
      return serviceCategories.map(c => c.name);
    }
    return [];
  }, [serviceCategories]);

  const allCategoryTabs = useMemo(() => {
    return ['All', ...availableCategories];
  }, [availableCategories]);

  const getCategoryMeta = useCallback((catName: string) => {
    const found = serviceCategories?.find(c => c.name.toLowerCase() === catName.toLowerCase());
    if (found) {
      return {
        bg: found.iconBg || '#1677FF15',
        text: found.iconColor || '#1677FF',
        icon: found.icon || 'wrench',
      };
    }
    return CATEGORY_COLORS[catName] || { bg: '#F1F5F9', text: '#64748B', icon: 'wrench' };
  }, [serviceCategories]);

  // Selected Garage resolution
  const myGarageId = user?.garageId || (garages.length > 0 ? garages[0]._id || garages[0].id : '');
  const [selectedGarageId, setSelectedGarageId] = useState<string>(myGarageId || '');

  // Services State
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter BottomSheet / Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // ─── CATALOG SELECTION MODAL STATE ───
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogGroups, setCatalogGroups] = useState<ServiceCatalogGroup[]>([]);
  const [catalogActiveCategory, setCatalogActiveCategory] = useState('All');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [catalogSelections, setCatalogSelections] = useState<Record<string, {
    selected: boolean;
    name: string;
    category: string;
    price: string;
    duration: string;
    description: string;
    serviceId?: string;
  }>>({});

  // ─── ADD CUSTOM SERVICE MODAL STATE ───
  const [modalVisible, setModalVisible] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Servicing');
  const [formPrice, setFormPrice] = useState('45.00');
  const [formDuration, setFormDuration] = useState('45');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [savingService, setSavingService] = useState(false);

  // Fetch Services for active garage
  const isFetchingRef = useRef(false);

  const loadServices = useCallback(async (targetId?: string, isManualRefresh = false) => {
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
      const data = await fetchGarageServices(targetGId);
      const list = Array.isArray(data.services) ? data.services : (Array.isArray(data) ? data : []);
      setServices(list);
    } catch (err: any) {
      console.warn('Could not fetch garage services:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [selectedGarageId, user?.garageId, garages, fetchGarageServices]);

  const loadServicesRef = useRef(loadServices);
  useEffect(() => {
    loadServicesRef.current = loadServices;
  }, [loadServices]);

  useFocusEffect(
    useCallback(() => {
      const targetGId = selectedGarageId || user?.garageId || (garages[0]?._id || garages[0]?.id);
      if (targetGId) {
        loadServicesRef.current(targetGId);
      }
    }, [selectedGarageId, user?.garageId])
  );

  useEffect(() => {
    if (garages.length > 0 && !selectedGarageId) {
      const gId = user?.garageId || garages[0]._id || garages[0].id;
      if (gId) setSelectedGarageId(gId);
    }
  }, [garages, selectedGarageId, user?.garageId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadServices(undefined, true);
  };

  // Open Modal for Catalog Selection
  const handleOpenCatalogModal = async () => {
    setCatalogModalVisible(true);
    setCatalogLoading(true);
    try {
      const groups = await fetchServiceCatalog();
      setCatalogGroups(groups);

      // Pre-populate selections from garage's current services
      const initialMap: Record<string, any> = {};
      groups.forEach((group) => {
        (group.services || []).forEach((svc: any) => {
          const key = (svc.name || '').trim().toLowerCase();
          const existing = services.find(
            (s) => (s.name || '').trim().toLowerCase() === key && !s.isCustom
          );
          initialMap[key] = {
            selected: !!existing,
            name: svc.name,
            category: svc.category || group.name,
            price: existing ? String(existing.price) : String(svc.price !== undefined ? svc.price : 45),
            duration: existing ? String(existing.duration) : String(svc.duration || 45),
            description: existing?.description || svc.description || '',
            serviceId: svc.id || svc._id,
          };
        });
      });
      setCatalogSelections(initialMap);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load service catalog.');
    } finally {
      setCatalogLoading(false);
    }
  };

  // Toggle selection in catalog modal
  const handleToggleCatalogItem = (key: string) => {
    setCatalogSelections((prev) => {
      const cur = prev[key];
      if (!cur) return prev;
      return {
        ...prev,
        [key]: { ...cur, selected: !cur.selected },
      };
    });
  };

  // Save selected catalog services to garage
  const handleSaveCatalog = async () => {
    const targetGId = selectedGarageId || user?.garageId || (garages[0]?._id || garages[0]?.id);
    if (!targetGId) {
      Alert.alert('Error', 'Garage ID missing. Please select or verify your garage.');
      return;
    }

    const selectedList = Object.values(catalogSelections)
      .filter((item) => item.selected)
      .map((item) => ({
        name: item.name,
        category: item.category,
        price: parseFloat(item.price) || 45,
        duration: parseInt(item.duration, 10) || 45,
        description: item.description || '',
        isActive: true,
        serviceId: item.serviceId,
      }));

    setSavingCatalog(true);
    try {
      await selectCatalogServices(targetGId, selectedList);
      Alert.alert(
        'Catalog Services Saved',
        `Successfully updated services for your garage (${selectedList.length} services active).`
      );
      setCatalogModalVisible(false);
      await loadServices();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save catalog services.');
    } finally {
      setSavingCatalog(false);
    }
  };

  // Open Modal for Custom Service Add
  const handleOpenAddCustom = () => {
    setFormName('');
    setFormCategory('Others');
    setFormPrice('45.00');
    setFormDuration('45');
    setFormDescription('');
    setFormIsActive(true);
    setModalVisible(true);
  };

  // Save Custom Service
  const handleSaveService = async () => {
    const targetGId = selectedGarageId || user?.garageId || (garages[0]?._id || garages[0]?.id);
    if (!targetGId) {
      Alert.alert('Error', 'Garage ID missing. Please select or verify your garage.');
      return;
    }

    const cleanName = formName.trim();
    if (!cleanName || cleanName.length < 2) {
      Alert.alert('Validation Error', 'Service name is required (minimum 2 characters).');
      return;
    }

    const numPrice = parseFloat(formPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      Alert.alert('Validation Error', 'Please enter a valid price (£).');
      return;
    }

    const numDuration = parseInt(formDuration, 10);
    if (isNaN(numDuration) || numDuration < 5 || numDuration > 720) {
      Alert.alert('Validation Error', 'Duration must be between 5 and 720 minutes.');
      return;
    }

    setSavingService(true);
    try {
      // Create custom service (automatically placed under 'Others' category)
      await addGarageService(targetGId, {
        name: cleanName,
        category: 'Others',
        price: numPrice,
        duration: numDuration,
        description: formDescription.trim(),
        isActive: formIsActive,
        isCustom: true,
      });
      Alert.alert(
        'Submitted for Super Admin Approval',
        `"${cleanName}" has been submitted under "Others" category for Super Admin review. It will become live for customers once approved.`
      );
      setModalVisible(false);
      await loadServices();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save service.');
    } finally {
      setSavingService(false);
    }
  };

  // Toggle Active Switch directly from list
  const handleToggleActive = async (service: ServiceItem, newVal: boolean) => {
    const targetGId = selectedGarageId || user?.garageId;
    const serviceId = service._id || service.id;
    if (!targetGId || !serviceId) return;

    if (service.isCustom && service.status === 'Pending') {
      Alert.alert('Pending Approval', 'This custom service is awaiting Super Admin approval before it can go live.');
      return;
    }

    // Optimistic update
    setServices((prev) =>
      prev.map((s) => ((s._id === serviceId || s.id === serviceId) ? { ...s, isActive: newVal } : s))
    );

    try {
      await updateGarageService(targetGId, serviceId, { isActive: newVal });
    } catch (err: any) {
      // Revert if error
      setServices((prev) =>
        prev.map((s) => ((s._id === serviceId || s.id === serviceId) ? { ...s, isActive: !newVal } : s))
      );
      Alert.alert('Error', 'Could not update active status.');
    }
  };

  // Delete Service
  const handleDeleteService = (service: ServiceItem) => {
    const targetGId = selectedGarageId || user?.garageId;
    const serviceId = service._id || service.id;
    if (!targetGId || !serviceId) return;

    Alert.alert(
      'Delete Service',
      `Are you sure you want to remove "${service.name}"? Customers will no longer be able to view or book this service.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteGarageService(targetGId, serviceId);
              await loadServices();
              Alert.alert('Deleted', `"${service.name}" has been removed.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete service.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Filtered Services List
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      // Category match
      if (activeCategory !== 'All') {
        const cat = (s.category || '').toLowerCase();
        const activeCat = activeCategory.toLowerCase();
        if (activeCat === 'tyres' || activeCat === 'tyre replacement') {
          if (!cat.includes('tyre') && !cat.includes('wheel')) return false;
        } else if (!cat.includes(activeCat)) {
          return false;
        }
      }
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchCat = (s.category || '').toLowerCase().includes(q);
        const matchDesc = (s.description || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc) return false;
      }
      return true;
    });
  }, [services, activeCategory, searchQuery]);

  // Catalog items filtered by tab & search
  const filteredCatalogItems = useMemo(() => {
    const allItems: any[] = [];
    catalogGroups.forEach((group) => {
      (group.services || []).forEach((s) => {
        allItems.push({
          ...s,
          groupName: group.name,
          groupIcon: group.icon,
          groupIconColor: group.iconColor,
          groupIconBg: group.iconBg,
        });
      });
    });

    return allItems.filter((item) => {
      if (catalogActiveCategory !== 'All') {
        const cat = (item.category || item.groupName || '').toLowerCase();
        if (!cat.includes(catalogActiveCategory.toLowerCase())) return false;
      }
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase().trim();
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc) return false;
      }
      return true;
    });
  }, [catalogGroups, catalogActiveCategory, catalogSearch]);

  const selectedCatalogCount = useMemo(() => {
    return Object.values(catalogSelections).filter((item) => item.selected).length;
  }, [catalogSelections]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={{ flex: 1 }}>
        {/* Top Navbar: Back + Title + Action Buttons */}
        <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {navigation.canGoBack && navigation.canGoBack() ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.navTitleGroup}>
            <Text style={[styles.navTitle, { color: theme.colors.text }]}>Services</Text>
            <View style={[styles.countBadge, { backgroundColor: theme.colors.primary + '18' }]}>
              <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>{services.length}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isSuperAdmin && (
              <TouchableOpacity
                style={[styles.smallAddBtn, { backgroundColor: '#10B98118', borderWidth: 1, borderColor: '#10B98150' }]}
                onPress={() => navigation.navigate('SuperAdminCategories')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="shape-plus" size={14} color="#10B981" />
                <Text style={[styles.smallAddBtnText, { color: '#10B981' }]}>Categories</Text>
              </TouchableOpacity>
            )}

            {/* Select from Platform Catalog */}
            <TouchableOpacity
              style={[styles.smallAddBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleOpenCatalogModal}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="playlist-plus" size={15} color="#FFFFFF" />
              <Text style={styles.smallAddBtnText}>From Catalog</Text>
            </TouchableOpacity>

            {/* Add Custom Service */}
            <TouchableOpacity
              style={[styles.smallAddBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderWidth: 1, borderColor: theme.colors.border }]}
              onPress={handleOpenAddCustom}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={15} color={theme.colors.text} />
              <Text style={[styles.smallAddBtnText, { color: theme.colors.text }]}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search & Filter Bar */}
        <View style={[styles.searchFilterContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.searchInputWrapper, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search services by name, keyword..."
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

          {/* Filter Button */}
          <TouchableOpacity
            style={[
              styles.filterBtn,
              {
                backgroundColor: activeCategory !== 'All' ? theme.colors.primary + '18' : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                borderColor: activeCategory !== 'All' ? theme.colors.primary : theme.colors.border,
              },
            ]}
            onPress={() => {
              setFilterModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={18}
              color={activeCategory !== 'All' ? theme.colors.primary : theme.colors.text}
            />
            {activeCategory !== 'All' && <View style={[styles.filterActiveDot, { backgroundColor: theme.colors.primary }]} />}
          </TouchableOpacity>
        </View>

        {/* Active Filter Indicator */}
        {activeCategory !== 'All' && (
          <View style={[styles.activeFilterBar, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.activeFilterChip, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '35' }]}>
              <MaterialCommunityIcons name="filter-outline" size={13} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.activeFilterChipText, { color: theme.colors.primary }]}>
                Filtered: {activeCategory}
              </Text>
              <TouchableOpacity onPress={() => setActiveCategory('All')} style={{ marginLeft: 6 }}>
                <MaterialCommunityIcons name="close-circle" size={15} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Main Services List */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
        >
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>Loading services...</Text>
            </View>
          ) : filteredServices.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="car-wrench" size={44} color={theme.colors.placeholder} style={{ marginBottom: 10 }} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Services Found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.placeholder }]}>
                {searchQuery || activeCategory !== 'All'
                  ? 'No services match your filter.'
                  : 'No services yet. Add from catalog or create a custom one.'}
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.smallAddBtn, { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 9 }]}
                  onPress={handleOpenCatalogModal}
                >
                  <MaterialCommunityIcons name="playlist-plus" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.smallAddBtnText}>Select from Catalog</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallAddBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 9 }]}
                  onPress={handleOpenAddCustom}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={theme.colors.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.smallAddBtnText, { color: theme.colors.text }]}>Add Custom</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            filteredServices.map((service) => {
              const catInfo = CATEGORY_COLORS[service.category || 'Servicing'] || CATEGORY_COLORS['Custom'];
              const isActive = service.isActive !== false;
              const serviceId = String(service._id || service.id || service.name);
              const isCustom = service.isCustom === true;
              const status = service.status || 'Approved';

              return (
                <View
                  key={serviceId}
                  style={[
                    styles.serviceCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: status === 'Pending' ? '#F59E0B60' : (status === 'Rejected' ? '#EF444460' : theme.colors.border),
                    },
                    !isActive && { opacity: 0.72 },
                  ]}
                >
                  {/* Top Row: Left (Icon + Name + Category) & Right (Switch + Delete Button) */}
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.catIconCircle, { backgroundColor: catInfo.bg }]}>
                      <MaterialCommunityIcons name={catInfo.icon as any} size={22} color={catInfo.text} />
                    </View>

                    <View style={styles.serviceTitleGroup}>
                      <Text style={[styles.serviceNameText, { color: theme.colors.text }]} numberOfLines={1}>
                        {service.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <View style={[styles.categoryBadge, { backgroundColor: catInfo.bg, borderColor: catInfo.text + '35' }]}>
                          <MaterialCommunityIcons name={catInfo.icon as any} size={11} color={catInfo.text} style={{ marginRight: 3.5 }} />
                          <Text style={[styles.categoryBadgeText, { color: catInfo.text }]}>
                            {service.category || 'Servicing'}
                          </Text>
                        </View>

                        {/* Custom Service Tag */}
                        {isCustom && (
                          <View style={[styles.customBadge, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                            <Text style={[styles.customBadgeText, { color: theme.colors.placeholder }]}>Custom</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Right Side: Checkbox/Switch + Delete Button */}
                    <View style={styles.cardRightControls}>
                      <Switch
                        value={isActive}
                        disabled={isCustom && status === 'Pending'}
                        onValueChange={(val) => handleToggleActive(service, val)}
                        trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                        thumbColor="#FFFFFF"
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteService(service)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={19} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Info Row: Price, Duration, Status Pill */}
                  <View style={styles.infoMetaRow}>
                    <View style={[styles.priceTagContainer, { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary + '30' }]}>
                      <Text style={[styles.priceTagCurrency, { color: theme.colors.primary }]}>£</Text>
                      <Text style={[styles.priceTagAmount, { color: theme.colors.primary }]}>
                        {Number(service.price).toFixed(2)}
                      </Text>
                    </View>

                    <View style={[styles.durationChip, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}>
                      <MaterialCommunityIcons name="clock-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                      <Text style={[styles.durationChipText, { color: theme.colors.text }]}>
                        {service.duration || 45} mins
                      </Text>
                    </View>

                    {/* Status Pill: Pending, Rejected, Live, Paused */}
                    {isCustom && status === 'Pending' ? (
                      <View style={[styles.statusPill, { backgroundColor: '#F59E0B20' }]}>
                        <MaterialCommunityIcons name="clock-alert-outline" size={12} color="#D97706" />
                        <Text style={[styles.statusPillText, { color: '#D97706' }]}>Pending Approval</Text>
                      </View>
                    ) : isCustom && status === 'Rejected' ? (
                      <View style={[styles.statusPill, { backgroundColor: '#EF444420' }]}>
                        <MaterialCommunityIcons name="close-circle-outline" size={12} color="#DC2626" />
                        <Text style={[styles.statusPillText, { color: '#DC2626' }]}>Rejected</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusPill, { backgroundColor: isActive ? '#10B98115' : '#6B728015' }]}>
                        <View style={[styles.statusDot, { backgroundColor: isActive ? '#10B981' : '#6B7280' }]} />
                        <Text style={[styles.statusPillText, { color: isActive ? '#10B981' : '#6B7280' }]}>
                          {isActive ? 'Live' : 'Paused'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Pending Notice Banner */}
                  {isCustom && status === 'Pending' && (
                    <View style={[styles.noticeBanner, { backgroundColor: '#F59E0B12', borderColor: '#F59E0B35' }]}>
                      <MaterialCommunityIcons name="clock-alert-outline" size={14} color="#D97706" style={{ marginRight: 6 }} />
                      <Text style={[styles.noticeBannerText, { color: '#B45309' }]}>
                        Under review. Hidden from customers until approved.
                      </Text>
                    </View>
                  )}

                  {/* Rejected Notice Banner */}
                  {isCustom && status === 'Rejected' && (
                    <View style={[styles.noticeBanner, { backgroundColor: '#EF444412', borderColor: '#EF444435' }]}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#DC2626" style={{ marginRight: 6 }} />
                      <Text style={[styles.noticeBannerText, { color: '#DC2626' }]}>
                        Rejected: {service.rejectionReason || 'Does not meet platform criteria.'}
                      </Text>
                    </View>
                  )}

                  {/* Description (if provided) */}
                  {service.description && service.description.trim() ? (
                    <Text style={[styles.descriptionText, { color: theme.colors.placeholder }]} numberOfLines={2}>
                      {service.description}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* ─── PLATFORM SERVICE CATALOG MODAL ─── */}
      <Modal
        visible={catalogModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCatalogModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.catalogModalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="playlist-check" size={24} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <View>
                  <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Platform Service Catalog</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                    Select verified services (live instantly)
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setCatalogModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            {/* Catalog Search & Category Tabs */}
            <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
              <View style={[styles.searchInputWrapper, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border, marginBottom: 8 }]}>
                <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search catalog services..."
                  placeholderTextColor={theme.colors.placeholder}
                  value={catalogSearch}
                  onChangeText={setCatalogSearch}
                />
                {catalogSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCatalogSearch('')}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {allCategoryTabs.map((cat) => {
                  const isSelected = catalogActiveCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catSelectPill,
                        isSelected
                          ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                          : { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border },
                      ]}
                      onPress={() => setCatalogActiveCategory(cat)}
                    >
                      <Text style={{ fontFamily: fonts.bold, color: isSelected ? '#FFFFFF' : theme.colors.text, fontSize: 11.5 }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Services List */}
            {catalogLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ marginTop: 10, fontFamily: fonts.medium, color: theme.colors.placeholder, fontSize: 12 }}>
                  Loading catalog services...
                </Text>
              </View>
            ) : filteredCatalogItems.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <MaterialCommunityIcons name="magnify-close" size={36} color={theme.colors.placeholder} style={{ marginBottom: 6 }} />
                <Text style={{ fontFamily: fonts.bold, color: theme.colors.text, fontSize: 14 }}>No catalog services found</Text>
                <Text style={{ fontFamily: fonts.regular, color: theme.colors.placeholder, fontSize: 12, marginTop: 2 }}>
                  Try another search or category.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
                {filteredCatalogItems.map((item) => {
                  const key = (item.name || '').trim().toLowerCase();
                  const selection = catalogSelections[key] || {
                    selected: false,
                    name: item.name,
                    category: item.category || item.groupName,
                    price: String(item.price || 45),
                    duration: String(item.duration || 45),
                    description: item.description || '',
                  };
                  const isSelected = selection.selected;
                  const catInfo = getCategoryMeta(item.category || item.groupName || 'Servicing');

                  return (
                    <View
                      key={key}
                      style={[
                        styles.catalogItemCard,
                        {
                          backgroundColor: isSelected ? theme.colors.primary + '0C' : (isDarkMode ? '#1E293B' : '#F8FAFC'),
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}
                        onPress={() => handleToggleCatalogItem(key)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkboxSquare, { borderColor: isSelected ? theme.colors.primary : theme.colors.border, backgroundColor: isSelected ? theme.colors.primary : 'transparent' }]}>
                          {isSelected && <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />}
                        </View>

                        <View style={[styles.catIconCircle, { width: 34, height: 34, marginLeft: 10, marginRight: 10, backgroundColor: catInfo.bg }]}>
                          <MaterialCommunityIcons name={(item.icon || catInfo.icon) as any} size={18} color={catInfo.text} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={[styles.catalogItemName, { color: theme.colors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={[styles.catalogItemCat, { color: theme.colors.placeholder }]}>
                            {item.category || item.groupName}
                          </Text>
                        </View>

                        {isSelected && (
                          <View style={[styles.catalogActiveTag, { backgroundColor: theme.colors.primary + '18' }]}>
                            <Text style={[styles.catalogActiveTagText, { color: theme.colors.primary }]}>Active</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Custom Rate & Timing Fields */}
                      {isSelected && (
                        <View style={[styles.catalogConfigBox, { backgroundColor: isDarkMode ? '#0F172A' : '#FFFFFF', borderColor: theme.colors.border }]}>
                          <View style={styles.catalogConfigField}>
                            <Text style={[styles.catalogConfigLabel, { color: theme.colors.placeholder }]}>
                              Rate (£)
                            </Text>
                            <View style={[styles.catalogInputWrap, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                              <Text style={[styles.catalogCurrencyText, { color: theme.colors.primary }]}>£</Text>
                              <TextInput
                                style={[styles.catalogInputText, { color: theme.colors.text }]}
                                keyboardType="decimal-pad"
                                value={selection.price}
                                placeholder="0.00"
                                placeholderTextColor={theme.colors.placeholder}
                                onChangeText={(val) => {
                                  setCatalogSelections((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], price: val },
                                  }));
                                }}
                              />
                            </View>
                          </View>

                          <View style={styles.catalogConfigField}>
                            <Text style={[styles.catalogConfigLabel, { color: theme.colors.placeholder }]}>
                              Timing (mins)
                            </Text>
                            <View style={[styles.catalogInputWrap, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                              <MaterialCommunityIcons name="clock-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                              <TextInput
                                style={[styles.catalogInputText, { color: theme.colors.text }]}
                                keyboardType="number-pad"
                                value={selection.duration}
                                placeholder="45"
                                placeholderTextColor={theme.colors.placeholder}
                                onChangeText={(val) => {
                                  setCatalogSelections((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], duration: val },
                                  }));
                                }}
                              />
                              <Text style={[styles.catalogUnitText, { color: theme.colors.placeholder }]}>min</Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Catalog Modal Actions */}
            <View style={[styles.modalActionsRow, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setCatalogModalVisible(false)}
                disabled={savingCatalog}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveCatalog}
                disabled={savingCatalog}
              >
                {savingCatalog ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>
                      Save Selected ({selectedCatalogCount})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── CATEGORY FILTER BOTTOM SHEET ─── */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity style={styles.bottomSheetOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <View style={[styles.bottomSheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />

            <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="tune-variant" size={20} color={theme.colors.primary} />
                <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Filter by Category</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={styles.categoryOptionsGrid}>
                {allCategoryTabs.map((cat) => {
                  const isSelected = activeCategory === cat;
                  const catInfo = getCategoryMeta(cat);

                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryOptionItem,
                        {
                          backgroundColor: isSelected ? theme.colors.primary + '15' : (isDarkMode ? '#1E293B' : '#F8FAFC'),
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                      onPress={() => {
                        setActiveCategory(cat);
                        setFilterModalVisible(false);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.catOptionIcon, { backgroundColor: catInfo.bg }]}>
                          <MaterialCommunityIcons name={catInfo.icon as any} size={18} color={catInfo.text} />
                        </View>
                        <Text style={[styles.catOptionText, { color: isSelected ? theme.colors.primary : theme.colors.text, fontFamily: isSelected ? fonts.bold : fonts.medium }]}>
                          {cat}
                        </Text>
                      </View>

                      {isSelected && <MaterialCommunityIcons name="check-circle" size={18} color={theme.colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[styles.sheetFooter, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.resetFilterBtn, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setActiveCategory('All');
                  setFilterModalVisible(false);
                }}
              >
                <Text style={[styles.resetFilterText, { color: theme.colors.text }]}>Reset to All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── ADD / EDIT CUSTOM SERVICE MODAL ─── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons
                  name="plus-circle"
                  size={24}
                  color={theme.colors.primary}
                  style={{ marginRight: 8 }}
                />
                <View>
                  <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                    Add Custom Service
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: '#D97706', marginTop: 1 }}>
                    Requires admin approval before going live
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormContent} showsVerticalScrollIndicator={false}>
              {/* Approval Notice */}
              <View style={[styles.noticeBanner, { backgroundColor: '#F59E0B12', borderColor: '#F59E0B35', marginBottom: 12 }]}>
                <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={[styles.noticeBannerText, { color: '#B45309', flex: 1 }]}>
                  Requires admin approval before appearing to customers.
                </Text>
              </View>

              {/* Service Name */}
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Service Name *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="e.g. Front Brake Pads & Discs, Custom Detailing..."
                placeholderTextColor={theme.colors.placeholder}
                value={formName}
                onChangeText={setFormName}
              />

              {/* Price (£) & Duration (Mins) Row */}
              <View style={styles.priceDurationRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Price (£ GBP) *</Text>
                  <View style={[styles.inputWithPrefix, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                    <Text style={[styles.currencyPrefix, { color: theme.colors.primary }]}>£</Text>
                    <TextInput
                      style={[styles.prefixInput, { color: theme.colors.text }]}
                      placeholder="45.00"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="decimal-pad"
                      value={formPrice}
                      onChangeText={setFormPrice}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Duration (Mins) *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', color: theme.colors.text, borderColor: theme.colors.border }]}
                    placeholder="45"
                    placeholderTextColor={theme.colors.placeholder}
                    keyboardType="number-pad"
                    value={formDuration}
                    onChangeText={setFormDuration}
                  />
                </View>
              </View>

              {/* Description */}
              <Text style={[styles.fieldLabel, { color: theme.colors.text, marginTop: 14 }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.formTextArea, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Details of what is included in this service..."
                placeholderTextColor={theme.colors.placeholder}
                multiline
                numberOfLines={3}
                value={formDescription}
                onChangeText={setFormDescription}
              />

              {/* Active Toggle */}
              <View style={[styles.toggleActiveCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' }]}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.toggleActiveTitle, { color: theme.colors.text }]}>Enable Service</Text>
                  <Text style={[styles.toggleActiveSubtitle, { color: theme.colors.placeholder }]}>
                    Make service available once approved.
                  </Text>
                </View>
                <Switch
                  value={formIsActive}
                  onValueChange={setFormIsActive}
                  trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={[styles.modalActionsRow, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setModalVisible(false)}
                disabled={savingService}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveService}
                disabled={savingService}
              >
                {savingService ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Submit for Approval</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    marginRight: 6,
  },
  navTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  countBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  smallAddBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#FFFFFF',
    marginLeft: 3,
  },
  searchFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
  },
  searchInput: {
    fontFamily: fonts.regular,
    flex: 1,
    fontSize: 12.5,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeFilterBar: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeFilterChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  listContent: {
    padding: 14,
    paddingBottom: 36,
    gap: 10,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 8,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  serviceCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    overflow: 'visible',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitleGroup: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  serviceNameText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
    marginTop: 2,
  },
  categoryBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.1,
  },
  customBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  customBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
  },
  cardRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    zIndex: 10,
  },
  threeDotBtn: {
    padding: 4,
    marginLeft: 2,
  },
  inlineDropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    minWidth: 105,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    zIndex: 999,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dropdownItemText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  dropdownDivider: {
    height: 1,
    marginVertical: 2,
  },
  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  priceTagContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  priceTagCurrency: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    marginRight: 1,
  },
  priceTagAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 15.5,
    letterSpacing: -0.3,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  durationChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
    gap: 4,
    marginLeft: 'auto',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    marginTop: 8,
  },
  noticeBannerText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
  },
  descriptionText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 16,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  categoryOptionsGrid: {
    gap: 6,
    paddingVertical: 6,
  },
  categoryOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  catOptionIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catOptionText: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  sheetFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 8,
  },
  resetFilterBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetFilterText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: Math.min(height * 0.88, 640),
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  catalogModalCard: {
    width: '100%',
    height: Math.min(height * 0.88, 680),
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 1,
  },
  modalFormContent: {
    padding: 14,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    marginBottom: 5,
  },
  formInput: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12.5,
  },
  formTextArea: {
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  catSelectPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
  },
  priceDurationRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  currencyPrefix: {
    fontFamily: fonts.bold,
    fontSize: 13,
    marginRight: 4,
  },
  prefixInput: {
    fontFamily: fonts.regular,
    flex: 1,
    paddingVertical: 7,
    fontSize: 12.5,
  },
  toggleActiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  toggleActiveTitle: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  toggleActiveSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 1,
  },
  modalActionsRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  saveBtnText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 12.5,
  },
  catalogItemCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogItemName: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
  },
  catalogItemCat: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    marginTop: 1,
  },
  catalogActiveTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catalogActiveTagText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  catalogConfigBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  catalogConfigField: {
    flex: 1,
  },
  catalogConfigLabel: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    marginBottom: 4,
  },
  catalogInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 34,
  },
  catalogCurrencyText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    marginRight: 4,
  },
  catalogInputText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    flex: 1,
    padding: 0,
  },
  catalogUnitText: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    marginLeft: 2,
  },
});
