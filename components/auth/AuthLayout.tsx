import React from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Typography, Radius } from '@/constants/theme'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  showBack?: boolean
  children: React.ReactNode
}

export function AuthLayout({ title, subtitle, showBack, children }: AuthLayoutProps) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top row */}
        <View style={styles.topRow}>
          {showBack ? (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          ) : <View style={styles.backBtn} />}

          {/* Wordmark */}
          <Text style={styles.wordmark}>seeliscape</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Decorative arc */}
        <View style={styles.arcWrapper}>
          <View style={styles.arc} />
        </View>

        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {/* Form content */}
        <View style={styles.card}>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  container: { paddingBottom: Spacing.xxl },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + (Platform.OS === 'android' ? 12 : 0),
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backArrow: { fontSize: 22, color: Colors.textSecondary },
  wordmark: {
    fontFamily: Typography.displayFont,
    fontSize: 20,
    color: Colors.primary,
    letterSpacing: -0.5,
  },

  // Decorative swoosh arc
  arcWrapper: { alignItems: 'center', marginTop: Spacing.sm },
  arc: {
    width: 220,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    opacity: 0.35,
  },

  titleBlock: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: Typography.displayFont,
    fontSize: 34,
    color: Colors.textPrimary,
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },

  card: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    // subtle shadow
    shadowColor: '#1A1208',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
})
