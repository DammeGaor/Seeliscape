import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
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
          <Text style={styles.successIcon}>✉️</Text>
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
      {generalError && <Text style={styles.generalError}>{generalError}</Text>}

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
  generalError: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.error,
    backgroundColor: Colors.errorLight,
    padding: Spacing.md,
    borderRadius: 10,
    marginBottom: Spacing.md,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  successIcon: { fontSize: 48, marginBottom: Spacing.md },
  successTitle: {
    fontFamily: Typography.displayFont,
    fontSize: 26,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
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
