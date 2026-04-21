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
function PersonIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Circle cx="8" cy="5" r="3" stroke={Colors.textMuted} strokeWidth="1.2" />
      <Path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke={Colors.textMuted} strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  )
}

function EmailIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x="1" y="3" width="14" height="10" rx="2" stroke={Colors.textMuted} strokeWidth="1.2" />
      <Path d="M1 5.5L8 9.5L15 5.5" stroke={Colors.textMuted} strokeWidth="1.2" />
    </Svg>
  )
}

function LockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x="3" y="7" width="10" height="7" rx="1.5" stroke={Colors.textMuted} strokeWidth="1.2" />
      <Path d="M5 7V5a3 3 0 016 0v2" stroke={Colors.textMuted} strokeWidth="1.2" strokeLinecap="round" />
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
// Wave divider
// ---------------------------------------------------------------------------
function WaveDivider() {
  return (
    <Svg
      width="100%"
      height={60}
      viewBox="0 0 390 60"
      preserveAspectRatio="none"
      style={{ marginTop: -1, backgroundColor: Colors.primary }}
    >
      <Path
        d="M0 30 C70 8, 140 52, 210 28 C280 4, 340 48, 390 22 L390 60 L0 60Z"
        fill={Colors.bgCard}
      />
    </Svg>
  )
}

// ---------------------------------------------------------------------------
// Reusable field component
// ---------------------------------------------------------------------------
interface FieldProps {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder: string
  icon: React.ReactNode
  error?: string
  isPassword?: boolean
  keyboardType?: 'default' | 'email-address'
  autoCapitalize?: 'none' | 'words'
}

function Field({
  label, value, onChangeText, placeholder, icon, error,
  isPassword, keyboardType = 'default', autoCapitalize = 'none',
}: FieldProps) {
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(isPassword ?? false)

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[
        styles.inputRow,
        focused && styles.inputFocused,
        !!error && styles.inputError,
      ]}>
        <View style={styles.inputIcon}>{icon}</View>
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
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
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
    fullName?: string
    email?: string
    password?: string
    confirm?: string
    general?: string
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

    // ---------------------------------------------------------------------------
    // Call signUp directly on supabase so we can inspect the raw response.
    //
    // Supabase returns:
    //   data.session !== null  → email confirmation is OFF  → user is in, go home
    //   data.session === null  → email confirmation is ON   → user must verify OTP
    // ---------------------------------------------------------------------------
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    setLoading(false)

    if (error) {
      setErrors({ general: error.message })
      return
    }

    if (data.session) {
      // Confirm email is OFF — user is fully signed in, go straight to app
      router.replace('/(tabs)/')
    } else {
      // Confirm email is ON — Supabase sent an OTP, go to verify screen
      setPendingEmail(email)
      router.push('/(auth)/verify-otp')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.wordmarkBadge}>
          <View style={styles.wordmarkDot} />
          <Text style={styles.wordmark}>seeliscape</Text>
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>join the community</Text>
          <Text style={styles.headerTitle}>Create{'\n'}account.</Text>
        </View>
      </View>

      <WaveDivider />

      {/* ── Body ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {errors.general && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errors.general}</Text>
          </View>
        )}

        <Field
          label="Full name"
          value={fullName}
          onChangeText={(t) => { setFullName(t); setErrors((e) => ({ ...e, fullName: undefined })) }}
          placeholder="Juan dela Cruz"
          icon={<PersonIcon />}
          error={errors.fullName}
          autoCapitalize="words"
        />

        <Field
          label="Email address"
          value={email}
          onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })) }}
          placeholder="you@email.com"
          icon={<EmailIcon />}
          error={errors.email}
          keyboardType="email-address"
        />

        <Field
          label="Password"
          value={password}
          onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })) }}
          placeholder="Min. 8 chars, 1 uppercase, 1 number"
          icon={<LockIcon />}
          error={errors.password}
          isPassword
        />

        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={(t) => { setConfirm(t); setErrors((e) => ({ ...e, confirm: undefined })) }}
          placeholder="Repeat your password"
          icon={<LockIcon />}
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
            : <Text style={styles.ctaText}>Create account</Text>
          }
        </TouchableOpacity>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.switchLink}>Sign in</Text>
          </TouchableOpacity>
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
  flex: { flex: 1, backgroundColor: Colors.bgCard },

  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? Spacing.xl + 8 : Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 0,
  },
  backBtn: { marginBottom: Spacing.sm },
  backArrow: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.8)',
  },
  wordmarkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  wordmarkDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    opacity: 0.9,
  },
  wordmark: {
    fontFamily: Typography.displayFont,
    fontSize: 15,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },
  headerTextBlock: { marginBottom: Spacing.lg },
  headerEyebrow: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  headerTitle: {
    fontFamily: Typography.displayFont,
    fontSize: 38,
    color: Colors.textInverse,
    lineHeight: 44,
    letterSpacing: -0.8,
  },

  body: { flex: 1, backgroundColor: Colors.bgCard },
  bodyContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#F5C6C1',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.error,
  },

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
    height: 52,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  inputFocused: {
    borderColor: Colors.borderFocus,
    backgroundColor: Colors.bgCard,
  },
  inputError: { borderColor: Colors.error },
  inputIcon: { width: 20, alignItems: 'center' },
  input: {
    flex: 1,
    fontFamily: Typography.bodyFont,
    fontSize: 15,
    color: Colors.textPrimary,
    height: '100%',
  },
  fieldError: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },

  ctaBtn: {
    height: 54,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 16,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  switchText: {
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textMuted,
  },
  switchLink: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: Colors.primary,
  },

  tagline: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
})
