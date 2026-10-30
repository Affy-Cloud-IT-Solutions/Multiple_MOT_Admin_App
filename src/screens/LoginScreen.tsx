import React, { useState, useEffect } from 'react';
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
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { validateEmail, validatePassword } from '../utils/validationUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts } from '../theme/theme';
import {
  EmailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
} from '../components/SvgIcons';

export default function LoginScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { setToken, setTokens, setUser, refreshSession } = useAppValues();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkPersistedSession = async () => {
      setLoading(true);
      try {
        const storedToken = await AsyncStorage.getItem('user_token');
        const storedRefreshToken = await AsyncStorage.getItem('user_refresh_token');
        const storedUserJson = await AsyncStorage.getItem('user_profile');

        if (storedRefreshToken && storedUserJson) {
          const storedUser = JSON.parse(storedUserJson);
          console.log('[LOGIN] Verifying persisted session with refresh token...');
          const isStaffRole = (role?: string) => role === 'admin' || role === 'staff' || role === 'garage_admin';

          // Make the shared session aware of the stored tokens, then refresh through the app's single,
          // de-duplicated refresh (so it can't race another refresh with the same token)
          setTokens(storedToken, storedRefreshToken);
          const outcome = await refreshSession();

          if (outcome.status === 'ok') {
            const activeUser = outcome.user || storedUser;
            setUser(activeUser);
            if (isStaffRole(activeUser.role)) {
              navigation.replace('Main');
              return;
            }
            setTokens(null, null);
            setUser(null);
          } else if (outcome.status === 'transient') {
            // Offline / server issue: the session is still valid - keep it instead of forcing a new login
            console.warn('[LOGIN] Could not verify session right now, keeping stored session:', outcome.reason);
            setUser(storedUser);
            if (isStaffRole(storedUser.role)) {
              navigation.replace('Main');
              return;
            }
          } else {
            console.warn('[LOGIN] Stored refresh token is expired or invalid. Staying on Login.');
            setTokens(null, null);
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Error reading persisted session:', err);
      } finally {
        setLoading(false);
      }
    };
    checkPersistedSession();
  }, []);

  const handleLogin = async () => {
    const emailVal = validateEmail(email);
    if (emailVal.error) {
      setEmailError(true);
      setErrorMessage(emailVal.error);
      return;
    }
    setEmailError(false);

    const passwordVal = validatePassword(password);
    if (passwordVal.error) {
      setPasswordError(true);
      setErrorMessage(passwordVal.error);
      return;
    }
    setPasswordError(false);

    setErrorMessage(null);
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: password.trim() })
      });
      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        // Pending or rejected garages still sign in - their application status is shown on the dashboard
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
        return;
      }

      // Save tokens and user details to context
      setTokens(data.accessToken || data.token, data.refreshToken || null);
      setUser(data.user);

      // Navigate based on actual backend user role
      if (data.user?.role === 'admin' || data.user?.role === 'staff' || data.user?.role === 'garage_admin') {
        navigation.replace('Main');
      } else {
        Alert.alert('Access Denied', 'This app is strictly for staff and admins.');
        setTokens(null, null);
        setUser(null);
      }
    } catch (error) {
      setLoading(false);
      console.error('Login error:', error);
      Alert.alert('Connection Error', 'Could not connect to the backend server.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo and Brand */}
        <View style={styles.headerContainer}>
          <View style={styles.brandLogoCard}>
            <Image
              source={require('../images/ondoorcarservice_Logo.png')}
              style={styles.brandLogoImage}
              resizeMode="contain"
              accessibilityLabel="Ondoorcarservice"
            />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Ondoorcarservice Hub
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            Garage Testing Station & Reminder Terminal
          </Text>
        </View>

        {/* Login Form Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.portalHeading, { color: theme.colors.text }]}>Sign In</Text>

            {errorMessage && (
              <View style={[styles.errorContainer, { borderColor: theme.colors.error + '40', backgroundColor: theme.colors.error + '10' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.error} style={{ marginRight: 6 }} />
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{errorMessage}</Text>
              </View>
            )}
            
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Email Address</Text>
            <View style={[styles.inputContainer, { borderColor: emailError ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}>
              <View style={styles.inputIcon}>
                <EmailIcon size={20} color={theme.colors.placeholder} />
              </View>
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError(false);
                  setErrorMessage(null);
                }}
                placeholder="E.g. manager@garage.co.uk"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, { color: theme.colors.text }]}
              />
            </View>

            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Password</Text>
            <View style={[styles.inputContainer, { borderColor: passwordError ? theme.colors.error : theme.colors.border, backgroundColor: theme.colors.background }]}>
              <View style={styles.inputIcon}>
                <LockIcon size={20} color={theme.colors.placeholder} />
              </View>
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
                {showPassword ? (
                  <EyeOffIcon size={20} color={theme.colors.placeholder} />
                ) : (
                  <EyeIcon size={20} color={theme.colors.placeholder} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sign In to Dashboard</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerContainer}>
              <Text style={[styles.footerText, { color: theme.colors.placeholder }]}>Don't have a garage account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={[styles.signupText, { color: theme.colors.primary, fontSize: 13 }]}>Register Garage</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  brandLogoCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoImage: {
    width: 200,
    height: 93, // logo is 590 x 273
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 30,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    padding: 16,
    borderRadius: 24,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: 26,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
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
  portalHeading: {
    fontFamily: fonts.bold,
    fontSize: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13.5,
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
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    fontFamily: fonts.medium,
    flex: 1,
    height: '100%',
    fontSize: 14.5,
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
    fontFamily: fonts.bold,
    color: '#FFFFFF',
    fontSize: 15.5,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  signupText: {
    fontFamily: fonts.bold,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    flex: 1,
  },
});
