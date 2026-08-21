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
import { BASE_URL } from '../context/DataContext';
import {
  validateFirstName,
  validateLastName,
  validatePhoneNumber,
  validateEmail,
  validatePassword
} from '../utils/validationUtils';

export default function SignupScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [mobileError, setMobileError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignup = async () => {
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const firstVal = validateFirstName(firstName);
    if (firstVal.error) {
      setNameError(true);
      setErrorMessage(firstVal.error);
      return;
    }

    if (!lastName) {
      setNameError(true);
      setErrorMessage('Last name is required. Please enter a full name.');
      return;
    }
    const lastVal = validateLastName(lastName);
    if (lastVal.error) {
      setNameError(true);
      setErrorMessage(lastVal.error);
      return;
    }
    setNameError(false);

    const emailVal = validateEmail(email);
    if (emailVal.error) {
      setEmailError(true);
      setErrorMessage(emailVal.error);
      return;
    }
    setEmailError(false);

    const mobileVal = validatePhoneNumber(mobile);
    if (mobileVal.error) {
      setMobileError(true);
      setErrorMessage(mobileVal.error);
      return;
    }
    setMobileError(false);

    const passwordVal = validatePassword(password);
    if (passwordVal.error) {
      setPasswordError(true);
      setErrorMessage(passwordVal.error);
      return;
    }
    setPasswordError(false);

    if (password.trim() !== confirmPassword.trim()) {
      setPasswordError(true);
      setConfirmPasswordError(true);
      setErrorMessage('Passwords do not match');
      return;
    }
    setConfirmPasswordError(false);
    setErrorMessage(null);

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          mobile: mobile.trim()
        })
      });
      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        Alert.alert('Signup Failed', data.error || 'Failed to create account');
        return;
      }

      Alert.alert(
        'Success',
        'Account created successfully! Please log in.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      setLoading(false);
      console.error('Signup error:', error);
      Alert.alert('Connection Error', 'Could not connect to the backend server.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Create Account
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            Sign up to track and check vehicle histories
          </Text>
        </View>

        {/* Signup Form Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>

          {errorMessage && (
            <View style={[styles.errorContainer, { borderColor: theme.colors.error + '40', backgroundColor: theme.colors.error + '10' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMessage}</Text>
            </View>
          )}

          {/* Full Name */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Full Name</Text>
          <View style={[styles.inputContainer, { borderColor: nameError ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}>
            <MaterialCommunityIcons name="account-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                setNameError(false);
                setErrorMessage(null);
              }}
              placeholder="E.g. Alex Mercer"
              placeholderTextColor={theme.colors.placeholder}
              autoCapitalize="words"
              style={[styles.input, { color: theme.colors.text }]}
            />
          </View>

          {/* Email */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email Address</Text>
          <View style={[styles.inputContainer, { borderColor: emailError ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}>
            <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError(false);
                setErrorMessage(null);
              }}
              placeholder="E.g. alex@example.com"
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, { color: theme.colors.text }]}
            />
          </View>

          {/* Mobile Number (Customer only) */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Mobile Number</Text>
          <View style={[styles.inputContainer, { borderColor: mobileError ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}>
            <MaterialCommunityIcons name="phone-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={mobile}
              onChangeText={(text) => {
                setMobile(text);
                setMobileError(false);
                setErrorMessage(null);
              }}
              placeholder="E.g. 07700 900077"
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="phone-pad"
              style={[styles.input, { color: theme.colors.text }]}
            />
          </View>

          {/* Password */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Password</Text>
          <View style={[styles.inputContainer, { borderColor: passwordError ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError(false);
                setErrorMessage(null);
              }}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.placeholder}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.input, { color: theme.colors.text }]}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.placeholder}
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Confirm Password</Text>
          <View style={[styles.inputContainer, { borderColor: confirmPasswordError ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}>
            <MaterialCommunityIcons name="lock-check-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
            <TextInput
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setConfirmPasswordError(false);
                setErrorMessage(null);
              }}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.placeholder}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              style={[styles.input, { color: theme.colors.text }]}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
              <MaterialCommunityIcons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.placeholder}
              />
            </TouchableOpacity>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            onPress={handleSignup}
            disabled={loading}
            style={[
              styles.button,
              { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={{ color: theme.colors.placeholder }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.loginText, { color: theme.colors.secondary }]}>Sign In</Text>
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    padding: 0,
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    fontWeight: 'bold',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
  },
});
