import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native'
import { router } from 'expo-router'
import Svg, { Path, Ellipse, Circle, Rect, Defs, RadialGradient, Stop } from 'react-native-svg'
import { signIn } from '@/lib/auth.service'
import { validateEmail, validatePassword } from '@/lib/validation'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

const { width: SW, height: SH } = Dimensions.get('window')

function EmailIcon({ focused }: { focused?: boolean }) {
  const c = focused ? Colors.primary : Colors.textMuted
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x="1" y="3" width="14" height="10" rx="2" stroke={c} strokeWidth="1.4" />
      <Path d="M1 5.5L8 9.5L15 5.5" stroke={c} strokeWidth="1.4" />
    </Svg>
  )
}

function LockIcon({ focused }: { focused?: boolean }) {
  const c = focused ? Colors.primary : Colors.textMuted
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x="3" y="7" width="10" height="7" rx="1.5" stroke={c} strokeWidth="1.4" />
      <Path d="M5 7V5a3 3 0 016 0v2" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  )
}

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Ellipse cx="9" cy="9" rx="7" ry="4.5" stroke={Colors.textMuted} strokeWidth="1.3" />
      <Circle cx="9" cy="9" r="2" fill={Colors.textMuted} />
      {!visible && (
        <Path d="M2 2L16 16" stroke={Colors.textMuted} strokeWidth="1.3" strokeLinecap="round" />
      )}
    </Svg>
  )
}

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    const emailErr = validateEmail(email)
    const passwordErr = validatePassword(password)
    if (emailErr || passwordErr) {
      setErrors({ email: emailErr ?? undefined, password: passwordErr ?? undefined })
      return
    }
    setErrors({})
    setLoading(true)
    const { error } = await signIn({ email, password })
    setLoading(false)
    if (error) { setErrors({ general: error }); return }
    router.replace('/(tabs)/')
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <View style={styles.brandRow}>
              <Text style={styles.brandLabel}>DISCOVER ALBAY</Text>
            </View>
            <Text style={styles.heroTitle}>Welcome back{'\n'}to Seeliscape.</Text>
            <Text style={styles.heroSub}>Sign in to continue your journey</Text>
          </View>
          {/* Decorative accent bar */}
          <View style={styles.accentBar} />
        </View>

        {/* Form card */}
        <View style={styles.card}>
          {errors.general && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠ {errors.general}</Text>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email address</Text>
            <View style={[styles.inputRow, emailFocused && styles.inputFocused, !!errors.email && styles.inputError]}>
              <View style={styles.inputIcon}><EmailIcon focused={emailFocused} /></View>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })) }}
                placeholder="you@email.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>
            {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={styles.forgotText}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputRow, passwordFocused && styles.inputFocused, !!errors.password && styles.inputError]}>
              <View style={styles.inputIcon}><LockIcon focused={passwordFocused} /></View>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })) }}
                placeholder="Your password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <EyeIcon visible={showPassword} />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.ctaBtn, loading && styles.ctaDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.textInverse} />
              : <Text style={styles.ctaText}>Sign in  →</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.switchLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.tagline}>✦  Explore the beauty of Bicol  ✦</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 48 },

  hero: {
    backgroundColor: Colors.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 32) + 12 : 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 32,
    position: 'relative',
  },
  heroInner: { gap: 6 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: Colors.primary,
  },
  brandLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 2.5,
  },
  heroTitle: {
    fontFamily: Typography.displayFont,
    fontSize: 46,
    color: Colors.textPrimary,
    lineHeight: 52,
    letterSpacing: -1.2,
  },
  heroSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 8,
  },
  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.lg,
    width: 48,
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 99,
  },

  card: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#F5C6C1',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorBannerText: { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.error },

  fieldGroup: { marginBottom: Spacing.md },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  forgotText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  inputFocused: { borderColor: Colors.primary, backgroundColor: Colors.bgCard },
  inputError: { borderColor: Colors.error },
  inputIcon: { width: 20, alignItems: 'center' },
  input: {
    flex: 1,
    fontFamily: Typography.bodyFont,
    fontSize: 15,
    color: Colors.textPrimary,
    height: '100%',
  },
  eyeBtn: { padding: 4 },
  fieldError: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.error, marginTop: 4 },

  ctaBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  ctaDisabled: { opacity: 0.65, shadowOpacity: 0 },
  ctaText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 16,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
    gap: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },

  switchRow: { flexDirection: 'row', justifyContent: 'center' },
  switchText: { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.textMuted },
  switchLink: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.primary },

  tagline: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: Spacing.xl,
  },
})
