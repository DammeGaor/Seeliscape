import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AuthCredentials {
  email: string
  password: string
}

export interface SignUpCredentials extends AuthCredentials {
  fullName: string
}

export interface AuthResult {
  error: string | null
}

// ---------------------------------------------------------------------------
// Sign up — creates account then sends OTP verification email
// ---------------------------------------------------------------------------
export async function signUp({ email, password, fullName }: SignUpCredentials): Promise<AuthResult> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: undefined, // using OTP, not magic link
    },
  })
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
export async function signIn({ email, password }: AuthCredentials): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export async function signOut(): Promise<AuthResult> {
  const { error } = await supabase.auth.signOut()
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Verify OTP sent to email
// ---------------------------------------------------------------------------
export async function verifyOtp(email: string, token: string): Promise<AuthResult> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  })
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Resend OTP (verification email)
// ---------------------------------------------------------------------------
export async function resendOtp(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Send password reset email
// ---------------------------------------------------------------------------
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: undefined, // handle in-app via deep link if needed
  })
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Update password (after reset flow)
// ---------------------------------------------------------------------------
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Get current session
// ---------------------------------------------------------------------------
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
