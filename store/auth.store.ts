import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------
interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  pendingEmail: string | null          // email awaiting OTP verification

  // Actions
  setSession: (session: Session | null) => void
  setPendingEmail: (email: string | null) => void
  setLoading: (loading: boolean) => void
  initialize: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  pendingEmail: null,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setPendingEmail: (email) =>
    set({ pendingEmail: email }),

  setLoading: (loading) =>
    set({ loading }),

  // Call once at app startup to restore session and subscribe to auth changes
  initialize: async () => {
    const { data } = await supabase.auth.getSession()
    set({ session: data.session, user: data.session?.user ?? null, loading: false })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null })
    })
  },
}))
