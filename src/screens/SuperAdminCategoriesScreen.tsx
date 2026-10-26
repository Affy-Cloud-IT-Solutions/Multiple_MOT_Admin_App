import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, ServiceCategory } from '../context/DataContext';

const { width } = Dimensions.get('window');

const PRESET_ICONS = [
  { name: 'shield-check', label: 'MOT' },
  { name: 'car-cog', label: 'Servicing' },
  { name: 'tire', label: 'Tyres' },
  { name: 'hammer-wrench', label: 'Repairs' },
  { name: 'car-brake-alert', label: 'Brakes' },
  { name: 'engine', label: 'Diagnostics' },
  { name: 'car-battery', label: 'Battery' },
  { name: 'snowflake', label: 'Air Con' },
  { name: 'pipe', label: 'Exhaust' },
  { name: 'car-wash', label: 'Valeting' },
  { name: 'car-electric', label: 'EV/Hybrid' },
  { name: 'wrench', label: 'General' },
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
    deleteServiceCategory,
  } = useAppValues();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('shield-check');
  const [formColor, setFormColor] = useState('#1677FF');
  const [formBg, setFormBg] = useState('#1677FF15');

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      await fetchServiceCategories();
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchServiceCategories]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCategories();
  };

  const handleOpenAdd = () => {
    setFormName('');
    setFormDescription('');
    setFormIcon('wrench');
    setFormColor('#1677FF');
    setFormBg('#1677FF15');
    setModalVisible(true);
  };

  const handleSelectColor = (color: string, bg: string) => {
    setFormColor(color);
    setFormBg(bg);
  };

  const handleSaveCategory = async () => {
    const cleanName = formName.trim();
    if (!cleanName || cleanName.length < 2) {
      Alert.alert('Validation Error', 'Category name is required (minimum 2 characters).');
      return;
    }

    setSaving(true);
    try {
      await createServiceCategory({
        name: cleanName,
        description: formDescription.trim(),
        icon: formIcon,
        iconColor: formColor,
        iconBg: formBg,
      });

      Alert.alert('Success', `Category "${cleanName}" has been added! Garages can now add custom services under this category.`);
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = (category: ServiceCategory) => {
    const catId = category._id || category.id;
    if (!catId) return;

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?\n\nGarages and customers will no longer see this category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(catId);
            try {
              await deleteServiceCategory(catId);
              Alert.alert('Deleted', `Category "${category.name}" was removed.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete category.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* ─── Top Header ─── */}
      <View style={[styles.headerBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Service Categories</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.placeholder }]}>
            Super Admin Category Manager
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
          onPress={handleOpenAdd}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
      >

        {/* Categories Count Header */}
        <View style={styles.countRow}>
          <Text style={[styles.countText, { color: theme.colors.placeholder }]}>
            Active Categories ({serviceCategories.length})
          </Text>
          <TouchableOpacity onPress={onRefresh} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="refresh" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '600' }}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Categories List */}
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
              Tap "Add" above to create the first service category.
            </Text>
          </View>
        ) : (
          serviceCategories.map((cat, idx) => {
            const catId = cat._id || cat.id || `cat_${idx}`;
            const isDeleting = deletingId === catId;

            return (
              <View
                key={catId}
                style={[
                  styles.categoryCard,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
              >
                {/* Category Icon */}
                <View style={[styles.categoryIconCircle, { backgroundColor: cat.iconBg || '#1677FF15' }]}>
                  <MaterialCommunityIcons
                    name={(cat.icon || 'wrench') as any}
                    size={24}
                    color={cat.iconColor || theme.colors.primary}
                  />
                </View>

                {/* Details */}
                <View style={styles.categoryInfoCol}>
                  <View style={styles.categoryNameRow}>
                    <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                      {cat.name}
                    </Text>
                    {cat.isDefault && (
                      <View style={[styles.defaultBadge, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
                        <Text style={[styles.defaultBadgeText, { color: '#10B981' }]}>Default</Text>
                      </View>
                    )}
                  </View>

                  {cat.description ? (
                    <Text style={[styles.categoryDesc, { color: theme.colors.placeholder }]} numberOfLines={2}>
                      {cat.description}
                    </Text>
                  ) : (
                    <Text style={[styles.categoryDesc, { color: theme.colors.placeholder, fontStyle: 'italic' }]}>
                      No description provided
                    </Text>
                  )}
                </View>

                {/* Delete Action */}
                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: '#EF444415' }]}
                  onPress={() => handleDeleteCategory(cat)}
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
      </ScrollView>

      {/* ─── ADD CATEGORY MODAL ─── */}
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
                <View style={[styles.modalHeaderIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="shape-plus" size={20} color={theme.colors.primary} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={[styles.modalTitle, { color: theme.colors.text }]}>New Service Category</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                    Visible across Super Admin, Garages & Customers
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormContent} showsVerticalScrollIndicator={false}>
              {/* Category Name */}
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Category Name *</Text>
              <TextInput
                style={[
                  styles.formInput,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  },
                ]}
                placeholder="e.g. Diagnostics, Windscreen, Detailing..."
                placeholderTextColor={theme.colors.placeholder}
                value={formName}
                onChangeText={setFormName}
              />

              {/* Description */}
              <Text style={[styles.fieldLabel, { color: theme.colors.text, marginTop: 14 }]}>
                Description (Optional)
              </Text>
              <TextInput
                style={[
                  styles.formTextArea,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                    color: theme.colors.text,
                    borderColor: theme.colors.border,
                  },
                ]}
                placeholder="Brief summary of services belonging to this category..."
                placeholderTextColor={theme.colors.placeholder}
                multiline
                numberOfLines={2}
                value={formDescription}
                onChangeText={setFormDescription}
              />

              {/* Icon Picker */}
              <Text style={[styles.fieldLabel, { color: theme.colors.text, marginTop: 14 }]}>Category Icon</Text>
              <View style={styles.iconGrid}>
                {PRESET_ICONS.map((item) => {
                  const isSelected = formIcon === item.name;
                  return (
                    <TouchableOpacity
                      key={item.name}
                      onPress={() => setFormIcon(item.name)}
                      style={[
                        styles.iconGridItem,
                        {
                          backgroundColor: isSelected ? formBg : (isDarkMode ? '#1E293B' : '#F1F5F9'),
                          borderColor: isSelected ? formColor : theme.colors.border,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.name as any}
                        size={22}
                        color={isSelected ? formColor : theme.colors.placeholder}
                      />
                      <Text
                        style={[
                          styles.iconGridLabel,
                          { color: isSelected ? formColor : theme.colors.placeholder },
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Color Swatches */}
              <Text style={[styles.fieldLabel, { color: theme.colors.text, marginTop: 14 }]}>Badge Color</Text>
              <View style={styles.colorRow}>
                {PRESET_COLORS.map((item) => {
                  const isSelected = formColor === item.color;
                  return (
                    <TouchableOpacity
                      key={item.color}
                      onPress={() => handleSelectColor(item.color, item.bg)}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: item.color },
                        isSelected && styles.colorSwatchSelected,
                      ]}
                    >
                      {isSelected && <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Live Preview */}
              <Text style={[styles.fieldLabel, { color: theme.colors.text, marginTop: 16 }]}>Customer UI Preview</Text>
              <View style={[styles.previewCard, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: theme.colors.border }]}>
                <View style={[styles.previewIconCircle, { backgroundColor: formBg, borderColor: formColor + '40' }]}>
                  <MaterialCommunityIcons name={formIcon as any} size={26} color={formColor} />
                  <View style={[styles.previewArrowBadge, { backgroundColor: formColor }]}>
                    <MaterialCommunityIcons name="arrow-right" size={9} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={[styles.previewTitle, { color: theme.colors.text }]}>
                  {formName.trim() || 'Category Name'}
                </Text>
                <View style={[styles.previewSelectPill, { backgroundColor: formBg, borderColor: formColor + '30' }]}>
                  <Text style={[styles.previewSelectText, { color: formColor }]}>Select</Text>
                  <MaterialCommunityIcons name="chevron-right" size={11} color={formColor} />
                </View>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={[styles.modalActionsRow, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={[styles.cancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveCategory}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Category</Text>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loaderWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.8,
  },
  defaultBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  categoryDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 11,
  },
  modalFormContent: {
    padding: 16,
    paddingBottom: 24,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  formInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13.5,
  },
  formTextArea: {
    minHeight: 60,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconGridItem: {
    width: (width - 64) / 4,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGridLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  previewCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  previewIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 6,
  },
  previewArrowBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  previewSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  previewSelectText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1.6,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
