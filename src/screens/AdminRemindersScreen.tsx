import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { useAppValues, BASE_URL } from '../context/DataContext';

export default function AdminRemindersScreen() {
  const { theme } = useAppTheme();
  const { audits, vehicles, customers, alerts, token } = useAppValues();
  const [activeTab, setActiveTab] = useState<'logs' | 'reports' | 'templates'>('logs');

  // Templates state
  const [t45, setT45] = useState(
    'Dear [Name], Your [Vehicle] ([Reg]) MOT expires on [Expiry]. Book your MOT today.'
  );
  const [t30, setT30] = useState(
    'Dear [Name], Just a reminder that your [Vehicle] ([Reg]) MOT is due in 30 days ([Expiry]). Book now.'
  );
  const [t7, setT7] = useState(
    'URGENT: Dear [Name], Your [Vehicle] ([Reg]) MOT expires in 7 days on [Expiry]. Book immediately to avoid fines.'
  );

  const [savingTemplate, setSavingTemplate] = useState<number | null>(null);
  const [exportingReport, setExportingReport] = useState<string | null>(null);

  const saveTemplate = (days: number) => {
    setSavingTemplate(days);
    setTimeout(() => {
      setSavingTemplate(null);
      Alert.alert('Success', `${days}-Day Reminder Template updated successfully!`);
    }, 1000);
  };

  const handleExport = async (reportName: string, format: 'PDF' | 'Excel' | 'CSV') => {
    let endpoint = '';
    if (reportName === 'MOT Due Report') endpoint = 'due-mots';
    else if (reportName === 'Reminder Sent Report') endpoint = 'reminder-sent';
    else if (reportName === 'Customer Response Report') endpoint = 'customer-response';
    else if (reportName === 'Booked MOT Report') endpoint = 'booked-mots';

    const formatParam = format.toLowerCase();
    const backendFormat = format === 'Excel' ? 'excel' : formatParam;
    const downloadUrl = `${BASE_URL}/reports/${endpoint}?format=${backendFormat}&token=${token}`;

    setExportingReport(`${reportName}_${format}`);
    try {
      await Linking.openURL(downloadUrl);
    } catch (error) {
      console.error('[EXPORT REPORT ERROR]', error);
      Alert.alert('Error', 'Failed to open report download link. Please check if a web browser is installed.');
    } finally {
      setTimeout(() => {
        setExportingReport(null);
      }, 500);
    }
  };

  // Compute metrics dynamically for the reports
  const activeVehiclesCount = vehicles.filter(v => v.status === 'Active').length;
  const remindersSentCount = audits.filter(a => a.activity.toLowerCase().includes('sent') || a.activity.toLowerCase().includes('reminder')).length;
  const customerResponsesCount = audits.filter(a => a.activity.toLowerCase().includes('request') || a.activity.toLowerCase().includes('change') || a.activity.toLowerCase().includes('book')).length;
  const bookedMotsCount = alerts.filter(a => a.type === 'BOOKED').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Top Segmented Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.background }]}>
          {(['logs', 'reports', 'templates'] as const).map((tab) => {
            const isActive = activeTab === tab;
            let label = 'Logs';
            let icon = 'file-clock-outline';
            if (tab === 'reports') {
              label = 'Reports';
              icon = 'chart-bar';
            } else if (tab === 'templates') {
              label = 'Templates';
              icon = 'cog-box';
            }

            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.tabItem,
                  isActive && { backgroundColor: theme.colors.card }
                ]}
              >
                <MaterialCommunityIcons 
                  name={icon} 
                  size={15} 
                  color={isActive ? theme.colors.primary : theme.colors.placeholder} 
                  style={{ marginRight: 5 }} 
                />
                <Text style={[
                  styles.tabText, 
                  { color: isActive ? theme.colors.text : theme.colors.placeholder }
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'logs' && (
          // AUDIT TRAIL / LOGS VIEW
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>System Audit Trail</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
              Real-time records of sent messages, vehicle updates, and customer responses.
            </Text>

            {audits.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="clipboard-text-play-outline" size={48} color={theme.colors.placeholder} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: theme.colors.placeholder }]}>No logs recorded.</Text>
              </View>
            ) : (
              audits.map((log) => {
                // Determine left border color and icon based on activity
                let borderLeftColor = theme.colors.primary;
                let iconName = 'bell-outline';
                const act = log.activity.toLowerCase();
                
                if (act.includes('sent') || act.includes('send')) {
                  borderLeftColor = '#10B981'; // Green
                  iconName = 'email-send-outline';
                } else if (act.includes('book') || act.includes('slot')) {
                  borderLeftColor = '#3B82F6'; // Blue
                  iconName = 'calendar-clock';
                } else if (act.includes('status') || act.includes('change') || act.includes('sold')) {
                  borderLeftColor = '#F59E0B'; // Amber
                  iconName = 'car-cog';
                } else if (act.includes('reject') || act.includes('fail')) {
                  borderLeftColor = '#EF4444'; // Red
                  iconName = 'alert-circle-outline';
                }

                return (
                  <View key={log.id} style={[styles.logCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderLeftColor }]}>
                    <View style={styles.logHeader}>
                      <View style={styles.logActivityRow}>
                        <MaterialCommunityIcons name={iconName} size={15} color={borderLeftColor} style={{ marginRight: 6 }} />
                        <Text style={[styles.logActivity, { color: theme.colors.text }]} numberOfLines={1}>{log.activity}</Text>
                      </View>
                      <Text style={[styles.logDate, { color: theme.colors.placeholder }]}>{log.date}</Text>
                    </View>
                    <Text style={[styles.logDetails, { color: theme.colors.text + 'CC' }]}>{log.details}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'reports' && (
          // REPORTS MODULE
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Garage Reporting Engine</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
              Generate, preview, and export critical MOT operations reports.
            </Text>

            {/* Report 1: MOT Due Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <View style={[styles.reportIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="file-document-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.reportMeta}>
                  <View style={styles.reportTitleRow}>
                    <Text style={[styles.reportTitle, { color: theme.colors.text }]}>MOT Due Report</Text>
                    <View style={[styles.metricBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.metricText, { color: theme.colors.primary }]}>{activeVehiclesCount} active</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 1 }}>Active vehicles scheduled for MOT soon</Text>
                </View>
              </View>
              <View style={styles.exportDivider} />
              <Text style={[styles.exportLabel, { color: theme.colors.placeholder }]}>DOWNLOAD FORMAT</Text>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => {
                  let btnStyle = {};
                  let color = theme.colors.text;
                  let icon = 'file-document-outline';
                  if (format === 'PDF') {
                    btnStyle = styles.pdfBtn;
                    color = '#EF4444';
                    icon = 'file-pdf-box';
                  } else if (format === 'Excel') {
                    btnStyle = styles.excelBtn;
                    color = '#22C55E';
                    icon = 'microsoft-excel';
                  } else if (format === 'CSV') {
                    btnStyle = styles.csvBtn;
                    color = '#3B82F6';
                    icon = 'file-delimited-outline';
                  }

                  return (
                    <TouchableOpacity
                      key={format}
                      onPress={() => handleExport('MOT Due Report', format)}
                      disabled={exportingReport !== null}
                      style={[styles.exportBtn, btnStyle]}
                    >
                      {exportingReport === `MOT Due Report_${format}` ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <View style={styles.exportBtnContent}>
                          <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 4 }} />
                          <Text style={[styles.exportBtnText, { color }]}>{format}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Report 2: Reminder Sent Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <View style={[styles.reportIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="message-text-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.reportMeta}>
                  <View style={styles.reportTitleRow}>
                    <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Reminder Sent Report</Text>
                    <View style={[styles.metricBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.metricText, { color: theme.colors.primary }]}>{remindersSentCount} sent</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 1 }}>Log of automated reminders sent by system</Text>
                </View>
              </View>
              <View style={styles.exportDivider} />
              <Text style={[styles.exportLabel, { color: theme.colors.placeholder }]}>DOWNLOAD FORMAT</Text>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => {
                  let btnStyle = {};
                  let color = theme.colors.text;
                  let icon = 'file-document-outline';
                  if (format === 'PDF') {
                    btnStyle = styles.pdfBtn;
                    color = '#EF4444';
                    icon = 'file-pdf-box';
                  } else if (format === 'Excel') {
                    btnStyle = styles.excelBtn;
                    color = '#22C55E';
                    icon = 'microsoft-excel';
                  } else if (format === 'CSV') {
                    btnStyle = styles.csvBtn;
                    color = '#3B82F6';
                    icon = 'file-delimited-outline';
                  }

                  return (
                    <TouchableOpacity
                      key={format}
                      onPress={() => handleExport('Reminder Sent Report', format)}
                      disabled={exportingReport !== null}
                      style={[styles.exportBtn, btnStyle]}
                    >
                      {exportingReport === `Reminder Sent Report_${format}` ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <View style={styles.exportBtnContent}>
                          <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 4 }} />
                          <Text style={[styles.exportBtnText, { color }]}>{format}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Report 3: Customer Response Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <View style={[styles.reportIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="forum-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.reportMeta}>
                  <View style={styles.reportTitleRow}>
                    <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Customer Response Report</Text>
                    <View style={[styles.metricBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.metricText, { color: theme.colors.primary }]}>{customerResponsesCount} logs</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 1 }}>Analysis of bookings, vehicle sold flags, etc.</Text>
                </View>
              </View>
              <View style={styles.exportDivider} />
              <Text style={[styles.exportLabel, { color: theme.colors.placeholder }]}>DOWNLOAD FORMAT</Text>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => {
                  let btnStyle = {};
                  let color = theme.colors.text;
                  let icon = 'file-document-outline';
                  if (format === 'PDF') {
                    btnStyle = styles.pdfBtn;
                    color = '#EF4444';
                    icon = 'file-pdf-box';
                  } else if (format === 'Excel') {
                    btnStyle = styles.excelBtn;
                    color = '#22C55E';
                    icon = 'microsoft-excel';
                  } else if (format === 'CSV') {
                    btnStyle = styles.csvBtn;
                    color = '#3B82F6';
                    icon = 'file-delimited-outline';
                  }

                  return (
                    <TouchableOpacity
                      key={format}
                      onPress={() => handleExport('Customer Response Report', format)}
                      disabled={exportingReport !== null}
                      style={[styles.exportBtn, btnStyle]}
                    >
                      {exportingReport === `Customer Response Report_${format}` ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <View style={styles.exportBtnContent}>
                          <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 4 }} />
                          <Text style={[styles.exportBtnText, { color }]}>{format}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Report 4: Booked MOT Report */}
            <View style={[styles.reportCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.reportHeader}>
                <View style={[styles.reportIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.reportMeta}>
                  <View style={styles.reportTitleRow}>
                    <Text style={[styles.reportTitle, { color: theme.colors.text }]}>Booked MOT Report</Text>
                    <View style={[styles.metricBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Text style={[styles.metricText, { color: theme.colors.primary }]}>{bookedMotsCount} booked</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 1 }}>List of scheduled MOT appointments and slot usage</Text>
                </View>
              </View>
              <View style={styles.exportDivider} />
              <Text style={[styles.exportLabel, { color: theme.colors.placeholder }]}>DOWNLOAD FORMAT</Text>
              <View style={styles.exportRow}>
                {(['PDF', 'Excel', 'CSV'] as const).map((format) => {
                  let btnStyle = {};
                  let color = theme.colors.text;
                  let icon = 'file-document-outline';
                  if (format === 'PDF') {
                    btnStyle = styles.pdfBtn;
                    color = '#EF4444';
                    icon = 'file-pdf-box';
                  } else if (format === 'Excel') {
                    btnStyle = styles.excelBtn;
                    color = '#22C55E';
                    icon = 'microsoft-excel';
                  } else if (format === 'CSV') {
                    btnStyle = styles.csvBtn;
                    color = '#3B82F6';
                    icon = 'file-delimited-outline';
                  }

                  return (
                    <TouchableOpacity
                      key={format}
                      onPress={() => handleExport('Booked MOT Report', format)}
                      disabled={exportingReport !== null}
                      style={[styles.exportBtn, btnStyle]}
                    >
                      {exportingReport === `Booked MOT Report_${format}` ? (
                        <ActivityIndicator size="small" color={color} />
                      ) : (
                        <View style={styles.exportBtnContent}>
                          <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 4 }} />
                          <Text style={[styles.exportBtnText, { color }]}>{format}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {activeTab === 'templates' && (
          // REMINDER TEMPLATE CONFIGURATION
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Reminder Schedule Config</Text>
            <Text style={[styles.sectionDesc, { color: theme.colors.placeholder }]}>
              Set the templates and timing parameters for automated customer communication.
            </Text>

            {/* 45 Days Reminder */}
            <View style={[styles.templateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.templateHeader}>
                <View style={styles.templateTitleRow}>
                  <MaterialCommunityIcons name="calendar-month" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.templateDaysText, { color: theme.colors.text }]}>Reminder 1: 45 Days Before MOT</Text>
                </View>
                <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 2 }}>Sent automatically as a friendly first notification.</Text>
              </View>
              <TextInput
                value={t45}
                onChangeText={setT45}
                multiline
                numberOfLines={3}
                style={[styles.templateInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              />
              <View style={styles.placeholderContainer}>
                <Text style={[styles.placeholderLabel, { color: theme.colors.placeholder }]}>Supported Tags:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeholderScroll}>
                  {['[Name]', '[Vehicle]', '[Reg]', '[Expiry]'].map((tag) => (
                    <View key={tag} style={[styles.placeholderPill, { backgroundColor: theme.colors.primary + '12' }]}>
                      <Text style={[styles.placeholderPillText, { color: theme.colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <TouchableOpacity
                onPress={() => saveTemplate(45)}
                disabled={savingTemplate !== null}
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              >
                {savingTemplate === 45 ? (
                  <ActivityIndicator size="small" color={theme.dark ? theme.colors.background : '#FFFFFF'} />
                ) : (
                  <View style={styles.saveBtnContent}>
                    <MaterialCommunityIcons name="content-save-outline" size={15} color={theme.dark ? theme.colors.background : '#FFFFFF'} style={{ marginRight: 5 }} />
                    <Text style={[styles.saveBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Save Template</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* 30 Days Reminder */}
            <View style={[styles.templateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.templateHeader}>
                <View style={styles.templateTitleRow}>
                  <MaterialCommunityIcons name="calendar-month" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.templateDaysText, { color: theme.colors.text }]}>Reminder 2: 30 Days Before MOT</Text>
                </View>
                <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 2 }}>Sent to follow up and encourage early bookings.</Text>
              </View>
              <TextInput
                value={t30}
                onChangeText={setT30}
                multiline
                numberOfLines={3}
                style={[styles.templateInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              />
              <View style={styles.placeholderContainer}>
                <Text style={[styles.placeholderLabel, { color: theme.colors.placeholder }]}>Supported Tags:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeholderScroll}>
                  {['[Name]', '[Vehicle]', '[Reg]', '[Expiry]'].map((tag) => (
                    <View key={tag} style={[styles.placeholderPill, { backgroundColor: theme.colors.primary + '12' }]}>
                      <Text style={[styles.placeholderPillText, { color: theme.colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <TouchableOpacity
                onPress={() => saveTemplate(30)}
                disabled={savingTemplate !== null}
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              >
                {savingTemplate === 30 ? (
                  <ActivityIndicator size="small" color={theme.dark ? theme.colors.background : '#FFFFFF'} />
                ) : (
                  <View style={styles.saveBtnContent}>
                    <MaterialCommunityIcons name="content-save-outline" size={15} color={theme.dark ? theme.colors.background : '#FFFFFF'} style={{ marginRight: 5 }} />
                    <Text style={[styles.saveBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Save Template</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* 7 Days Reminder */}
            <View style={[styles.templateCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.templateHeader}>
                <View style={styles.templateTitleRow}>
                  <MaterialCommunityIcons name="calendar-month" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.templateDaysText, { color: theme.colors.text }]}>Reminder 3: 7 Days Before MOT</Text>
                </View>
                <Text style={{ fontSize: 11, color: theme.colors.placeholder, marginTop: 2 }}>URGENT follow-up to prevent roadworthiness failures.</Text>
              </View>
              <TextInput
                value={t7}
                onChangeText={setT7}
                multiline
                numberOfLines={3}
                style={[styles.templateInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              />
              <View style={styles.placeholderContainer}>
                <Text style={[styles.placeholderLabel, { color: theme.colors.placeholder }]}>Supported Tags:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeholderScroll}>
                  {['[Name]', '[Vehicle]', '[Reg]', '[Expiry]'].map((tag) => (
                    <View key={tag} style={[styles.placeholderPill, { backgroundColor: theme.colors.primary + '12' }]}>
                      <Text style={[styles.placeholderPillText, { color: theme.colors.primary }]}>{tag}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <TouchableOpacity
                onPress={() => saveTemplate(7)}
                disabled={savingTemplate !== null}
                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
              >
                {savingTemplate === 7 ? (
                  <ActivityIndicator size="small" color={theme.dark ? theme.colors.background : '#FFFFFF'} />
                ) : (
                  <View style={styles.saveBtnContent}>
                    <MaterialCommunityIcons name="content-save-outline" size={15} color={theme.dark ? theme.colors.background : '#FFFFFF'} style={{ marginRight: 5 }} />
                    <Text style={[styles.saveBtnText, { color: theme.dark ? theme.colors.background : '#FFFFFF' }]}>Save Template</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    height: 40,
    width: '100%',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  tabContent: {},
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  logCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logActivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  logActivity: {
    fontWeight: 'bold',
    fontSize: 13.5,
  },
  logDate: {
    fontSize: 10.5,
  },
  logDetails: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  reportCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportMeta: {
    flex: 1,
    marginLeft: 12,
  },
  reportTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportTitle: {
    fontSize: 14.5,
    fontWeight: 'bold',
  },
  metricBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  metricText: {
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  exportDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    marginVertical: 14,
  },
  exportLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  exportBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pdfBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  excelBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  csvBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  templateHeader: {
    marginBottom: 12,
  },
  templateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateDaysText: {
    fontWeight: 'bold',
    fontSize: 13.5,
  },
  templateInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 80,
    marginBottom: 12,
  },
  placeholderContainer: {
    marginBottom: 14,
  },
  placeholderLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  placeholderScroll: {
    gap: 6,
  },
  placeholderPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  placeholderPillText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  saveBtn: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
