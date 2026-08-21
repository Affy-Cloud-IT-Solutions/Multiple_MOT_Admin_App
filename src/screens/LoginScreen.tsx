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
import { validateEmail, validatePassword } from '../utils/validationUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const { setToken, setUser } = useAppValues();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    const checkPersistedSession = async () => {
      setLoading(true);
      try {
        const storedToken = await AsyncStorage.getItem('user_token');
        const storedUserJson = await AsyncStorage.getItem('user_profile');
        if (storedToken && storedUserJson) {
          const storedUser = JSON.parse(storedUserJson);
          setToken(storedToken);
          setUser(storedUser);
          
          if (storedUser.role === 'admin' || storedUser.role === 'staff') {
            navigation.replace('Main');
          } else if (storedUser.role === 'customer' && storedUser.customerId) {
            navigation.replace('CustomerPortal', { customerId: storedUser.customerId });
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
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: password.trim() })
      });
      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
        return;
      }

      // Save token and user details to context
      setToken(data.token);
      setUser(data.user);

      // Navigate based on actual backend user role
      if (data.user?.role === 'admin' || data.user?.role === 'staff') {
        navigation.replace('Main');
      } else if (data.user?.role === 'customer') {
        if (data.user.customerId) {
          navigation.replace('CustomerPortal', { customerId: data.user.customerId });
        } else {
          Alert.alert('Error', 'No customer profile linked to this account.');
        }
      } else {
        Alert.alert('Error', 'Unknown user role returned from server.');
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
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="bell-ring" size={50} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            MOT Reminders
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.placeholder }]}>
            Garage MOT Reminder Management System
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
              <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.placeholder} style={styles.inputIcon} />
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError(false);
                  setErrorMessage(null);
                }}
                placeholder="E.g. user@example.com"
                placeholderTextColor={theme.colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, { color: theme.colors.text }]}
              />
            </View>

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

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={[
                styles.button,
                { backgroundColor: theme.colors.primary, opacity: loading ? 0.7 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={theme.dark ? theme.colors.background : '#FFFFFF'} size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Link to Registration */}
        <View style={styles.footerContainer}>
          <Text style={{ color: theme.colors.placeholder }}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={[styles.signupText, { color: theme.colors.secondary }]}>Sign Up</Text>
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
    marginBottom: 24,
  },
  iconContainer: {
    padding: 16,
    borderRadius: 24,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: 'bold',
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  portalInfoText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
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
  customerSelectorContainer: {
    marginBottom: 16,
  },
  customerSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  customerName: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
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
