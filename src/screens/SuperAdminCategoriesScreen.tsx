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
  Dimensions,
  Pressable,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, ServiceCategory } from '../context/DataContext';
import { fonts } from '../theme/theme';

const { width, height } = Dimensions.get('window');

function resolveCategoryDesign(name = '') {
  const s = name.toLowerCase().trim();
  if (/\bmot\b/i.test(s)) return { icon: 'shield-check', iconColor: '#10B981', iconBg: '#10B98115' };
  if (s.includes('service') || s.includes('oil')) return { icon: 'car-cog', iconColor: '#1677FF', iconBg: '#1677FF15' };
  if (s.includes('tyre') || s.includes('tire') || s.includes('wheel')) return { icon: 'tire', iconColor: '#F59E0B', iconBg: '#F59E0B15' };
  if (s.includes('repair') || s.includes('wrench')) return { icon: 'hammer-wrench', iconColor: '#EC4899', iconBg: '#EC489915' };
  if (s.includes('brake')) return { icon: 'car-brake-alert', iconColor: '#EF4444', iconBg: '#EF444415' };
  if (s.includes('diag') || s.includes('scan')) return { icon: 'engine', iconColor: '#06B6D4', iconBg: '#06B6D415' };
  if (s.includes('battery') || s.includes('electric')) return { icon: 'car-battery', iconColor: '#EAB308', iconBg: '#EAB30815' };
  if (/\b(air\s*con|aircon|air\s*conditioning|regas|ac)\b/i.test(s) || s.includes('condit')) return { icon: 'snowflake', iconColor: '#3B82F6', iconBg: '#3B82F615' };
  if (s.includes('exhaust')) return { icon: 'pipe', iconColor: '#6366F1', iconBg: '#6366F115' };
  return { icon: 'wrench', iconColor: '#8B5CF6', iconBg: '#8B5CF615' };
}

const PRESET_ICONS = [
  { name: 'shield-check', label: 'MOT' },
  { name: 'car-cog', label: 'Servicing' },
  { name: 'tire', label: 'Tyres' },
  { name: 'hammer-wrench', label: 'Repairs' },
  { name: 'car-brake-alert', label: 'Brakes' },
  { name: 'engine', label: 'Diagnostics' },
  { name: 'car-battery', label: 'Battery' },
  { name: 'snowflake', label: 'Air Con' },
  { name: 'oil', label: 'Oil/Fluids' },
  { name: 'cog-sync', label: 'Clutch' },
  { name: 'car-traction-control', label: 'Suspension' },
  { name: 'pipe', label: 'Exhaust' },
  { name: 'car-wash', label: 'Valeting' },
  { name: 'car-light-high', label: 'Lighting' },
  { name: 'car-door', label: 'Bodywork' },
  { name: 'car-windshield', label: 'Glass' },
  { name: 'speedometer', label: 'Performance' },
  { name: 'shield-car', label: 'Safety' },
  { name: 'tow-truck', label: 'Recovery' },
  { name: 'car-electric', label: 'EV/Hybrid' },
  { name: 'wrench', label: 'General' },
  { name: 'dots-horizontal-circle-outline', label: 'Other' },
];

const PRESET_COLORS = [
  { color: '#10B981', bg: '#10B98115', label: 'Emerald' },
  { color: '#1677FF', bg: '#1677FF15', label: 'Blue' },
  { color: '#F59E0B', bg: '#F59E0B15', label: 'Amber' },
  { color: '#EF4444', bg: '#EF444415', label: 'Red' },
  { color: '#8B5CF6', bg: '#8B5CF615', label: 'Purple' },
  { color: '#06B6D4', bg: '#06B6D415', label: 'Cyan' },
  { color: '#EC4899', bg: '#EC489915', label: 'Pink' },
  { color: '#6366F1', bg: '#6366F115', label: 'Indigo' },
];

export default function SuperAdminCategoriesScreen({ navigation }: any) {
  const { theme, isDarkMode } = useAppTheme();
  const {
    user,
    serviceCategories,
    fetchServiceCategories,
    createServiceCategory,
    updateServiceCategory,
    deleteServiceCategory,
    fetchPlatformServices,
    createPlatformService,
    deletePlatformService,
    fetchPendingCustomServices,
    setPendingCustomServicesCount,
    approveCustomService,
    rejectCustomService,
  } = useAppValues();

  // Active Screen Tab: 'categories' | 'services' | 'approvals'
  const [activeTab, setActiveTab] = useState<'categories' | 'services' | 'approvals'>('categories');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Platform Services State
  const [platformServices, setPlatformServices] = useState<any[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

  // Pending Custom Services Approvals State
  const [pendingCustomServices, setPendingCustomServices] = useState<any[]>([]);

  // Category Modal State
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [isManualIconSet, setIsManualIconSet] = useState(false);
  const [activeMenuCatId, setActiveMenuCatId] = useState<string | null>(null);

  // Category Form State
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catIcon, setCatIcon] = useState('shield-check');
  const [catColor, setCatColor] = useState('#1677FF');
  const [catBg, setCatBg] = useState('#1677FF15');

  // Service Modal State
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [deletingSvcId, setDeletingSvcId] = useState<string | null>(null);

  // Service Form State
  const [svcName, setSvcName] = useState('');
  const [svcCategory, setSvcCategory] = useState('');
  const [svcPrice, setSvcPrice] = useState('45.00');
  const [svcDuration, setSvcDuration] = useState('45');
  const [svcDescription, setSvcDescription] = useState('');

  // Action loaders for approval
  const [actioningSvcId, setActioningSvcId] = useState<string | null>(null);

  // Rejection Modal State
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingSvc, setRejectingSvc] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('Does not meet platform service criteria');

  const REJECTION_PRESETS = [
    'Does not meet platform service criteria',
    'Duplicate or similar service already exists',
    'Inappropriate pricing or service description',
    'Requires special certification or verification',
  ];

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cats, svcs, pendings] = await Promise.all([
        fetchServiceCategories(),
        fetchPlatformServices ? fetchPlatformServices({ all: 'true' }) : Promise.resolve([]),
        fetchPendingCustomServices ? fetchPendingCustomServices() : Promise.resolve([]),
      ]);
      setPlatformServices(svcs || []);
      setPendingCustomServices(pendings || []);
      if (setPendingCustomServicesCount && Array.isArray(pendings)) {
        setPendingCustomServicesCount(pendings.length);
      }
    } catch (err: any) {
      console.error('Error fetching admin categories & services:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchServiceCategories, fetchPlatformServices, fetchPendingCustomServices]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setActiveMenuCatId(null);
    setRefreshing(true);
    loadData();
  };

  // ─── CATEGORY HANDLERS ───
  const handleOpenAddCategory = () => {
    setActiveMenuCatId(null);
    setEditingCatId(null);
    setCatName('');
    setCatDescription('');
    setCatIcon('car-cog');
    setCatColor('#1677FF');
    setCatBg('#1677FF15');
    setIsManualIconSet(false);
    setCategoryModalVisible(true);
  };

  const handleOpenEditCategory = (cat: ServiceCategory) => {
    setActiveMenuCatId(null);
    setEditingCatId(cat._id || cat.id || null);
    setCatName(cat.name || '');
    setCatDescription(cat.description || '');
    setCatIcon(cat.icon || 'wrench');
    setCatColor(cat.iconColor || '#1677FF');
    setCatBg(cat.iconBg || (cat.iconColor ? cat.iconColor + '15' : '#1677FF15'));
    setIsManualIconSet(true);
    setCategoryModalVisible(true);
  };

  const handleCatNameChange = (text: string) => {
    setCatName(text);
    if (!isManualIconSet && !editingCatId && text.trim().length >= 2) {
      const design = resolveCategoryDesign(text);
      setCatIcon(design.icon);
      setCatColor(design.iconColor);
      setCatBg(design.iconBg);
    }
  };

  const handleSelectIcon = (iconName: string) => {
    setCatIcon(iconName);
    setIsManualIconSet(true);
  };

  const handleSelectColor = (colorHex: string, bgHex?: string) => {
    setCatColor(colorHex);
    setCatBg(bgHex || colorHex + '18');
    setIsManualIconSet(true);
  };

  const handleSaveCategory = async () => {
    const cleanName = catName.trim();
    if (!cleanName || cleanName.length < 2) {
      Alert.alert('Validation Error', 'Category name is required (minimum 2 characters).');
      return;
    }

    setSavingCategory(true);
    try {
      const finalIcon = catIcon || 'wrench';
      const finalColor = catColor || '#1677FF';
      const finalBg = catBg || finalColor + '15';

      if (editingCatId) {
        await updateServiceCategory(editingCatId, {
          name: cleanName,
          description: catDescription.trim(),
          icon: finalIcon,
          iconColor: finalColor,
          iconBg: finalBg,
        });
        Alert.alert('Success', `Category "${cleanName}" updated successfully!`);
      } else {
        await createServiceCategory({
          name: cleanName,
          description: catDescription.trim(),
          icon: finalIcon,
          iconColor: finalColor,
          iconBg: finalBg,
        });
        Alert.alert('Success', `Category "${cleanName}" created! You can now create services under it.`);
      }

      setCategoryModalVisible(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save category.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = (cat: ServiceCategory) => {
    const catId = cat._id || cat.id;
    if (!catId) return;

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete the category "${cat.name}"?\nGarages will no longer be able to offer services in this category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingCatId(catId);
            try {
              await deleteServiceCategory(catId);
              Alert.alert('Deleted', `Category "${cat.name}" has been removed.`);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not delete category.');
            } finally {
              setDeletingCatId(null);
            }
          },
        },
      ]
    );
  };

  // ─── SERVICE CATALOG HANDLERS ───
  const handleOpenAddService = () => {
    setSvcName('');
    setSvcCategory(
      selectedCategoryFilter !== 'All'
        ? selectedCategoryFilter
        : (serviceCategories[0]?.name || 'Servicing')
    );
    setSvcPrice('45.00');
    setSvcDuration('45');
    setSvcDescription('');
    setServiceModalVisible(true);
  };

  const handleSaveService = async () => {
    const cleanName = svcName.trim();
    if (!cleanName || cleanName.length < 2) {
      Alert.alert('Validation Error', 'Service name is required (minimum 2 characters).');
      return;
    }
    if (!svcCategory) {
      Alert.alert('Validation Error', 'Please select a category for this service.');
      return;
    }

    const numPrice = Number(svcPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      Alert.alert('Validation Error', 'Please enter a valid price in GBP.');
      return;
    }

    const numDuration = Number(svcDuration);
    if (isNaN(numDuration) || numDuration < 5) {
      Alert.alert('Validation Error', 'Please enter a valid duration in minutes.');
      return;
    }

    setSavingService(true);
    try {
      const matchedCat = serviceCategories.find(c => c.name.toLowerCase() === svcCategory.toLowerCase());
      const catDesign = resolveCategoryDesign(svcCategory);
      const resolvedIcon = matchedCat?.icon || catDesign.icon;
      const resolvedColor = matchedCat?.iconColor || catDesign.iconColor;
      const resolvedBg = matchedCat?.iconBg || catDesign.iconBg;

      await createPlatformService({
        name: cleanName,
        category: svcCategory,
        price: numPrice,
        duration: numDuration,
        description: svcDescription.trim(),
        icon: resolvedIcon,
        iconColor: resolvedColor,
        iconBg: resolvedBg,
      });

      Alert.alert('Success', `Service "${cleanName}" created under category "${svcCategory}"! Garages can now select it.`);
      setServiceModalVisible(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create platform service.');
    } finally {
      setSavingService(false);
    }
  };

  const handleDeleteService = (svc: any) => {
    const svcId = svc._id || svc.id;
    if (!svcId) return;

    Alert.alert(
      'Delete Service',
      `Are you sure you want to remove "${svc.name}" from the platform catalog?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingSvcId(svcId);
            try {
              await deletePlatformService(svcId);
              Alert.alert('Deleted', `Service "${svc.name}" removed from platform catalog.`);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to remove service.');
            } finally {
              setDeletingSvcId(null);
            }
          },
        },
      ]
    );
  };

  // ─── APPROVALS HANDLERS ───
  const handleApproveCustomService = async (svc: any) => {
    const svcId = svc._id || svc.id;
    if (!svcId) return;

    setActioningSvcId(svcId);
    try {
      await approveCustomService(svcId);
      Alert.alert('Approved!', `Custom service "${svc.name}" is now approved and live platform-wide!`);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to approve custom service.');
    } finally {
      setActioningSvcId(null);
    }
  };

  const handleOpenRejectModal = (svc: any) => {
    setRejectingSvc(svc);
    setRejectReason('Does not meet platform service criteria');
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingSvc) return;
    const svcId = rejectingSvc._id || rejectingSvc.id;
    if (!svcId) return;

    const reason = rejectReason.trim() || 'Does not meet platform service criteria';
    setRejectModalVisible(false);
    setActioningSvcId(svcId);
    try {
      await rejectCustomService(svcId, reason);
      Alert.alert('Service Rejected', `Custom service "${rejectingSvc.name}" was rejected.`);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to reject service.');
    } finally {
      setActioningSvcId(null);
      setRejectingSvc(null);
    }
  };

  // Filtered platform services
  const filteredServices = useMemo(() => {
    if (selectedCategoryFilter === 'All') return platformServices;
    const catLower = selectedCategoryFilter.toLowerCase().trim();
    return platformServices.filter(
      (s) => (s.category || '').toLowerCase().trim() === catLower
    );
  }, [platformServices, selectedCategoryFilter]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* ─── HEADER ─── */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {navigation.canGoBack && navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          ) : null}
          <View style={{ marginLeft: 12 }}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Services & Categories
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.placeholder }]}>
              Manage catalog & approvals
            </Text>
          </View>
        </View>

        {activeTab === 'categories' ? (
          <TouchableOpacity
            style={[styles.headerAddBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleOpenAddCategory}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.headerAddBtnText}>Category</Text>
          </TouchableOpacity>
        ) : activeTab === 'services' ? (
          <TouchableOpacity
            style={[styles.headerAddBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleOpenAddService}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.headerAddBtnText}>Service</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ─── TOP SEGMENTED TABS ─── */}
      <View style={[styles.tabBarWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'categories' && [styles.activeTabItem, { borderColor: theme.colors.primary }],
          ]}
          onPress={() => {
            setActiveMenuCatId(null);
            setActiveTab('categories');
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="shape"
            size={16}
            color={activeTab === 'categories' ? theme.colors.primary : theme.colors.placeholder}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'categories' ? theme.colors.primary : theme.colors.placeholder },
            ]}
          >
            Categories ({serviceCategories.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'services' && [styles.activeTabItem, { borderColor: theme.colors.primary }],
          ]}
          onPress={() => {
            setActiveMenuCatId(null);
            setActiveTab('services');
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="tools"
            size={16}
            color={activeTab === 'services' ? theme.colors.primary : theme.colors.placeholder}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'services' ? theme.colors.primary : theme.colors.placeholder },
            ]}
          >
            Services ({platformServices.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'approvals' && [styles.activeTabItem, { borderColor: theme.colors.primary }],
          ]}
          onPress={() => {
            setActiveMenuCatId(null);
            setActiveTab('approvals');
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="clock-check-outline"
            size={16}
            color={activeTab === 'approvals' ? theme.colors.primary : theme.colors.placeholder}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'approvals' ? theme.colors.primary : theme.colors.placeholder },
            ]}
          >
            Approvals
          </Text>
          {pendingCustomServices.length > 0 && (
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{pendingCustomServices.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── MAIN CONTENT ─── */}
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => setActiveMenuCatId(null)}
      >
        {/* ════════════ TAB 1: CATEGORIES ════════════ */}
        {activeTab === 'categories' && (
          <View style={{ position: 'relative' }}>
            {activeMenuCatId ? (
              <Pressable
                style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
                onPress={() => setActiveMenuCatId(null)}
              />
            ) : null}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
                Platform Service Categories
              </Text>
              <Text style={[styles.sectionSub, { color: theme.colors.placeholder }]}>
                Categories for platform and garage services.
              </Text>
            </View>

            {loading && serviceCategories.length === 0 ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ marginTop: 10, color: theme.colors.placeholder }}>Loading categories...</Text>
              </View>
            ) : serviceCategories.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="tag-off-outline" size={48} color={theme.colors.placeholder} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Categories Found</Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.placeholder }]}>
                  Tap "+ Category" to add one.
                </Text>
              </View>
            ) : (
              serviceCategories.map((cat, idx) => {
                const catId = cat._id || cat.id || `cat_${idx}`;
                const isDeleting = deletingCatId === catId;
                const svcsInCat = platformServices.filter(
                  (s) => (s.category || '').toLowerCase().trim() === cat.name.toLowerCase().trim()
                ).length;
                const isMenuOpen = activeMenuCatId === catId;

                return (
                  <View
                    key={catId}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        zIndex: isMenuOpen ? 99 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.categoryIconCircle, { backgroundColor: cat.iconBg || '#1677FF15' }]}>
                      <MaterialCommunityIcons
                        name={(cat.icon || 'wrench') as any}
                        size={24}
                        color={cat.iconColor || theme.colors.primary}
                      />
                    </View>

                    <View style={styles.categoryInfoCol}>
                      <View style={styles.categoryNameRow}>
                        <Text style={[styles.categoryName, { color: theme.colors.text }]}>{cat.name}</Text>
                        <View style={[styles.countBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                          <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>
                            {svcsInCat} {svcsInCat === 1 ? 'service' : 'services'}
                          </Text>
                        </View>
                      </View>

                      {cat.description && cat.description.trim() ? (
                        <Text style={[styles.categoryDesc, { color: theme.colors.placeholder }]} numberOfLines={2}>
                          {cat.description}
                        </Text>
                      ) : null}
                    </View>

                    {/* Three Dots Button */}
                    <TouchableOpacity
                      style={[
                        styles.threeDotsBtn,
                        {
                          backgroundColor: isMenuOpen
                            ? theme.colors.primary + '18'
                            : isDarkMode
                            ? '#33415530'
                            : '#F1F5F9',
                        },
                      ]}
                      onPress={() => setActiveMenuCatId(isMenuOpen ? null : catId)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="dots-vertical"
                        size={20}
                        color={isMenuOpen ? theme.colors.primary : theme.colors.text}
                      />
                    </TouchableOpacity>

                    {/* Absolute Popover Menu for Edit & Delete */}
                    {isMenuOpen && (
                      <View
                        style={[
                          styles.categoryMenuPopup,
                          {
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.categoryMenuItem}
                          onPress={() => {
                            setActiveMenuCatId(null);
                            handleOpenEditCategory(cat);
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons
                            name="pencil-outline"
                            size={16}
                            color={theme.colors.primary}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={[styles.categoryMenuText, { color: theme.colors.text }]}>Edit</Text>
                        </TouchableOpacity>

                        <View style={[styles.categoryMenuDivider, { backgroundColor: theme.colors.border }]} />

                        <TouchableOpacity
                          style={styles.categoryMenuItem}
                          onPress={() => {
                            setActiveMenuCatId(null);
                            handleDeleteCategory(cat);
                          }}
                          disabled={isDeleting}
                          activeOpacity={0.7}
                        >
                          {isDeleting ? (
                            <ActivityIndicator size="small" color="#EF4444" style={{ marginRight: 8 }} />
                          ) : (
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={16}
                              color="#EF4444"
                              style={{ marginRight: 8 }}
                            />
                          )}
                          <Text style={[styles.categoryMenuText, { color: '#EF4444' }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ════════════ TAB 2: SERVICES ════════════ */}
        {activeTab === 'services' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
                Platform Services
              </Text>
              <Text style={[styles.sectionSub, { color: theme.colors.placeholder }]}>
                Master services garages can offer.
              </Text>
            </View>

            {/* Horizontal Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              <TouchableOpacity
                onPress={() => setSelectedCategoryFilter('All')}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: selectedCategoryFilter === 'All' ? theme.colors.primary : theme.colors.card,
                    borderColor: selectedCategoryFilter === 'All' ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: selectedCategoryFilter === 'All' ? '#FFFFFF' : theme.colors.text },
                  ]}
                >
                  All ({platformServices.length})
                </Text>
              </TouchableOpacity>

              {serviceCategories.map((c) => {
                const isSelected = selectedCategoryFilter === c.name;
                const count = platformServices.filter(
                  (s) => (s.category || '').toLowerCase().trim() === c.name.toLowerCase().trim()
                ).length;

                return (
                  <TouchableOpacity
                    key={c.name}
                    onPress={() => setSelectedCategoryFilter(c.name)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.card,
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: isSelected ? '#FFFFFF' : theme.colors.text },
                      ]}
                    >
                      {c.name} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Services List */}
            {filteredServices.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="tools" size={48} color={theme.colors.placeholder} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Services in "{selectedCategoryFilter}"</Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.placeholder }]}>
                  Tap "+ Service" to add one.
                </Text>
              </View>
            ) : (
              filteredServices.map((svc, idx) => {
                const sId = svc._id || svc.id || `svc_${idx}`;
                const isDeleting = deletingSvcId === sId;

                return (
                  <View
                    key={sId}
                    style={[
                      styles.serviceCard,
                      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                    ]}
                  >
                    <View style={styles.serviceInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.serviceTitle, { color: theme.colors.text }]} numberOfLines={1}>
                          {svc.name}
                        </Text>
                        <Text style={[styles.servicePrice, { color: theme.colors.primary }]}>
                          £{Number(svc.price || 45).toFixed(2)}
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                        <View style={[styles.categoryTag, { backgroundColor: theme.colors.primary + '12' }]}>
                          <Text style={[styles.categoryTagText, { color: theme.colors.primary }]}>{svc.category}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="clock-outline" size={13} color={theme.colors.placeholder} style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 12, color: theme.colors.placeholder, fontFamily: fonts.medium }}>
                            {svc.duration || 45} mins
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MaterialCommunityIcons name="storefront-outline" size={13} color="#10B981" style={{ marginRight: 3 }} />
                          <Text style={{ fontSize: 12, color: '#10B981', fontFamily: fonts.medium }}>
                            {svc.garageCount || 0} garages
                          </Text>
                        </View>
                      </View>

                      {svc.description && svc.description.trim() ? (
                        <Text style={[styles.serviceDesc, { color: theme.colors.placeholder }]} numberOfLines={2}>
                          {svc.description}
                        </Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={[styles.deleteBtn, { backgroundColor: '#EF444415' }]}
                      onPress={() => handleDeleteService(svc)}
                      disabled={isDeleting}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <MaterialCommunityIcons name="trash-can-outline" size={19} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ════════════ TAB 3: CUSTOM APPROVALS ════════════ */}
        {activeTab === 'approvals' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
                Custom Services Awaiting Verification
              </Text>
              <Text style={[styles.sectionSub, { color: theme.colors.placeholder }]}>
                Custom services awaiting verification.
              </Text>
            </View>

            {pendingCustomServices.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="check-decagram-outline" size={48} color="#10B981" />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>All Caught Up!</Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.placeholder }]}>
                  No custom services to review.
                </Text>
              </View>
            ) : (
              pendingCustomServices.map((svc) => {
                const sId = svc._id || svc.id;
                const isActioning = actioningSvcId === sId;

                return (
                  <View
                    key={sId}
                    style={[
                      styles.approvalCard,
                      { backgroundColor: theme.colors.card, borderColor: '#F59E0B50' },
                    ]}
                  >
                    <View style={styles.approvalTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.approvalTitle, { color: theme.colors.text }]}>{svc.name}</Text>
                        <Text style={{ fontSize: 13, color: theme.colors.placeholder, fontFamily: fonts.medium, marginTop: 2 }}>
                          Proposed for category: <Text style={{ color: theme.colors.primary, fontFamily: fonts.bold }}>{svc.category}</Text>
                        </Text>
                      </View>
                      <View style={[styles.pendingBadge, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B50' }]}>
                        <Text style={[styles.pendingBadgeText, { color: '#D97706' }]}>Pending Approval</Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.garageNoticeBox,
                        {
                          backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                          borderColor: theme.colors.border,
                          borderWidth: 1,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          backgroundColor: theme.colors.primary + '18',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                        }}
                      >
                        <MaterialCommunityIcons name="storefront" size={18} color={theme.colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            color: theme.colors.placeholder,
                            fontFamily: fonts.medium,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Submitted by Garage
                        </Text>
                        <Text
                          style={{
                            fontSize: 14.5,
                            color: theme.colors.text,
                            fontFamily: fonts.bold,
                            marginTop: 1,
                          }}
                          numberOfLines={1}
                        >
                          {svc.garageName || 'Unknown Garage'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                        <Text style={{ fontSize: 15, color: theme.colors.primary, fontFamily: fonts.extraBold }}>
                          £{Number(svc.price || 45).toFixed(2)}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: theme.colors.placeholder, fontFamily: fonts.medium }}>
                          {svc.duration || 45} mins
                        </Text>
                      </View>
                    </View>

                    {svc.description && svc.description.trim() ? (
                      <Text style={[styles.approvalDesc, { color: theme.colors.placeholder }]}>
                        "{svc.description}"
                      </Text>
                    ) : null}

                    {/* Action Buttons */}
                    <View style={styles.approvalActionRow}>
                      <TouchableOpacity
                        style={[styles.rejectBtn, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}
                        onPress={() => handleOpenRejectModal(svc)}
                        disabled={isActioning}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="close" size={16} color="#DC2626" style={{ marginRight: 4 }} />
                        <Text style={[styles.rejectBtnText, { color: '#DC2626' }]}>Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.approveBtn, { backgroundColor: '#10B981' }]}
                        onPress={() => handleApproveCustomService(svc)}
                        disabled={isActioning}
                        activeOpacity={0.8}
                      >
                        {isActioning ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.approveBtnText}>Approve</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ─── ADD / EDIT CATEGORY MODAL ─── */}
      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.modalHeaderIcon, { backgroundColor: catBg }]}>
                  <MaterialCommunityIcons name={(catIcon || 'shape-plus') as any} size={20} color={catColor} />
                </View>
                <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>
                  {editingCatId ? 'Edit Service Category' : 'Add Service Category'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Live Preview Card */}
              <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 0 }]}>Live Preview</Text>
              <View style={[styles.previewCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                <View style={[styles.previewIconCircle, { backgroundColor: catBg }]}>
                  <MaterialCommunityIcons name={(catIcon || 'wrench') as any} size={24} color={catColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.previewName, { color: theme.colors.text }]} numberOfLines={1}>
                    {catName.trim() || 'Category Name Preview'}
                  </Text>
                  <Text style={[styles.previewSub, { color: theme.colors.placeholder }]}>
                    Icon: {catIcon} • Accent: {catColor}
                  </Text>
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 14 }]}>Category Name *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g. Tyres, Air Conditioning, Brakes..."
                placeholderTextColor={theme.colors.placeholder}
                value={catName}
                onChangeText={handleCatNameChange}
                maxLength={40}
              />

              {/* Color Theme Selector */}
              <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 14 }]}>Icon & Accent Color</Text>
              <View style={styles.colorPaletteRow}>
                {PRESET_COLORS.map((item) => {
                  const isSelected = catColor.toLowerCase() === item.color.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={item.color}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: item.color },
                        isSelected && styles.colorSwatchSelected,
                      ]}
                      onPress={() => handleSelectColor(item.color, item.bg)}
                      activeOpacity={0.8}
                    >
                      {isSelected && (
                        <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Icon Grid Selector */}
              <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 14 }]}>Choose Category Icon</Text>
              <View style={styles.iconGrid}>
                {PRESET_ICONS.map((item) => {
                  const isSelected = catIcon === item.name;
                  return (
                    <TouchableOpacity
                      key={item.name}
                      style={[
                        styles.iconTile,
                        {
                          backgroundColor: isSelected ? catBg : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                          borderColor: isSelected ? catColor : 'transparent',
                        },
                      ]}
                      onPress={() => handleSelectIcon(item.name)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={item.name as any}
                        size={22}
                        color={isSelected ? catColor : theme.colors.placeholder}
                      />
                      <Text
                        style={[
                          styles.iconTileText,
                          { color: isSelected ? catColor : theme.colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 14 }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInputMulti, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Brief description for garages & customer filters..."
                placeholderTextColor={theme.colors.placeholder}
                value={catDescription}
                onChangeText={setCatDescription}
                multiline
                numberOfLines={3}
                maxLength={160}
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setCategoryModalVisible(false)}
                disabled={savingCategory}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveCategory}
                disabled={savingCategory}
              >
                {savingCategory ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>
                    {editingCatId ? 'Save Changes' : 'Create Category'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── ADD PLATFORM SERVICE MODAL ─── */}
      <Modal
        visible={serviceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setServiceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>Add Platform Service</Text>
              </View>
              <TouchableOpacity onPress={() => setServiceModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {serviceCategories.map((c) => {
                  const isSel = svcCategory === c.name;
                  return (
                    <TouchableOpacity
                      key={c.name}
                      onPress={() => setSvcCategory(c.name)}
                      style={[
                        styles.catPillBtn,
                        {
                          backgroundColor: isSel ? theme.colors.primary : theme.colors.background,
                          borderColor: isSel ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 13, fontFamily: fonts.semiBold, color: isSel ? '#FFFFFF' : theme.colors.text }}>
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Service Name *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g. Major Service, 4-Wheel Alignment..."
                placeholderTextColor={theme.colors.placeholder}
                value={svcName}
                onChangeText={setSvcName}
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Default Price (£) *</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="45.00"
                    placeholderTextColor={theme.colors.placeholder}
                    keyboardType="numeric"
                    value={svcPrice}
                    onChangeText={setSvcPrice}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Duration (Mins) *</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="45"
                    placeholderTextColor={theme.colors.placeholder}
                    keyboardType="numeric"
                    value={svcDuration}
                    onChangeText={setSvcDuration}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 14 }]}>Description</Text>
              <TextInput
                style={[styles.textInputMulti, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="What is included in this service..."
                placeholderTextColor={theme.colors.placeholder}
                value={svcDescription}
                onChangeText={setSvcDescription}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setServiceModalVisible(false)}
                disabled={savingService}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveService}
                disabled={savingService}
              >
                {savingService ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Create Service</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── REJECT CUSTOM SERVICE MODAL ─── */}
      <Modal
        visible={rejectModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.modalHeaderIcon, { backgroundColor: '#EF444415' }]}>
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color="#DC2626" />
                </View>
                <Text style={[styles.modalHeaderTitle, { color: theme.colors.text }]}>Reject Service</Text>
              </View>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: theme.colors.text, marginBottom: 4 }}>
                Rejecting: <Text style={{ fontFamily: fonts.bold, color: theme.colors.primary }}>{rejectingSvc?.name}</Text>
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: theme.colors.placeholder, marginBottom: 14, lineHeight: 18 }}>
                Submitted by <Text style={{ fontFamily: fonts.bold, color: theme.colors.text }}>{rejectingSvc?.garageName || 'Garage'}</Text>. Please specify the reason for rejection (this will be visible to the garage admin).
              </Text>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Quick Presets</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {REJECTION_PRESETS.map((preset) => {
                  const isSelected = rejectReason === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1,
                        backgroundColor: isSelected ? '#EF444415' : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                        borderColor: isSelected ? '#EF4444' : theme.colors.border,
                      }}
                      onPress={() => setRejectReason(preset)}
                    >
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: isSelected ? '#DC2626' : theme.colors.text }}>
                        {preset}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Rejection Reason / Note *</Text>
              <TextInput
                style={[styles.textInputMulti, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Reason for rejecting this service..."
                placeholderTextColor={theme.colors.placeholder}
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  { backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
                ]}
                onPress={handleConfirmReject}
              >
                <MaterialCommunityIcons name="close" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalSaveBtnText}>Confirm Rejection</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 1,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  headerAddBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  tabBarWrap: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  activeTabItem: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  badgePill: {
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 12,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    marginBottom: 14,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  sectionSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 2,
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  loaderWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  categoryCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  threeDotsBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryMenuPopup: {
    position: 'absolute',
    top: 50,
    right: 10,
    minWidth: 128,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 4,
    elevation: 0,
    zIndex: 999,
  },
  categoryMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryMenuText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  categoryMenuDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryInfoCol: {
    flex: 1,
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  categoryName: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  categoryDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 3,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  serviceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  serviceInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  serviceTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    flex: 1,
  },
  servicePrice: {
    fontFamily: fonts.bold,
    fontSize: 14,
    marginLeft: 6,
  },
  categoryTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryTagText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  serviceDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 4,
  },
  approvalCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  approvalTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  approvalTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  pendingBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  garageNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  approvalDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  approvalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  rejectBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  modalBody: {
    padding: 18,
  },
  inputLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  textInputMulti: {
    height: 80,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlignVertical: 'top',
  },
  catPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  previewIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  previewSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 6,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    transform: [{ scale: 1.15 }],
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  iconTile: {
    width: (width - 36 - 24) / 4,
    height: 60,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconTileText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    marginTop: 3,
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSaveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
