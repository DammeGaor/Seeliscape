import React, { useState } from 'react'
import { View, Text, StyleSheet, Platform, StatusBar, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { sendPasswordReset } from '@/lib/auth.service'
import { validateEmail } from '@/lib/validation'
import { Colors, Spacing, Typography, Radius } from '@/constants/theme'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)

  async function handleSend() {
    const err = validateEmail(email)
    if (err) { setEmailError(err); return }
    setEmailError(null)
    setLoading(true)
    const { error } = await sendPasswordReset(email)
    setLoading(false)
    if (error) { setGeneralError(error); return }
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title={'Check your\ninbox.'} showBack>
        <View style={styles.successBox}>
          <View style={styles.successIconWrap}>
            <Text style={styles.successIcon}>✉️</Text>
          </View>
          <Text style={styles.successTitle}>Email sent!</Text>
          <Text style={styles.successBody}>
            We sent a password reset link to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
        </View>
        <AuthButton
          label="Back to sign in"
          onPress={() => router.replace('/(auth)/login')}
          variant="ghost"
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={'Forgot\npassword?'}
      subtitle="No worries. Enter your email and we'll send a reset link."
      showBack
    >
      {generalError && (
        <View style={styles.errorBox}>
          <Text style={styles.generalError}>⚠ {generalError}</Text>
        </View>
      )}

      <AuthInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        placeholder="you@email.com"
        error={emailError}
      />

      <AuthButton label="Send reset link" loading={loading} onPress={handleSend} />
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  errorBox: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#F5C6C1',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  generalError: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.error,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary + '25',
  },
  successIcon: { fontSize: 32 },
  successTitle: {
    fontFamily: Typography.displayFont,
    fontSize: 26,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  successBody: {
    fontFamily: Typography.bodyFont,
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: {
    fontFamily: Typography.bodySemiBold,
    color: Colors.primary,
  },
})
