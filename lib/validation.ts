// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return 'Enter a valid email address.'
  return null
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------
export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Include at least one uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Include at least one number.'
  return null
}

// ---------------------------------------------------------------------------
// Confirm password
// ---------------------------------------------------------------------------
export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password.'
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

// ---------------------------------------------------------------------------
// Full name
// ---------------------------------------------------------------------------
export function validateFullName(name: string): string | null {
  if (!name.trim()) return 'Full name is required.'
  if (name.trim().length < 2) return 'Name is too short.'
  return null
}

// ---------------------------------------------------------------------------
// OTP token
// ---------------------------------------------------------------------------
export function validateOtp(token: string): string | null {
  if (!token.trim()) return 'Enter the 6-digit code.'
  if (!/^\d{6}$/.test(token)) return 'Code must be exactly 6 digits.'
  return null
}
