import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL, Garage } from '../context/DataContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const REJECTION_PRESETS = [
  'Document is blurry / unreadable. Please re-upload a clear copy.',
  'Certificate appears to be expired. Please submit valid up-to-date documentation.',
  'Missing official DVLA examiner stamp / authorized signature.',
  'Incorrect document submitted for this category.',
  'Business details do not match the registered garage name.'
];

export default function GarageVerificationReviewScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { token, updateGarageStatus, updateGarageDocumentStatus, refreshData } = useAppValues();

  const initialGarageId = route.params?.garageId || route.params?.garage?.id || route.params?.garage?._id;
  const initialGarage = route.params?.garage;

  const [garage, setGarage] = useState<Garage | null>(initialGarage || null);
  const [loading, setLoading] = useState<boolean>(!initialGarage);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Document Inspection & Preview Modal
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [docPreviewModalVisible, setDocPreviewModalVisible] = useState<boolean>(false);

  // Single Document Rejection Modal
  const [rejectingDoc, setRejectingDoc] = useState<any | null>(null);
  const [docRejectionReason, setDocRejectionReason] = useState<string>('');
  const [docRejectModalVisible, setDocRejectModalVisible] = useState<boolean>(false);
  const [savingDocAction, setSavingDocAction] = useState<boolean>(false);

  // Master Final Garage Rejection Modal
  const [masterRejectModalVisible, setMasterRejectModalVisible] = useState<boolean>(false);
  const [masterRejectionReason, setMasterRejectionReason] = useState<string>('');
  const [savingMasterAction, setSavingMasterAction] = useState<boolean>(false);

  // Photo Gallery Inspector Modal
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [photoModalVisible, setPhotoModalVisible] = useState<boolean>(false);

  // Fetch latest garage details
  const fetchGarageDetails = async () => {
    if (!initialGarageId) return;
    try {
      const res = await fetch(`${BASE_URL}/garages/${initialGarageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setGarage(data);
      } else {
        Alert.alert('Error', data.error || 'Failed to fetch garage details.');
      }
    } catch (err: any) {
      console.error('Fetch garage details error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGarageDetails();
  }, [initialGarageId]);

  if (loading || !garage) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading Garage Verification Center...</Text>
      </View>
    );
  }

  const garageId = garage.id || garage._id || '';
  const docs = garage.verificationDocuments || [];
  const verifiedDocsCount = docs.filter(d => d.status === 'Verified').length;
  const rejectedDocsCount = docs.filter(d => d.status === 'Rejected').length;
  const pendingDocsCount = docs.filter(d => !d.status || d.status === 'Pending').length;

  // Single Document Approval Handler
  const handleApproveDocument = async (doc: any) => {
    const docId = doc.id || doc._id;
    if (!docId) return;

    setSavingDocAction(true);
    try {
      await updateGarageDocumentStatus(garageId, docId, 'Verified');
      Alert.alert('Document Verified', `"${doc.name}" has been marked as Verified.`);
      await fetchGarageDetails();
      await refreshData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to verify document.');
    } finally {
      setSavingDocAction(false);
    }
  };

  // Open Single Document Rejection Modal
  const openRejectDocModal = (doc: any) => {
    setRejectingDoc(doc);
    setDocRejectionReason(doc.rejectionReason || REJECTION_PRESETS[0]);
    setDocRejectModalVisible(true);
  };

  // Submit Single Document Rejection
  const handleSubmitDocRejection = async () => {
    if (!rejectingDoc) return;
    const docId = rejectingDoc.id || rejectingDoc._id;
    if (!docId) return;

    if (!docRejectionReason.trim()) {
      Alert.alert('Missing Reason', 'Please enter or select a rejection reason for this document.');
      return;
    }

    setSavingDocAction(true);
    try {
      await updateGarageDocumentStatus(garageId, docId, 'Rejected', docRejectionReason.trim());
      setDocRejectModalVisible(false);
      Alert.alert('Document Rejected', `"${rejectingDoc.name}" was marked as Rejected with feedback.`);
      await fetchGarageDetails();
      await refreshData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reject document.');
    } finally {
      setSavingDocAction(false);
      setRejectingDoc(null);
    }
  };

  // Master Garage Approval Handler
  const handleMasterApproveGarage = () => {
    Alert.alert(
      'Approve & Authorize Garage?',
      `Are you sure you want to approve and activate "${garage.name}" on the MOT Platform? The garage admin will be granted full access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Approve Garage',
          style: 'default',
          onPress: async () => {
            setSavingMasterAction(true);
            try {
              await updateGarageStatus(garageId, 'Approved', 'Verified');
              Alert.alert('Garage Approved!', `"${garage.name}" is now Active and officially Authorized.`);
              await fetchGarageDetails();
              await refreshData();
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Approval Failed', err.message || 'Could not approve garage.');
            } finally {
              setSavingMasterAction(false);
            }
          }
        }
      ]
    );
  };

  // Submit Master Garage Rejection
  const handleSubmitMasterRejection = async () => {
    if (!masterRejectionReason.trim()) {
      Alert.alert('Missing Reason', 'Please provide an overall rejection explanation for the applicant.');
      return;
    }

    setSavingMasterAction(true);
    try {
      await updateGarageStatus(garageId, 'Rejected', 'Rejected', masterRejectionReason.trim());
      setMasterRejectModalVisible(false);
      Alert.alert('Garage Application Rejected', `"${garage.name}" has been marked as Rejected.`);
      await fetchGarageDetails();
      await refreshData();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Rejection Failed', err.message || 'Could not reject garage application.');
    } finally {
      setSavingMasterAction(false);
    }
  };

  // Open Document in browser / viewer
  const handleOpenDocUrl = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Notice', 'Could not open document URL.');
    });
  };

  const isApproved = garage.status === 'Approved';
  const isRejected = garage.status === 'Rejected';
  const isPending = garage.status === 'Pending';

  const statusColor = isApproved ? '#10B981' : isRejected ? '#EF4444' : '#F59E0B';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.colors.background }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
            Verification & Audit Center
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.placeholder }]} numberOfLines={1}>
            {garage.name}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{garage.status}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Verification Summary Banner */}
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Document Verification Audit</Text>
              <Text style={[styles.summarySubtitle, { color: theme.colors.placeholder }]}>
                {docs.length === 0 ? 'No documents submitted' : `${verifiedDocsCount} of ${docs.length} Documents Approved`}
              </Text>
            </View>
            <View style={[styles.verificationPill, { backgroundColor: garage.verificationStatus === 'Verified' ? '#10B98120' : '#F59E0B20' }]}>
              <MaterialCommunityIcons
                name={garage.verificationStatus === 'Verified' ? 'shield-check' : 'shield-alert-outline'}
                size={16}
                color={garage.verificationStatus === 'Verified' ? '#10B981' : '#F59E0B'}
                style={{ marginRight: 4 }}
              />
              <Text style={{ fontSize: 12, fontWeight: '700', color: garage.verificationStatus === 'Verified' ? '#10B981' : '#F59E0B' }}>
                {garage.verificationStatus || 'Pending'}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          {docs.length > 0 && (
            <View style={[styles.progressBarBg, { backgroundColor: theme.colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${(verifiedDocsCount / docs.length) * 100}%`,
                    backgroundColor: verifiedDocsCount === docs.length ? '#10B981' : theme.colors.primary
                  }
                ]}
              />
            </View>
          )}

          {garage.rejectionReason ? (
            <View style={styles.garageRejectionNotice}>
              <MaterialCommunityIcons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectionNoticeHeading}>Application Feedback / Rejection Note:</Text>
                <Text style={styles.rejectionNoticeText}>{garage.rejectionReason}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* SECTION 1: GARAGE & OWNER PROFILE */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="storefront-outline" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Garage & Owner Details</Text>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>Garage Trade Name</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>{garage.name}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>Contact Email</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>{garage.email || 'N/A'}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>Telephone</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>{garage.phone || 'N/A'}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>Operating Hours</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                {garage.openingTime || '08:00'} – {garage.closingTime || '18:00'}
              </Text>
            </View>

            <View style={[styles.detailItem, { width: '100%' }]}>
              <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>Full Address & Postcode</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                {garage.address}{garage.city ? `, ${garage.city}` : ''}{garage.postcode ? ` (${garage.postcode})` : ''}
              </Text>
            </View>

            <View style={[styles.detailItem, { width: '100%' }]}>
              <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>GPS Coordinates</Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                Latitude: {garage.latitude || '51.5074'} | Longitude: {garage.longitude || '-0.1278'}
              </Text>
            </View>

            {garage.description ? (
              <View style={[styles.detailItem, { width: '100%' }]}>
                <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>Garage Description</Text>
                <Text style={[styles.detailValue, { color: theme.colors.text }]}>{garage.description}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* SECTION 2: 5 FACILITY & MOT TESTING PHOTOS */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="camera-image" size={20} color="#0284C7" style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Facility & Bay Photos ({garage.images ? garage.images.length : 0})
            </Text>
          </View>
          <Text style={[styles.sectionHelper, { color: theme.colors.placeholder }]}>
            Tap any photo to open full-screen inspector to inspect workshop cleanliness, testing bays, and exterior frontage.
          </Text>

          {garage.images && garage.images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoList}>
              {garage.images.map((imgUrl, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedPhotoIndex(idx);
                    setPhotoModalVisible(true);
                  }}
                  style={[styles.photoCard, { borderColor: theme.colors.border }]}
                >
                  <Image source={{ uri: imgUrl }} style={styles.photoImg} resizeMode="cover" />
                  <View style={styles.photoBadge}>
                    <Text style={styles.photoBadgeText}>Photo {idx + 1}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.emptyBox, { borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="image-off-outline" size={28} color={theme.colors.placeholder} />
              <Text style={[styles.emptyBoxText, { color: theme.colors.placeholder }]}>No facility photos uploaded.</Text>
            </View>
          )}
        </View>

        {/* SECTION 3: DVLA LEGAL & MOT AUTHORIZATION CREDENTIALS */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="shield-check" size={20} color="#10B981" style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>DVLA MOT Authorization Credentials</Text>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.credentialBox}>
              <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>DVLA VTS Site Number</Text>
              <Text style={[styles.credentialValue, { color: theme.colors.text }]}>{garage.vtsNumber || 'Not Provided'}</Text>
            </View>

            <View style={styles.credentialBox}>
              <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>MOT Authorised Examiner (AE) #</Text>
              <Text style={[styles.credentialValue, { color: theme.colors.text }]}>
                {garage.motAuthorisedExaminerNumber || 'Not Provided'}
              </Text>
            </View>

            <View style={[styles.credentialBox, { width: '100%' }]}>
              <Text style={[styles.detailLabel, { color: theme.colors.placeholder }]}>Companies House / Business Reg #</Text>
              <Text style={[styles.credentialValue, { color: theme.colors.text }]}>
                {garage.businessRegistrationNumber || 'Not Provided'}
              </Text>
            </View>

            <View style={[styles.credentialBox, { width: '100%', backgroundColor: '#10B98110', borderColor: '#10B98140' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#10B981' }}>Legal MOT Declaration Signed</Text>
              </View>
              <Text style={{ fontSize: 11.5, color: theme.colors.placeholder }}>
                Applicant legally declared compliance with DVLA MOT testing standards and genuine authorization.
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 4: GRANULAR UPLOADED VERIFICATION DOCUMENTS */}
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons name="file-certificate" size={20} color="#6366F1" style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Submitted Verification Certificates ({docs.length})
            </Text>
          </View>
          <Text style={[styles.sectionHelper, { color: theme.colors.placeholder }]}>
            Review each certificate individually. If any document is blurry, expired, or invalid, click Reject and provide the reason.
          </Text>

          {docs.length === 0 ? (
            <View style={[styles.emptyBox, { borderColor: theme.colors.border }]}>
              <MaterialCommunityIcons name="file-question-outline" size={28} color={theme.colors.placeholder} />
              <Text style={[styles.emptyBoxText, { color: theme.colors.placeholder }]}>No documents uploaded by applicant.</Text>
            </View>
          ) : (
            docs.map((doc, dIdx) => {
              const docVerified = doc.status === 'Verified';
              const docRejected = doc.status === 'Rejected';
              const docPending = !doc.status || doc.status === 'Pending';
              const docStatusColor = docVerified ? '#10B981' : docRejected ? '#EF4444' : '#F59E0B';

              return (
                <View
                  key={doc.id || doc._id || dIdx}
                  style={[
                    styles.docAuditCard,
                    {
                      backgroundColor: theme.colors.background,
                      borderColor: docRejected ? '#EF444480' : docVerified ? '#10B98160' : theme.colors.border
                    }
                  ]}
                >
                  {/* Top: Icon, Name, Date, Status */}
                  <View style={styles.docHeaderRow}>
                    <View style={[styles.docIconBox, { backgroundColor: docStatusColor + '18' }]}>
                      <MaterialCommunityIcons
                        name={doc.fileUrl?.endsWith('.pdf') ? 'file-pdf-box' : 'file-certificate-outline'}
                        size={24}
                        color={docStatusColor}
                      />
                    </View>

                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.docTitleText, { color: theme.colors.text }]}>{doc.name}</Text>
                      <Text style={[styles.docSubtitleText, { color: theme.colors.placeholder }]} numberOfLines={1}>
                        {doc.uploadDate ? `Uploaded on ${new Date(doc.uploadDate).toLocaleDateString()}` : 'Recently Uploaded'}
                      </Text>
                    </View>

                    <View style={[styles.docStatusBadge, { backgroundColor: docStatusColor + '18' }]}>
                      <Text style={[styles.docStatusBadgeText, { color: docStatusColor }]}>
                        {doc.status || 'Pending'}
                      </Text>
                    </View>
                  </View>

                  {/* Document Rejection Notice (if rejected) */}
                  {docRejected && doc.rejectionReason ? (
                    <View style={styles.docRejectionBanner}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#EF4444" style={{ marginRight: 6, marginTop: 1 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docRejectionHeading}>Rejection Feedback for Applicant:</Text>
                        <Text style={styles.docRejectionText}>"{doc.rejectionReason}"</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Actions for this specific document */}
                  <View style={styles.docActionRow}>
                    {/* Preview / View Document */}
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedDoc(doc);
                        setDocPreviewModalVisible(true);
                      }}
                      style={[styles.previewDocBtn, { borderColor: theme.colors.border }]}
                    >
                      <MaterialCommunityIcons name="eye-outline" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                      <Text style={[styles.previewDocBtnText, { color: theme.colors.primary }]}>Preview Document</Text>
                    </TouchableOpacity>

                    {/* Approve Document Button */}
                    <TouchableOpacity
                      onPress={() => handleApproveDocument(doc)}
                      disabled={savingDocAction || docVerified}
                      style={[
                        styles.approveDocBtn,
                        {
                          backgroundColor: docVerified ? '#10B98120' : '#10B981',
                          opacity: savingDocAction ? 0.6 : 1
                        }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color={docVerified ? '#10B981' : '#FFFFFF'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.approveDocBtnText, { color: docVerified ? '#10B981' : '#FFFFFF' }]}>
                        {docVerified ? 'Verified ✓' : 'Approve'}
                      </Text>
                    </TouchableOpacity>

                    {/* Reject Document Button */}
                    <TouchableOpacity
                      onPress={() => openRejectDocModal(doc)}
                      disabled={savingDocAction}
                      style={[
                        styles.rejectDocBtn,
                        {
                          backgroundColor: docRejected ? '#EF444420' : '#EF4444',
                          opacity: savingDocAction ? 0.6 : 1
                        }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={16}
                        color={docRejected ? '#EF4444' : '#FFFFFF'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.rejectDocBtnText, { color: docRejected ? '#EF4444' : '#FFFFFF' }]}>
                        {docRejected ? 'Rejected ✗' : 'Reject'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* MASTER DECISION BAR AT BOTTOM */}
      <View style={[styles.bottomDecisionBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View>
            <Text style={[styles.decisionSummaryTitle, { color: theme.colors.text }]}>Final Application Decision</Text>
            <Text style={[styles.decisionSummarySubtitle, { color: theme.colors.placeholder }]}>
              {rejectedDocsCount > 0
                ? `⚠️ ${rejectedDocsCount} document(s) rejected — require re-upload`
                : verifiedDocsCount === docs.length && docs.length > 0
                ? 'All documents verified & ready for authorization'
                : 'Review all credentials before finalizing'}
            </Text>
          </View>
        </View>

        <View style={styles.decisionButtonRow}>
          {/* Final Reject Button */}
          <TouchableOpacity
            onPress={() => {
              // Pre-fill master reason if any docs were rejected
              const rejectedList = docs
                .filter(d => d.status === 'Rejected' && d.rejectionReason)
                .map(d => `• ${d.name}: ${d.rejectionReason}`)
                .join('\n');
              setMasterRejectionReason(
                rejectedList
                  ? `Please address the following document issues and re-submit:\n${rejectedList}`
                  : 'Application requires updated MOT documentation and facility photos.'
              );
              setMasterRejectModalVisible(true);
            }}
            disabled={savingMasterAction}
            style={[styles.masterRejectBtn, { opacity: savingMasterAction ? 0.6 : 1 }]}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.masterRejectBtnText}>Reject Application</Text>
          </TouchableOpacity>

          {/* Final Approve Button */}
          <TouchableOpacity
            onPress={handleMasterApproveGarage}
            disabled={savingMasterAction || isApproved}
            style={[
              styles.masterApproveBtn,
              {
                backgroundColor: isApproved ? '#10B98180' : '#10B981',
                opacity: savingMasterAction ? 0.6 : 1
              }
            ]}
          >
            {savingMasterAction ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.masterApproveBtnText}>
                  {isApproved ? 'Approved ✓' : 'Approve & Activate Garage'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL 1: SINGLE DOCUMENT REJECTION MODAL */}
      <Modal
        visible={docRejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDocRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="file-alert-outline" size={22} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={[styles.modalHeading, { color: theme.colors.text }]}>Reject Document</Text>
              </View>
              <TouchableOpacity onPress={() => setDocRejectModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDocName, { color: theme.colors.text }]}>
              Document: <Text style={{ fontWeight: 'bold' }}>{rejectingDoc?.name}</Text>
            </Text>

            <Text style={[styles.modalLabel, { color: theme.colors.placeholder, marginTop: 10 }]}>
              Quick Rejection Reason Presets:
            </Text>
            <ScrollView style={{ maxHeight: 130, marginVertical: 6 }}>
              {REJECTION_PRESETS.map((preset, pIdx) => (
                <TouchableOpacity
                  key={pIdx}
                  onPress={() => setDocRejectionReason(preset)}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: docRejectionReason === preset ? '#EF444415' : theme.colors.background,
                      borderColor: docRejectionReason === preset ? '#EF4444' : theme.colors.border
                    }
                  ]}
                >
                  <Text style={[styles.presetText, { color: docRejectionReason === preset ? '#EF4444' : theme.colors.text }]}>
                    {preset}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.modalLabel, { color: theme.colors.placeholder, marginTop: 6 }]}>
              Custom Feedback / Reason for Re-upload:
            </Text>
            <TextInput
              value={docRejectionReason}
              onChangeText={setDocRejectionReason}
              placeholder="E.g. Document is blurry, please upload clear high-res copy..."
              placeholderTextColor={theme.colors.placeholder}
              multiline
              numberOfLines={3}
              style={[
                styles.rejectionTextInput,
                { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }
              ]}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setDocRejectModalVisible(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmitDocRejection}
                disabled={savingDocAction}
                style={[styles.modalConfirmRejectBtn, { opacity: savingDocAction ? 0.6 : 1 }]}
              >
                {savingDocAction ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmRejectBtnText}>Save Rejection Reason</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: MASTER GARAGE REJECTION MODAL */}
      <Modal
        visible={masterRejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMasterRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="alert-octagon-outline" size={24} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={[styles.modalHeading, { color: theme.colors.text }]}>Reject Garage Application</Text>
              </View>
              <TouchableOpacity onPress={() => setMasterRejectModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color={theme.colors.placeholder} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitleText, { color: theme.colors.placeholder }]}>
              The garage applicant will receive this rejection feedback explaining why their application was rejected and what changes are required.
            </Text>

            <Text style={[styles.modalLabel, { color: theme.colors.placeholder, marginTop: 10 }]}>
              Rejection & Re-submission Instructions:
            </Text>
            <TextInput
              value={masterRejectionReason}
              onChangeText={setMasterRejectionReason}
              placeholder="Explain reasons for rejection and requested document re-uploads..."
              placeholderTextColor={theme.colors.placeholder}
              multiline
              numberOfLines={4}
              style={[
                styles.rejectionTextInput,
                { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background, minHeight: 90 }
              ]}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                onPress={() => setMasterRejectModalVisible(false)}
                style={[styles.modalCancelBtn, { borderColor: theme.colors.border }]}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmitMasterRejection}
                disabled={savingMasterAction}
                style={[styles.modalConfirmRejectBtn, { opacity: savingMasterAction ? 0.6 : 1 }]}
              >
                {savingMasterAction ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmRejectBtnText}>Reject Application</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: DOCUMENT PREVIEW MODAL */}
      <Modal
        visible={docPreviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDocPreviewModalVisible(false)}
      >
        <View style={styles.previewModalOverlay}>
          <View style={[styles.previewModalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.previewModalHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.previewModalTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {selectedDoc?.name || 'Certificate Preview'}
                </Text>
                <Text style={[styles.previewModalSubtitle, { color: theme.colors.placeholder }]} numberOfLines={1}>
                  Status: {selectedDoc?.status || 'Pending'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setDocPreviewModalVisible(false)}
                style={[styles.closePreviewBtn, { backgroundColor: theme.colors.background }]}
              >
                <MaterialCommunityIcons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.previewBody}>
              {selectedDoc?.fileUrl && (selectedDoc.fileUrl.endsWith('.jpg') || selectedDoc.fileUrl.endsWith('.png') || selectedDoc.fileUrl.endsWith('.jpeg') || selectedDoc.fileUrl.includes('images')) ? (
                <Image
                  source={{ uri: selectedDoc.fileUrl }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.pdfPreviewPlaceholder}>
                  <MaterialCommunityIcons name="file-pdf-box" size={64} color="#EF4444" />
                  <Text style={[styles.pdfDocTitle, { color: theme.colors.text }]}>{selectedDoc?.name}</Text>
                  <Text style={[styles.pdfDocUrl, { color: theme.colors.placeholder }]}>{selectedDoc?.fileUrl}</Text>

                  <TouchableOpacity
                    onPress={() => handleOpenDocUrl(selectedDoc?.fileUrl)}
                    style={[styles.openLinkBtn, { backgroundColor: theme.colors.primary }]}
                  >
                    <MaterialCommunityIcons name="open-in-new" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.openLinkBtnText}>Open Document in Browser / Viewer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: FACILITY PHOTO INSPECTOR */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity
            style={styles.photoCloseBtn}
            onPress={() => setPhotoModalVisible(false)}
          >
            <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {selectedPhotoIndex !== null && garage.images && garage.images[selectedPhotoIndex] ? (
            <View style={styles.photoModalContent}>
              <Image
                source={{ uri: garage.images[selectedPhotoIndex] }}
                style={styles.fullPhoto}
                resizeMode="contain"
              />
              <View style={styles.photoCaptionBar}>
                <Text style={styles.photoCaptionText}>
                  Facility Photo {selectedPhotoIndex + 1} of {garage.images.length}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  summarySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  verificationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  garageRejectionNotice: {
    flexDirection: 'row',
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444440',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  rejectionNoticeHeading: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  rejectionNoticeText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 2,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHelper: {
    fontSize: 11.5,
    marginBottom: 12,
    lineHeight: 16,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  detailItem: {
    width: '48%',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  credentialBox: {
    width: '48%',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F030',
  },
  credentialValue: {
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 2,
  },
  photoList: {
    gap: 10,
    paddingVertical: 4,
  },
  photoCard: {
    width: 130,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBoxText: {
    fontSize: 12,
    marginTop: 6,
  },
  docAuditCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  docHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  docTitleText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  docSubtitleText: {
    fontSize: 11,
    marginTop: 2,
  },
  docStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  docStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  docRejectionBanner: {
    flexDirection: 'row',
    backgroundColor: '#EF444415',
    borderWidth: 1,
    borderColor: '#EF444430',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
  },
  docRejectionHeading: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  docRejectionText: {
    fontSize: 11.5,
    color: '#EF4444',
    marginTop: 1,
    fontStyle: 'italic',
  },
  docActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F030',
  },
  previewDocBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 7,
  },
  previewDocBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  approveDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  approveDocBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  rejectDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  rejectDocBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  bottomDecisionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  decisionSummaryTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  decisionSummarySubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  decisionButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  masterRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
  },
  masterRejectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  masterApproveBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  masterApproveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalDocName: {
    fontSize: 13,
    marginTop: 4,
  },
  modalSubtitleText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  modalLabel: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 5,
  },
  presetText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  rejectionTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 12.5,
    textAlignVertical: 'top',
    marginTop: 6,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmRejectBtn: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 10,
  },
  modalConfirmRejectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  previewModalContent: {
    height: SCREEN_HEIGHT * 0.82,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  previewModalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewModalSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  closePreviewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBody: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  pdfPreviewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pdfDocTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  pdfDocUrl: {
    fontSize: 11.5,
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 20,
  },
  openLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  openLinkBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  photoModalContent: {
    width: '100%',
    height: '80%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPhoto: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  photoCaptionBar: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  photoCaptionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
