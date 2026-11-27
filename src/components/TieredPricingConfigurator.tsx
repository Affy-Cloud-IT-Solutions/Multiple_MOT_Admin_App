import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { fonts } from '../theme/theme';
import {
  GaragePricing,
  ServicingTierPrice,
  DEFAULT_UK_BENCHMARK_PRICING,
} from '../context/DataContext';

export interface TieredPricingConfiguratorProps {
  pricing: GaragePricing;
  onChange: (updated: GaragePricing) => void;
  onApplyStandardRates?: () => void;
  isSaving?: boolean;
  onSave?: () => void;
  showSaveButton?: boolean;
}

const CC_BRACKET_META: Array<{
  key: keyof GaragePricing['servicingTiers'];
  label: string;
  sub: string;
  shortLabel: string;
  examples: string;
}> = [
  { key: 'up_to_1200', label: '0 - 1200cc', shortLabel: 'Up to 1.2L', sub: 'City / Small Cars', examples: 'Fiesta 1.0, Polo 1.2, Corsa 1.2' },
  { key: '1201_to_1500', label: '1201 - 1500cc', shortLabel: '1.2L - 1.5L', sub: 'Hatchbacks', examples: 'Focus 1.5, Golf 1.4, Astra 1.4' },
  { key: '1501_to_2000', label: '1501 - 2000cc', shortLabel: '1.5L - 2.0L', sub: 'Family / Saloons', examples: 'BMW 320d, Golf GTi, Passat 2.0' },
  { key: '2001_to_2400', label: '2001 - 2400cc', shortLabel: '2.0L - 2.4L', sub: 'Executive / SUVs', examples: 'Audi A4 2.0T / 2.4, Mondeo 2.2' },
  { key: '2401_to_3500', label: '2401 - 3500cc', shortLabel: '2.4L - 3.5L', sub: 'Large V6 / Pickups', examples: 'BMW 330d 3.0, Ranger 3.2' },
  { key: '3501_plus', label: '3501cc+', shortLabel: '3.5L+ V8', sub: 'High-Displacement', examples: 'Range Rover V8, Porsche 4.0' },
];

const DEFAULT_SAMPLE_ADDONS = [
  { name: 'Full DPF Clean', price: 299, description: 'Deep particulate filter chemical flush & regeneration', enabled: true },
  { name: 'Air Conditioning Regas (R134a)', price: 60, description: 'Complete AC refrigerant drain, vacuum test and recharge', enabled: true },
  { name: 'Tyres - Quote on arrival', price: 60, description: 'Inspection and quote on vehicle tyre replacement', enabled: true },
];

export default function TieredPricingConfigurator({
  pricing,
  onChange,
  onApplyStandardRates,
  isSaving = false,
  onSave,
  showSaveButton = false,
}: TieredPricingConfiguratorProps) {
  const { theme, isDarkMode } = useAppTheme();
  // Logo brand blue (#012652) with high-contrast electric blue (#1677FF) on dark mode
  const LOGO_BLUE = isDarkMode ? '#1677FF' : '#012652';
  const [selectedBracket, setSelectedBracket] = useState<keyof GaragePricing['servicingTiers']>('1501_to_2000');
  const [activeSection, setActiveSection] = useState<'tiers' | 'mot' | 'delivery' | 'labour_addons'>('tiers');

  // Custom Add-on Inline Form state
  const [showAddAddon, setShowAddAddon] = useState(false);
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');
  const [newAddonDesc, setNewAddonDesc] = useState('');

  const tiers = pricing.servicingTiers || DEFAULT_UK_BENCHMARK_PRICING.servicingTiers;
  const currentTier = tiers[selectedBracket] || { interim: 118, full: 136, major: 149, oilChange: 89 };

  const handleUpdatePrice = (serviceKey: keyof ServicingTierPrice, rawVal: string) => {
    const sanitized = rawVal.replace(/[^0-9.]/g, '');
    const num = parseFloat(sanitized) || 0;
    const updatedTiers = {
      ...tiers,
      [selectedBracket]: {
        ...currentTier,
        [serviceKey]: num >= 0 ? num : 0,
      },
    };
    onChange({
      ...pricing,
      servicingTiers: updatedTiers,
    });
  };

  const handleApplyDefaults = () => {
    Alert.alert(
      'Apply UK Benchmark Rates? 🇬🇧',
      'This will populate all 6 engine displacement brackets, MOT combo rates (£20 discount), delivery fees, and labour rates matching BookMyGarage UK industry benchmarks.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Standard Rates',
          onPress: () => {
            if (onApplyStandardRates) {
              onApplyStandardRates();
            } else {
              onChange({
                ...DEFAULT_UK_BENCHMARK_PRICING,
              });
            }
          },
        },
      ]
    );
  };

  // Quick Adjustment tools
  const handleQuickPercentAdjust = (percent: number) => {
    Alert.alert(
      `Adjust All Rates by ${percent > 0 ? `+${percent}%` : `${percent}%`}?`,
      `This will recalculate all service prices across all 6 engine brackets by ${percent > 0 ? `+${percent}%` : `${percent}%`}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Adjustment',
          onPress: () => {
            const factor = 1 + percent / 100;
            const updatedTiers: any = {};
            (Object.keys(tiers) as Array<keyof GaragePricing['servicingTiers']>).forEach((bracket) => {
              const b = tiers[bracket];
              updatedTiers[bracket] = {
                interim: Math.round(b.interim * factor),
                full: Math.round(b.full * factor),
                major: Math.round(b.major * factor),
                oilChange: b.oilChange ? Math.round(b.oilChange * factor) : undefined,
              };
            });
            onChange({
              ...pricing,
              servicingTiers: updatedTiers,
            });
          },
        },
      ]
    );
  };

  const handleCopyCurrentBracketToAll = () => {
    const activeMeta = CC_BRACKET_META.find((m) => m.key === selectedBracket);
    const bracketLabel = activeMeta?.label || selectedBracket;
    Alert.alert(
      'Copy Rates to All Brackets?',
      `This will copy the current rates from ${bracketLabel} to all other 5 engine brackets.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy to All',
          onPress: () => {
            const updatedTiers: any = {};
            (Object.keys(tiers) as Array<keyof GaragePricing['servicingTiers']>).forEach((bracket) => {
              updatedTiers[bracket] = { ...currentTier };
            });
            onChange({
              ...pricing,
              servicingTiers: updatedTiers,
            });
          },
        },
      ]
    );
  };

  const handleMotChange = (field: 'class4Standalone' | 'comboWithFullMajor' | 'comboWithInterim', rawVal: string) => {
    const sanitized = rawVal.replace(/[^0-9.]/g, '');
    const num = parseFloat(sanitized) || 0;
    const validNum = Math.max(0, num);
    onChange({
      ...pricing,
      mot: {
        enabled: true,
        ...pricing.mot,
        [field]: validNum,
      },
    });
  };

  const handleDeliveryChange = (
    type: 'dropOff' | 'collectAndDeliver' | 'courtesyCar',
    field: string,
    val: any
  ) => {
    const curDelivery = pricing.delivery || DEFAULT_UK_BENCHMARK_PRICING.delivery || {};
    const curTarget = (curDelivery as any)[type] || {};

    onChange({
      ...pricing,
      delivery: {
        ...curDelivery,
        [type]: {
          ...curTarget,
          [field]: val,
        },
      },
    });
  };

  const handleLabourChange = (field: 'mechanical' | 'ev', rawVal: string) => {
    const num = parseFloat(rawVal) || 0;
    onChange({
      ...pricing,
      labourRates: {
        mechanical: 60,
        ev: 75,
        ...pricing.labourRates,
        [field]: num,
      },
    });
  };

  // Custom Products management
  const customProducts = Array.isArray(pricing.customProducts) && pricing.customProducts.length > 0
    ? pricing.customProducts
    : DEFAULT_SAMPLE_ADDONS;

  const handleToggleCustomProduct = (index: number, enabled: boolean) => {
    const list = [...customProducts];
    if (list[index]) {
      list[index] = { ...list[index], enabled } as any;
      onChange({ ...pricing, customProducts: list });
    }
  };

  const handleDeleteCustomProduct = (index: number) => {
    const list = customProducts.filter((_, i) => i !== index);
    onChange({ ...pricing, customProducts: list });
  };

  const handleCreateCustomProduct = () => {
    if (!newAddonName.trim()) {
      Alert.alert('Required', 'Please enter a name for the workshop product.');
      return;
    }
    const priceNum = parseFloat(newAddonPrice) || 50;
    const item = {
      name: newAddonName.trim(),
      price: priceNum,
      description: newAddonDesc.trim() || `${newAddonName.trim()} service at our workshop`,
      enabled: true,
    };
    onChange({
      ...pricing,
      customProducts: [...customProducts, item],
    });
    setNewAddonName('');
    setNewAddonPrice('');
    setNewAddonDesc('');
    setShowAddAddon(false);
  };

  const mot = pricing.mot || DEFAULT_UK_BENCHMARK_PRICING.mot!;
  const delivery = pricing.delivery || DEFAULT_UK_BENCHMARK_PRICING.delivery!;
  const labourRates = pricing.labourRates || { mechanical: 60, ev: 75 };

  const fullMajorSaving = Math.max(0, (mot.class4Standalone || 54.85) - (mot.comboWithFullMajor || 34.85));
  const interimSaving = Math.max(0, (mot.class4Standalone || 54.85) - (mot.comboWithInterim || 39.85));

  const activeMeta = CC_BRACKET_META.find((m) => m.key === selectedBracket) || CC_BRACKET_META[2];

  return (
    <View style={styles.container}>
      {/* Top Banner: Clear, Non-cramped Header with Quick Standard Benchmark Button */}
      <View style={[styles.presetBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.presetBannerContent}>
          <View style={styles.presetTitleRow}>
            <View style={[styles.presetIconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
              <MaterialCommunityIcons name="speedometer" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.presetBannerTitle, { color: theme.colors.text }]} numberOfLines={1}>
                UK Benchmark Pricing
              </Text>
              <Text style={[styles.presetBannerSub, { color: theme.colors.placeholder }]} numberOfLines={2}>
                Set rates for 6 engine bands, MOT combos & extra services.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.applyDefaultBtn, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }]}
            onPress={handleApplyDefaults}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.applyDefaultBtnText, { color: theme.colors.primary }]}>Reset to UK Standards</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal Scrollable Subtabs Bar: Never overlaps or clips on small screens */}
      <View style={styles.subTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabsContent}
        >
          <TouchableOpacity
            style={[
              styles.subTabPill,
              activeSection === 'tiers'
                ? { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE }
                : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => setActiveSection('tiers')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="engine"
              size={15}
              color={activeSection === 'tiers' ? '#FFFFFF' : theme.colors.placeholder}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.subTabText,
                { color: activeSection === 'tiers' ? '#FFFFFF' : theme.colors.text },
              ]}
            >
              Servicing (6 CC)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTabPill,
              activeSection === 'mot'
                ? { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE }
                : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => setActiveSection('mot')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="shield-car"
              size={15}
              color={activeSection === 'mot' ? '#FFFFFF' : theme.colors.placeholder}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.subTabText,
                { color: activeSection === 'mot' ? '#FFFFFF' : theme.colors.text },
              ]}
            >
              MOT & Combos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTabPill,
              activeSection === 'delivery'
                ? { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE }
                : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => setActiveSection('delivery')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="truck-delivery"
              size={15}
              color={activeSection === 'delivery' ? '#FFFFFF' : theme.colors.placeholder}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.subTabText,
                { color: activeSection === 'delivery' ? '#FFFFFF' : theme.colors.text },
              ]}
            >
              Collection & Delivery
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTabPill,
              activeSection === 'labour_addons'
                ? { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE }
                : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => setActiveSection('labour_addons')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="hammer-wrench"
              size={15}
              color={activeSection === 'labour_addons' ? '#FFFFFF' : theme.colors.placeholder}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.subTabText,
                { color: activeSection === 'labour_addons' ? '#FFFFFF' : theme.colors.text },
              ]}
            >
              Labour & Add-ons
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1: 6-TIER ENGINE SERVICING
          ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'tiers' && (
        <View style={styles.sectionWrap}>
          {/* Quick Modifier Actions Bar: Scrollable chips with generous touch targets */}
          <View style={styles.quickToolsWrapper}>
            <View style={styles.quickToolsHeader}>
              <MaterialCommunityIcons name="lightning-bolt-outline" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.quickAdjustLabel, { color: theme.colors.placeholder }]}>Quick Rate Tools:</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAdjustScroll}>
              <TouchableOpacity
                style={[styles.quickAdjustPill, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}
                onPress={() => handleQuickPercentAdjust(5)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>+5% All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAdjustPill, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}
                onPress={() => handleQuickPercentAdjust(10)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>+10% All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAdjustPill, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}
                onPress={() => handleQuickPercentAdjust(-5)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>-5% All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAdjustPill, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }]}
                onPress={handleCopyCurrentBracketToAll}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="content-copy" size={12} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.quickAdjustText, { color: theme.colors.primary }]}>Copy {activeMeta.shortLabel} to All</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Engine Bracket Selector Section */}
          <View style={styles.bracketSectionHeader}>
            <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
              Select Engine Displacement (CC):
            </Text>
            <Text style={[styles.sectionSubHeading, { color: theme.colors.placeholder }]}>
              Choose a band to set or tweak its specific service prices
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bracketPillsContainer}
          >
            {CC_BRACKET_META.map((meta) => {
              const isSelected = selectedBracket === meta.key;
              return (
                <TouchableOpacity
                  key={meta.key}
                  style={[
                    styles.bracketPill,
                    isSelected
                      ? [styles.bracketPillSelected, { backgroundColor: LOGO_BLUE, borderColor: LOGO_BLUE }]
                      : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                  ]}
                  onPress={() => setSelectedBracket(meta.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.bracketPillTop}>
                    <Text
                      style={[
                        styles.bracketPillLabel,
                        { color: isSelected ? '#FFFFFF' : theme.colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {meta.label}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.bracketPillSub,
                      { color: isSelected ? '#E0E7FF' : theme.colors.placeholder },
                    ]}
                    numberOfLines={1}
                  >
                    {meta.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Bracket Details Card: Clean, simple, impossible to overlap */}
          <View style={[styles.bracketDetailsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.bracketHeaderRow}>
              <View style={styles.bracketBadgeRow}>
                <View style={[styles.bracketCcBadge, { backgroundColor: LOGO_BLUE + '18' }]}>
                  <Text style={[styles.bracketCcBadgeText, { color: LOGO_BLUE }]}>
                    {activeMeta.label}
                  </Text>
                </View>
                <Text style={[styles.bracketCarType, { color: theme.colors.text }]} numberOfLines={1}>
                  {activeMeta.sub}
                </Text>
              </View>
              <Text style={[styles.bracketExamplesText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                e.g. {activeMeta.examples}
              </Text>
            </View>

            {/* 4 Servicing Cards: Interim, Full, Major, Oil */}
            <View style={styles.serviceRatesList}>
              {/* 1. Interim Service */}
              <View style={[styles.serviceItemCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                <View style={styles.serviceItemHeader}>
                  <View style={styles.serviceTitleCol}>
                    <View style={styles.serviceTitleRow}>
                      <View style={[styles.serviceIconWrap, { backgroundColor: '#3B82F618' }]}>
                        <MaterialCommunityIcons name="oil" size={16} color="#3B82F6" />
                      </View>
                      <Text style={[styles.serviceName, { color: theme.colors.text }]}>Interim Service</Text>
                    </View>
                    <Text style={[styles.serviceIntervalText, { color: theme.colors.placeholder }]}>
                      6-Month / 6,000 miles • Oil & filter check
                    </Text>
                  </View>

                  <View style={[styles.priceInputWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                    <TextInput
                      style={[styles.priceInput, { color: theme.colors.text }]}
                      keyboardType="decimal-pad"
                      value={String(currentTier.interim || '')}
                      onChangeText={(val) => handleUpdatePrice('interim', val)}
                      placeholder="118.00"
                      placeholderTextColor={theme.colors.placeholder}
                      selectTextOnFocus
                    />
                  </View>
                </View>
              </View>

              {/* 2. Full Service (with POPULAR badge safely placed) */}
              <View style={[styles.serviceItemCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                <View style={styles.serviceItemHeader}>
                  <View style={styles.serviceTitleCol}>
                    <View style={styles.serviceTitleRow}>
                      <View style={[styles.serviceIconWrap, { backgroundColor: '#10B98118' }]}>
                        <MaterialCommunityIcons name="car-wrench" size={16} color="#10B981" />
                      </View>
                      <Text style={[styles.serviceName, { color: theme.colors.text }]}>Full Service</Text>
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>POPULAR</Text>
                      </View>
                    </View>
                    <Text style={[styles.serviceIntervalText, { color: theme.colors.placeholder }]}>
                      12-Month / 12,000 miles • 70+ point check
                    </Text>
                  </View>

                  <View style={[styles.priceInputWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                    <TextInput
                      style={[styles.priceInput, { color: theme.colors.text }]}
                      keyboardType="decimal-pad"
                      value={String(currentTier.full || '')}
                      onChangeText={(val) => handleUpdatePrice('full', val)}
                      placeholder="136.00"
                      placeholderTextColor={theme.colors.placeholder}
                      selectTextOnFocus
                    />
                  </View>
                </View>
              </View>

              {/* 3. Major Service */}
              <View style={[styles.serviceItemCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                <View style={styles.serviceItemHeader}>
                  <View style={styles.serviceTitleCol}>
                    <View style={styles.serviceTitleRow}>
                      <View style={[styles.serviceIconWrap, { backgroundColor: '#F59E0B18' }]}>
                        <MaterialCommunityIcons name="shield-star" size={16} color="#F59E0B" />
                      </View>
                      <Text style={[styles.serviceName, { color: theme.colors.text }]}>Major Service</Text>
                    </View>
                    <Text style={[styles.serviceIntervalText, { color: theme.colors.placeholder }]}>
                      24-Month / 24,000 miles • Plugs & full filters
                    </Text>
                  </View>

                  <View style={[styles.priceInputWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                    <TextInput
                      style={[styles.priceInput, { color: theme.colors.text }]}
                      keyboardType="decimal-pad"
                      value={String(currentTier.major || '')}
                      onChangeText={(val) => handleUpdatePrice('major', val)}
                      placeholder="149.00"
                      placeholderTextColor={theme.colors.placeholder}
                      selectTextOnFocus
                    />
                  </View>
                </View>
              </View>

              {/* 4. Oil & Filter Change */}
              <View style={[styles.serviceItemCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
                <View style={styles.serviceItemHeader}>
                  <View style={styles.serviceTitleCol}>
                    <View style={styles.serviceTitleRow}>
                      <View style={[styles.serviceIconWrap, { backgroundColor: '#8B5CF618' }]}>
                        <MaterialCommunityIcons name="oil-level" size={16} color="#8B5CF6" />
                      </View>
                      <Text style={[styles.serviceName, { color: theme.colors.text }]}>Oil & Filter Change</Text>
                    </View>
                    <Text style={[styles.serviceIntervalText, { color: theme.colors.placeholder }]}>
                      Engine oil drain, replacement filter & fluid top-up
                    </Text>
                  </View>

                  <View style={[styles.priceInputWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                    <TextInput
                      style={[styles.priceInput, { color: theme.colors.text }]}
                      keyboardType="decimal-pad"
                      value={String(currentTier.oilChange || '')}
                      onChangeText={(val) => handleUpdatePrice('oilChange', val)}
                      placeholder="89.00"
                      placeholderTextColor={theme.colors.placeholder}
                      selectTextOnFocus
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* All 6 Brackets Matrix Overview: Horizontally scrollable so nothing ever clips */}
          <View style={[styles.matrixCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.matrixCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.matrixCardTitle, { color: theme.colors.text }]}>
                  All 6 Engine Bands Comparison (£)
                </Text>
                <Text style={[styles.matrixCardSub, { color: theme.colors.placeholder }]}>
                  Scroll right to see all rates • Tap any row to edit it
                </Text>
              </View>
              <MaterialCommunityIcons name="gesture-swipe-horizontal" size={18} color={theme.colors.placeholder} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.matrixTableInner}>
                {/* Table Header Row */}
                <View style={[styles.matrixHeaderRow, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.matrixHeadCol, styles.colBracket, { color: theme.colors.placeholder }]}>Engine Size</Text>
                  <Text style={[styles.matrixHeadCol, styles.colPrice, { color: theme.colors.placeholder }]}>Interim</Text>
                  <Text style={[styles.matrixHeadCol, styles.colPrice, { color: theme.colors.placeholder }]}>Full</Text>
                  <Text style={[styles.matrixHeadCol, styles.colPrice, { color: theme.colors.placeholder }]}>Major</Text>
                  <Text style={[styles.matrixHeadCol, styles.colPrice, { color: theme.colors.placeholder }]}>Oil Only</Text>
                </View>

                {/* Table Data Rows */}
                {CC_BRACKET_META.map((meta) => {
                  const bTier = tiers[meta.key] || { interim: 0, full: 0, major: 0, oilChange: 0 };
                  const isCurrent = selectedBracket === meta.key;
                  return (
                    <TouchableOpacity
                      key={meta.key}
                      style={[
                        styles.matrixDataRow,
                        isCurrent && { backgroundColor: LOGO_BLUE + '16', borderColor: LOGO_BLUE + '50', borderWidth: 1 },
                      ]}
                      onPress={() => setSelectedBracket(meta.key)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.colBracket}>
                        <Text
                          style={[
                            styles.matrixCellBracket,
                            { color: isCurrent ? LOGO_BLUE : theme.colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {meta.label}
                        </Text>
                        <Text style={[styles.matrixCellSub, { color: theme.colors.placeholder }]} numberOfLines={1}>
                          {meta.sub}
                        </Text>
                      </View>
                      <Text style={[styles.matrixCellPrice, styles.colPrice, { color: theme.colors.text }]}>£{bTier.interim}</Text>
                      <Text style={[styles.matrixCellPrice, styles.colPrice, { color: theme.colors.text }]}>£{bTier.full}</Text>
                      <Text style={[styles.matrixCellPrice, styles.colPrice, { color: theme.colors.text }]}>£{bTier.major}</Text>
                      <Text style={[styles.matrixCellPrice, styles.colPrice, { color: theme.colors.text }]}>£{bTier.oilChange || '-'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2: MOT & BUNDLE DISCOUNTS
          ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'mot' && (
        <View style={styles.sectionWrap}>
          <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeaderBox}>
              <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
                <MaterialCommunityIcons name="shield-check" size={22} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.cardHeaderTitle, { color: theme.colors.text }]}>Class 4 MOT & Combos</Text>
                <Text style={[styles.cardHeaderSub, { color: theme.colors.placeholder }]}>
                  Upsell discounts when customers book MOT alongside routine servicing.
                </Text>
              </View>
            </View>

            {/* Standalone MOT Card */}
            <View style={[styles.motItemBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
              <View style={styles.motItemTop}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.motItemTitle, { color: theme.colors.text }]}>Standalone Class 4 MOT</Text>
                  <Text style={[styles.motItemDesc, { color: theme.colors.placeholder }]}>
                    Standard DVSA government maximum is £54.85
                  </Text>
                </View>
                <View style={[styles.priceInputWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                  <TextInput
                    style={[styles.priceInput, { color: theme.colors.text }]}
                    keyboardType="decimal-pad"
                    value={String(mot.class4Standalone || '')}
                    onChangeText={(val) => handleMotChange('class4Standalone', val)}
                    placeholder="54.85"
                    placeholderTextColor={theme.colors.placeholder}
                    selectTextOnFocus
                  />
                </View>
              </View>
            </View>

            {/* Combo with Full or Major Service */}
            <View style={[styles.motItemBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
              <View style={styles.motItemTop}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.motItemTitle, { color: theme.colors.text }]}>MOT + Full or Major Service</Text>
                  {fullMajorSaving > 0 && (
                    <View style={styles.savingPillRow}>
                      <View style={[styles.savingTag, { backgroundColor: '#10B9811C' }]}>
                        <MaterialCommunityIcons name="tag-outline" size={11} color="#10B981" style={{ marginRight: 3 }} />
                        <Text style={[styles.savingTagText, { color: '#10B981' }]}>
                          Customer Saves £{fullMajorSaving.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  )}
                  <Text style={[styles.motItemDesc, { color: theme.colors.placeholder }]}>
                    Prominently upsold when customer books Full or Major service
                  </Text>
                </View>
                <View style={[styles.priceInputWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                  <TextInput
                    style={[styles.priceInput, { color: theme.colors.text }]}
                    keyboardType="decimal-pad"
                    value={String(mot.comboWithFullMajor || '')}
                    onChangeText={(val) => handleMotChange('comboWithFullMajor', val)}
                    placeholder="34.85"
                    placeholderTextColor={theme.colors.placeholder}
                    selectTextOnFocus
                  />
                </View>
              </View>
            </View>

            {/* Combo with Interim Service */}
            <View style={[styles.motItemBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
              <View style={styles.motItemTop}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.motItemTitle, { color: theme.colors.text }]}>MOT + Interim Service</Text>
                  {interimSaving > 0 && (
                    <View style={styles.savingPillRow}>
                      <View style={[styles.savingTag, { backgroundColor: '#10B9811C' }]}>
                        <MaterialCommunityIcons name="tag-outline" size={11} color="#10B981" style={{ marginRight: 3 }} />
                        <Text style={[styles.savingTagText, { color: '#10B981' }]}>
                          Customer Saves £{interimSaving.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  )}
                  <Text style={[styles.motItemDesc, { color: theme.colors.placeholder }]}>
                    Special combo discount when booked alongside Interim service
                  </Text>
                </View>
                <View style={[styles.priceInputWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                  <TextInput
                    style={[styles.priceInput, { color: theme.colors.text }]}
                    keyboardType="decimal-pad"
                    value={String(mot.comboWithInterim || '')}
                    onChangeText={(val) => handleMotChange('comboWithInterim', val)}
                    placeholder="39.85"
                    placeholderTextColor={theme.colors.placeholder}
                    selectTextOnFocus
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3: DELIVERY & MOBILITY OPTIONS
          ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'delivery' && (
        <View style={styles.sectionWrap}>
          {/* Customer Drop-off */}
          <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeaderBox}>
              <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
                <MaterialCommunityIcons name="car-side" size={22} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.text }]}>Customer Drop-off</Text>
                  <View style={[styles.freeBadge, { backgroundColor: '#10B9811C' }]}>
                    <Text style={[styles.freeBadgeText, { color: '#10B981' }]}>Always Free</Text>
                  </View>
                </View>
                <Text style={[styles.cardHeaderSub, { color: theme.colors.placeholder, marginTop: 4 }]}>
                  Customer delivers and collects vehicle directly at workshop.
                </Text>
              </View>
            </View>
          </View>

          {/* Collect & Deliver */}
          <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeaderBox}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#3B82F618' }]}>
                <MaterialCommunityIcons name="truck-delivery" size={22} color="#3B82F6" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.text }]}>Collect & Deliver</Text>
                  <Switch
                    value={Boolean(delivery.collectAndDeliver?.enabled)}
                    onValueChange={(val) => handleDeliveryChange('collectAndDeliver', 'enabled', val)}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#CBD5E1"
                  />
                </View>
                <Text style={[styles.cardHeaderSub, { color: theme.colors.placeholder, marginTop: 2 }]}>
                  Garage collects vehicle from customer address and returns it.
                </Text>
              </View>
            </View>

            {delivery.collectAndDeliver?.enabled && (
              <View style={[styles.deliveryConfigFields, { borderTopColor: theme.colors.border + '60' }]}>
                <View style={styles.deliveryFieldRow}>
                  <Text style={[styles.deliveryFieldLabel, { color: theme.colors.text }]}>Collection Fee (£)</Text>
                  <View style={[styles.smallInputWrap, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                    <TextInput
                      style={[styles.smallInput, { color: theme.colors.text }]}
                      keyboardType="decimal-pad"
                      value={String(delivery.collectAndDeliver?.price ?? 15)}
                      onChangeText={(val) => handleDeliveryChange('collectAndDeliver', 'price', parseFloat(val) || 0)}
                      placeholder="15.00"
                      placeholderTextColor={theme.colors.placeholder}
                    />
                  </View>
                </View>

                <View style={styles.deliveryFieldRow}>
                  <Text style={[styles.deliveryFieldLabel, { color: theme.colors.text }]}>Max Radius (Miles)</Text>
                  <View style={[styles.smallInputWrap, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}>
                    <TextInput
                      style={[styles.smallInput, { color: theme.colors.text }]}
                      keyboardType="number-pad"
                      value={String(delivery.collectAndDeliver?.maxMiles ?? 5)}
                      onChangeText={(val) => handleDeliveryChange('collectAndDeliver', 'maxMiles', parseInt(val, 10) || 5)}
                      placeholder="5"
                      placeholderTextColor={theme.colors.placeholder}
                    />
                    <Text style={[styles.unitText, { color: theme.colors.placeholder }]}>mi</Text>
                  </View>
                </View>

                <View style={styles.deliveryFieldRow}>
                  <Text style={[styles.deliveryFieldLabel, { color: theme.colors.text }]}>Notice Required (Days)</Text>
                  <View style={[styles.smallInputWrap, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}>
                    <TextInput
                      style={[styles.smallInput, { color: theme.colors.text }]}
                      keyboardType="number-pad"
                      value={String(delivery.collectAndDeliver?.leadDays ?? 1)}
                      onChangeText={(val) => handleDeliveryChange('collectAndDeliver', 'leadDays', parseInt(val, 10) || 1)}
                      placeholder="1"
                      placeholderTextColor={theme.colors.placeholder}
                    />
                    <Text style={[styles.unitText, { color: theme.colors.placeholder }]}>day</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Courtesy Car */}
          <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeaderBox}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#8B5CF618' }]}>
                <MaterialCommunityIcons name="car-key" size={22} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.cardHeaderTitle, { color: theme.colors.text }]}>Courtesy / Loan Car</Text>
                  <Switch
                    value={Boolean(delivery.courtesyCar?.enabled)}
                    onValueChange={(val) => handleDeliveryChange('courtesyCar', 'enabled', val)}
                    trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#CBD5E1"
                  />
                </View>
                <Text style={[styles.cardHeaderSub, { color: theme.colors.placeholder, marginTop: 2 }]}>
                  Replacement vehicle for customer while car is in workshop.
                </Text>
              </View>
            </View>

            {delivery.courtesyCar?.enabled && (
              <View style={[styles.deliveryConfigFields, { borderTopColor: theme.colors.border + '60' }]}>
                <View style={styles.deliveryFieldRow}>
                  <Text style={[styles.deliveryFieldLabel, { color: theme.colors.text }]}>Daily Fee (£)</Text>
                  <View style={[styles.smallInputWrap, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}>
                    <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                    <TextInput
                      style={[styles.smallInput, { color: theme.colors.text }]}
                      keyboardType="decimal-pad"
                      value={String(delivery.courtesyCar?.price ?? 20)}
                      onChangeText={(val) => handleDeliveryChange('courtesyCar', 'price', parseFloat(val) || 0)}
                      placeholder="20.00"
                      placeholderTextColor={theme.colors.placeholder}
                    />
                  </View>
                </View>

                <View style={styles.deliveryFieldRow}>
                  <Text style={[styles.deliveryFieldLabel, { color: theme.colors.text }]}>Advance Notice (Days)</Text>
                  <View style={[styles.smallInputWrap, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}>
                    <TextInput
                      style={[styles.smallInput, { color: theme.colors.text }]}
                      keyboardType="number-pad"
                      value={String(delivery.courtesyCar?.leadDays ?? 2)}
                      onChangeText={(val) => handleDeliveryChange('courtesyCar', 'leadDays', parseInt(val, 10) || 2)}
                      placeholder="2"
                      placeholderTextColor={theme.colors.placeholder}
                    />
                    <Text style={[styles.unitText, { color: theme.colors.placeholder }]}>days</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4: LABOUR RATES & CUSTOM WORKSHOP PRODUCTS
          ══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'labour_addons' && (
        <View style={styles.sectionWrap}>
          {/* Workshop Labour Rates Card */}
          <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.cardHeaderBox}>
              <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
                <MaterialCommunityIcons name="clock-outline" size={22} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.cardHeaderTitle, { color: theme.colors.text }]}>Workshop Labour Rates</Text>
                <Text style={[styles.cardHeaderSub, { color: theme.colors.placeholder }]}>
                  Used for dynamic quote & repair calculations across your bookings.
                </Text>
              </View>
            </View>

            {/* Mechanical Labour Row */}
            <View style={[styles.labourRowCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.labourFieldTitle, { color: theme.colors.text }]}>Mechanical Labour</Text>
                <Text style={[styles.labourFieldSub, { color: theme.colors.placeholder }]}>
                  Standard petrol & diesel repairs
                </Text>
              </View>
              <View style={[styles.priceInputWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                <TextInput
                  style={[styles.priceInput, { color: theme.colors.text }]}
                  keyboardType="decimal-pad"
                  value={String(labourRates.mechanical || 60)}
                  onChangeText={(val) => handleLabourChange('mechanical', val)}
                  placeholder="60.00"
                  placeholderTextColor={theme.colors.placeholder}
                  selectTextOnFocus
                />
                <Text style={[styles.unitText, { color: theme.colors.placeholder }]}>/hr</Text>
              </View>
            </View>

            {/* EV Labour Row */}
            <View style={[styles.labourRowCard, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', borderColor: theme.colors.border }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.labourFieldTitle, { color: theme.colors.text }]}>Electric Vehicle (EV) Labour</Text>
                <Text style={[styles.labourFieldSub, { color: theme.colors.placeholder }]}>
                  High-voltage certified EV technician rate
                </Text>
              </View>
              <View style={[styles.priceInputWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>£</Text>
                <TextInput
                  style={[styles.priceInput, { color: theme.colors.text }]}
                  keyboardType="decimal-pad"
                  value={String(labourRates.ev || 75)}
                  onChangeText={(val) => handleLabourChange('ev', val)}
                  placeholder="75.00"
                  placeholderTextColor={theme.colors.placeholder}
                  selectTextOnFocus
                />
                <Text style={[styles.unitText, { color: theme.colors.placeholder }]}>/hr</Text>
              </View>
            </View>
          </View>

          {/* Custom Workshop Add-ons Card */}
          <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.addonsHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.cardHeaderTitle, { color: theme.colors.text }]}>Custom Workshop Add-ons</Text>
                <Text style={[styles.cardHeaderSub, { color: theme.colors.placeholder }]}>
                  Fixed-rate bespoke upsells offered to customers alongside servicing.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.addAddonBtn, { backgroundColor: LOGO_BLUE }]}
                onPress={() => setShowAddAddon(!showAddAddon)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name={showAddAddon ? 'close' : 'plus'} size={15} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.addAddonBtnText}>{showAddAddon ? 'Cancel' : 'Add Item'}</Text>
              </TouchableOpacity>
            </View>

            {/* Inline Add Item Form */}
            {showAddAddon && (
              <View style={[styles.inlineAddonForm, { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }]}>
                <Text style={[styles.formSubHeader, { color: theme.colors.text }]}>New Custom Upsell Item</Text>
                <TextInput
                  style={[styles.addonInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                  placeholder="Item Name (e.g. Wheel Alignment, DPF Clean)"
                  placeholderTextColor={theme.colors.placeholder}
                  value={newAddonName}
                  onChangeText={setNewAddonName}
                />
                <View style={styles.inlineFormRow}>
                  <View style={[styles.addonInputWrap, { width: 100 }]}>
                    <TextInput
                      style={[styles.addonInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                      placeholder="Rate (£)"
                      placeholderTextColor={theme.colors.placeholder}
                      keyboardType="decimal-pad"
                      value={newAddonPrice}
                      onChangeText={setNewAddonPrice}
                    />
                  </View>
                  <View style={[styles.addonInputWrap, { flex: 1 }]}>
                    <TextInput
                      style={[styles.addonInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                      placeholder="Short Description"
                      placeholderTextColor={theme.colors.placeholder}
                      value={newAddonDesc}
                      onChangeText={setNewAddonDesc}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.submitAddonBtn, { backgroundColor: LOGO_BLUE }]}
                  onPress={handleCreateCustomProduct}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitAddonBtnText}>Add Product to Workshop</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Products List */}
            <View style={styles.addonItemsList}>
              {customProducts.map((prod: any, idx: number) => {
                const isEnabled = prod.enabled !== false;
                return (
                  <View
                    key={prod.name || idx}
                    style={[
                      styles.addonItemCard,
                      {
                        backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                        borderColor: isEnabled ? theme.colors.border : theme.colors.border + '50',
                        opacity: isEnabled ? 1 : 0.6,
                      },
                    ]}
                  >
                    <View style={styles.addonItemMain}>
                      <View style={styles.addonItemTitleRow}>
                        <Text style={[styles.addonItemName, { color: theme.colors.text }]} numberOfLines={1}>
                          {prod.name}
                        </Text>
                        <Text style={[styles.addonItemPriceTag, { color: theme.colors.primary }]}>
                          £{Number(prod.price || 0).toFixed(2)}
                        </Text>
                      </View>
                      {prod.description ? (
                        <Text style={[styles.addonItemDesc, { color: theme.colors.placeholder }]} numberOfLines={2}>
                          {prod.description}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.addonItemActions}>
                      <Switch
                        value={isEnabled}
                        onValueChange={(val) => handleToggleCustomProduct(idx, val)}
                        trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#CBD5E1"
                      />
                      <TouchableOpacity
                        onPress={() => handleDeleteCustomProduct(idx)}
                        style={styles.deleteAddonBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons name="delete-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Optional Standalone Save Button */}
      {showSaveButton && onSave && (
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: LOGO_BLUE }]}
          onPress={() => {
            // 1. MOT Validation
            const motStandalone = Number(pricing.mot?.class4Standalone ?? (pricing.mot as any)?.standalonePrice ?? 54.85);
            if (isNaN(motStandalone) || motStandalone <= 0) {
              Alert.alert('Validation Error', 'Please enter a valid price for Class 4 MOT.');
              return;
            }
            if (motStandalone > 54.85) {
              Alert.alert('DVSA Statutory Limit', `Class 4 MOT standalone price (£${motStandalone.toFixed(2)}) exceeds the official UK DVSA maximum statutory fee of £54.85.`);
              return;
            }

            const motCombo = Number(pricing.mot?.comboWithFullMajor ?? (pricing.mot as any)?.comboPriceWithService ?? 34.85);
            if (isNaN(motCombo) || motCombo < 0) {
              Alert.alert('Validation Error', 'Please enter a valid price for MOT Combo.');
              return;
            }
            if (motCombo > motStandalone) {
              Alert.alert('Validation Error', `MOT Combo price (£${motCombo.toFixed(2)}) cannot exceed the standalone MOT price (£${motStandalone.toFixed(2)}). Combo rate must be discounted.`);
              return;
            }

            // 2. Servicing Tiers Validation
            if (pricing.servicingTiers) {
              for (const [bracket, tier] of Object.entries(pricing.servicingTiers)) {
                if (!tier) continue;
                if (Number(tier.interim) <= 0 || Number(tier.full) <= 0 || Number(tier.major) <= 0) {
                  Alert.alert('Validation Error', `Please enter valid prices for all services in bracket ${bracket}.`);
                  return;
                }
                if (Number(tier.full) < Number(tier.interim)) {
                  Alert.alert('Validation Error', `In ${bracket}, Full Service price (£${tier.full}) cannot be lower than Interim Service price (£${tier.interim}).`);
                  return;
                }
                if (Number(tier.major) < Number(tier.full)) {
                  Alert.alert('Validation Error', `In ${bracket}, Major Service price (£${tier.major}) cannot be lower than Full Service price (£${tier.full}).`);
                  return;
                }
              }
            }

            // 3. Custom Products Validation
            if (Array.isArray(pricing.customProducts)) {
              for (const cp of pricing.customProducts) {
                if (!cp.name || !cp.name.trim()) {
                  Alert.alert('Validation Error', 'All workshop add-on products must have a name.');
                  return;
                }
                if (isNaN(Number(cp.price)) || Number(cp.price) < 0) {
                  Alert.alert('Validation Error', `Please enter a valid price for "${cp.name}".`);
                  return;
                }
              }
            }

            onSave();
          }}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="content-save-check" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving Rates...' : 'Save Pricing Rates'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  // Top Preset Banner
  presetBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  presetBannerContent: {
    width: '100%',
  },
  presetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  presetIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  presetBannerTitle: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
  },
  presetBannerSub: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 2,
    lineHeight: 15,
  },
  applyDefaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  applyDefaultBtnText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },

  // Horizontal Scroll Subtabs
  subTabsContainer: {
    marginBottom: 14,
  },
  subTabsContent: {
    gap: 8,
    paddingVertical: 2,
  },
  subTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  subTabText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },

  // Sections
  sectionWrap: {
    marginBottom: 10,
  },

  // Quick Rate Tools Bar
  quickToolsWrapper: {
    marginBottom: 14,
  },
  quickToolsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickAdjustLabel: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
  },
  quickAdjustScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  quickAdjustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickAdjustText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },

  // CC Bracket Selector
  bracketSectionHeader: {
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
  },
  sectionSubHeading: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  bracketPillsContainer: {
    gap: 8,
    paddingBottom: 12,
  },
  bracketPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 115,
  },
  bracketPillSelected: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  bracketPillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bracketPillLabel: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  bracketPillSub: {
    fontSize: 10,
    fontFamily: fonts.regular,
    marginTop: 2,
  },

  // Active Bracket Details Card
  bracketDetailsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  bracketHeaderRow: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#00000010',
  },
  bracketBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bracketCcBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  bracketCcBadgeText: {
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  bracketCarType: {
    fontSize: 13,
    fontFamily: fonts.bold,
    flex: 1,
  },
  bracketExamplesText: {
    fontSize: 11,
    fontFamily: fonts.regular,
  },

  // 4 Service Rates List
  serviceRatesList: {
    gap: 10,
  },
  serviceItemCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  serviceItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  serviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  serviceIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  serviceName: {
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  popularBadge: {
    backgroundColor: '#10B9811F',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  popularBadgeText: {
    color: '#10B981',
    fontSize: 8.5,
    fontFamily: fonts.bold,
  },
  serviceIntervalText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    lineHeight: 14,
  },

  // Clean Price Input Wrap (Guaranteed fit & no clipping)
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 38,
    width: 100,
  },
  currencySymbol: {
    fontSize: 13,
    fontFamily: fonts.bold,
    marginRight: 4,
  },
  priceInput: {
    fontSize: 13,
    fontFamily: fonts.bold,
    flex: 1,
    padding: 0,
    height: '100%',
  },

  // 6-Bracket Matrix Card
  matrixCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  matrixCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  matrixCardTitle: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
  },
  matrixCardSub: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  matrixTableInner: {
    minWidth: 440,
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  matrixHeadCol: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  colBracket: {
    width: 130,
    paddingRight: 6,
  },
  colPrice: {
    width: 76,
    textAlign: 'center',
  },
  matrixDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    marginVertical: 1,
  },
  matrixCellBracket: {
    fontSize: 11.5,
    fontFamily: fonts.bold,
  },
  matrixCellSub: {
    fontSize: 9.5,
    fontFamily: fonts.regular,
    marginTop: 1,
  },
  matrixCellPrice: {
    fontSize: 11.5,
    fontFamily: fonts.semiBold,
  },

  // Generic Content Card
  contentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  cardHeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTitle: {
    fontSize: 13.5,
    fontFamily: fonts.bold,
  },
  cardHeaderSub: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 2,
    lineHeight: 15,
  },

  // MOT Section Styles
  motItemBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  motItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  motItemTitle: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
  },
  savingPillRow: {
    flexDirection: 'row',
    marginTop: 3,
    marginBottom: 2,
  },
  savingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingTagText: {
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  motItemDesc: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    marginTop: 3,
    lineHeight: 14,
  },

  // Delivery Section Styles
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  freeBadgeText: {
    fontSize: 10.5,
    fontFamily: fonts.bold,
  },
  deliveryConfigFields: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  deliveryFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deliveryFieldLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  smallInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 34,
    width: 80,
  },
  smallInput: {
    fontSize: 12,
    fontFamily: fonts.bold,
    padding: 0,
    flex: 1,
    height: '100%',
  },
  unitText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    marginLeft: 3,
  },

  // Labour Section Styles
  labourRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  labourFieldTitle: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
  },
  labourFieldSub: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    marginTop: 2,
  },

  // Custom Addons Section Styles
  addonsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addAddonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  addAddonBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontFamily: fonts.bold,
  },
  inlineAddonForm: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  formSubHeader: {
    fontSize: 12,
    fontFamily: fonts.bold,
    marginBottom: 6,
  },
  addonInput: {
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    fontFamily: fonts.regular,
  },
  inlineFormRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addonInputWrap: {},
  submitAddonBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  submitAddonBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: fonts.bold,
  },
  addonItemsList: {
    gap: 8,
  },
  addonItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  addonItemMain: {
    flex: 1,
    marginRight: 8,
  },
  addonItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  addonItemName: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    flex: 1,
  },
  addonItemPriceTag: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    marginLeft: 6,
  },
  addonItemDesc: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    lineHeight: 14,
  },
  addonItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteAddonBtn: {
    padding: 4,
  },

  // Save Button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: fonts.bold,
  },
});
