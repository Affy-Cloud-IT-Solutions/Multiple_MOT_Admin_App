import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';

export default function ResultScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const [saving, setSaving] = useState(false);

  const defaultVehicle = {
    registration: 'AB18 CDE',
    make: 'FORD',
    model: 'FOCUS TDCI',
    year: '2018',
    color: 'Metallic Grey',
    fuelType: 'Diesel',
    engineSize: '1499cc',
    status: 'PASS',
    expiryDate: '12 July 2027',
    testDate: '13 July 2026',
    testNumber: '8910 2345 6789',
    mileage: '48,250 miles',
    advisories: [
      'Front brake pads wearing thin (minor)',
      'Nearside rear tyre worn close to legal limit (advisory)',
    ],
    failures: [],
  };

  const vehicle = route?.params?.vehicleData || defaultVehicle;
  const isPass = vehicle.status === 'PASS';

  const handleSaveToHistory = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      Alert.alert(
        'Success',
        `Vehicle ${vehicle.registration} has been saved to your local search history!`
      );
    }, 1500);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header Plate */}
      <View style={styles.header}>
        <View style={styles.plateContainer}>
          <View style={styles.ukStrip}>
            <Text style={styles.ukText}>UK</Text>
          </View>
          <Text style={styles.plateText}>{vehicle.registration}</Text>
        </View>
        <Text style={[styles.vehicleTitle, { color: theme.colors.text }]}>
          {vehicle.make} {vehicle.model}
        </Text>
        <Text style={[styles.vehicleSpec, { color: theme.colors.placeholder }]}>
          {vehicle.year} • {vehicle.color} • {vehicle.fuelType} ({vehicle.engineSize})
        </Text>
      </View>

      {/* MOT Status Card */}
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={styles.statusContent}>
          <View
            style={[
              styles.statusIconCircle,
              { backgroundColor: isPass ? theme.colors.success + '15' : theme.colors.error + '15' },
            ]}
          >
            <MaterialCommunityIcons
              name={isPass ? 'check-decagram' : 'alert-decagram'}
              size={54}
              color={isPass ? theme.colors.success : theme.colors.error}
            />
          </View>

          <Text
            style={[
              styles.statusText,
              { color: isPass ? theme.colors.success : theme.colors.error },
            ]}
          >
            MOT {vehicle.status}
          </Text>

          <Text style={[styles.expiryText, { color: theme.colors.text }]}>
            {isPass ? 'Expiry Date:' : 'Status Detail:'}{' '}
            <Text style={{ fontWeight: 'bold' }}>{vehicle.expiryDate}</Text>
          </Text>
        </View>
      </View>

      {/* Vehicle Specification Details Card */}
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Test Details</Text>
        
        <View style={styles.detailRow}>
          <Text style={{ color: theme.colors.placeholder }}>Test Date</Text>
          <Text style={[styles.detailValue, { color: theme.colors.text }]}>{vehicle.testDate}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        
        <View style={styles.detailRow}>
          <Text style={{ color: theme.colors.placeholder }}>Test Number</Text>
          <Text style={[styles.detailValue, { color: theme.colors.text }]}>{vehicle.testNumber}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        
        <View style={styles.detailRow}>
          <Text style={{ color: theme.colors.placeholder }}>Mileage</Text>
          <Text style={[styles.detailValue, { color: theme.colors.text }]}>{vehicle.mileage}</Text>
        </View>
      </View>

      {/* Failures (if FAIL status) */}
      {!isPass && vehicle.failures && vehicle.failures.length > 0 && (
        <View style={[styles.card, styles.failuresCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="alert-octagon" size={20} color={theme.colors.error} style={{ marginRight: 8 }} />
            <Text style={[styles.cardTitle, { color: theme.colors.error, marginBottom: 0 }]}>Failures & Major Defects</Text>
          </View>
          <View style={styles.listContainer}>
            {vehicle.failures.map((fail: string, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <MaterialCommunityIcons name="circle-slice-8" size={14} color={theme.colors.error} style={styles.bulletIcon} />
                <Text style={[styles.itemText, { color: theme.colors.text }]}>{fail}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Advisories */}
      {vehicle.advisories && vehicle.advisories.length > 0 && (
        <View style={[styles.card, styles.advisoriesCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={theme.colors.warning} style={{ marginRight: 8 }} />
            <Text style={[styles.cardTitle, { color: theme.colors.warning, marginBottom: 0 }]}>Advisory Notices</Text>
          </View>
          <View style={styles.listContainer}>
            {vehicle.advisories.map((adv: string, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <MaterialCommunityIcons name="circle-slice-8" size={14} color={theme.colors.warning} style={styles.bulletIcon} />
                <Text style={[styles.itemText, { color: theme.colors.text }]}>{adv}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Save Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={handleSaveToHistory}
          disabled={saving}
          style={[
            styles.saveButton,
            { backgroundColor: theme.colors.primary, opacity: saving ? 0.7 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
          ) : (
            <View style={styles.saveButtonContent}>
              <MaterialCommunityIcons 
                name="bookmark-outline" 
                size={20} 
                color={theme.dark ? theme.colors.background : '#FFFFFF'} 
                style={{ marginRight: 8 }} 
              />
              <Text style={[styles.saveButtonText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Save to History</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginVertical: 24,
    paddingHorizontal: 16,
  },
  plateContainer: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: '#FFD300',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  ukStrip: {
    width: 28,
    height: '100%',
    backgroundColor: '#0A4E9B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ukText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 8,
  },
  plateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    paddingHorizontal: 16,
    letterSpacing: 1.5,
  },
  vehicleTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  vehicleSpec: {
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statusContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  statusIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  expiryText: {
    fontSize: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  detailValue: {
    fontWeight: '500',
  },
  divider: {
    height: 1,
  },
  failuresCard: {
    borderColor: '#EF444450',
    borderWidth: 1.2,
  },
  advisoriesCard: {
    borderColor: '#F59E0B50',
    borderWidth: 1.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listContainer: {
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
    paddingRight: 8,
  },
  bulletIcon: {
    marginTop: 3,
    marginRight: 8,
  },
  itemText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    marginBottom: 32,
    marginTop: 8,
  },
  saveButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
