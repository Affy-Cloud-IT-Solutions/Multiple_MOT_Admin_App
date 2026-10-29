import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
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
import { useAppValues, BASE_URL } from '../context/DataContext';
import { fonts } from '../theme/theme';
import {
  validatePhoneNumber,
  validateEmail,
  validatePassword
} from '../utils/validationUtils';

export default function SignupScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { setToken, setUser, refreshData } = useAppValues();

  // Registration Fields
  const [garageName, setGarageName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [garageEmail, setGarageEmail] = useState('');
  const [garagePhone, setGaragePhone] = useState('');
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('18:00');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMessage(null);

    // Validation
    if (!garageName.trim()) {
      setErrorMessage('Please enter your Garage Name.');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('Please enter the Owner / Manager Name.');
      return;
    }
    const emailVal = validateEmail(garageEmail);
    if (emailVal.error) {
      setErrorMessage(emailVal.error);
      return;
    }
    const phoneVal = validatePhoneNumber(garagePhone);
    if (phoneVal.error) {
      setErrorMessage(phoneVal.error);
      return;
    }
    const passVal = validatePassword(password);
    if (passVal.error) {
      setErrorMessage(passVal.error);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: garageName.trim(),
        garageName: garageName.trim(),
        ownerName: ownerName.trim(),
        email: garageEmail.trim().toLowerCase(),
        phone: garagePhone.trim(),
        address: 'Pending Location Setup',
        city: 'London',
        postcode: '',
        openingTime: openingTime.trim() || '08:00',
        closingTime: closingTime.trim() || '18:00',
        password: password.trim(),
        ownerPassword: password.trim(),
        images: [
          'https://images.unsplash.com/photo-1617886322168-72b886573c3c?w=800&h=500&fit=crop',
          'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=800&h=500&fit=crop',
          'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?w=800&h=500&fit=crop'
        ],
        verificationDocuments: [],
        legalDeclaration: true
      };

      const res = await fetch(`${BASE_URL}/garages/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to complete registration.');
        return;
      }

      // If token and user were returned, log in instantly
      if (data.token && data.user) {
        setToken(data.token);
        setUser(data.user);
        await refreshData(data.token);
        navigation.replace('Main');
      } else {
        Alert.alert(
          'Registration Successful! 🎉',
          'Your garage account has been created. Please log in with your credentials.',
          [{ text: 'Log In Now', onPress: () => navigation.replace('Login') }]
        );
      }
    } catch (err: any) {
      setLoading(false);
      console.error('Registration submission error:', err);
      setErrorMessage('Could not connect to the backend server. Please verify your network.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Header */}
        <View style={styles.headerContainer}>
          <View style={[styles.badgeContainer, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="shield-check" size={28} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Registration</Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            Create your account to start managing your garage
          </Text>
        </View>

        {/* Error message banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Compact Form Card */}
        <View style={[styles.formCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {/* Garage Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Garage Name *</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="storefront-outline" size={18} color={theme.colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="e.g. Apex Auto MOT Centre"
                placeholderTextColor={theme.colors.placeholder}
                value={garageName}
                onChangeText={setGarageName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Owner Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Owner / Manager Name *</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="account-outline" size={18} color={theme.colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="e.g. David Miller"
                placeholderTextColor={theme.colors.placeholder}
                value={ownerName}
                onChangeText={setOwnerName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Email & Phone side-by-side or stacked cleanly */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Email Address *</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="e.g. service@apexauto.co.uk"
                placeholderTextColor={theme.colors.placeholder}
                value={garageEmail}
                onChangeText={setGarageEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Phone Number *</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="phone-outline" size={18} color={theme.colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="e.g. 020 7946 0192"
                placeholderTextColor={theme.colors.placeholder}
                value={garagePhone}
                onChangeText={setGaragePhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Opening & Closing Times side-by-side */}
          <View style={styles.rowFields}>
            <View style={[styles.fieldGroup, { flex: 1, marginRight: 6 }]}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Opening</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="clock-time-four-outline" size={16} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="08:00"
                  placeholderTextColor={theme.colors.placeholder}
                  value={openingTime}
                  onChangeText={setOpeningTime}
                />
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1, marginLeft: 6 }]}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Closing</Text>
              <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="clock-time-eight-outline" size={16} color={theme.colors.placeholder} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="18:00"
                  placeholderTextColor={theme.colors.placeholder}
                  value={closingTime}
                  onChangeText={setClosingTime}
                />
              </View>
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Password *</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="lock-outline" size={18} color={theme.colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Minimum 6 characters"
                placeholderTextColor={theme.colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={18} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Confirm Password *</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="lock-check-outline" size={18} color={theme.colors.placeholder} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Re-enter password"
                placeholderTextColor={theme.colors.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                <MaterialCommunityIcons name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Create Account</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Existing account link */}
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: theme.colors.placeholder }]}>
            Already have an account?
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.loginLink, { color: theme.colors.primary }]}> Log In</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 50 : 24,
    paddingBottom: 28,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    fontFamily: fonts.semiBold,
    flex: 1,
    color: '#DC2626',
    fontSize: 12,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    marginBottom: 5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    fontFamily: fonts.medium,
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  rowFields: {
    flexDirection: 'row',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 10,
    marginTop: 6,
    gap: 8,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  loginLink: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
