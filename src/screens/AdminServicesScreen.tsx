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
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues } from '../context/DataContext';

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
};

const STANDARD_CATEGORIES = [
  'All',
  'MOT',
  'Servicing',
  'Repairs',
  'Tyre replacement',
  'Diagnostics',
  'Brakes',
  'Exhaust',
  'Air Conditioning',
];

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
  } = useAppValues();

  const isSuperAdmin = user?.role === 'admin';

  // Dynamic Categories from Super Admin master collection
  const availableCategories = useMemo(() => {
    if (serviceCategories && serviceCategories.length > 0) {
      return serviceCategories.map(c => c.name);
    }
    return ['MOT', 'Servicing', 'Tyres', 'Repairs'];
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

  // Dropdown menu state (ID of service whose 3-dot dropdown is open)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Filter BottomSheet / Modal State
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Add / Edit Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
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
    setOpenMenuId(null);
    loadServices(undefined, true);
  };

  // Open Modal for Add
  const handleOpenAdd = () => {
    setOpenMenuId(null);
    setEditingService(null);
    setFormName('');
    setFormCategory(availableCategories[0] || 'Servicing');
    setFormPrice('45.00');
    setFormDuration('45');
    setFormDescription('');
    setFormIsActive(true);
    setModalVisible(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (service: ServiceItem) => {
    setOpenMenuId(null);
    setEditingService(service);
    setFormName(service.name || '');
    setFormCategory(service.category || 'Servicing');
    setFormPrice(String(service.price !== undefined ? service.price : '45.00'));
    setFormDuration(String(service.duration || '45'));
    setFormDescription(service.description || '');
    setFormIsActive(service.isActive !== false);
    setModalVisible(true);
  };

  // Save Service (Create or Update)
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
      if (editingService) {
        // Update
        const serviceId = editingService._id || editingService.id || '';
        await updateGarageService(targetGId, serviceId, {
          name: cleanName,
          category: formCategory,
          price: numPrice,
          duration: numDuration,
          description: formDescription.trim(),
          isActive: formIsActive
        });
        Alert.alert('Success', `"${cleanName}" updated successfully!`);
      } else {
        // Create
        await addGarageService(targetGId, {
          name: cleanName,
          category: formCategory,
          price: numPrice,
          duration: numDuration,
          description: formDescription.trim(),
          isActive: formIsActive
        });
        Alert.alert('Success', `"${cleanName}" added successfully!`);
      }
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
    setOpenMenuId(null);
    const targetGId = selectedGarageId || user?.garageId;
    const serviceId = service._id || service.id;
    if (!targetGId || !serviceId) return;

    // Optimistic update
    setServices(prev => prev.map(s => (s._id === serviceId || s.id === serviceId) ? { ...s, isActive: newVal } : s));

    try {
      await updateGarageService(targetGId, serviceId, { isActive: newVal });
    } catch (err: any) {
      // Revert if error
      setServices(prev => prev.map(s => (s._id === serviceId || s.id === serviceId) ? { ...s, isActive: !newVal } : s));
      Alert.alert('Error', 'Could not update active status.');
    }
  };

  // Delete Service
  const handleDeleteService = (service: ServiceItem) => {
    setOpenMenuId(null);
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
          }
        }
      ]
    );
  };

  // Filtered Services List
  const filteredServices = useMemo(() => {
    return services.filter(s => {
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={{ flex: 1 }}>
        {/* Transparent backdrop to dismiss 3-dot menu only when open */}
        {openMenuId !== null && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setOpenMenuId(null)}
          />
        )}
        {/* Top Navbar: Back + Title + Count Badge + Smaller "Add Service" Button */}
        <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {navigation.canGoBack && navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.navTitleGroup}>
            <Text style={[styles.navTitle, { color: theme.colors.text }]}>Services</Text>
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

            <TouchableOpacity
              style={[styles.smallAddBtn, { backgroundColor: theme.colors.primary }]}
              onPress={handleOpenAdd}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={15} color="#FFFFFF" />
              <Text style={styles.smallAddBtnText}>Add Service</Text>
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
                }
              ]}
              onPress={() => {
                setOpenMenuId(null);
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
            onScrollBeginDrag={() => setOpenMenuId(null)}
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
                    ? 'No services match your active search or filter.'
                    : 'No services created yet. Tap "+ Add Service" to add your first garage service.'}
                </Text>

                <TouchableOpacity
                  style={[styles.smallAddBtn, { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8 }]}
                  onPress={handleOpenAdd}
                >
                  <MaterialCommunityIcons name="plus" size={15} color="#FFFFFF" />
                  <Text style={styles.smallAddBtnText}>Add Custom Service</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredServices.map((service) => {
                const catInfo = CATEGORY_COLORS[service.category || 'Servicing'] || CATEGORY_COLORS['Custom'];
                const isActive = service.isActive !== false;
                const serviceId = String(service._id || service.id || service.name);
                const isMenuOpen = openMenuId === serviceId;

                return (
                  <View
                    key={serviceId}
                    style={[
                      styles.serviceCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        zIndex: isMenuOpen ? 100 : 1,
                      },
                      !isActive && { opacity: 0.72 }
                    ]}
                  >
                    {/* Top Row: Left (Icon + Name + Category) & Right (Switch + Three-Dot Button) */}
                    <View style={styles.cardHeaderRow}>
                      {/* Category Icon */}
                      <View style={[styles.catIconCircle, { backgroundColor: catInfo.bg }]}>
                        <MaterialCommunityIcons name={catInfo.icon as any} size={22} color={catInfo.text} />
                      </View>

                      {/* Name and Enhanced Category Badge */}
                      <View style={styles.serviceTitleGroup}>
                        <Text style={[styles.serviceNameText, { color: theme.colors.text }]} numberOfLines={1}>
                          {service.name}
                        </Text>
                        <View style={[styles.categoryBadge, { backgroundColor: catInfo.bg, borderColor: catInfo.text + '35' }]}>
                          <MaterialCommunityIcons name={catInfo.icon as any} size={11} color={catInfo.text} style={{ marginRight: 3.5 }} />
                          <Text style={[styles.categoryBadgeText, { color: catInfo.text }]}>
                            {service.category || 'Servicing'}
                          </Text>
                        </View>
                      </View>

                      {/* Right Side: Checkbox/Switch + Three-dot Menu Button */}
                      <View style={styles.cardRightControls}>
                        <Switch
                          value={isActive}
                          onValueChange={(val) => handleToggleActive(service, val)}
                          trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                          thumbColor="#FFFFFF"
                          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />

                        <TouchableOpacity
                          style={[styles.threeDotBtn, isMenuOpen && { backgroundColor: theme.colors.primary + '15', borderRadius: 6 }]}
                          onPress={() => setOpenMenuId(isMenuOpen ? null : serviceId)}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="dots-vertical" size={20} color={isMenuOpen ? theme.colors.primary : theme.colors.text} />
                        </TouchableOpacity>

                        {/* Absolute Dropdown positioned just below the three dots */}
                        {isMenuOpen && (
                          <View style={[styles.inlineDropdown, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <TouchableOpacity
                              style={styles.dropdownItem}
                              onPress={() => handleOpenEdit(service)}
                              activeOpacity={0.7}
                            >
                              <MaterialCommunityIcons name="pencil-outline" size={15} color={theme.colors.primary} />
                              <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>Edit</Text>
                            </TouchableOpacity>

                            <View style={[styles.dropdownDivider, { backgroundColor: theme.colors.border }]} />

                            <TouchableOpacity
                              style={styles.dropdownItem}
                              onPress={() => handleDeleteService(service)}
                              activeOpacity={0.7}
                            >
                              <MaterialCommunityIcons name="trash-can-outline" size={15} color="#EF4444" />
                              <Text style={[styles.dropdownItemText, { color: '#EF4444' }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Info Row: LARGER PRICING FIRST, THEN DURATION & STATUS */}
                    <View style={styles.infoMetaRow}>
                      {/* 1. Larger Prominent Price First */}
                      <View style={[styles.priceTagContainer, { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary + '30' }]}>
                        <Text style={[styles.priceTagCurrency, { color: theme.colors.primary }]}>£</Text>
                        <Text style={[styles.priceTagAmount, { color: theme.colors.primary }]}>
                          {Number(service.price).toFixed(2)}
                        </Text>
                      </View>

                      {/* 2. Duration Second */}
                      <View style={[styles.durationChip, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}>
                        <MaterialCommunityIcons name="clock-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 4 }} />
                        <Text style={[styles.durationChipText, { color: theme.colors.text }]}>
                          {service.duration || 45} mins
                        </Text>
                      </View>

                      {/* Status Indicator Pill */}
                      <View style={[styles.statusPill, { backgroundColor: isActive ? '#10B98115' : '#6B728015' }]}>
                        <View style={[styles.statusDot, { backgroundColor: isActive ? '#10B981' : '#6B7280' }]} />
                        <Text style={[styles.statusPillText, { color: isActive ? '#10B981' : '#6B7280' }]}>
                          {isActive ? 'Live' : 'Paused'}
                        </Text>
                      </View>
                    </View>

                    {/* Description (if provided) */}
                    {service.description ? (
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

      {/* ─── CATEGORY FILTER BOTTOM SHEET ─── */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View
            style={[styles.bottomSheetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="tune-variant" size={20} color={theme.colors.primary} />
                <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Filter by Category</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            {/* Category Options List */}
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
                        }
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
                        <Text style={[styles.catOptionText, { color: isSelected ? theme.colors.primary : theme.colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                          {cat}
                        </Text>
                      </View>

                      {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={18} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Reset / All Action */}
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

      {/* ─── ADD / EDIT SERVICE MODAL ─── */}
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
                  name={editingService ? 'pencil-circle' : 'plus-circle'}
                  size={24}
                  color={theme.colors.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {editingService ? 'Edit Service' : 'Add New Service'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormContent} showsVerticalScrollIndicator={false}>
              {/* Service Name */}
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Service Name *</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="e.g. Front Brake Pads & Discs, Full Service..."
                placeholderTextColor={theme.colors.placeholder}
                value={formName}
                onChangeText={setFormName}
              />

              {/* Category Selection */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text, marginBottom: 0 }]}>Category *</Text>
                {isSuperAdmin && (
                  <TouchableOpacity
                    onPress={() => {
                      setModalVisible(false);
                      navigation.navigate('SuperAdminCategories');
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <MaterialCommunityIcons name="cog-outline" size={13} color={theme.colors.primary} style={{ marginRight: 2 }} />
                    <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '700' }}>Manage Categories</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {availableCategories.map((cat) => {
                  const meta = getCategoryMeta(cat);
                  const isSelected = formCategory.toLowerCase() === cat.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catSelectPill,
                        { flexDirection: 'row', alignItems: 'center' },
                        isSelected
                          ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                          : { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }
                      ]}
                      onPress={() => setFormCategory(cat)}
                    >
                      <MaterialCommunityIcons
                        name={meta.icon as any}
                        size={14}
                        color={isSelected ? '#FFFFFF' : meta.text}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={{ color: isSelected ? '#FFFFFF' : theme.colors.text, fontSize: 12, fontWeight: '700' }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

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
                  <Text style={[styles.toggleActiveTitle, { color: theme.colors.text }]}>Live for Customer Booking</Text>
                  <Text style={[styles.toggleActiveSubtitle, { color: theme.colors.placeholder }]}>
                    When active, customers can find and book this service.
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
                    <Text style={styles.saveBtnText}>{editingService ? 'Update Service' : 'Add Service'}</Text>
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
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 3,
  },
  smallAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11.5,
  },
  searchFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
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
    fontSize: 13.5,
    fontWeight: '700',
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
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
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dropdownItemText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 12.5,
    fontWeight: '700',
    marginRight: 1,
  },
  priceTagAmount: {
    fontSize: 15.5,
    fontWeight: '800',
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
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 10.5,
    fontWeight: '700',
  },
  descriptionText: {
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
    fontSize: 16,
    fontWeight: '700',
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
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: Math.min(height * 0.88, 620),
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
    fontSize: 15,
    fontWeight: '700',
  },
  modalFormContent: {
    padding: 14,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 5,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12.5,
  },
  formTextArea: {
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
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },
  prefixInput: {
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
    fontSize: 11.5,
    fontWeight: '700',
  },
  toggleActiveSubtitle: {
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
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontWeight: '600',
    fontSize: 12,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
