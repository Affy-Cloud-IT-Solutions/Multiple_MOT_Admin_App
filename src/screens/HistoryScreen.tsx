import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';

const HISTORICAL_CHECKS = [
  {
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
      'Front suspension arm pin or bush worn but not resulting in excessive movement (advisory)',
    ],
    failures: [],
  },
  {
    registration: 'LD65 XYZ',
    make: 'VAUXHALL',
    model: 'CORSA ECOFLEX',
    year: '2015',
    color: 'Red',
    fuelType: 'Petrol',
    engineSize: '1398cc',
    status: 'FAIL',
    expiryDate: 'Expired (14 Jan 2026)',
    testDate: '15 Jan 2026',
    testNumber: '1122 3344 5566',
    mileage: '67,890 miles',
    advisories: [
      'Nearside front tyre slightly damaged (advisory)',
      'Monitor oil leak from gearbox area (minor)',
    ],
    failures: [
      'Nearside front headlamp not working on dipped beam (major failure)',
      'Offside rear brake disc worn below limit (major failure)',
      'Exhaust emissions exceed limit values (major failure)',
    ],
  },
  {
    registration: 'MH07 KKK',
    make: 'BMW',
    model: '320D M SPORT',
    year: '2019',
    color: 'White',
    fuelType: 'Diesel',
    engineSize: '1995cc',
    status: 'PASS',
    expiryDate: '28 October 2026',
    testDate: '29 October 2025',
    testNumber: '9988 7766 5544',
    mileage: '32,100 miles',
    advisories: [],
    failures: [],
  },
  {
    registration: 'GY19 PLK',
    make: 'AUDI',
    model: 'A3 SPORTBACK',
    year: '2019',
    color: 'Black',
    fuelType: 'Petrol',
    engineSize: '1495cc',
    status: 'PASS',
    expiryDate: '03 March 2027',
    testDate: '04 March 2026',
    testNumber: '5566 7788 9900',
    mileage: '41,500 miles',
    advisories: [
      'Offside front tyre slightly worn on outer edge (advisory)',
    ],
    failures: [],
  },
];

export default function HistoryScreen({ navigation }: any) {
  const { theme } = useAppTheme();

  const handleCardPress = (vehicleData: any) => {
    navigation.navigate('Result', { vehicleData });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Search History
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
          Select a vehicle from your recent searches to view details
        </Text>
      </View>

      <View style={styles.listContainer}>
        {HISTORICAL_CHECKS.map((item, index) => {
          const isPass = item.status === 'PASS';
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.card,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
              onPress={() => handleCardPress(item)}
            >
              <View style={styles.cardContent}>
                <View style={styles.leftContainer}>
                  {/* Plate Component */}
                  <View style={styles.plate}>
                    <View style={styles.ukStrip}>
                      <Text style={styles.ukText}>UK</Text>
                    </View>
                    <Text style={styles.plateText}>{item.registration}</Text>
                  </View>

                  <View style={styles.vehicleDetails}>
                    <Text style={[styles.makeModelText, { color: theme.colors.text }]}>
                      {item.make} {item.model}
                    </Text>
                    <Text style={[styles.dateText, { color: theme.colors.placeholder }]}>
                      Checked on {item.testDate}
                    </Text>
                  </View>
                </View>

                {/* Status Badging */}
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: isPass ? theme.colors.success + '20' : theme.colors.error + '20' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isPass ? 'check-circle-outline' : 'alert-circle-outline'}
                    size={16}
                    color={isPass ? theme.colors.success : theme.colors.error}
                    style={styles.statusIcon}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: isPass ? theme.colors.success : theme.colors.error },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  leftContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  plate: {
    flexDirection: 'row',
    height: 30,
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    alignItems: 'center',
    marginBottom: 8,
  },
  ukStrip: {
    width: 18,
    height: '100%',
    backgroundColor: '#0A4E9B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ukText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 6,
  },
  plateText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    paddingHorizontal: 8,
    letterSpacing: 0.5,
  },
  vehicleDetails: {
    paddingLeft: 2,
  },
  makeModelText: {
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'center',
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
