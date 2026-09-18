import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface IconProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
}

// 1. Premium UK MOT Admin & Station Hero Graphic
export const AdminHeroLogo: React.FC<{
  size?: number;
  primary?: string;
  secondary?: string;
  dark?: boolean;
}> = ({
  size = 96,
  primary = '#0B1F33',
  secondary = '#1677FF',
  dark = false,
}) => {
  return (
    <View style={[styles.heroLogoContainer, { width: size, height: size }]}>
      {/* Outer ambient glow halo */}
      <View
        style={[
          styles.outerHalo,
          {
            backgroundColor: dark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(22, 119, 255, 0.12)',
            borderColor: dark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(22, 119, 255, 0.2)',
          },
        ]}
      />

      {/* Main Shield & Terminal Container */}
      <View
        style={[
          styles.mainBadge,
          {
            backgroundColor: dark ? '#0E2843' : '#0B1F33',
            borderColor: dark ? '#38BDF8' : '#1677FF',
          },
        ]}
      >
        {/* Top Triple MOT Triangles */}
        <View style={styles.motTrianglesRow}>
          <View style={[styles.motTriangle, { borderBottomColor: '#38BDF8' }]} />
          <View style={[styles.motTriangle, { borderBottomColor: '#60A5FA' }]} />
          <View style={[styles.motTriangle, { borderBottomColor: '#93C5FD' }]} />
        </View>

        {/* Central Garage / Terminal Shield Icon */}
        <MaterialCommunityIcons name="shield-car" size={38} color="#FFFFFF" />

        {/* Inner subtle glow line */}
        <View style={styles.innerGlowBar} />
      </View>

      {/* Verified Admin Key / Check Badge on Bottom Right */}
      <View style={styles.verifiedBadge}>
        <MaterialCommunityIcons name="shield-check" size={14} color="#FFFFFF" />
      </View>
    </View>
  );
};

// 2. Email Icon
export const EmailIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="email-outline" size={size} color={color} />;
};

// 3. Lock Icon
export const LockIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="lock-outline" size={size} color={color} />;
};

// 4. Lock Check Icon
export const LockCheckIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="lock-check-outline" size={size} color={color} />;
};

// 5. Eye Icon
export const EyeIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="eye-outline" size={size} color={color} />;
};

// 6. Eye Off Icon
export const EyeOffIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="eye-off-outline" size={size} color={color} />;
};

// 7. User Icon
export const UserIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="account-outline" size={size} color={color} />;
};

// 8. Garage / Store Icon
export const GarageIcon: React.FC<IconProps> = ({ size = 20, color = '#647890' }) => {
  return <MaterialCommunityIcons name="store-outline" size={size} color={color} />;
};

const styles = StyleSheet.create({
  heroLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 6,
  },
  outerHalo: {
    position: 'absolute',
    width: '118%',
    height: '118%',
    borderRadius: 30,
    borderWidth: 1.5,
  },
  mainBadge: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#1677FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    paddingTop: 4,
    overflow: 'hidden',
  },
  motTrianglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 4,
  },
  motTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  innerGlowBar: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: '#38BDF8',
    borderRadius: 1,
    opacity: 0.8,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});
