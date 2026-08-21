import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';

interface SearchableDropdownProps {
  placeholder: string;
  selectedValue: string;
  onValueChange: (value: string) => void;
  fetchItems: (search: string, page: number) => Promise<{ items: string[]; hasMore: boolean }>;
  disabled?: boolean;
}

export default function SearchableDropdown({
  placeholder,
  selectedValue,
  onValueChange,
  fetchItems,
  disabled = false,
}: SearchableDropdownProps) {
  const { theme } = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state and fetch first page
  const openModal = () => {
    if (disabled) return;
    setSearchQuery('');
    setItems([]);
    setPage(1);
    setHasMore(true);
    setModalVisible(true);
    loadData('', 1, true);
  };

  const loadData = async (search: string, currentPage: number, isInitial: boolean = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = await fetchItems(search, currentPage);
      if (isInitial) {
        setItems(result.items);
      } else {
        setItems((prev) => [...prev, ...result.items]);
      }
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error fetching dropdown items:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Debounced search trigger
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      loadData(text, 1, true);
    }, 400);
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(searchQuery, nextPage, false);
  };

  const selectItem = (item: string) => {
    onValueChange(item);
    setModalVisible(false);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={openModal}
        disabled={disabled}
        style={[
          styles.dropdownButton,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
          disabled && styles.disabledButton,
        ]}
      >
        <Text
          style={[
            styles.selectedText,
            { color: selectedValue ? theme.colors.text : theme.colors.placeholder },
          ]}
          numberOfLines={1}
        >
          {selectedValue || placeholder}
        </Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={disabled ? theme.colors.border : theme.colors.placeholder}
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalContent, { backgroundColor: theme.colors.card }]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                Select {placeholder}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={theme.colors.placeholder}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder={`Search ${placeholder.toLowerCase()}...`}
                placeholderTextColor={theme.colors.placeholder}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearchChange('')} style={styles.clearSearchBtn}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={theme.colors.placeholder} />
                </TouchableOpacity>
              )}
            </View>

            {/* Content List */}
            {loading && page === 1 ? (
              <View style={styles.centerSpinner}>
                <ActivityIndicator size="large" color={theme.colors.secondary} />
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item, index) => `${item}_${index}`}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.2}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = item.toUpperCase() === selectedValue.toUpperCase();
                  return (
                    <TouchableOpacity
                      activeOpacity={0.6}
                      onPress={() => selectItem(item)}
                      style={[
                        styles.itemRow,
                        { borderBottomColor: theme.colors.background },
                        isSelected && { backgroundColor: theme.colors.secondary + '10' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.itemText,
                          { color: theme.colors.text },
                          isSelected && { color: theme.colors.secondary, fontWeight: 'bold' },
                        ]}
                      >
                        {item}
                      </Text>
                      {isSelected && (
                        <MaterialCommunityIcons name="check" size={18} color={theme.colors.secondary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>
                      No {placeholder.toLowerCase()}s found.
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  loadingMore ? (
                    <View style={styles.footerSpinner}>
                      <ActivityIndicator size="small" color={theme.colors.secondary} />
                    </View>
                  ) : null
                }
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  dropdownButton: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disabledButton: {
    opacity: 0.55,
  },
  selectedText: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    paddingBottom: Platform.OS === 'ios' ? 0 : 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    height: '100%',
  },
  clearSearchBtn: {
    padding: 4,
  },
  centerSpinner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  itemText: {
    fontSize: 14,
    flex: 1,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  footerSpinner: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
