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
  Modal,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';
import { validateEmail, validatePassword } from '../utils/validationUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AdminHeroLogo,
  EmailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
} from '../components/SvgIcons';

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

  // Rejected documents & Application status states for Garage Admin
  const [garageInfo, setGarageInfo] = useState<{
    garageId: string;
    garageName: string;
    status: string;
    rejectionReason?: string;
  } | null>(null);
  const [rejectedDocuments, setRejectedDocuments] = useState<any[]>([]);
  const [reuploadModalVisible, setReuploadModalVisible] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  useEffect(() => {
    const checkPersistedSession = async () => {
      setLoading(true);
      try {
        const storedToken = await AsyncStorage.getItem('user_token');
        const storedUserJson = await AsyncStorage.getItem('user_profile');
        if (storedToken && storedUserJson) {
          const storedUser = JSON.parse(storedUserJson);
          setToken(storedToken);
          setUser(storedUser);
          
          if (storedUser.role === 'admin' || storedUser.role === 'staff' || storedUser.role === 'garage_admin') {
            navigation.replace('Main');
          } else {
            setToken(null);
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

  // Helper for uploading file to backend
  const uploadDocumentToBackend = async (fileUri: string, fileName: string, fileType: string) => {
    const formData = new FormData();
    formData.append('document', {
      uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
      name: fileName || `reupload_${Date.now()}.pdf`,
      type: fileType || 'application/pdf'
    } as any);

    const res = await fetch(`${BASE_URL}/upload/document`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error('Could not upload file to server.');
    }
    const data = await res.json();
    return data.url || fileUri;
  };

  // Pick & Re-upload replacement document
  const handlePickAndResubmitDocument = async (doc: any) => {
    const docId = doc._id || doc.id;
    if (!docId || !garageInfo?.garageId) return;

    try {
      const results = await pick({
        type: [types.pdf, types.images, types.doc, types.docx, types.plainText],
        allowMultiSelection: false
      });

      if (!results || results.length === 0) return;
      const file = results[0];
      if (!file.uri) return;

      setUploadingDocId(docId);

      let uploadedUrl = file.uri;
      try {
        uploadedUrl = await uploadDocumentToBackend(
          file.uri,
          file.name || `${doc.name}.pdf`,
          file.type || 'application/pdf'
        );
      } catch (uploadErr) {
        console.warn('Backend upload fallback:', uploadErr);
      }

      // Call PUT API to resubmit the document
      const res = await fetch(`${BASE_URL}/garages/${garageInfo.garageId}/documents/${docId}/resubmit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newFileUrl: uploadedUrl,
          name: doc.name
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resubmit document.');
      }

      // Update local rejected documents state
      const remaining = rejectedDocuments.filter(d => (d._id || d.id) !== docId);
      setRejectedDocuments(remaining);

      if (remaining.length === 0) {
        setGarageInfo(null);
        setReuploadModalVisible(false);
        Alert.alert(
          'Documents Re-submitted!',
          'All updated documents have been submitted successfully. Your registration is back under review by the Platform Super Admin.',
          [{ text: 'Great!', style: 'default' }]
        );
      } else {
        Alert.alert(
          'Document Updated',
          `"${doc.name}" has been replaced and submitted for review. ${remaining.length} document(s) remaining.`
        );
      }
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      console.error('Re-upload error:', err);
      Alert.alert('Re-upload Notice', err.message || 'Could not select or upload document.');
    } finally {
      setUploadingDocId(null);
    }
  };

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
        // If there are rejected documents requiring re-upload, open modal directly
        const rejected = data.rejectedDocuments || [];
        if (rejected.length > 0) {
          setRejectedDocuments(rejected);
          setGarageInfo({
            garageId: data.garageId,
            garageName: data.garageName,
            status: data.status,
            rejectionReason: data.rejectionReason
          });
          // Directly open re-upload action popup
          setReuploadModalVisible(true);
          return;
        }

        if (data.status === 'Pending') {
          Alert.alert(
            'Application Pending Approval',
            data.error || 'Your garage registration is currently pending Super Admin review. You will be able to log in once your facility photos and MOT authorization documentation are approved.',
            [{ text: 'Understood', style: 'default' }]
          );
        } else if (data.status === 'Rejected') {
          Alert.alert(
            'Application Rejected',
            data.error || 'Your garage registration was rejected by the Platform Super Admin. Please contact support.',
            [{ text: 'OK', style: 'default' }]
          );
        } else {
          Alert.alert('Login Failed', data.error || 'Invalid credentials');
        }
        return;
      }

      // If login succeeded, clear any rejection state
      setGarageInfo(null);
      setRejectedDocuments([]);

      // Save token and user details to context
      setToken(data.token);
      setUser(data.user);

      // Navigate based on actual backend user role
      if (data.user?.role === 'admin' || data.user?.role === 'staff' || data.user?.role === 'garage_admin') {
        navigation.replace('Main');
      } else {
        Alert.alert('Access Denied', 'This app is strictly for staff and admins.');
        setToken(null);
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
          <AdminHeroLogo
            size={92}
            primary={theme.colors.primary}
            secondary={theme.colors.secondary || '#1677FF'}
            dark={theme.dark}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            MOT Admin Hub
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
              <Text style={{ color: theme.colors.placeholder, fontSize: 13 }}>Don't have a garage account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={[styles.signupText, { color: theme.colors.primary, fontSize: 13 }]}>Register Garage</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* RE-UPLOAD REJECTED DOCUMENTS MODAL */}
      <Modal
        visible={reuploadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReuploadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="file-document-edit-outline" size={22} color="#EF4444" />
                  <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                    Re-upload Rejected Documents
                  </Text>
                </View>
                <Text style={[styles.modalSubtitle, { color: theme.colors.placeholder }]}>
                  {garageInfo?.garageName || 'Garage Application'} • Please address the feedback below.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setReuploadModalVisible(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.colors.background }]}
              >
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              {/* Overall garage rejection note if any */}
              {garageInfo?.rejectionReason ? (
                <View style={styles.masterNoticeBox}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 6, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.masterNoticeTitle}>Super Admin Review Feedback:</Text>
                    <Text style={styles.masterNoticeText}>{garageInfo.rejectionReason}</Text>
                  </View>
                </View>
              ) : null}

              <Text style={[styles.docSectionTitle, { color: theme.colors.text }]}>
                Rejected Document(s) Requiring New Copy:
              </Text>

              {rejectedDocuments.length === 0 ? (
                <View style={[styles.emptyDocsBox, { borderColor: theme.colors.border }]}>
                  <MaterialCommunityIcons name="check-decagram" size={36} color="#10B981" />
                  <Text style={[styles.emptyDocsTitle, { color: theme.colors.text }]}>
                    All Documents Re-submitted!
                  </Text>
                  <Text style={[styles.emptyDocsSubtitle, { color: theme.colors.placeholder }]}>
                    Your application has been returned to Super Admin for authorization.
                  </Text>
                </View>
              ) : (
                rejectedDocuments.map((doc, dIdx) => {
                  const docId = doc._id || doc.id;
                  const isUploadingThis = uploadingDocId === docId;

                  return (
                    <View
                      key={docId || dIdx}
                      style={[styles.rejectedDocCard, { backgroundColor: theme.colors.background, borderColor: '#EF444460' }]}
                    >
                      <View style={styles.rejectedDocTop}>
                        <View style={[styles.rejectedDocIconBox, { backgroundColor: '#EF444415' }]}>
                          <MaterialCommunityIcons
                            name={doc.fileUrl?.endsWith('.pdf') ? 'file-pdf-box' : 'file-document-outline'}
                            size={24}
                            color="#EF4444"
                          />
                        </View>
                        <View style={{ flex: 1, paddingRight: 6 }}>
                          <Text style={[styles.rejectedDocName, { color: theme.colors.text }]}>{doc.name}</Text>
                          <Text style={[styles.rejectedDocUrl, { color: theme.colors.placeholder }]} numberOfLines={1}>
                            Current: {doc.fileUrl}
                          </Text>
                        </View>
                        <View style={styles.rejectedBadge}>
                          <Text style={styles.rejectedBadgeText}>Needs Fix</Text>
                        </View>
                      </View>

                      {/* Super Admin Rejection Reason Callout */}
                      <View style={styles.rejectionReasonBox}>
                        <MaterialCommunityIcons name="alert-outline" size={16} color="#EF4444" style={{ marginRight: 6, marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rejectionReasonLabel}>Reason for Rejection:</Text>
                          <Text style={styles.rejectionReasonText}>
                            "{doc.rejectionReason || 'Document is blurry or unreadable. Please re-upload a clear copy.'}"
                          </Text>
                        </View>
                      </View>

                      {/* Re-upload Action Button */}
                      <TouchableOpacity
                        onPress={() => handlePickAndResubmitDocument(doc)}
                        disabled={isUploadingThis}
                        style={[styles.reuploadBtn, { backgroundColor: theme.colors.primary, opacity: isUploadingThis ? 0.7 : 1 }]}
                      >
                        {isUploadingThis ? (
                          <>
                            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.reuploadBtnText}>Uploading New Document...</Text>
                          </>
                        ) : (
                          <>
                            <MaterialCommunityIcons name="upload" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.reuploadBtnText}>Browse & Re-upload Clear Copy</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    padding: 20,
    paddingTop: 30,
  },
  topRejectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  topRejectionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EF444420',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topRejectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  topRejectionBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  topRejectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  topRejectionSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
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
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 13.5,
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
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
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
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: 'bold',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
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
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: 'bold',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444430',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  masterNoticeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  masterNoticeText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 2,
  },
  docSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyDocsBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDocsTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyDocsSubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  rejectedDocCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  rejectedDocTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rejectedDocIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rejectedDocName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  rejectedDocUrl: {
    fontSize: 11,
    marginTop: 2,
  },
  rejectedBadge: {
    backgroundColor: '#EF444420',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rejectedBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  rejectionReasonBox: {
    flexDirection: 'row',
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444430',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  rejectionReasonLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  rejectionReasonText: {
    fontSize: 11.5,
    color: '#EF4444',
    marginTop: 1,
    fontStyle: 'italic',
  },
  reuploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  reuploadBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
