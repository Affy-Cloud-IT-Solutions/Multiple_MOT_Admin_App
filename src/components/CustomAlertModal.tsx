import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../context/ThemeContext';
import { setAlertHandlers, AlertParams } from '../utils/AlertManager';

const { width } = Dimensions.get('window');

export default function CustomAlertModal() {
  const { theme } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [params, setParams] = useState<AlertParams | null>(null);
  const [scaleAnim] = useState(new Animated.Value(0.85));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    setAlertHandlers(
      (alertParams) => {
        setParams(alertParams);
        setVisible(true);
      },
      () => {
        handleClose();
      }
    );
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setParams(null);
    });
  };

  if (!visible || !params) return null;

  const { title, message, buttons } = params;

  // Infer the alert type from the content
  let type: 'success' | 'error' | 'warning' | 'info' = 'info';
  const fullText = `${title} ${message || ''}`.toLowerCase();
  
  if (
    fullText.includes('success') ||
    fullText.includes('confirmed') ||
    fullText.includes('approved') ||
    fullText.includes('saved') ||
    fullText.includes('cleared') ||
    fullText.includes('acknowledged') ||
    fullText.includes('sent')
  ) {
    type = 'success';
  } else if (
    fullText.includes('failed') ||
    fullText.includes('error') ||
    fullText.includes('invalid') ||
    fullText.includes('denied') ||
    fullText.includes('cannot') ||
    fullText.includes('could not') ||
    fullText.includes('failed')
  ) {
    type = 'error';
  } else if (
    fullText.includes('warning') ||
    fullText.includes('sure') ||
    fullText.includes('are you sure') ||
    fullText.includes('delete') ||
    fullText.includes('remove') ||
    fullText.includes('sign out') ||
    fullText.includes('logout')
  ) {
    type = 'warning';
  }

  // Type configuration
  let headerColor = '#3B82F6'; // Blue for info
  let iconName = 'information-outline';
  if (type === 'success') {
    headerColor = '#10B981'; // Green
    iconName = 'check-circle-outline';
  } else if (type === 'error') {
    headerColor = '#EF4444'; // Red
    iconName = 'alert-circle-outline';
  } else if (type === 'warning') {
    headerColor = '#F59E0B'; // Amber
    iconName = 'help-circle-outline';
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Header Icon Indicator */}
          <View style={[styles.iconContainer, { backgroundColor: headerColor + '15', borderColor: headerColor }]}>
            <MaterialCommunityIcons name={iconName} size={32} color={headerColor} />
          </View>

          {/* Text Content */}
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: theme.colors.placeholder }]}>
              {message}
            </Text>
          ) : null}

          {/* Buttons Layout */}
          <View style={[styles.buttonContainer, buttons && buttons.length > 2 && { flexDirection: 'column' }]}>
            {buttons && buttons.length > 0 ? (
              buttons.map((btn, index) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                
                let btnColor = theme.colors.primary;
                let btnBg = theme.colors.primary + '12';
                let isOutline = true;

                if (isDestructive) {
                  btnColor = '#EF4444';
                  btnBg = '#EF4444';
                  isOutline = false;
                } else if (isCancel) {
                  btnColor = theme.colors.placeholder;
                  btnBg = 'transparent';
                  isOutline = true;
                } else if (index === buttons.length - 1) {
                  btnColor = headerColor;
                  btnBg = headerColor;
                  isOutline = false;
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      isOutline ? { borderColor: theme.colors.border, borderWidth: 1 } : { backgroundColor: btnBg },
                      buttons.length > 2 && { width: '100%', marginBottom: 8 }
                    ]}
                    onPress={() => {
                      handleClose();
                      if (btn.onPress) btn.onPress();
                    }}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        { color: isOutline ? btnColor : '#FFFFFF' }
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              // Default OK button
              <TouchableOpacity
                style={[styles.button, { backgroundColor: headerColor }]}
                onPress={handleClose}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>OK</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalContainer: {
    width: width * 0.84,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  button: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
