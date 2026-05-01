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
} from 'react-native'
import { router } from 'expo-router'
import Svg, { Path, Rect, Circle, Ellipse } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateFullName,
} from '@/lib/validation'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function PersonIcon({ focused }: { focused?: boolean }) {
  const c = focused ? Colors.primary : Colors.textMuted
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Circle cx="8" cy="5" r="3" stroke={c} strokeWidth="1.3" />
      <Path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  )
}

function EmailIcon({ focused }: { focused?: boolean }) {
  const c = focused ? Colors.primary : Colors.textMuted
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x="1" y="3" width="14" height="10" rx="2" stroke={c} strokeWidth="1.3" />
      <Path d="M1 5.5L8 9.5L15 5.5" stroke={c} strokeWidth="1.3" />
    </Svg>
  )
}

function LockIcon({ focused }: { focused?: boolean }) {
  const c = focused ? Colors.primary : Colors.textMuted
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x="3" y="7" width="10" height="7" rx="1.5" stroke={c} strokeWidth="1.3" />
      <Path d="M5 7V5a3 3 0 016 0v2" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
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

// ---------------------------------------------------------------------------
// Reusable Field
// ---------------------------------------------------------------------------
interface FieldProps {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder: string
  icon: (focused: boolean) => React.ReactNode
  error?: string
  isPassword?: boolean
  keyboardType?: 'default' | 'email-address'
  autoCapitalize?: 'none' | 'words'
}

function Field({ label, value, onChangeText, placeholder, icon, error, isPassword, keyboardType = 'default', autoCapitalize = 'none' }: FieldProps) {
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(isPassword ?? false)

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputFocused, !!error && styles.inputError]}>
        <View style={styles.inputIcon}>{icon(focused)}</View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <EyeIcon visible={!hidden} />
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function RegisterScreen() {
  const setPendingEmail = useAuthStore((s) => s.setPendingEmail)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{
    fullName?: string; email?: string; password?: string; confirm?: string; general?: string
  }>({})
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    const nameErr = validateFullName(fullName)
    const emailErr = validateEmail(email)
    const passwordErr = validatePassword(password)
    const confirmErr = validateConfirmPassword(password, confirm)

    if (nameErr || emailErr || passwordErr || confirmErr) {
      setErrors({
        fullName: nameErr ?? undefined,
        email: emailErr ?? undefined,
        password: passwordErr ?? undefined,
        confirm: confirmErr ?? undefined,
      })
      return
    }

    setErrors({})
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    setLoading(false)

    if (error) { setErrors({ general: error.message }); return }

    if (data.session) {
      router.replace('/(tabs)/')
    } else {
      setPendingEmail(email)
      router.push('/(auth)/verify-otp')
    }
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.brandRow}>
            <Text style={styles.brandLabel}>JOIN THE COMMUNITY</Text>
          </View>
          <Text style={styles.heroTitle}>Create{'\n'}account.</Text>
          <Text style={styles.heroSub}>Start exploring Albay today</Text>
          <View style={styles.accentBar} />
        </View>

        {/* Form card */}
        <View style={styles.card}>
          {errors.general && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠ {errors.general}</Text>
            </View>
          )}

          <Field
            label="Full name"
            value={fullName}
            onChangeText={(t) => { setFullName(t); setErrors((e) => ({ ...e, fullName: undefined })) }}
            placeholder="Juan dela Cruz"
            icon={(f) => <PersonIcon focused={f} />}
            error={errors.fullName}
            autoCapitalize="words"
          />

          <Field
            label="Email address"
            value={email}
            onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })) }}
            placeholder="you@email.com"
            icon={(f) => <EmailIcon focused={f} />}
            error={errors.email}
            keyboardType="email-address"
          />

          <Field
            label="Password"
            value={password}
            onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })) }}
            placeholder="Min. 8 chars, uppercase & number"
            icon={(f) => <LockIcon focused={f} />}
            error={errors.password}
            isPassword
          />

          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={(t) => { setConfirm(t); setErrors((e) => ({ ...e, confirm: undefined })) }}
            placeholder="Repeat your password"
            icon={(f) => <LockIcon focused={f} />}
            error={errors.confirm}
            isPassword
          />

          <TouchableOpacity
            style={[styles.ctaBtn, loading && styles.ctaDisabled]}
            onPress={handleRegister}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.textInverse} />
              : <Text style={styles.ctaText}>Create account  →</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.switchLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.tagline}>✦  Explore the beauty of Bicol  ✦</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
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
  backBtn: { marginBottom: Spacing.lg },
  backArrow: {
    fontSize: 22,
    color: Colors.textPrimary,
  },
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
  fieldLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
