import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';

const MOCK_VEHICLES: Record<string, any> = {
  'AB18 CDE': {
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
  'LD65 XYZ': {
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
  'MH07 KKK': {
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
};

export default function HomeScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const [regNumber, setRegNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheckMOT = () => {
    const formattedReg = regNumber.trim().toUpperCase();
    if (!formattedReg) {
      Alert.alert('Error', 'Please enter a vehicle registration number');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      let vehicleData = MOCK_VEHICLES[formattedReg];
      
      if (!vehicleData) {
        const isPass = formattedReg.length % 2 === 0;
        vehicleData = {
          registration: formattedReg,
          make: 'VOLKSWAGEN',
          model: 'GOLF TSI',
          year: '2017',
          color: 'Blue',
          fuelType: 'Petrol',
          engineSize: '1395cc',
          status: isPass ? 'PASS' : 'FAIL',
          expiryDate: isPass ? '18 September 2026' : 'Expired (10 May 2026)',
          testDate: '19 September 2025',
          testNumber: '4455 6677 8899',
          mileage: '54,000 miles',
          advisories: isPass ? ['Rear brake discs worn, pitted or scored (minor)'] : ['Front tyres worn close to limit'],
          failures: isPass ? [] : ['Windscreen wiper does not clear the windshield effectively (major failure)'],
        };
      }

      navigation.navigate('Result', { vehicleData });
    }, 1500);
  };

  const handleRecentCheckPress = (reg: string) => {
    const vehicleData = MOCK_VEHICLES[reg];
    navigation.navigate('Result', { vehicleData });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={[styles.bannerTitle, { color: theme.colors.text }]}>
            UK MOT Status Check
          </Text>
          <Text style={[styles.bannerSubtitle, { color: theme.colors.placeholder }]}>
            Enter a registration plate to view real-time MOT status, history, advisories, and failures.
          </Text>
        </View>

        {/* Plate Search Input Container */}
        <View style={[styles.searchCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
            Enter Registration Mark
          </Text>

          {/* Styled UK License Plate Container */}
          <View style={styles.plateOuterContainer}>
            <View style={styles.ukPlateStrip}>
              <Text style={styles.ukPlateStripText}>UK</Text>
            </View>
            <TextInput
              value={regNumber}
              onChangeText={setRegNumber}
              placeholder="E.g. AB18 CDE"
              placeholderTextColor="#808080"
              style={styles.plateInput}
              autoCapitalize="characters"
              maxLength={8}
              underlineColorAndroid="transparent"
            />
          </View>

          <TouchableOpacity
            onPress={handleCheckMOT}
            disabled={loading}
            style={[
              styles.searchButton,
              { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
            ) : (
              <Text style={[styles.searchButtonText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Check MOT Status</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Recent Checks Section */}
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Recent Checks
          </Text>

          {/* Recent Checks List */}
          {Object.keys(MOCK_VEHICLES).map((reg) => {
            const item = MOCK_VEHICLES[reg];
            const isPass = item.status === 'PASS';
            return (
              <TouchableOpacity
                key={reg}
                onPress={() => handleRecentCheckPress(reg)}
                style={[
                  styles.recentCard,
                  { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.recentCardLayout}>
                  <View style={styles.recentInfo}>
                    <View style={styles.recentPlate}>
                      <Text style={styles.recentPlateText}>{item.registration}</Text>
                    </View>
                    <View style={styles.vehicleDetails}>
                      <Text style={[styles.vehicleText, { color: theme.colors.text }]}>
                        {item.make} {item.model}
                      </Text>
                      <Text style={[styles.vehicleCheckDate, { color: theme.colors.placeholder }]}>
                        Checked on {item.testDate}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: isPass ? theme.colors.success + '20' : theme.colors.error + '20' },
                    ]}
                  >
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  banner: {
    alignItems: 'center',
    marginVertical: 24,
    paddingHorizontal: 8,
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  bannerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  searchCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  plateOuterContainer: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#FFD300', // UK Plate Yellow
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    alignItems: 'center',
  },
  ukPlateStrip: {
    width: 36,
    height: '100%',
    backgroundColor: '#0A4E9B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ukPlateStripText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 10,
  },
  plateInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 2,
    height: '100%',
    padding: 0,
  },
  searchButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recentSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  recentCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  recentCardLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  recentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentPlate: {
    backgroundColor: '#FFD300',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 12,
  },
  recentPlateText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  vehicleCheckDate: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
