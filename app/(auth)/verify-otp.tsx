import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native'
import { router } from 'expo-router'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { AuthButton } from '@/components/auth/AuthButton'
import { verifyOtp, resendOtp } from '@/lib/auth.service'
import { useAuthStore } from '@/store/auth.store'
import { Colors, Spacing, Typography, Radius } from '@/constants/theme'

const OTP_LENGTH = 6

export default function VerifyOtpScreen() {
  const pendingEmail = useAuthStore((s) => s.pendingEmail)
  const setPendingEmail = useAuthStore((s) => s.setPendingEmail)

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputs = useRef<(TextInput | null)[]>([])

  const token = digits.join('')

  function handleDigitChange(text: string, index: number) {
    const digit = text.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus()
    }
  }

  function handleKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  async function handleVerify() {
    if (token.length < OTP_LENGTH) {
      setError('Enter all 6 digits.')
      return
    }
    if (!pendingEmail) {
      setError('Session expired. Please register again.')
      return
    }
    setError(null)
    setLoading(true)
    const { error: err } = await verifyOtp(pendingEmail, token)
    setLoading(false)
    if (err) { setError(err); return }
    setPendingEmail(null)
    router.replace('/(tabs)/')
  }

  async function handleResend() {
    if (!pendingEmail || resendCooldown > 0) return
    await resendOtp(pendingEmail)
    // 60 second cooldown
    setResendCooldown(60)
    const interval = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0 }
        return c - 1
      })
    }, 1000)
  }

  return (
    <AuthLayout
      title={'Verify\nyour email.'}
      subtitle={`We sent a 6-digit code to${pendingEmail ? `\n${pendingEmail}` : ' your email'}.`}
      showBack
    >
      {/* OTP digit boxes */}
      <View style={styles.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => { inputs.current[i] = r }}
            style={[styles.digitBox, d ? styles.digitFilled : null]}
            value={d}
            onChangeText={(t) => handleDigitChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            textAlign="center"
          />
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <AuthButton label="Verify email" loading={loading} onPress={handleVerify} />

      {/* Resend */}
      <TouchableOpacity
        onPress={handleResend}
        disabled={resendCooldown > 0}
        style={styles.resendBtn}
      >
        <Text style={[styles.resendText, resendCooldown > 0 && styles.resendMuted]}>
          {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get a code? Resend"}
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  )
}

const styles = StyleSheet.create({
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  digitBox: {
    width: 46,
    height: 58,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgMuted,
    fontSize: 24,
    fontFamily: Typography.bodySemiBold,
    color: Colors.textPrimary,
  },
  digitFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.bgCard,
  },
  errorText: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  resendBtn: { alignItems: 'center', marginTop: Spacing.md },
  resendText: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.accent,
  },
  resendMuted: { color: Colors.textMuted },
})
