import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Colors, Radius, Spacing, Typography } from '@/constants/theme'

interface AuthInputProps extends TextInputProps {
  label: string
  error?: string | null
  isPassword?: boolean
}

export function AuthInput({ label, error, isPassword, ...props }: AuthInputProps) {
  const [hidden, setHidden] = useState(isPassword ?? false)
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputFocused, !!error && styles.inputError]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={hidden}
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{hidden ? '👁' : '🙈'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgMuted,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  inputFocused: { borderColor: Colors.borderFocus },
  inputError: { borderColor: Colors.error },
  input: {
    flex: 1,
    height: 52,
    fontFamily: Typography.bodyFont,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  eyeBtn: { padding: Spacing.sm },
  eyeText: { fontSize: 16 },
  errorText: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
})
