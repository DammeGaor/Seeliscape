import React from 'react'
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
} from 'react-native'
import { Colors, Radius, Typography } from '@/constants/theme'

interface AuthButtonProps extends TouchableOpacityProps {
  label: string
  loading?: boolean
  variant?: 'primary' | 'ghost'
}

export function AuthButton({ label, loading, variant = 'primary', style, ...props }: AuthButtonProps) {
  const isPrimary = variant === 'primary'
  return (
    <TouchableOpacity
      style={[styles.btn, isPrimary ? styles.primary : styles.ghost, style]}
      activeOpacity={0.82}
      disabled={loading}
      {...props}
    >
      {loading
        ? <ActivityIndicator color={isPrimary ? Colors.textInverse : Colors.primary} />
        : <Text style={[styles.label, !isPrimary && styles.labelGhost]}>{label}</Text>
      }
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  primary: { backgroundColor: Colors.primary },
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.border },
  label: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 16,
    color: Colors.textInverse,
    letterSpacing: 0.4,
  },
  labelGhost: { color: Colors.textSecondary },
})
