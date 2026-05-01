import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
} from 'react-native'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

interface InfoModalProps {
  visible: boolean
  onClose: () => void
}

const AUTHORS = [
  'Carl Ivanne Froyalde',
  'Marc Damme Gaor',
  'Roshan Pearl Recomendable',
]

export function InfoModal({ visible, onClose }: InfoModalProps) {
  const scaleAnim   = useRef(new Animated.Value(0.92)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const slideAnim   = useRef(new Animated.Value(24)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 12, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 12, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 0.92, duration: 160, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0,    duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim,   { toValue: 24,   duration: 160, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* ── Top accent bar ── */}
          <View style={styles.accentBar} />

          {/* ── App name ── */}
          <View style={styles.header}>
            <Text style={styles.appName}>Seeliscape</Text>
            <Text style={styles.tagline}>Discover the beauty of Albay</Text>
          </View>

          {/* ── Body ── */}
          <Text style={styles.body}>
            An interactive tourism companion for Albay, Bicol — explore landmarks,
            unlock destinations by visiting them in person, and navigate across the province.
          </Text>

          {/* ── Divider with label ── */}
          <View style={styles.labelRow}>
            <View style={styles.labelLine} />
            <Text style={styles.labelTxt}>MADE BY</Text>
            <View style={styles.labelLine} />
          </View>

          {/* ── Authors ── */}
          <View style={styles.authorList}>
            {AUTHORS.map((name, i) => (
              <View key={name} style={styles.authorRow}>
                <Text style={styles.authorIndex}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={styles.authorName}>{name}</Text>
              </View>
            ))}
          </View>

          {/* ── Degree badge ── */}
          <View style={styles.degreeBadge}>
            <Text style={styles.degreeTxt}>A BS Computer Science Undergraduate Thesis</Text>
          </View>

          {/* ── Close button ── */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeBtnTxt}>Close</Text>
          </TouchableOpacity>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },

  card: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 20,
  },

  // Top accent stripe
  accentBar: {
    height: 4,
    backgroundColor: Colors.primary,
    width: '100%',
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  appName: {
    fontFamily: Typography.displayFont,
    fontSize: 30,
    color: Colors.textPrimary,
    letterSpacing: -1,
    marginBottom: 4,
  },
  tagline: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },

  // Body
  body: {
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },

  // Divider with label
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  labelLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  labelTxt: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },

  // Authors
  authorList: {
    paddingHorizontal: Spacing.lg,
    gap: 10,
    marginBottom: Spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorIndex: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.primary,
    opacity: 0.7,
    width: 22,
  },
  authorName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  // Degree badge
  degreeBadge: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  degreeTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },

  // Close button
  closeBtn: {
    margin: Spacing.lg,
    marginTop: 0,
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnTxt: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 15,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },
})
