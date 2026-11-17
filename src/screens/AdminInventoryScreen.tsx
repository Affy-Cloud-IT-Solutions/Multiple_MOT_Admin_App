import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import {
  useAppValues,
  InventoryItem,
  DynamicInventoryCategory,
} from '../context/DataContext';
import HeaderMenuButton from '../components/HeaderMenuButton';
import { fonts } from '../theme/theme';

const { width } = Dimensions.get('window');

const DEFAULT_UNITS = [
  'piece',
  'set',
  'pair',
  'litre',
  'bottle',
  'can',
  'kg',
  'box',
  'metre',
  'kit',
];

// Aesthetic category badge colors based on category name
function getCategoryColor(name: string): { icon: string; color: string; bg: string } {
  const lower = (name || '').toLowerCase();
  if (lower.includes('brake')) return { icon: 'car-brake-alert', color: '#E11D48', bg: '#FFE4E6' };
  if (lower.includes('oil') || lower.includes('fluid')) return { icon: 'oil', color: '#D97706', bg: '#FEF3C7' };
  if (lower.includes('filter')) return { icon: 'air-filter', color: '#0284C7', bg: '#E0F2FE' };
  if (lower.includes('tyre') || lower.includes('wheel')) return { icon: 'tire', color: '#7C3AED', bg: '#EDE9FE' };
  if (lower.includes('battery') || lower.includes('electric') || lower.includes('light'))
    return { icon: 'car-battery', color: '#EA580C', bg: '#FFEDD5' };
  if (lower.includes('suspension') || lower.includes('steer'))
    return { icon: 'car-traction-control', color: '#059669', bg: '#D1FAE5' };
  if (lower.includes('exhaust') || lower.includes('emission'))
    return { icon: 'smoke', color: '#475569', bg: '#F1F5F9' };
  if (lower.includes('belt') || lower.includes('chain'))
    return { icon: 'link-variant', color: '#0D9488', bg: '#CCFBF1' };
  if (lower.includes('wiper') || lower.includes('wash'))
    return { icon: 'wiper', color: '#2563EB', bg: '#DBEAFE' };
  if (lower.includes('fastener') || lower.includes('clip') || lower.includes('bolt'))
    return { icon: 'screw-machine-round-top', color: '#64748B', bg: '#F1F5F9' };
  if (lower.includes('tool')) return { icon: 'tools', color: '#4F46E5', bg: '#EEF2FF' };
  return { icon: 'package-variant', color: '#6366F1', bg: '#EEF2FF' };
}

export default function AdminInventoryScreen({ navigation }: any) {
  const { theme, isDarkMode } = useAppTheme();
  const {
    inventoryItems,
    inventoryStats,
    loadingInventory,
    dynamicCategories,
    fetchInventory,
    fetchInventoryStats,
    fetchDynamicCategories,
    createDynamicCategory,
    addSubCategoryToCategory,
    addInventoryItem,
    updateInventoryItem,
    adjustInventoryStock,
    deleteInventoryItem,
  } = useAppValues();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive' | 'Out of Stock'>('all');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'name' | 'stockAsc' | 'stockDesc' | 'valDesc'>('updatedAt');
  const [refreshing, setRefreshing] = useState(false);

  // Item Modal State
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  // Form Fields (Item Name, SKU, Brand, Category, Sub Category, Unit, Status, Description, Stock Quantity, Purchase Price, Selling Price)
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubCategory, setFormSubCategory] = useState('');
  const [formUnit, setFormUnit] = useState('piece');
  const [customUnitInput, setCustomUnitInput] = useState('');
  const [isCustomUnitActive, setIsCustomUnitActive] = useState(false);
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive' | 'Out of Stock'>('Active');
  const [formDescription, setFormDescription] = useState('');
  const [formQuantity, setFormQuantity] = useState('0');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');

  // Quick Inline Category/SubCategory Creation inside Item Modal
  const [inlineNewCatActive, setInlineNewCatActive] = useState(false);
  const [inlineNewCatInput, setInlineNewCatInput] = useState('');
  const [inlineNewSubActive, setInlineNewSubActive] = useState(false);
  const [inlineNewSubInput, setInlineNewSubInput] = useState('');

  // Quick Adjustment Modal State
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('1');
  const [adjustAction, setAdjustAction] = useState<'RESTOCK' | 'USED_IN_JOB' | 'AUDIT_ADJUSTMENT' | 'DAMAGE_WASTE'>('RESTOCK');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  // History Detail Modal
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      await Promise.all([
        fetchInventory({
          search: searchQuery,
          category: selectedCategory,
          status: statusFilter,
        }),
        fetchInventoryStats(),
        fetchDynamicCategories(),
      ]);
    } catch (e) {
      // Handled in context
    }
  }, [fetchInventory, fetchInventoryStats, fetchDynamicCategories, searchQuery, selectedCategory, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // When category filter changes, reset sub-category filter to ALL
  const handleSelectCategory = (catName: string) => {
    setSelectedCategory(catName);
    setSelectedSubCategory('ALL');
  };

  // Get active subcategories list for currently selected category filter
  const currentCategoryObj = useMemo(() => {
    if (selectedCategory === 'ALL') return null;
    return (dynamicCategories || []).find((c) => c.name === selectedCategory) || null;
  }, [selectedCategory, dynamicCategories]);

  // Sub-categories available for the category chosen in the Item Form
  const formCategoryObj = useMemo(() => {
    if (!formCategory) return null;
    return (dynamicCategories || []).find((c) => c.name === formCategory) || null;
  }, [formCategory, dynamicCategories]);

  // Derived Dynamic Statistics (Exact 5 user KPIs: item, active, inactive, out of stock, stock value)
  const stats = useMemo(() => {
    if (inventoryStats) {
      return {
        totalItems: inventoryStats.totalItems ?? inventoryItems.length,
        activeCount: inventoryStats.activeCount ?? inventoryItems.filter((i) => i.status === 'Active' && (i.quantity ?? 0) > 0).length,
        inactiveCount: inventoryStats.inactiveCount ?? inventoryItems.filter((i) => i.status === 'Inactive').length,
        outOfStockCount: inventoryStats.outOfStockCount ?? inventoryItems.filter((i) => i.status === 'Out of Stock' || (i.quantity ?? 0) <= 0).length,
        stockValue: inventoryStats.stockValue ?? inventoryItems.reduce((acc, i) => acc + (i.quantity || 0) * (i.sellingPrice || 0), 0),
      };
    }
    const totalItems = inventoryItems.length;
    let activeCount = 0;
    let inactiveCount = 0;
    let outOfStockCount = 0;
    let stockValue = 0;

    for (const item of inventoryItems) {
      const qty = item.quantity || 0;
      const price = item.sellingPrice || 0;
      stockValue += qty * price;

      if (item.status === 'Inactive') {
        inactiveCount++;
      } else if (item.status === 'Out of Stock' || qty <= 0) {
        outOfStockCount++;
      } else {
        activeCount++;
      }
    }

    return {
      totalItems,
      activeCount,
      inactiveCount,
      outOfStockCount,
      stockValue,
    };
  }, [inventoryStats, inventoryItems]);

  // Dynamically Filter & Sort Items
  const filteredAndSortedItems = useMemo(() => {
    let list = [...(inventoryItems || [])];

    // 1. Category Filter
    if (selectedCategory !== 'ALL') {
      list = list.filter((i) => (i.category || '').toLowerCase() === selectedCategory.toLowerCase());
    }

    // 2. Sub-Category Filter
    if (selectedSubCategory !== 'ALL') {
      list = list.filter((i) => (i.subCategory || '').toLowerCase() === selectedSubCategory.toLowerCase());
    }

    // 3. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'Active') {
        list = list.filter((i) => i.status === 'Active' && (i.quantity ?? 0) > 0);
      } else if (statusFilter === 'Inactive') {
        list = list.filter((i) => i.status === 'Inactive');
      } else if (statusFilter === 'Out of Stock') {
        list = list.filter((i) => i.status === 'Out of Stock' || (i.quantity ?? 0) <= 0);
      }
    }

    // 4. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          (i.name && i.name.toLowerCase().includes(q)) ||
          (i.sku && i.sku.toLowerCase().includes(q)) ||
          (i.partNumber && i.partNumber.toLowerCase().includes(q)) ||
          (i.brand && i.brand.toLowerCase().includes(q)) ||
          (i.category && i.category.toLowerCase().includes(q)) ||
          (i.subCategory && i.subCategory.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    // 5. Dynamic Sorting
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'stockAsc') {
        return (a.quantity ?? 0) - (b.quantity ?? 0);
      }
      if (sortBy === 'stockDesc') {
        return (b.quantity ?? 0) - (a.quantity ?? 0);
      }
      if (sortBy === 'valDesc') {
        const valA = (a.quantity ?? 0) * (a.sellingPrice ?? 0);
        const valB = (b.quantity ?? 0) * (b.sellingPrice ?? 0);
        return valB - valA;
      }
      // default: updatedAt desc
      const dateA = new Date(a.updatedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || 0).getTime();
      return dateB - dateA;
    });

    return list;
  }, [inventoryItems, selectedCategory, selectedSubCategory, statusFilter, searchQuery, sortBy]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormSku('');
    setFormBrand('');
    const initialCat = dynamicCategories.length > 0 ? dynamicCategories[0].name : '';
    setFormCategory(initialCat);
    setFormSubCategory('');
    setFormUnit('piece');
    setIsCustomUnitActive(false);
    setCustomUnitInput('');
    setFormStatus('Active');
    setFormDescription('');
    setFormQuantity('0');
    setFormCostPrice('');
    setFormSellingPrice('');
    setInlineNewCatActive(!initialCat);
    setInlineNewSubActive(false);
    setItemModalVisible(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormName(item.name || '');
    setFormSku(item.sku || item.partNumber || '');
    setFormBrand(item.brand || '');
    setFormCategory(item.category || (dynamicCategories.length > 0 ? dynamicCategories[0].name : ''));
    setFormSubCategory(item.subCategory || '');

    const isKnownUnit = DEFAULT_UNITS.includes(item.unit || '');
    if (!isKnownUnit && item.unit) {
      setFormUnit('__CUSTOM__');
      setIsCustomUnitActive(true);
      setCustomUnitInput(item.unit);
    } else {
      setFormUnit(item.unit || 'piece');
      setIsCustomUnitActive(false);
      setCustomUnitInput('');
    }

    setFormStatus(item.status || ((item.quantity ?? 0) <= 0 ? 'Out of Stock' : 'Active'));
    setFormDescription(item.description || '');
    setFormQuantity(String(item.quantity ?? 0));
    setFormCostPrice(item.costPrice !== undefined && item.costPrice !== null ? String(item.costPrice) : '');
    setFormSellingPrice(String(item.sellingPrice ?? ''));
    setInlineNewCatActive(false);
    setInlineNewSubActive(false);
    setItemModalVisible(true);
  };

  // Save Item (Create or Update)
  const handleSaveItem = async () => {
    if (!formName.trim()) {
      Alert.alert('Required Field', 'Please enter an Item Name.');
      return;
    }
    if (!formSku.trim()) {
      Alert.alert('Required Field', 'Please enter a SKU / Part Number.');
      return;
    }
    if (!formCategory.trim()) {
      Alert.alert('Required Field', 'Please select or create a Category.');
      return;
    }

    const sellingPriceNum = parseFloat(formSellingPrice);
    if (isNaN(sellingPriceNum) || sellingPriceNum < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid Selling Price.');
      return;
    }

    const qtyNum = parseFloat(formQuantity);
    if (isNaN(qtyNum) || qtyNum < 0) {
      Alert.alert('Invalid Quantity', 'Stock Quantity must be 0 or higher.');
      return;
    }

    const costPriceNum = formCostPrice.trim() ? parseFloat(formCostPrice) : 0;
    if (isNaN(costPriceNum) || costPriceNum < 0) {
      Alert.alert('Invalid Price', 'Purchase price must be a positive number if provided.');
      return;
    }

    const finalUnit = isCustomUnitActive ? customUnitInput.trim().toLowerCase() || 'piece' : formUnit;

    setSavingItem(true);
    try {
      const payload: Partial<InventoryItem> = {
        name: formName.trim(),
        sku: formSku.trim(),
        partNumber: formSku.trim(),
        brand: formBrand.trim(),
        category: formCategory.trim(),
        subCategory: formSubCategory.trim(),
        unit: finalUnit,
        status: formStatus,
        description: formDescription.trim(),
        quantity: qtyNum,
        costPrice: costPriceNum,
        sellingPrice: sellingPriceNum,
      };

      if (editingItem) {
        await updateInventoryItem(editingItem._id || (editingItem as any).id, payload);
        Alert.alert('Saved', `"${formName.trim()}" updated successfully.`);
      } else {
        await addInventoryItem(payload);
        Alert.alert('Created', `"${formName.trim()}" added to inventory.`);
      }

      setItemModalVisible(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save inventory item.');
    } finally {
      setSavingItem(false);
    }
  };

  // Quick Inline Category Addition
  const handleAddInlineCategory = async () => {
    if (!inlineNewCatInput.trim()) return;
    try {
      const created = await createDynamicCategory(inlineNewCatInput.trim());
      setFormCategory(created.name);
      setFormSubCategory('');
      setInlineNewCatInput('');
      setInlineNewCatActive(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not create category');
    }
  };

  // Quick Inline Sub-Category Addition
  const handleAddInlineSubCategory = async () => {
    if (!inlineNewSubInput.trim() || !formCategoryObj) return;
    try {
      await addSubCategoryToCategory(formCategoryObj._id, inlineNewSubInput.trim());
      setFormSubCategory(inlineNewSubInput.trim());
      setInlineNewSubInput('');
      setInlineNewSubActive(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not add sub-category');
    }
  };

  // Open Quick Adjust Modal
  const handleOpenAdjustModal = (item: InventoryItem, defaultAction: 'RESTOCK' | 'USED_IN_JOB' = 'RESTOCK') => {
    setAdjustingItem(item);
    setAdjustDelta('1');
    setAdjustAction(defaultAction);
    setAdjustReason(defaultAction === 'RESTOCK' ? 'Replenished from supplier' : 'Job service installation');
    setAdjustModalVisible(true);
  };

  // Submit Quick Adjust
  const handleSaveAdjust = async () => {
    if (!adjustingItem) return;
    const deltaNum = parseFloat(adjustDelta);
    if (isNaN(deltaNum) || deltaNum === 0) {
      Alert.alert('Invalid Input', 'Adjustment quantity must be greater than 0.');
      return;
    }

    const finalDelta =
      adjustAction === 'RESTOCK' || (adjustAction === 'AUDIT_ADJUSTMENT' && deltaNum > 0)
        ? Math.abs(deltaNum)
        : -Math.abs(deltaNum);

    if (adjustingItem.quantity + finalDelta < 0) {
      Alert.alert(
        'Insufficient Stock',
        `Cannot deduct ${Math.abs(finalDelta)} units. Current stock is ${adjustingItem.quantity} ${adjustingItem.unit}.`
      );
      return;
    }

    setAdjusting(true);
    try {
      await adjustInventoryStock(
        adjustingItem._id || (adjustingItem as any).id,
        finalDelta,
        adjustAction,
        adjustReason.trim()
      );
      setAdjustModalVisible(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Adjustment Failed', err.message || 'Could not update stock.');
    } finally {
      setAdjusting(false);
    }
  };

  // Delete Item
  const handleDeleteItem = (item: InventoryItem) => {
    Alert.alert(
      'Remove Inventory Item',
      `Are you sure you want to remove "${item.name}"? It will be archived from active stock.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInventoryItem(item._id || (item as any).id);
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete item.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Top Navbar: Compact with strictly "+ Add Part" on top right */}
      <View style={[styles.navbar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <HeaderMenuButton style={{ marginRight: 8 }} />
          <View>
            <Text style={[styles.navTitle, { color: theme.colors.text }]}>Inventory & Stock</Text>
            <Text style={[styles.navSubtitle, { color: theme.colors.placeholder }]}>
              {stats.totalItems} Items • £{stats.stockValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Top Right: ONLY the "+ Add Part" button */}
        <TouchableOpacity
          style={[styles.addPartBtn, { backgroundColor: theme.colors.primary }]}
          onPress={handleOpenCreateModal}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.addPartBtnText}>Add Part</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ======================================================== */}
        {/* COMPACT KPI DASHBOARD: 5 STATS (NO PROFIT!)             */}
        {/* 1. Item, 2. Active, 3. Inactive, 4. Out of Stock, 5. Stock Value */}
        {/* ======================================================== */}
        <View style={styles.kpiContainer}>
          {/* Top Row: Stock Value & Total Items */}
          <View style={styles.kpiTopRow}>
            {/* Stock Value */}
            <View
              style={[
                styles.kpiMainCard,
                {
                  backgroundColor: isDarkMode ? '#1E1B4B' : '#EEF2FF',
                  borderColor: isDarkMode ? '#4338CA' : '#C7D2FE',
                },
              ]}
            >
              <View style={styles.kpiMiniHeader}>
                <MaterialCommunityIcons name="currency-gbp" size={13} color="#6366F1" />
                <Text style={[styles.kpiMiniLabel, { color: isDarkMode ? '#C7D2FE' : '#4F46E5' }]}>
                  Stock Value
                </Text>
              </View>
              <Text style={[styles.kpiValueMain, { color: isDarkMode ? '#FFFFFF' : '#1E1B4B' }]}>
                £{stats.stockValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>

            {/* Total Items */}
            <View
              style={[
                styles.kpiMainCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.kpiMiniHeader}>
                <MaterialCommunityIcons name="package-variant-closed" size={13} color="#3B82F6" />
                <Text style={[styles.kpiMiniLabel, { color: theme.colors.placeholder }]}>
                  Total Items
                </Text>
              </View>
              <Text style={[styles.kpiValueMain, { color: theme.colors.text }]}>
                {stats.totalItems}{' '}
                <Text style={{ fontSize: 10, fontFamily: fonts.medium, color: theme.colors.placeholder }}>
                  SKUs
                </Text>
              </Text>
            </View>
          </View>

          {/* Bottom Row: 3 Compact Status Badges (Active, Inactive, Out of Stock) */}
          <View style={styles.kpiBottomRow}>
            {/* Active */}
            <View style={[styles.kpiStatusChip, { backgroundColor: '#10B98112', borderColor: '#10B98135' }]}>
              <View style={[styles.kpiDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.kpiStatusLabel, { color: '#10B981' }]}>Active:</Text>
              <Text style={[styles.kpiStatusVal, { color: '#10B981' }]}>{stats.activeCount}</Text>
            </View>

            {/* Inactive */}
            <View style={[styles.kpiStatusChip, { backgroundColor: '#6B728012', borderColor: '#6B728035' }]}>
              <View style={[styles.kpiDot, { backgroundColor: '#6B7280' }]} />
              <Text style={[styles.kpiStatusLabel, { color: '#6B7280' }]}>Inactive:</Text>
              <Text style={[styles.kpiStatusVal, { color: '#6B7280' }]}>{stats.inactiveCount}</Text>
            </View>

            {/* Out of Stock */}
            <View
              style={[
                styles.kpiStatusChip,
                {
                  backgroundColor: stats.outOfStockCount > 0 ? '#EF444415' : '#6B728010',
                  borderColor: stats.outOfStockCount > 0 ? '#EF444450' : '#6B728030',
                },
              ]}
            >
              <View
                style={[
                  styles.kpiDot,
                  { backgroundColor: stats.outOfStockCount > 0 ? '#EF4444' : '#6B7280' },
                ]}
              />
              <Text
                style={[
                  styles.kpiStatusLabel,
                  { color: stats.outOfStockCount > 0 ? '#EF4444' : '#6B7280' },
                ]}
              >
                Out of Stock:
              </Text>
              <Text
                style={[
                  styles.kpiStatusVal,
                  { color: stats.outOfStockCount > 0 ? '#EF4444' : '#6B7280' },
                ]}
              >
                {stats.outOfStockCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Compact Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={17} color={theme.colors.placeholder} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search part name, SKU, brand, category, shelf..."
              placeholderTextColor={theme.colors.placeholder}
              style={[styles.searchInput, { color: theme.colors.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Compact Status Filter Pills */}
        <View style={styles.statusPillsRow}>
          {(['all', 'Active', 'Inactive', 'Out of Stock'] as const).map((st) => {
            const isSel = statusFilter === st;
            let count = stats.totalItems;
            let activeColor = theme.colors.primary;
            if (st === 'Active') {
              count = stats.activeCount;
              activeColor = '#10B981';
            } else if (st === 'Inactive') {
              count = stats.inactiveCount;
              activeColor = '#6B7280';
            } else if (st === 'Out of Stock') {
              count = stats.outOfStockCount;
              activeColor = '#EF4444';
            }

            return (
              <TouchableOpacity
                key={st}
                style={[
                  styles.statusPill,
                  isSel
                    ? { backgroundColor: activeColor, borderColor: activeColor }
                    : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
                onPress={() => setStatusFilter(st)}
              >
                <Text style={[styles.statusPillText, { color: isSel ? '#FFFFFF' : theme.colors.text }]}>
                  {st === 'all' ? 'All' : st} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dynamic Category Chips (Compact Horizontal Scroll) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {/* ALL Chip */}
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === 'ALL'
                ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => handleSelectCategory('ALL')}
          >
            <Text
              style={[
                styles.categoryChipText,
                {
                  color: selectedCategory === 'ALL' ? '#FFFFFF' : theme.colors.text,
                  fontFamily: selectedCategory === 'ALL' ? fonts.bold : fonts.medium,
                },
              ]}
            >
              All ({stats.totalItems})
            </Text>
          </TouchableOpacity>

          {/* Dynamic Categories from DB */}
          {dynamicCategories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            const meta = getCategoryColor(cat.name);
            const itemCount = inventoryItems.filter(
              (i) => (i.category || '').toLowerCase() === cat.name.toLowerCase()
            ).length;

            return (
              <TouchableOpacity
                key={cat._id}
                style={[
                  styles.categoryChip,
                  isSelected
                    ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                    : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
                onPress={() => handleSelectCategory(cat.name)}
              >
                <MaterialCommunityIcons
                  name={meta.icon as any}
                  size={12}
                  color={isSelected ? '#FFFFFF' : theme.colors.placeholder}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color: isSelected ? '#FFFFFF' : theme.colors.text,
                      fontFamily: isSelected ? fonts.bold : fonts.medium,
                    },
                  ]}
                >
                  {cat.name} {itemCount > 0 ? `(${itemCount})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sub-Category Chips Row (Shown when selected category has subcategories) */}
        {currentCategoryObj && currentCategoryObj.subCategories && currentCategoryObj.subCategories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subCategoryScroll}>
            <TouchableOpacity
              style={[
                styles.subCatChip,
                selectedSubCategory === 'ALL'
                  ? { backgroundColor: theme.colors.primary + '25', borderColor: theme.colors.primary }
                  : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
              ]}
              onPress={() => setSelectedSubCategory('ALL')}
            >
              <Text
                style={[
                  styles.subCatChipText,
                  {
                    color: selectedSubCategory === 'ALL' ? theme.colors.primary : theme.colors.placeholder,
                    fontFamily: selectedSubCategory === 'ALL' ? fonts.bold : fonts.regular,
                  },
                ]}
              >
                All {currentCategoryObj.name}
              </Text>
            </TouchableOpacity>

            {currentCategoryObj.subCategories.map((sub) => {
              const isSelected = selectedSubCategory === sub;
              return (
                <TouchableOpacity
                  key={sub}
                  style={[
                    styles.subCatChip,
                    isSelected
                      ? { backgroundColor: theme.colors.primary + '25', borderColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  ]}
                  onPress={() => setSelectedSubCategory(sub)}
                >
                  <Text
                    style={[
                      styles.subCatChipText,
                      {
                        color: isSelected ? theme.colors.primary : theme.colors.text,
                        fontFamily: isSelected ? fonts.bold : fonts.medium,
                      },
                    ]}
                  >
                    {sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Compact Sort Row */}
        <View style={styles.sortBarRow}>
          <Text style={[styles.sortBarLabel, { color: theme.colors.placeholder }]}>Sort:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
            {[
              { id: 'updatedAt', label: 'Recent' },
              { id: 'name', label: 'Name (A-Z)' },
              { id: 'stockAsc', label: 'Stock (Low)' },
              { id: 'stockDesc', label: 'Stock (High)' },
              { id: 'valDesc', label: 'Value (£)' },
            ].map((s) => {
              const active = sortBy === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.sortChip,
                    active
                      ? { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  ]}
                  onPress={() => setSortBy(s.id as any)}
                >
                  <Text style={[styles.sortChipText, { color: active ? theme.colors.primary : theme.colors.placeholder }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Items List or Empty State */}
        {loadingInventory && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>Loading inventory...</Text>
          </View>
        ) : filteredAndSortedItems.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <MaterialCommunityIcons name="package-variant" size={40} color={theme.colors.placeholder} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Items Found</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.placeholder }]}>
              {searchQuery || selectedCategory !== 'ALL' || statusFilter !== 'all'
                ? 'Try adjusting your search filters or status.'
                : 'Your catalog is empty. Click "+ Add Part" to add items.'}
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.emptyAddBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleOpenCreateModal}
              >
                <MaterialCommunityIcons name="plus" size={15} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Add First Part</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {filteredAndSortedItems.map((item) => {
              const catMeta = getCategoryColor(item.category);
              const isOut = item.status === 'Out of Stock' || (item.quantity ?? 0) <= 0;
              const isInactive = item.status === 'Inactive';
              const isLow = !isOut && !isInactive && (item.quantity ?? 0) <= (item.minStockThreshold ?? 3);
              const itemStockVal = (item.quantity || 0) * (item.sellingPrice || 0);

              return (
                <View
                  key={item._id || (item as any).id}
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: isOut
                        ? '#EF444450'
                        : isInactive
                        ? '#6B728035'
                        : isLow
                        ? '#F59E0B50'
                        : theme.colors.border,
                    },
                  ]}
                >
                  {/* Top Card Row */}
                  <View style={styles.itemCardTop}>
                    <View style={[styles.itemCategoryIconBox, { backgroundColor: catMeta.bg }]}>
                      <MaterialCommunityIcons name={catMeta.icon as any} size={18} color={catMeta.color} />
                    </View>

                    <View style={styles.itemTitleBlock}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.itemName, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>

                        {/* Status Badge */}
                        <View
                          style={[
                            styles.stockStatusBadge,
                            isOut
                              ? { backgroundColor: '#EF444415', borderColor: '#EF444440' }
                              : isInactive
                              ? { backgroundColor: '#6B728015', borderColor: '#6B728040' }
                              : { backgroundColor: '#10B98115', borderColor: '#10B98140' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.stockStatusText,
                              {
                                color: isOut ? '#EF4444' : isInactive ? '#6B7280' : '#10B981',
                              },
                            ]}
                          >
                            {item.status || (isOut ? 'Out of Stock' : 'Active')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.subMetaRow}>
                        {item.brand ? (
                          <Text style={[styles.itemBrandText, { color: theme.colors.placeholder }]}>
                            {item.brand} •{' '}
                          </Text>
                        ) : null}
                        {(item.sku || item.partNumber) ? (
                          <View style={[styles.skuBadge, { backgroundColor: theme.colors.border + '40' }]}>
                            <Text style={[styles.skuText, { color: theme.colors.text }]}>
                              {item.sku || item.partNumber}
                            </Text>
                          </View>
                        ) : null}
                        {item.category ? (
                          <View style={[styles.catBadge, { backgroundColor: catMeta.color + '15' }]}>
                            <Text style={[styles.catBadgeText, { color: catMeta.color }]}>
                              {item.category}
                              {item.subCategory ? ` > ${item.subCategory}` : ''}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Quantity & Actions Row */}
                  <View style={[styles.quantityRow, { borderTopColor: theme.colors.border + '30' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Text style={[styles.qtyLabel, { color: theme.colors.placeholder }]}>Qty:</Text>
                      <Text
                        style={[
                          styles.qtyNumber,
                          {
                            color: isOut
                              ? '#EF4444'
                              : isInactive
                              ? '#6B7280'
                              : isLow
                              ? '#F59E0B'
                              : theme.colors.text,
                          },
                        ]}
                      >
                        {item.quantity}
                      </Text>
                      <Text style={[styles.qtyUnit, { color: theme.colors.placeholder }]}>{item.unit}s</Text>
                      {isLow ? <Text style={styles.minWarnText}>(Min: {item.minStockThreshold})</Text> : null}
                    </View>

                    {/* Quick +/- Action Buttons */}
                    <View style={styles.quickActionGroup}>
                      <TouchableOpacity
                        style={[styles.quickQtyBtn, { borderColor: theme.colors.border }]}
                        onPress={() => handleOpenAdjustModal(item, 'USED_IN_JOB')}
                        disabled={(item.quantity ?? 0) <= 0}
                      >
                        <MaterialCommunityIcons
                          name="minus"
                          size={14}
                          color={(item.quantity ?? 0) <= 0 ? theme.colors.placeholder : '#EF4444'}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.quickQtyBtn,
                          { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' },
                        ]}
                        onPress={() => handleOpenAdjustModal(item, 'RESTOCK')}
                      >
                        <MaterialCommunityIcons name="plus" size={14} color={theme.colors.primary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickQtyBtn, { borderColor: theme.colors.border }]}
                        onPress={() => {
                          setHistoryItem(item);
                          setHistoryModalVisible(true);
                        }}
                      >
                        <MaterialCommunityIcons name="history" size={14} color={theme.colors.placeholder} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickQtyBtn, { borderColor: theme.colors.border }]}
                        onPress={() => handleOpenEditModal(item)}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={14} color={theme.colors.text} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickQtyBtn, { borderColor: theme.colors.border }]}
                        onPress={() => handleDeleteItem(item)}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Financial Row: Selling Price, Purchase Price, Stock Value (No Profit!) */}
                  <View style={[styles.financialRow, { backgroundColor: theme.colors.background + '60' }]}>
                    <View style={styles.financialCol}>
                      <Text style={[styles.finLabel, { color: theme.colors.placeholder }]}>Selling Price</Text>
                      <Text style={[styles.finVal, { color: theme.colors.primary }]}>
                        £{(item.sellingPrice || 0).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.financialCol}>
                      <Text style={[styles.finLabel, { color: theme.colors.placeholder }]}>Purchase Price</Text>
                      <Text style={[styles.finVal, { color: theme.colors.placeholder }]}>
                        {item.costPrice !== undefined && item.costPrice > 0
                          ? `£${Number(item.costPrice).toFixed(2)}`
                          : '—'}
                      </Text>
                    </View>

                    <View style={[styles.financialCol, { alignItems: 'flex-end' }]}>
                      <Text style={[styles.finLabel, { color: theme.colors.placeholder }]}>Stock Value</Text>
                      <Text style={[styles.finVal, { color: theme.colors.text, fontFamily: fonts.bold }]}>
                        £{itemStockVal.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ======================================================== */}
      {/* ADD / EDIT ITEM MODAL                                    */}
      {/* Fields: name, sku, brand, category (+ inline create),   */}
      {/* subCategory (+ inline create), unit, status, description, */}
      {/* stock quantity, purchase price, selling price            */}
      {/* ======================================================== */}
      <Modal visible={itemModalVisible} animationType="slide" transparent={true} onRequestClose={() => setItemModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  {editingItem ? 'Edit Item' : 'Add New Part'}
                </Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                  Specify product details, pricing and initial stock
                </Text>
              </View>
              <TouchableOpacity onPress={() => setItemModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalFormContent}>
              {/* Field 1: Item Name * */}
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Item Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g. Brembo Front Brake Pad Set"
                placeholderTextColor={theme.colors.placeholder}
                value={formName}
                onChangeText={setFormName}
              />

              {/* Field 2 & 3: SKU * & Brand Name (Optional) */}
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>SKU / Part Number *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="e.g. BP-8842"
                    placeholderTextColor={theme.colors.placeholder}
                    value={formSku}
                    onChangeText={setFormSku}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Brand Name (Optional)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="e.g. Bosch, Castrol"
                    placeholderTextColor={theme.colors.placeholder}
                    value={formBrand}
                    onChangeText={setFormBrand}
                  />
                </View>
              </View>

              {/* Field 4: Category * (Selected from Dynamic Categories + Quick Inline Add) */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <Text style={[styles.inputLabel, { color: theme.colors.text, marginBottom: 0 }]}>Category *</Text>
                <TouchableOpacity onPress={() => setInlineNewCatActive(!inlineNewCatActive)}>
                  <Text style={{ color: theme.colors.primary, fontSize: 11, fontFamily: fonts.semiBold }}>
                    {inlineNewCatActive ? 'Cancel' : '+ New Category'}
                  </Text>
                </TouchableOpacity>
              </View>

              {inlineNewCatActive && (
                <View style={styles.inlineAddRow}>
                  <TextInput
                    style={[styles.inlineInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.primary, color: theme.colors.text }]}
                    placeholder="New category name..."
                    placeholderTextColor={theme.colors.placeholder}
                    value={inlineNewCatInput}
                    onChangeText={setInlineNewCatInput}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.inlineAddBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={handleAddInlineCategory}
                  >
                    <Text style={styles.inlineAddBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              )}

              {dynamicCategories.length === 0 ? (
                <View style={{ marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.placeholder, fontSize: 11 }}>
                    No categories created yet. Click "+ New Category" above to create one.
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {dynamicCategories.map((c) => {
                    const isSel = formCategory === c.name;
                    return (
                      <TouchableOpacity
                        key={c._id}
                        style={[
                          styles.unitChip,
                          isSel
                            ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                            : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                        ]}
                        onPress={() => {
                          setFormCategory(c.name);
                          setFormSubCategory('');
                        }}
                      >
                        <Text
                          style={{
                            color: isSel ? '#FFFFFF' : theme.colors.text,
                            fontSize: 11,
                            fontFamily: fonts.semiBold,
                          }}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Field 5: Sub-Category (Optional, from category's sub-categories + Quick Inline Add) */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <Text style={[styles.inputLabel, { color: theme.colors.text, marginBottom: 0 }]}>
                  Sub-Category (Optional)
                </Text>
                {formCategoryObj && (
                  <TouchableOpacity onPress={() => setInlineNewSubActive(!inlineNewSubActive)}>
                    <Text style={{ color: theme.colors.primary, fontSize: 11, fontFamily: fonts.semiBold }}>
                      {inlineNewSubActive ? 'Cancel' : '+ New Sub-Category'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {inlineNewSubActive && formCategoryObj && (
                <View style={styles.inlineAddRow}>
                  <TextInput
                    style={[styles.inlineInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.primary, color: theme.colors.text }]}
                    placeholder={`New sub-category for ${formCategory}...`}
                    placeholderTextColor={theme.colors.placeholder}
                    value={inlineNewSubInput}
                    onChangeText={setInlineNewSubInput}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.inlineAddBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={handleAddInlineSubCategory}
                  >
                    <Text style={styles.inlineAddBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              )}

              {formCategoryObj && formCategoryObj.subCategories && formCategoryObj.subCategories.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.unitChip,
                      !formSubCategory
                        ? { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                        : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                    ]}
                    onPress={() => setFormSubCategory('')}
                  >
                    <Text style={{ color: !formSubCategory ? theme.colors.primary : theme.colors.placeholder, fontSize: 11 }}>
                      None
                    </Text>
                  </TouchableOpacity>

                  {formCategoryObj.subCategories.map((sub) => {
                    const isSel = formSubCategory === sub;
                    return (
                      <TouchableOpacity
                        key={sub}
                        style={[
                          styles.unitChip,
                          isSel
                            ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                            : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                        ]}
                        onPress={() => setFormSubCategory(sub)}
                      >
                        <Text style={{ color: isSel ? '#FFFFFF' : theme.colors.text, fontSize: 11, fontFamily: fonts.medium }}>
                          {sub}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="e.g. Brake Pads, Front Blades"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formSubCategory}
                  onChangeText={setFormSubCategory}
                />
              )}

              {/* Field 6: Unit * */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Unit *</Text>
                {isCustomUnitActive && (
                  <TouchableOpacity onPress={() => setIsCustomUnitActive(false)}>
                    <Text style={{ color: theme.colors.primary, fontSize: 11, fontFamily: fonts.semiBold }}>
                      ← Standard Units
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {isCustomUnitActive ? (
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.primary, color: theme.colors.text }]}
                  placeholder="Type unit (e.g. metre, roll, tub)"
                  placeholderTextColor={theme.colors.placeholder}
                  value={customUnitInput}
                  onChangeText={setCustomUnitInput}
                  autoFocus
                />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {DEFAULT_UNITS.map((u) => {
                    const isSel = formUnit === u && !isCustomUnitActive;
                    return (
                      <TouchableOpacity
                        key={u}
                        style={[
                          styles.unitChip,
                          isSel
                            ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                            : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                        ]}
                        onPress={() => {
                          setFormUnit(u);
                          setIsCustomUnitActive(false);
                        }}
                      >
                        <Text style={{ color: isSel ? '#FFFFFF' : theme.colors.text, fontSize: 11, fontFamily: fonts.semiBold }}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.unitChip, { backgroundColor: '#6366F115', borderColor: '#6366F150' }]}
                    onPress={() => {
                      setIsCustomUnitActive(true);
                      setFormUnit('__CUSTOM__');
                    }}
                  >
                    <Text style={{ color: '#6366F1', fontSize: 11, fontFamily: fonts.bold }}>+ Custom</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}

              {/* Field 7: Status * (Active, Inactive, Out of Stock) */}
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Status *</Text>
              <View style={styles.statusButtonGroup}>
                {[
                  { id: 'Active', label: 'Active', icon: 'check-circle-outline', activeColor: '#10B981' },
                  { id: 'Inactive', label: 'Inactive', icon: 'pause-circle-outline', activeColor: '#6B7280' },
                  { id: 'Out of Stock', label: 'Out of Stock', icon: 'alert-circle-outline', activeColor: '#EF4444' },
                ].map((s) => {
                  const isSel = formStatus === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.statusSelectBtn,
                        isSel
                          ? { backgroundColor: s.activeColor, borderColor: s.activeColor }
                          : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                      ]}
                      onPress={() => setFormStatus(s.id as any)}
                    >
                      <MaterialCommunityIcons
                        name={s.icon as any}
                        size={14}
                        color={isSel ? '#FFFFFF' : s.activeColor}
                      />
                      <Text style={[styles.statusSelectBtnText, { color: isSel ? '#FFFFFF' : theme.colors.text }]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Field 8: Description (Optional) */}
              <Text style={[styles.inputLabel, { color: theme.colors.text, marginTop: 10 }]}>
                Description (Optional)
              </Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                multiline
                numberOfLines={2}
                placeholder="Item specification or notes..."
                placeholderTextColor={theme.colors.placeholder}
                value={formDescription}
                onChangeText={setFormDescription}
              />

              {/* Field 9: Stock Quantity * */}
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Stock Quantity *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.placeholder}
                value={formQuantity}
                onChangeText={setFormQuantity}
              />

              {/* Field 10 & 11: Purchase Price (Optional) & Selling Price * */}
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Purchase Price (£) (Optional)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.placeholder}
                    value={formCostPrice}
                    onChangeText={setFormCostPrice}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Selling Price (£) *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.placeholder}
                    value={formSellingPrice}
                    onChangeText={setFormSellingPrice}
                  />
                </View>
              </View>

              {/* Submit Save Button */}
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveItem}
                disabled={savingItem}
              >
                {savingItem ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>{editingItem ? 'Update Part' : 'Add Part'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* QUICK STOCK ADJUSTMENT MODAL                             */}
      {/* ======================================================== */}
      <Modal visible={adjustModalVisible} animationType="fade" transparent={true} onRequestClose={() => setAdjustModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.smallModalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Stock Adjustment</Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                  {adjustingItem?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAdjustModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 14 }}>
              <View style={[styles.adjustCurrentBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Text style={[styles.adjustCurrentLabel, { color: theme.colors.placeholder }]}>Current In Stock</Text>
                <Text style={[styles.adjustCurrentVal, { color: theme.colors.text }]}>
                  {adjustingItem?.quantity} {adjustingItem?.unit}s
                </Text>
              </View>

              <View style={styles.actionTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.actionTypeBtn,
                    adjustAction === 'RESTOCK'
                      ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                      : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  ]}
                  onPress={() => {
                    setAdjustAction('RESTOCK');
                    setAdjustReason('Replenished from supplier');
                  }}
                >
                  <MaterialCommunityIcons
                    name="plus-circle-outline"
                    size={14}
                    color={adjustAction === 'RESTOCK' ? '#FFFFFF' : '#10B981'}
                  />
                  <Text style={[styles.actionTypeBtnText, { color: adjustAction === 'RESTOCK' ? '#FFFFFF' : '#10B981' }]}>
                    Restock (+)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionTypeBtn,
                    adjustAction === 'USED_IN_JOB'
                      ? { backgroundColor: '#EF4444', borderColor: '#EF4444' }
                      : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  ]}
                  onPress={() => {
                    setAdjustAction('USED_IN_JOB');
                    setAdjustReason('Job installation');
                  }}
                >
                  <MaterialCommunityIcons
                    name="minus-circle-outline"
                    size={14}
                    color={adjustAction === 'USED_IN_JOB' ? '#FFFFFF' : '#EF4444'}
                  />
                  <Text style={[styles.actionTypeBtnText, { color: adjustAction === 'USED_IN_JOB' ? '#FFFFFF' : '#EF4444' }]}>
                    Deduct (-)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionTypeBtn,
                    adjustAction === 'AUDIT_ADJUSTMENT'
                      ? { backgroundColor: '#6366F1', borderColor: '#6366F1' }
                      : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  ]}
                  onPress={() => {
                    setAdjustAction('AUDIT_ADJUSTMENT');
                    setAdjustReason('Stock count audit');
                  }}
                >
                  <MaterialCommunityIcons
                    name="clipboard-check-outline"
                    size={14}
                    color={adjustAction === 'AUDIT_ADJUSTMENT' ? '#FFFFFF' : '#6366F1'}
                  />
                  <Text style={[styles.actionTypeBtnText, { color: adjustAction === 'AUDIT_ADJUSTMENT' ? '#FFFFFF' : '#6366F1' }]}>
                    Audit
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Units to Change</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                keyboardType="numeric"
                value={adjustDelta}
                onChangeText={setAdjustDelta}
                placeholder="1"
                placeholderTextColor={theme.colors.placeholder}
              />

              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Audit Reason / Note</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                value={adjustReason}
                onChangeText={setAdjustReason}
                placeholder="e.g. Booking #10432, Weekly delivery"
                placeholderTextColor={theme.colors.placeholder}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.colors.primary, marginTop: 4 }]}
                onPress={handleSaveAdjust}
                disabled={adjusting}
              >
                {adjusting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Apply Live Adjustment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* AUDIT HISTORY MODAL                                      */}
      {/* ======================================================== */}
      <Modal visible={historyModalVisible} animationType="slide" transparent={true} onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Stock Movement Log</Text>
                <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                  {historyItem?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={18} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 14 }}>
              {!historyItem?.history || historyItem.history.length === 0 ? (
                <Text style={{ color: theme.colors.placeholder, textAlign: 'center', paddingVertical: 18 }}>
                  No movement history recorded yet.
                </Text>
              ) : (
                historyItem.history
                  .slice()
                  .reverse()
                  .map((h, idx) => (
                    <View
                      key={idx}
                      style={[styles.historyItemRow, { borderBottomColor: theme.colors.border + '40' }]}
                    >
                      <View style={styles.historyLeft}>
                        <View
                          style={[
                            styles.historyIconCircle,
                            {
                              backgroundColor: h.quantityChange > 0 ? '#10B98118' : '#EF444418',
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={h.quantityChange > 0 ? 'arrow-down-bold' : 'arrow-up-bold'}
                            size={12}
                            color={h.quantityChange > 0 ? '#10B981' : '#EF4444'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.historyAction, { color: theme.colors.text }]}>
                            {h.reason || h.action}
                          </Text>
                          <Text style={[styles.historySub, { color: theme.colors.placeholder }]}>
                            By {h.performedByName || 'Staff'} •{' '}
                            {new Date(h.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Text
                          style={[
                            styles.historyChangeText,
                            { color: h.quantityChange > 0 ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          {h.quantityChange > 0 ? `+${h.quantityChange}` : h.quantityChange} {historyItem.unit}
                        </Text>
                        <Text style={[styles.historyAfterText, { color: theme.colors.placeholder }]}>
                          Bal: {h.quantityAfter}
                        </Text>
                      </View>
                    </View>
                  ))
              )}
            </ScrollView>
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  navSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 10,
    marginTop: 1,
  },
  addPartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    gap: 4,
  },
  addPartBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  kpiContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
  },
  kpiTopRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiMainCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  kpiMiniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  kpiMiniLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  kpiValueMain: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  kpiBottomRow: {
    flexDirection: 'row',
    gap: 6,
  },
  kpiStatusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 7,
    borderWidth: 1,
    gap: 4,
  },
  kpiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kpiStatusLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  kpiStatusVal: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  searchContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingVertical: 0,
  },
  statusPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  categoryScroll: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 11,
  },
  subCategoryScroll: {
    paddingHorizontal: 14,
    paddingBottom: 4,
    gap: 5,
  },
  subCatChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  subCatChipText: {
    fontSize: 10,
  },
  sortBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 6,
  },
  sortBarLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  sortChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  sortChipText: {
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  loadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  emptyBox: {
    marginHorizontal: 14,
    marginTop: 16,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 12,
    lineHeight: 16,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    gap: 5,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  itemsList: {
    paddingHorizontal: 14,
    paddingTop: 4,
    gap: 8,
  },
  itemCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
  },
  itemCategoryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitleBlock: {
    flex: 1,
  },
  itemName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    flex: 1,
    marginRight: 6,
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  itemBrandText: {
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  skuBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  skuText: {
    fontFamily: fonts.semiBold,
    fontSize: 9,
  },
  catBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  catBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 9,
  },
  stockStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  stockStatusText: {
    fontFamily: fonts.bold,
    fontSize: 9,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  qtyLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  qtyNumber: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
  },
  qtyUnit: {
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  minWarnText: {
    color: '#F59E0B',
    fontFamily: fonts.medium,
    fontSize: 9,
  },
  quickActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickQtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  financialRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000008',
  },
  financialCol: {
    flex: 1,
  },
  finLabel: {
    fontFamily: fonts.medium,
    fontSize: 8,
    marginBottom: 1,
  },
  finVal: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    maxHeight: '90%',
  },
  smallModalCard: {
    margin: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000010',
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  modalSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 10,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 3,
  },
  modalFormContent: {
    padding: 16,
    paddingBottom: 36,
  },
  inputLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    marginBottom: 4,
  },
  input: {
    height: 38,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginBottom: 10,
  },
  textArea: {
    height: 52,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 6,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginBottom: 10,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 5,
  },
  statusButtonGroup: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 3,
  },
  statusSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    gap: 4,
  },
  statusSelectBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  inlineAddRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  inlineInput: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 11,
  },
  inlineAddBtn: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineAddBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  adjustCurrentBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    alignItems: 'center',
  },
  adjustCurrentLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  adjustCurrentVal: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    marginTop: 1,
  },
  actionTypeRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  actionTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    gap: 3,
  },
  actionTypeBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  historyItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  historyIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyAction: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  historySub: {
    fontFamily: fonts.regular,
    fontSize: 9,
    marginTop: 1,
  },
  historyChangeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  historyAfterText: {
    fontFamily: fonts.regular,
    fontSize: 9,
    marginTop: 1,
  },
});
