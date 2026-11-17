import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Linking,
  Share,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme/theme';
import { useAppValues, InvoiceLineItem, Invoice, InventoryItem, BASE_URL } from '../context/DataContext';
import { downloadReceiptFile } from '../utils/fileDownloader';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  booking: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function JobSheetInvoiceModal({ visible, booking, onClose, onSuccess }: Props) {
  const { theme } = useAppTheme();
  const {
    inventoryItems,
    fetchInventory,
    fetchBookingInvoice,
    saveBookingInvoice,
    refreshData,
    token,
    currentGarage,
  } = useAppValues();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [vatRate, setVatRate] = useState<number>(20);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'Pending' | 'Paid'>('Pending');
  const [paymentMethod, setPaymentMethod] = useState<'Cash'>('Cash');
  const [invoiceStatus, setInvoiceStatus] = useState<'Draft' | 'Issued' | 'Paid' | 'Cancelled'>('Issued');
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const [invoiceCustMobile, setInvoiceCustMobile] = useState<string>('');
  const [invoiceCustEmail, setInvoiceCustEmail] = useState<string>('');

  // Inventory picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('ALL');

  // Custom Item Modal state
  const [customItemModalVisible, setCustomItemModalVisible] = useState(false);
  const [customDesc, setCustomDesc] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customType, setCustomType] = useState<'SERVICE' | 'LABOUR' | 'OTHER'>('SERVICE');

  const bookingId = booking?.id || booking?._id;
  const normalizedStatus = String(booking?.status || '').toLowerCase().replace(/[\s_-]/g, '');
  const isApproved = normalizedStatus === 'approved' || normalizedStatus === 'confirmed';
  const isInProgress = normalizedStatus === 'inprogress';
  const isCompleted = normalizedStatus === 'completed';

  // Load or synthesize invoice whenever modal opens
  const loadInvoiceData = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      // Ensure latest inventory is loaded for stock availability badges
      fetchInventory().catch(() => {});

      const res = await fetchBookingInvoice(bookingId);
      if (res.invoice) {
        const inv = res.invoice;
        setInvoiceNumber(inv.invoiceNumber || '');
        setItems(Array.isArray(inv.items) ? inv.items : []);
        setNotes(inv.notes || booking?.serviceNotes || '');
        setVatRate(inv.vatRate ?? 20);
        setDiscountAmount(inv.discountAmount || 0);
        setPaymentStatus(inv.paymentStatus === 'Paid' ? 'Paid' : 'Pending');
        setPaymentMethod('Cash');
        setInvoiceStatus(inv.status || 'Issued');
        if (inv.customerMobile) setInvoiceCustMobile(inv.customerMobile);
        if (inv.customerEmail) setInvoiceCustEmail(inv.customerEmail);
      } else if (res.provisional) {
        const prov = res.provisional;
        setInvoiceNumber('');
        setItems(prov.items || []);
        setNotes(booking?.serviceNotes || '');
        setVatRate(prov.vatRate ?? 20);
        setDiscountAmount(0);
        setPaymentStatus('Pending');
        setPaymentMethod('Cash');
        setInvoiceStatus('Draft');
      }
    } catch (err: any) {
      console.error('[JobSheetInvoiceModal] loadInvoice error:', err);
      Alert.alert('Notice', 'Could not fetch existing invoice. Initializing new job sheet.');
      // Fallback: initialize from booking services
      const fallbackItems: InvoiceLineItem[] = [];
      if (Array.isArray(booking?.services) && booking.services.length > 0) {
        booking.services.forEach((s: any) => {
          fallbackItems.push({
            itemType: 'SERVICE',
            description: s.name || 'Vehicle Service',
            quantity: 1,
            unit: 'service',
            unitPrice: Number(s.price) || 0,
            totalPrice: Number(s.price) || 0,
            stockDeducted: false,
            deductedQuantity: 0,
          });
        });
      } else {
        fallbackItems.push({
          itemType: 'SERVICE',
          description: booking?.serviceName || (booking?.hasMot ? 'MOT Test' : 'Vehicle Service'),
          quantity: 1,
          unit: 'service',
          unitPrice: Number(booking?.price) || 0,
          totalPrice: Number(booking?.price) || 0,
          stockDeducted: false,
          deductedQuantity: 0,
        });
      }
      setItems(fallbackItems);
    } finally {
      setLoading(false);
    }
  }, [bookingId, booking, fetchBookingInvoice, fetchInventory]);

  useEffect(() => {
    if (visible && bookingId) {
      loadInvoiceData();
      setViewMode(isCompleted ? 'preview' : 'editor');
    }
  }, [visible, bookingId, isCompleted, loadInvoiceData]);

  // Derived financial calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
  }, [items]);

  const vatAmount = useMemo(() => {
    const taxable = Math.max(0, subtotal - discountAmount);
    return Math.round(taxable * (vatRate / 100) * 100) / 100;
  }, [subtotal, discountAmount, vatRate]);

  const grandTotal = useMemo(() => {
    const taxable = Math.max(0, subtotal - discountAmount);
    return Math.round((taxable + vatAmount) * 100) / 100;
  }, [subtotal, discountAmount, vatAmount]);

  // Update item quantity
  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty <= 0) return;
    const currentItem = items[index];
    if (currentItem?.itemType === 'PART' && currentItem?.inventoryItemId) {
      const invItem = inventoryItems.find(i => i._id.toString() === currentItem.inventoryItemId?.toString());
      if (invItem && newQty > currentItem.quantity) {
        if (newQty > (invItem.quantity ?? 0)) {
          Alert.alert(
            'Stock Limit Exceeded',
            `Only ${invItem.quantity} unit(s) of "${invItem.name}" available in warehouse.`
          );
          return;
        }
      }
    }
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };
      target.quantity = Math.round(newQty * 100) / 100;
      target.totalPrice = Math.round(target.quantity * target.unitPrice * 100) / 100;
      copy[index] = target;
      return copy;
    });
  };

  // Update item price
  const handlePriceChange = (index: number, newPriceStr: string) => {
    const val = parseFloat(newPriceStr) || 0;
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };
      target.unitPrice = Math.max(0, val);
      target.totalPrice = Math.round(target.quantity * target.unitPrice * 100) / 100;
      copy[index] = target;
      return copy;
    });
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Add Part from Inventory
  const handleSelectInventoryPart = (item: InventoryItem) => {
    if (item.status === 'Inactive') {
      Alert.alert('Part Inactive', `"${item.name}" is currently marked inactive and cannot be selected.`);
      return;
    }
    if (item.status === 'Out of Stock' || (item.quantity ?? 0) <= 0) {
      Alert.alert('Out of Stock', `"${item.name}" is out of stock in the warehouse.`);
      return;
    }

    const existingIdx = items.findIndex(
      it => it.itemType === 'PART' && it.inventoryItemId && it.inventoryItemId.toString() === item._id.toString()
    );

    if (existingIdx !== -1) {
      // Check stock before incrementing
      const currentQty = items[existingIdx].quantity;
      if (currentQty + 1 > (item.quantity ?? 0)) {
        Alert.alert('Stock Limit', `Cannot add more units. Only ${item.quantity} units of "${item.name}" available.`);
        return;
      }
      handleQuantityChange(existingIdx, currentQty + 1);
    } else {
      // Add new part item
      const price = Number(item.sellingPrice) || 0;
      const newItem: InvoiceLineItem = {
        itemType: 'PART',
        inventoryItemId: item._id,
        partNumber: item.partNumber || '',
        description: item.name,
        quantity: 1,
        unit: item.unit || 'piece',
        unitPrice: price,
        totalPrice: price,
        stockDeducted: false,
        deductedQuantity: 0,
      };
      setItems(prev => [...prev, newItem]);
    }
    setPickerVisible(false);
  };

  // Add Custom Service / Labour
  const handleAddCustomItem = () => {
    if (!customDesc.trim()) {
      Alert.alert('Required', 'Please enter a description for the service or labour.');
      return;
    }
    const price = Math.max(0, parseFloat(customPrice) || 0);
    const newItem: InvoiceLineItem = {
      itemType: customType,
      description: customDesc.trim(),
      quantity: 1,
      unit: customType === 'LABOUR' ? 'hr' : 'item',
      unitPrice: price,
      totalPrice: price,
      stockDeducted: false,
      deductedQuantity: 0,
    };
    setItems(prev => [...prev, newItem]);
    setCustomDesc('');
    setCustomPrice('');
    setCustomItemModalVisible(false);
  };

  // Core save execution
  const executeSave = async (options: { markStarted?: boolean; markCompleted?: boolean } = {}) => {
    if (!bookingId) return;
    if (items.length === 0) {
      Alert.alert('Empty Job Sheet', 'Please add at least one service or part item to the invoice.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        items,
        notes,
        vatRate,
        discountAmount,
        paymentStatus,
        paymentMethod: 'Cash',
        status: options.markCompleted ? 'Issued' : invoiceStatus,
        markServiceStarted: !!options.markStarted,
        markServiceCompleted: !!options.markCompleted,
      };

      const result = await saveBookingInvoice(bookingId, payload);
      const generatedInv = result.invoice;
      setInvoiceNumber(generatedInv.invoiceNumber);

      if (options.markCompleted) {
        Alert.alert(
          'Service Completed',
          `Service completed! Itemized receipt #${generatedInv.invoiceNumber} (£${generatedInv.grandTotal.toFixed(2)}) has been generated.`,
          [
            {
              text: '📥 Download PDF',
              onPress: () => {
                handleDownloadReceipt();
              },
            },
            {
              text: 'View Receipt',
              onPress: () => {
                setViewMode('preview');
              },
            },
            {
              text: 'Done',
              onPress: () => {
                if (onSuccess) onSuccess();
                onClose();
              },
            },
          ]
        );
      } else {
        const msg = options.markStarted
          ? 'Service started! Vehicle is now In Progress in the workshop.'
          : 'Job sheet and parts saved successfully. Stock updated.';
        Alert.alert('Saved', msg, [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) onSuccess();
              onClose();
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('[JobSheetInvoiceModal] Save error:', error);
      Alert.alert('Save Failed', error?.message || 'Could not save invoice.');
    } finally {
      setSaving(false);
    }
  };

  // Download receipt slip as PDF directly to device Files / Downloads
  const handleDownloadReceipt = async () => {
    const targetId = invoiceNumber || bookingId;
    if (!targetId) {
      Alert.alert('No Receipt', 'Please save or complete the service first to generate the receipt.');
      return;
    }
    const safeName = `Receipt_${(invoiceNumber || bookingId || 'bill').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    const url = `${BASE_URL}/invoices/${targetId}/download?token=${token || ''}`;
    await downloadReceiptFile({
      url,
      fileName: safeName,
      title: `Receipt ${invoiceNumber || ''}`,
      mimeType: 'application/pdf',
    });
  };

  // Plain-text sharing for WhatsApp / SMS / thermal share
  const handleShareReceipt = async () => {
    try {
      const garageName = (currentGarage as any)?.garageName || currentGarage?.name || 'GARAGE WORKSHOP';
      const lines = [
        `================================`,
        `${garageName}`,
        `RECEIPT / TAX INVOICE`,
        `Receipt #: ${invoiceNumber || 'INV-DRAFT'}`,
        `Date: ${new Date().toLocaleDateString('en-GB')}`,
        `Vehicle: ${regText} (${makeModelText})`,
        `Customer: ${customerName}`,
        ...(displayMobile ? [`Phone: ${displayMobile}`] : []),
        ...(displayEmail ? [`Email: ${displayEmail}`] : []),
        `--------------------------------`,
        ...items.map(it => `${it.description} x${it.quantity} - £${Number(it.totalPrice || 0).toFixed(2)}`),
        `--------------------------------`,
        `Subtotal (Excl. VAT): £${subtotal.toFixed(2)}`,
        ...(discountAmount > 0 ? [`Discount: -£${discountAmount.toFixed(2)}`] : []),
        `UK VAT (${vatRate}%): £${vatAmount.toFixed(2)}`,
        `GRAND TOTAL: £${grandTotal.toFixed(2)}`,
        `--------------------------------`,
        `Payment Method: CASH ONLY`,
        `Payment Status: ${paymentStatus === 'Paid' ? 'PAID IN CASH' : 'CASH DUE ON COLLECTION'}`,
        ...(notes ? [`Notes: ${notes}`] : []),
        `================================`,
        `Thank you for choosing ${garageName}!`,
      ];
      await Share.share({
        title: `Receipt #${invoiceNumber || 'INV'} - ${regText}`,
        message: lines.join('\n'),
      });
    } catch (err) {}
  };

  // Filtered inventory items for picker
  const filteredInventory = useMemo(() => {
    return inventoryItems.filter(item => {
      if (pickerCategory !== 'ALL' && item.category !== pickerCategory) {
        return false;
      }
      if (pickerSearch.trim()) {
        const q = pickerSearch.toLowerCase().trim();
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchPart = (item.partNumber || '').toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        return matchName || matchPart || matchCat;
      }
      return true;
    });
  }, [inventoryItems, pickerCategory, pickerSearch]);

  const inventoryCategories = useMemo(() => {
    const set = new Set<string>();
    inventoryItems.forEach(it => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set);
  }, [inventoryItems]);

  const regText = booking?.registrationNumber || booking?.vrn || 'Vehicle';
  const makeModelText = booking?.makeModel || '';
  const customerName =
    booking?.customerName ||
    (booking?.customer ? `${booking.customer.firstName || ''} ${booking.customer.lastName || ''}`.trim() : '') ||
    'Customer';
  const rawCustomerMobile =
    booking?.customerMobile ||
    booking?.customerPhone ||
    booking?.mobile ||
    booking?.phone ||
    booking?.customer?.mobile ||
    booking?.customer?.phone ||
    '';
  const rawCustomerEmail =
    booking?.customerEmail ||
    booking?.email ||
    booking?.customer?.email ||
    '';
  const displayMobile = invoiceCustMobile || rawCustomerMobile;
  const displayEmail = invoiceCustEmail || rawCustomerEmail;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.sheetContainer, { backgroundColor: theme.colors.card }]}>
          {/* Header Bar */}
          <View style={[styles.headerBar, { borderBottomColor: theme.colors.border }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="file-document-edit-outline" size={22} color={theme.colors.secondary} style={{ marginRight: 6 }} />
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Workshop Job Sheet & Invoice</Text>
              </View>
              {invoiceNumber ? (
                <Text style={styles.invoiceNumberPill}>#{invoiceNumber}</Text>
              ) : (
                <Text style={[styles.draftBadge, { color: theme.colors.placeholder }]}>New Draft Job Sheet</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Segmented View Mode Tabs: [ Job Sheet & Parts ] | [ 🧾 Receipt Slip Preview ] */}
          <View style={[styles.viewModeSwitcher, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
            <TouchableOpacity
              onPress={() => setViewMode('editor')}
              style={[
                styles.viewModeTab,
                viewMode === 'editor' && { borderBottomColor: theme.colors.secondary, borderBottomWidth: 2, backgroundColor: theme.colors.card }
              ]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="format-list-checks"
                size={15}
                color={viewMode === 'editor' ? theme.colors.secondary : theme.colors.placeholder}
                style={{ marginRight: 5 }}
              />
              <Text style={[
                styles.viewModeTabText,
                {
                  color: viewMode === 'editor' ? theme.colors.secondary : theme.colors.placeholder,
                  fontFamily: viewMode === 'editor' ? fonts.bold : fonts.medium,
                }
              ]}>
                Job Sheet & Parts ({items.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setViewMode('preview')}
              style={[
                styles.viewModeTab,
                viewMode === 'preview' && { borderBottomColor: '#10B981', borderBottomWidth: 2, backgroundColor: theme.colors.card }
              ]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="receipt"
                size={15}
                color={viewMode === 'preview' ? '#10B981' : theme.colors.placeholder}
                style={{ marginRight: 5 }}
              />
              <Text style={[
                styles.viewModeTabText,
                {
                  color: viewMode === 'preview' ? '#10B981' : theme.colors.placeholder,
                  fontFamily: viewMode === 'preview' ? fonts.bold : fonts.medium,
                }
              ]}>
                🧾 Receipt Slip Preview
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.secondary} />
              <Text style={[styles.loadingText, { color: theme.colors.placeholder }]}>Loading Job Sheet & Stock Data...</Text>
            </View>
          ) : viewMode === 'preview' ? (
            /* ========================================================== */
            /* INLINE LIVE RECEIPT BILL PREVIEW */
            /* ========================================================== */
            <View style={{ flex: 1 }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.receiptScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.receiptPaper}>
                  {/* Garage Header */}
                  <View style={styles.receiptHeader}>
                    <Text style={styles.receiptGarageTitle}>
                      {((currentGarage as any)?.garageName || currentGarage?.name || 'GARAGE WORKSHOP').toUpperCase()}
                    </Text>
                    {currentGarage?.address ? (
                      <Text style={styles.receiptGarageSub}>
                        {[currentGarage.address, currentGarage.city, currentGarage.postcode].filter(Boolean).join(', ')}
                      </Text>
                    ) : null}
                    {currentGarage?.phone ? (
                      <Text style={styles.receiptGarageSub}>Tel: {currentGarage.phone}</Text>
                    ) : null}
                    {currentGarage?.email ? (
                      <Text style={styles.receiptGarageSub}>Email: {currentGarage.email}</Text>
                    ) : null}
                    {currentGarage?.vtsNumber ? (
                      <Text style={styles.receiptGarageSub}>MOT VTS Station: {currentGarage.vtsNumber}</Text>
                    ) : null}
                    <View style={styles.receiptBadgeWrap}>
                      <Text style={styles.receiptBadgeText}>RETAIL CASH RECEIPT & TAX INVOICE</Text>
                    </View>
                  </View>

                  <View style={styles.receiptDashedDivider} />

                  {/* Meta Details */}
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Receipt #:</Text>
                    <Text style={styles.receiptMetaVal} numberOfLines={1}>{invoiceNumber || 'INV-DRAFT'}</Text>
                  </View>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Date & Time:</Text>
                    <Text style={styles.receiptMetaVal}>
                      {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <View style={[styles.receiptMetaRow, { alignItems: 'center', marginTop: 4 }]}>
                    <Text style={styles.receiptMetaKey}>Vehicle VRN:</Text>
                    <View style={styles.receiptVrnBox}>
                      <Text style={styles.receiptVrnText}>{regText}</Text>
                    </View>
                  </View>
                  {makeModelText ? (
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Make / Model:</Text>
                      <Text style={styles.receiptMetaVal} numberOfLines={2}>{makeModelText}</Text>
                    </View>
                  ) : null}
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Customer:</Text>
                    <Text style={styles.receiptMetaVal} numberOfLines={2}>{customerName}</Text>
                  </View>
                  {displayMobile ? (
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Phone / Mobile:</Text>
                      <Text style={styles.receiptMetaVal} numberOfLines={1}>{displayMobile}</Text>
                    </View>
                  ) : null}
                  {displayEmail ? (
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Email:</Text>
                      <Text style={styles.receiptMetaVal} numberOfLines={2}>{displayEmail}</Text>
                    </View>
                  ) : null}

                  <View style={styles.receiptDashedDivider} />

                  {/* Items Table */}
                  <View style={styles.receiptItemHeaderRow}>
                    <Text style={[styles.receiptItemColHeader, { flex: 1 }]}>ITEM / SERVICE</Text>
                    <Text style={[styles.receiptItemColHeader, { width: 56, textAlign: 'right' }]}>PRICE</Text>
                    <Text style={[styles.receiptItemColHeader, { width: 32, textAlign: 'center' }]}>QTY</Text>
                    <Text style={[styles.receiptItemColHeader, { width: 62, textAlign: 'right' }]}>TOTAL</Text>
                  </View>

                  {items.length === 0 ? (
                    <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
                        No items added yet. Switch to "Job Sheet" tab to add parts or services.
                      </Text>
                    </View>
                  ) : (
                    items.map((it, idx) => (
                      <View key={idx} style={styles.receiptItemRow}>
                        <View style={{ flex: 1, paddingRight: 6 }}>
                          <Text style={styles.receiptItemDesc}>{it.description}</Text>
                          {it.partNumber ? (
                            <Text style={styles.receiptItemPartNum}>Part: {it.partNumber}</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.receiptItemPrice, { width: 56 }]}>£{Number(it.unitPrice || 0).toFixed(2)}</Text>
                        <Text style={[styles.receiptItemQty, { width: 32 }]}>{it.quantity}</Text>
                        <Text style={[styles.receiptItemTotal, { width: 62 }]}>£{Number(it.totalPrice || 0).toFixed(2)}</Text>
                      </View>
                    ))
                  )}

                  <View style={styles.receiptDashedDivider} />

                  {/* Totals Breakdown */}
                  <View style={styles.receiptTotalsRow}>
                    <Text style={styles.receiptTotalsKey}>Subtotal (Excl. VAT):</Text>
                    <Text style={styles.receiptTotalsVal}>£{subtotal.toFixed(2)}</Text>
                  </View>
                  {discountAmount > 0 ? (
                    <View style={styles.receiptTotalsRow}>
                      <Text style={[styles.receiptTotalsKey, { color: '#DC2626' }]}>Discount:</Text>
                      <Text style={[styles.receiptTotalsVal, { color: '#DC2626' }]}>-£{discountAmount.toFixed(2)}</Text>
                    </View>
                  ) : null}
                  <View style={styles.receiptTotalsRow}>
                    <Text style={styles.receiptTotalsKey}>Standard UK VAT ({vatRate}%):</Text>
                    <Text style={styles.receiptTotalsVal}>£{vatAmount.toFixed(2)}</Text>
                  </View>

                  <View style={styles.receiptDoubleDivider} />

                  <View style={[styles.receiptTotalsRow, { marginTop: 4 }]}>
                    <Text style={styles.receiptGrandTotalKey}>TOTAL AMOUNT:</Text>
                    <Text style={styles.receiptGrandTotalVal}>£{grandTotal.toFixed(2)}</Text>
                  </View>

                  <View style={[styles.receiptMetaRow, { marginTop: 8, alignItems: 'center' }]}>
                    <Text style={styles.receiptMetaKey}>Payment Method:</Text>
                    <View style={styles.receiptCashTag}>
                      <Text style={styles.receiptCashTagText}>💵 CASH ONLY</Text>
                    </View>
                  </View>

                  <View style={[styles.receiptMetaRow, { marginTop: 4, alignItems: 'center' }]}>
                    <Text style={styles.receiptMetaKey}>Payment Status:</Text>
                    <Text style={[
                      styles.receiptStatusText,
                      { color: paymentStatus === 'Paid' ? '#059669' : '#D97706' }
                    ]}>
                      {paymentStatus === 'Paid' ? 'PAID IN CASH' : 'CASH DUE ON COLLECTION'}
                    </Text>
                  </View>

                  {notes ? (
                    <View style={styles.receiptNotesBox}>
                      <Text style={styles.receiptNotesTitle}>Technician Notes:</Text>
                      <Text style={styles.receiptNotesContent}>{notes}</Text>
                    </View>
                  ) : null}

                  <View style={styles.receiptDashedDivider} />

                  <Text style={styles.receiptFooterText}>
                    Thank you for choosing {((currentGarage as any)?.garageName || currentGarage?.name || 'our workshop')}!{'\n'}
                    Please retain this receipt bill for vehicle warranty & service records.
                  </Text>
                </View>
              </ScrollView>

              {/* Receipt View Bottom Action Bar */}
              <View style={[styles.receiptActionsBar, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                  onPress={handleDownloadReceipt}
                  style={[styles.receiptPrintBtn, { backgroundColor: '#10B981' }]}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="download" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.receiptActionBtnText}>📥 Download Receipt (PDF)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShareReceipt}
                  style={[styles.receiptShareBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="share-variant-outline" size={17} color={theme.colors.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.receiptShareBtnText, { color: theme.colors.text }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
              {/* Vehicle & Customer Identity Card */}
              <View style={[styles.vehicleCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <View style={styles.vehicleHeaderRow}>
                  {/* UK License Plate */}
                  <View style={styles.ukPlate}>
                    <View style={styles.ukFlag}>
                      <Text style={styles.ukFlagText}>🇬🇧</Text>
                      <Text style={styles.ukTag}>UK</Text>
                    </View>
                    <Text style={styles.plateText}>{regText}</Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={[
                      styles.statusPill,
                      { backgroundColor: isCompleted ? '#10B98120' : isInProgress ? '#8B5CF620' : '#1677FF20' }
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        { color: isCompleted ? '#10B981' : isInProgress ? '#8B5CF6' : '#1677FF' }
                      ]}>
                        {booking?.status || 'Scheduled'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={[styles.makeModelText, { color: theme.colors.text }]}>
                    {makeModelText || 'Vehicle Details Not Set'}
                  </Text>
                  <Text style={[styles.customerText, { color: theme.colors.placeholder }]}>
                    👤 {customerName}
                    {displayMobile ? ` • 📞 ${displayMobile}` : ''}
                    {displayEmail ? ` • ✉️ ${displayEmail}` : ''}
                  </Text>
                </View>
              </View>

              {/* Items Section */}
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWrap}>
                  <MaterialCommunityIcons name="format-list-checks" size={17} color={theme.colors.secondary} style={{ marginRight: 5 }} />
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Items & Parts ({items.length})
                  </Text>
                </View>

                <View style={styles.sectionActionBtns}>
                  <TouchableOpacity
                    onPress={() => setPickerVisible(true)}
                    style={[styles.addPartBtn, { backgroundColor: '#10B981' }]}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="cube-send" size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                    <Text style={styles.addPartBtnText}>+ Part</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCustomItemModalVisible(true)}
                    style={[styles.addCustomBtn, { borderColor: theme.colors.secondary, backgroundColor: theme.colors.secondary + '12' }]}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="plus" size={13} color={theme.colors.secondary} style={{ marginRight: 2 }} />
                    <Text style={[styles.addCustomBtnText, { color: theme.colors.secondary }]}>+ Service</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Items Table / List */}
              {items.length === 0 ? (
                <View style={[styles.emptyItemsBox, { borderColor: theme.colors.border }]}>
                  <MaterialCommunityIcons name="cart-off" size={32} color={theme.colors.placeholder} />
                  <Text style={[styles.emptyItemsText, { color: theme.colors.placeholder }]}>
                    No items on this job sheet yet. Add services or parts fitted to this vehicle.
                  </Text>
                </View>
              ) : (
                items.map((item, idx) => {
                  const isPart = item.itemType === 'PART';
                  // Lookup inventory item for real-time stock info
                  const invItem = isPart && item.inventoryItemId
                    ? inventoryItems.find(i => i._id.toString() === item.inventoryItemId?.toString())
                    : null;

                  return (
                    <View
                      key={idx}
                      style={[styles.itemCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    >
                      <View style={styles.itemTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={[
                            styles.itemTypeTag,
                            {
                              backgroundColor: isPart ? '#10B98120' : item.itemType === 'LABOUR' ? '#8B5CF620' : '#1677FF20',
                              borderColor: isPart ? '#10B981' : item.itemType === 'LABOUR' ? '#8B5CF6' : '#1677FF',
                            }
                          ]}>
                            <Text style={[
                              styles.itemTypeTagText,
                              { color: isPart ? '#10B981' : item.itemType === 'LABOUR' ? '#8B5CF6' : '#1677FF' }
                            ]}>
                              {item.itemType}
                            </Text>
                          </View>
                          <Text style={[styles.itemDescription, { color: theme.colors.text }]} numberOfLines={1}>
                            {item.description}
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleRemoveItem(idx)}
                          style={styles.trashBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={17} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      {/* Stock availability badge if part */}
                      {isPart && (
                        <View style={styles.partDetailsRow}>
                          {item.partNumber ? (
                            <Text style={[styles.partNumberText, { color: theme.colors.placeholder }]}>
                              Part #: {item.partNumber}
                            </Text>
                          ) : null}
                          {invItem ? (
                            <View style={[
                              styles.stockBadge,
                              { backgroundColor: invItem.quantity > 0 ? '#10B98115' : '#EF444415' }
                            ]}>
                              <MaterialCommunityIcons
                                name={invItem.quantity > 0 ? 'check-circle' : 'alert-circle'}
                                size={12}
                                color={invItem.quantity > 0 ? '#10B981' : '#EF4444'}
                                style={{ marginRight: 3 }}
                              />
                              <Text style={{
                                fontSize: 10.5,
                                fontFamily: fonts.bold,
                                color: invItem.quantity > 0 ? '#10B981' : '#EF4444',
                              }}>
                                Warehouse: {invItem.quantity} {invItem.unit || 'units'} available
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {/* Price & Quantity Controls */}
                      <View style={styles.itemBottomRow}>
                        <View style={styles.qtyControlRow}>
                          <Text style={[styles.controlLabel, { color: theme.colors.placeholder }]}>Qty:</Text>
                          <TouchableOpacity
                            onPress={() => handleQuantityChange(idx, Math.max(1, item.quantity - 1))}
                            style={[styles.qtyBtn, { borderColor: theme.colors.border }]}
                          >
                            <MaterialCommunityIcons name="minus" size={14} color={theme.colors.text} />
                          </TouchableOpacity>
                          <Text style={[styles.qtyValueText, { color: theme.colors.text }]}>
                            {item.quantity}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleQuantityChange(idx, item.quantity + 1)}
                            style={[styles.qtyBtn, { borderColor: theme.colors.border }]}
                          >
                            <MaterialCommunityIcons name="plus" size={14} color={theme.colors.text} />
                          </TouchableOpacity>
                          <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginLeft: 4 }}>
                            {item.unit || ''}
                          </Text>
                        </View>

                        <View style={styles.priceInputsRow}>
                          <Text style={[styles.controlLabel, { color: theme.colors.placeholder }]}>Unit (£):</Text>
                          <TextInput
                            style={[styles.priceInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            keyboardType="numeric"
                            value={String(item.unitPrice)}
                            onChangeText={(val) => handlePriceChange(idx, val)}
                          />
                          <Text style={[styles.totalPriceText, { color: theme.colors.text }]}>
                            = £{Number(item.totalPrice || 0).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}

              {/* Financial Summary Card */}
              <View style={[styles.summaryCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Text style={[styles.summaryCardTitle, { color: theme.colors.text }]}>Financial Breakdown</Text>
                
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Subtotal (Excl. VAT):</Text>
                  <Text style={[styles.summaryVal, { color: theme.colors.text }]}>£{subtotal.toFixed(2)}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.summaryLabel, { color: theme.colors.placeholder }]}>Standard UK VAT ({vatRate}%):</Text>
                  </View>
                  <Text style={[styles.summaryVal, { color: theme.colors.text }]}>£{vatAmount.toFixed(2)}</Text>
                </View>

                <View style={[styles.summaryRow, styles.grandTotalRow, { borderTopColor: theme.colors.border }]}>
                  <Text style={[styles.grandTotalLabel, { color: theme.colors.text }]}>Grand Total Payable:</Text>
                  <Text style={styles.grandTotalVal}>£{grandTotal.toFixed(2)}</Text>
                </View>
              </View>

              {/* Payment Status & Method Selector */}
              <View style={[styles.settingsCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Text style={[styles.summaryCardTitle, { color: theme.colors.text, marginBottom: 8 }]}>Payment Details</Text>

                <Text style={[styles.inputSubLabel, { color: theme.colors.placeholder }]}>Payment Method:</Text>
                <View style={styles.chipsRow}>
                  <View
                    style={[
                      styles.selectorChip,
                      {
                        backgroundColor: '#10B981',
                        borderColor: '#10B981',
                        flexDirection: 'row',
                        alignItems: 'center',
                      }
                    ]}
                  >
                    <MaterialCommunityIcons name="cash" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={[styles.selectorChipText, { color: '#FFFFFF', fontFamily: fonts.bold }]}>
                      Cash Only
                    </Text>
                  </View>
                </View>

                <Text style={[styles.inputSubLabel, { color: theme.colors.placeholder, marginTop: 8 }]}>Payment Status:</Text>
                <View style={styles.chipsRow}>
                  <TouchableOpacity
                    onPress={() => setPaymentStatus('Paid')}
                    style={[
                      styles.selectorChip,
                      {
                        backgroundColor: paymentStatus === 'Paid' ? '#10B981' : theme.colors.card,
                        borderColor: paymentStatus === 'Paid' ? '#10B981' : theme.colors.border,
                      }
                    ]}
                  >
                    <Text style={[styles.selectorChipText, { color: paymentStatus === 'Paid' ? '#FFFFFF' : theme.colors.text }]}>
                      ✅ Cash Paid
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setPaymentStatus('Pending')}
                    style={[
                      styles.selectorChip,
                      {
                        backgroundColor: paymentStatus === 'Pending' ? '#F59E0B' : theme.colors.card,
                        borderColor: paymentStatus === 'Pending' ? '#F59E0B' : theme.colors.border,
                      }
                    ]}
                  >
                    <Text style={[styles.selectorChipText, { color: paymentStatus === 'Pending' ? '#FFFFFF' : theme.colors.text }]}>
                      ⏳ Cash Due on Collection
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Workshop Technician Notes */}
                <Text style={[styles.inputSubLabel, { color: theme.colors.placeholder, marginTop: 10 }]}>Technician / Service Notes:</Text>
                <TextInput
                  style={[styles.notesInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                  placeholder="Notes for customer (e.g. Brake pads replaced, tyre pressures adjusted to 32 PSI)..."
                  placeholderTextColor={theme.colors.placeholder}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </ScrollView>

            {/* Action Footer Buttons */}
            <View style={[styles.footerBar, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                onPress={() => executeSave()}
                disabled={saving || loading}
                style={[styles.footerSecondaryBtn, { borderColor: theme.colors.border }]}
                activeOpacity={0.7}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <Text style={[styles.footerSecondaryBtnText, { color: theme.colors.text }]}>
                    Save Sheet
                  </Text>
                )}
              </TouchableOpacity>

              {isApproved && (
                <TouchableOpacity
                  onPress={() => executeSave({ markStarted: true })}
                  disabled={saving || loading}
                  style={[styles.footerPrimaryBtn, { backgroundColor: '#8B5CF6' }]}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="play-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.footerPrimaryBtnText}>Start Service</Text>
                </TouchableOpacity>
              )}

              {(!isApproved && !isCompleted) && (
                <TouchableOpacity
                  onPress={() => executeSave({ markCompleted: true })}
                  disabled={saving || loading}
                  style={[styles.footerPrimaryBtn, { backgroundColor: '#10B981' }]}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.footerPrimaryBtnText}>Complete Service</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {isCompleted && (
                <TouchableOpacity
                  onPress={() => executeSave()}
                  disabled={saving || loading}
                  style={[styles.footerPrimaryBtn, { backgroundColor: theme.colors.secondary }]}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="content-save" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.footerPrimaryBtnText}>Update</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

        {/* ============================================================== */}
        {/* SUB-MODAL: LIVE INVENTORY PARTS PICKER */}
        {/* ============================================================== */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={pickerVisible}
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.pickerHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="cube-send" size={20} color="#10B981" style={{ marginRight: 6 }} />
                  <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>Add Part from Inventory</Text>
                </View>
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              {/* Search & Filter */}
              <View style={[styles.pickerSearchRow, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.placeholder} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.pickerSearchInput, { color: theme.colors.text }]}
                  placeholder="Search parts by name, part # or category..."
                  placeholderTextColor={theme.colors.placeholder}
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                />
              </View>

              {/* Category Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                <TouchableOpacity
                  onPress={() => setPickerCategory('ALL')}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: pickerCategory === 'ALL' ? '#10B981' : theme.colors.background,
                      borderColor: pickerCategory === 'ALL' ? '#10B981' : theme.colors.border,
                    }
                  ]}
                >
                  <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: pickerCategory === 'ALL' ? '#FFFFFF' : theme.colors.text }}>
                    All Categories
                  </Text>
                </TouchableOpacity>
                {inventoryCategories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setPickerCategory(cat)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: pickerCategory === cat ? '#10B981' : theme.colors.background,
                        borderColor: pickerCategory === cat ? '#10B981' : theme.colors.border,
                      }
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: pickerCategory === cat ? '#FFFFFF' : theme.colors.text }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Items List */}
              <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={false}>
                {filteredInventory.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>No matching parts found in inventory.</Text>
                  </View>
                ) : (
                  filteredInventory.map(item => {
                    const isInactive = item.status === 'Inactive';
                    const isOutOfStock = item.status === 'Out of Stock' || (item.quantity ?? 0) <= 0;
                    const isUnavailable = isInactive || isOutOfStock;

                    return (
                      <TouchableOpacity
                        key={item._id}
                        disabled={isUnavailable}
                        onPress={() => handleSelectInventoryPart(item)}
                        style={[
                          styles.pickerItemRow,
                          {
                            borderBottomColor: theme.colors.border + '60',
                            opacity: isUnavailable ? 0.45 : 1,
                            backgroundColor: isUnavailable ? (theme.dark ? '#1F293740' : '#F3F4F660') : 'transparent',
                          }
                        ]}
                        activeOpacity={isUnavailable ? 1 : 0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                            <Text
                              style={[
                                styles.pickerItemName,
                                {
                                  color: isUnavailable ? theme.colors.placeholder : theme.colors.text,
                                  textDecorationLine: isUnavailable ? 'line-through' : 'none',
                                }
                              ]}
                            >
                              {item.name}
                            </Text>
                            {isUnavailable && (
                              <View
                                style={[
                                  styles.disabledTag,
                                  { backgroundColor: isInactive ? '#6B728020' : '#EF444420' }
                                ]}
                              >
                                <Text style={{ fontSize: 9, fontFamily: fonts.bold, color: isInactive ? '#6B7280' : '#EF4444' }}>
                                  {isInactive ? 'INACTIVE' : 'OUT OF STOCK'}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            {item.partNumber ? (
                              <Text style={[styles.pickerItemPart, { color: theme.colors.placeholder }]}>
                                Part: {item.partNumber} •{' '}
                              </Text>
                            ) : null}
                            <Text style={{ fontSize: 11, color: theme.colors.placeholder }}>
                              {item.category}
                            </Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                          <Text style={[styles.pickerItemPrice, { color: isUnavailable ? theme.colors.placeholder : theme.colors.text }]}>
                            £{Number(item.sellingPrice || 0).toFixed(2)}
                          </Text>
                          <View style={[
                            styles.stockCountTag,
                            { backgroundColor: isUnavailable ? '#EF444415' : '#10B98115' }
                          ]}>
                            <Text style={{
                              fontSize: 10,
                              fontFamily: fonts.bold,
                              color: isUnavailable ? '#EF4444' : '#10B981'
                            }}>
                              {isInactive ? 'Disabled' : isOutOfStock ? '0 in stock' : `Stock: ${item.quantity} ${item.unit || ''}`}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ============================================================== */}
        {/* SUB-MODAL: ADD CUSTOM SERVICE / LABOUR */}
        {/* ============================================================== */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={customItemModalVisible}
          onRequestClose={() => setCustomItemModalVisible(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>Add Service or Labour</Text>
                <TouchableOpacity onPress={() => setCustomItemModalVisible(false)}>
                  <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {(['SERVICE', 'LABOUR', 'OTHER'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setCustomType(t)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: customType === t ? theme.colors.secondary : theme.colors.background,
                        borderColor: customType === t ? theme.colors.secondary : theme.colors.border,
                      }
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: customType === t ? '#FFFFFF' : theme.colors.text }}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                placeholder="Description (e.g. Brake Fluid Flush, Labour 1.5 hrs)..."
                placeholderTextColor={theme.colors.placeholder}
                value={customDesc}
                onChangeText={setCustomDesc}
              />

              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background, marginTop: 8 }]}
                placeholder="Price (£)"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="numeric"
                value={customPrice}
                onChangeText={setCustomPrice}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() => setCustomItemModalVisible(false)}
                  style={[styles.modalBtn, { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border }]}
                >
                  <Text style={{ color: theme.colors.text, fontFamily: fonts.semiBold }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddCustomItem}
                  style={[styles.modalBtn, { backgroundColor: theme.colors.secondary }]}
                >
                  <Text style={{ color: '#FFFFFF', fontFamily: fonts.bold }}>Add to Job Sheet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ============================================================== */}
        {/* SUB-MODAL: THERMAL PRINTABLE RECEIPT BILL PREVIEW */}
        {/* ============================================================== */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={receiptModalVisible}
          onRequestClose={() => setReceiptModalVisible(false)}
        >
          <View style={styles.receiptOverlay}>
            <View style={[styles.receiptContainer, { backgroundColor: theme.colors.card }]}>
              {/* Receipt Top Actions Bar */}
              <View style={[styles.receiptTopBar, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="receipt" size={20} color="#10B981" style={{ marginRight: 6 }} />
                  <Text style={[styles.receiptTopBarTitle, { color: theme.colors.text }]}>
                    Receipt Slip Preview
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setReceiptModalVisible(false)}
                  style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Receipt Slip */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.receiptScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.receiptPaper}>
                  {/* Garage Header */}
                  <View style={styles.receiptHeader}>
                    <Text style={styles.receiptGarageTitle}>
                      {((currentGarage as any)?.garageName || currentGarage?.name || 'GARAGE WORKSHOP').toUpperCase()}
                    </Text>
                    {currentGarage?.address ? (
                      <Text style={styles.receiptGarageSub}>
                        {[currentGarage.address, currentGarage.city, currentGarage.postcode].filter(Boolean).join(', ')}
                      </Text>
                    ) : null}
                    {currentGarage?.phone ? (
                      <Text style={styles.receiptGarageSub}>Tel: {currentGarage.phone}</Text>
                    ) : null}
                    {currentGarage?.email ? (
                      <Text style={styles.receiptGarageSub}>Email: {currentGarage.email}</Text>
                    ) : null}
                    {currentGarage?.vtsNumber ? (
                      <Text style={styles.receiptGarageSub}>MOT VTS Station: {currentGarage.vtsNumber}</Text>
                    ) : null}
                    <View style={styles.receiptBadgeWrap}>
                      <Text style={styles.receiptBadgeText}>RETAIL CASH RECEIPT & TAX INVOICE</Text>
                    </View>
                  </View>

                  <View style={styles.receiptDashedDivider} />

                  {/* Meta Details */}
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Receipt #:</Text>
                    <Text style={styles.receiptMetaVal} numberOfLines={1}>{invoiceNumber || 'INV-DRAFT'}</Text>
                  </View>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Date & Time:</Text>
                    <Text style={styles.receiptMetaVal}>
                      {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <View style={[styles.receiptMetaRow, { alignItems: 'center', marginTop: 4 }]}>
                    <Text style={styles.receiptMetaKey}>Vehicle VRN:</Text>
                    <View style={styles.receiptVrnBox}>
                      <Text style={styles.receiptVrnText}>{regText}</Text>
                    </View>
                  </View>
                  {makeModelText ? (
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Make / Model:</Text>
                      <Text style={styles.receiptMetaVal} numberOfLines={2}>{makeModelText}</Text>
                    </View>
                  ) : null}
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Customer:</Text>
                    <Text style={styles.receiptMetaVal} numberOfLines={2}>{customerName}</Text>
                  </View>
                  {displayMobile ? (
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Phone / Mobile:</Text>
                      <Text style={styles.receiptMetaVal} numberOfLines={1}>{displayMobile}</Text>
                    </View>
                  ) : null}
                  {displayEmail ? (
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Email:</Text>
                      <Text style={styles.receiptMetaVal} numberOfLines={2}>{displayEmail}</Text>
                    </View>
                  ) : null}

                  <View style={styles.receiptDashedDivider} />

                  {/* Items Table */}
                  <View style={styles.receiptItemHeaderRow}>
                    <Text style={[styles.receiptItemColHeader, { flex: 1 }]}>ITEM / SERVICE</Text>
                    <Text style={[styles.receiptItemColHeader, { width: 56, textAlign: 'right' }]}>PRICE</Text>
                    <Text style={[styles.receiptItemColHeader, { width: 32, textAlign: 'center' }]}>QTY</Text>
                    <Text style={[styles.receiptItemColHeader, { width: 62, textAlign: 'right' }]}>TOTAL</Text>
                  </View>

                  {items.map((it, idx) => (
                    <View key={idx} style={styles.receiptItemRow}>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={styles.receiptItemDesc}>{it.description}</Text>
                        {it.partNumber ? (
                          <Text style={styles.receiptItemPartNum}>Part: {it.partNumber}</Text>
                        ) : null}
                      </View>
                      <Text style={[styles.receiptItemPrice, { width: 56 }]}>£{Number(it.unitPrice || 0).toFixed(2)}</Text>
                      <Text style={[styles.receiptItemQty, { width: 32 }]}>{it.quantity}</Text>
                      <Text style={[styles.receiptItemTotal, { width: 62 }]}>£{Number(it.totalPrice || 0).toFixed(2)}</Text>
                    </View>
                  ))}

                  <View style={styles.receiptDashedDivider} />

                  {/* Totals Breakdown */}
                  <View style={styles.receiptTotalsRow}>
                    <Text style={styles.receiptTotalsKey}>Subtotal (Excl. VAT):</Text>
                    <Text style={styles.receiptTotalsVal}>£{subtotal.toFixed(2)}</Text>
                  </View>
                  {discountAmount > 0 ? (
                    <View style={styles.receiptTotalsRow}>
                      <Text style={[styles.receiptTotalsKey, { color: '#DC2626' }]}>Discount:</Text>
                      <Text style={[styles.receiptTotalsVal, { color: '#DC2626' }]}>-£{discountAmount.toFixed(2)}</Text>
                    </View>
                  ) : null}
                  <View style={styles.receiptTotalsRow}>
                    <Text style={styles.receiptTotalsKey}>Standard UK VAT ({vatRate}%):</Text>
                    <Text style={styles.receiptTotalsVal}>£{vatAmount.toFixed(2)}</Text>
                  </View>

                  <View style={styles.receiptDoubleDivider} />

                  <View style={[styles.receiptTotalsRow, { marginTop: 4 }]}>
                    <Text style={styles.receiptGrandTotalKey}>TOTAL AMOUNT:</Text>
                    <Text style={styles.receiptGrandTotalVal}>£{grandTotal.toFixed(2)}</Text>
                  </View>

                  <View style={[styles.receiptMetaRow, { marginTop: 8, alignItems: 'center' }]}>
                    <Text style={styles.receiptMetaKey}>Payment Method:</Text>
                    <View style={styles.receiptCashTag}>
                      <Text style={styles.receiptCashTagText}>💵 CASH ONLY</Text>
                    </View>
                  </View>

                  <View style={[styles.receiptMetaRow, { marginTop: 4, alignItems: 'center' }]}>
                    <Text style={styles.receiptMetaKey}>Payment Status:</Text>
                    <Text style={[
                      styles.receiptStatusText,
                      { color: paymentStatus === 'Paid' ? '#059669' : '#D97706' }
                    ]}>
                      {paymentStatus === 'Paid' ? 'PAID IN CASH' : 'CASH DUE ON COLLECTION'}
                    </Text>
                  </View>

                  {notes ? (
                    <View style={styles.receiptNotesBox}>
                      <Text style={styles.receiptNotesTitle}>Technician Notes:</Text>
                      <Text style={styles.receiptNotesContent}>{notes}</Text>
                    </View>
                  ) : null}

                  <View style={styles.receiptDashedDivider} />

                  <Text style={styles.receiptFooterText}>
                    Thank you for choosing {((currentGarage as any)?.garageName || currentGarage?.name || 'our workshop')}!{'\n'}
                    Please retain this receipt bill for vehicle warranty & service records.
                  </Text>
                </View>
              </ScrollView>

              {/* Receipt Bottom Action Buttons */}
              <View style={[styles.receiptActionsBar, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                  onPress={handleDownloadReceipt}
                  style={[styles.receiptPrintBtn, { backgroundColor: '#10B981' }]}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="download" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.receiptActionBtnText}>📥 Download Receipt (PDF)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShareReceipt}
                  style={[styles.receiptShareBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="share-variant-outline" size={17} color={theme.colors.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.receiptShareBtnText, { color: theme.colors.text }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    height: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  invoiceNumberPill: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
  draftBadge: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: fonts.medium,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  vehicleCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  vehicleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ukPlate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD200',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#111827',
    overflow: 'hidden',
    paddingRight: 8,
  },
  ukFlag: {
    backgroundColor: '#00247D',
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  ukFlagText: {
    fontSize: 8,
  },
  ukTag: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: fonts.bold,
    lineHeight: 9,
  },
  plateText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#111827',
    letterSpacing: 1.2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  metaRow: {
    marginTop: 2,
  },
  makeModelText: {
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  customerText: {
    fontSize: 11.5,
    marginTop: 2,
    fontFamily: fonts.regular,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  sectionActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  addPartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addPartBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  addCustomBtnText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    marginLeft: 2,
  },
  emptyItemsBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyItemsText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  itemCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.8,
    marginRight: 6,
  },
  itemTypeTagText: {
    fontSize: 9.5,
    fontFamily: fonts.bold,
  },
  itemDescription: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    flex: 1,
  },
  trashBtn: {
    padding: 4,
  },
  partDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  partNumberText: {
    fontSize: 10.5,
    fontFamily: fonts.medium,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginRight: 4,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValueText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    marginHorizontal: 6,
  },
  priceInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInput: {
    height: 28,
    width: 60,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 11.5,
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
  totalPriceText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    marginLeft: 6,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  summaryCardTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    marginBottom: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  summaryVal: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  grandTotalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1.5,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontFamily: fonts.bold,
  },
  grandTotalVal: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: '#10B981',
  },
  settingsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  inputSubLabel: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectorChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  selectorChipText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  footerSecondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSecondaryBtnText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  footerPrimaryBtn: {
    flex: 1.2,
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  pickerBox: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 12,
    height: 38,
  },
  categoryScroll: {
    paddingVertical: 4,
    gap: 6,
    marginBottom: 8,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  pickerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.8,
  },
  pickerItemName: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
  },
  pickerItemPart: {
    fontSize: 11,
    fontFamily: fonts.medium,
  },
  pickerItemPrice: {
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  stockCountTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  headerReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  disabledTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  receiptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  receiptContainer: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 14,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  receiptTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  receiptTopBarTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  receiptScrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  receiptPaper: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FAFAF7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 12,
    overflow: 'hidden',
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  receiptGarageTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  receiptGarageSub: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  receiptBadgeWrap: {
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    marginTop: 8,
    alignSelf: 'center',
  },
  receiptBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  receiptDashedDivider: {
    width: '100%',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
    marginVertical: 7,
  },
  receiptDoubleDivider: {
    width: '100%',
    height: 4,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#111827',
    marginVertical: 7,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 2,
    gap: 6,
  },
  receiptMetaKey: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: '#4B5563',
    flexShrink: 0,
  },
  receiptMetaVal: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#111827',
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  receiptVrnBox: {
    backgroundColor: '#FFD200',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#111827',
    alignSelf: 'flex-end',
  },
  receiptVrnText: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
    color: '#111827',
    letterSpacing: 1,
  },
  receiptItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 4,
  },
  receiptItemColHeader: {
    fontSize: 9.5,
    fontFamily: fonts.bold,
    color: '#374151',
  },
  receiptItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  receiptItemDesc: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: '#111827',
    flexWrap: 'wrap',
  },
  receiptItemPartNum: {
    fontSize: 9,
    fontFamily: fonts.regular,
    color: '#6B7280',
    marginTop: 1,
    flexWrap: 'wrap',
  },
  receiptItemQty: {
    fontSize: 10.5,
    fontFamily: fonts.medium,
    color: '#111827',
    textAlign: 'center',
  },
  receiptItemPrice: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    color: '#4B5563',
    textAlign: 'right',
  },
  receiptItemTotal: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: '#111827',
    textAlign: 'right',
  },
  receiptTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 6,
  },
  receiptTotalsKey: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: '#4B5563',
    flex: 1,
  },
  receiptTotalsVal: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
    color: '#111827',
    textAlign: 'right',
    flexShrink: 0,
  },
  receiptGrandTotalKey: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: '#111827',
    flex: 1,
  },
  receiptGrandTotalVal: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#10B981',
    textAlign: 'right',
    flexShrink: 0,
  },
  receiptCashTag: {
    backgroundColor: '#10B98115',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  receiptCashTagText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#065F46',
  },
  receiptStatusText: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.bold,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
  receiptNotesBox: {
    marginTop: 6,
    backgroundColor: '#F3F4F6',
    padding: 7,
    borderRadius: 6,
    width: '100%',
  },
  receiptNotesTitle: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#374151',
  },
  receiptNotesContent: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 14,
  },
  receiptFooterText: {
    fontSize: 9.5,
    fontFamily: fonts.regular,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 13,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  receiptActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  receiptPrintBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  receiptActionBtnText: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  receiptShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  receiptShareBtnText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  footerReceiptBtn: {
    flex: 1.2,
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerReceiptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  viewModeSwitcher: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  viewModeTabActive: {},
  viewModeTabText: {
    fontSize: 12.5,
  },
  footerPreviewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
