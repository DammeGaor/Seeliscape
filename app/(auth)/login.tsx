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
import Svg, { Path, Ellipse, Circle, Rect } from 'react-native-svg'
import { signIn } from '@/lib/auth.service'
import { validateEmail, validatePassword } from '@/lib/validation'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------
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
// Wave SVG that transitions from the blue header into the white body
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
// Screen
// ---------------------------------------------------------------------------
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
    if (error) {
      setErrors({ general: error })
      return
    }
    router.replace('/(tabs)/')
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* ── Ocean blue header ── */}
      <View style={styles.header}>
        <View style={styles.wordmarkBadge}>
          <View style={styles.wordmarkDot} />
          <Text style={styles.wordmark}>seeliscape</Text>
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerEyebrow}>discover albay</Text>
          <Text style={styles.headerTitle}>Welcome{'\n'}back.</Text>
        </View>
      </View>

      {/* ── Wave transition ── */}
      <WaveDivider />

      {/* ── Scrollable white body ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* General error banner */}
        {errors.general && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errors.general}</Text>
          </View>
        )}

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email address</Text>
          <View style={[
            styles.inputRow,
            emailFocused && styles.inputFocused,
            !!errors.email && styles.inputError,
          ]}>
            <View style={styles.inputIcon}><EmailIcon /></View>
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

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={[
            styles.inputRow,
            passwordFocused && styles.inputFocused,
            !!errors.password && styles.inputError,
          ]}>
            <View style={styles.inputIcon}><LockIcon /></View>
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
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eyeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <EyeIcon visible={showPassword} />
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
        </View>

        {/* Forgot password */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/forgot-password')}
          style={styles.forgotBtn}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign in CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, loading && styles.ctaDisabled]}
          onPress={handleLogin}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.textInverse} />
            : <Text style={styles.ctaText}>Sign in</Text>
          }
        </TouchableOpacity>

        {/* OR divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google OAuth */}
        <TouchableOpacity style={styles.oauthBtn} activeOpacity={0.8}>
          <Svg width={18} height={18} viewBox="0 0 18 18">
            <Path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
            <Path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
            <Path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
            <Path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335" />
          </Svg>
          <Text style={styles.oauthText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Switch to register */}
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.switchLink}>Create one</Text>
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

  // Header — ocean blue block
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? Spacing.xl + 8 : Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 0,
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
    marginBottom: Spacing.lg,
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

  // Body
  body: { flex: 1, backgroundColor: Colors.bgCard },
  bodyContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  // Error banner
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

  // Fields
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
  eyeBtn: { padding: 4 },
  fieldError: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },

  // Forgot
  forgotBtn: { alignSelf: 'flex-end', marginBottom: Spacing.lg, marginTop: -4 },
  forgotText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.primary,
  },

  // CTA button
  ctaBtn: {
    height: 54,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 16,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerLabel: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Google OAuth
  oauthBtn: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  oauthText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  // Switch row
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

  // Footer
  tagline: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
})
