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
  role: 'tourist' | 'admin' | null
  isAdmin: boolean
  pendingEmail: string | null

  setSession: (session: Session | null) => void
  setPendingEmail: (email: string | null) => void
  setLoading: (loading: boolean) => void
  initialize: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Fetch role from profiles table
// ---------------------------------------------------------------------------
async function fetchRole(userId: string): Promise<'tourist' | 'admin'> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) return 'tourist'
  return data.role === 'admin' ? 'admin' : 'tourist'
}

// ---------------------------------------------------------------------------
// Track whether the auth listener has been registered — prevents duplicates
// when initialize() is called more than once (hot reload, strict mode, etc.)
// ---------------------------------------------------------------------------
let listenerRegistered = false

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  role: null,
  isAdmin: false,
  pendingEmail: null,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setPendingEmail: (email) =>
    set({ pendingEmail: email }),

  setLoading: (loading) =>
    set({ loading }),

  initialize: async () => {
    // ── 1. Restore existing session on app start ──────────────────────────
    const { data } = await supabase.auth.getSession()
    const session  = data.session
    const userId   = session?.user?.id

    let role: 'tourist' | 'admin' = 'tourist'
    if (userId) role = await fetchRole(userId)

    set({
      session,
      user:    session?.user ?? null,
      loading: false,
      role,
      isAdmin: role === 'admin',
    })

    // ── 2. Subscribe to future auth changes (sign in / sign out / refresh) ─
    // Guard prevents duplicate listeners if initialize() is called again.
    if (listenerRegistered) return
    listenerRegistered = true

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const userId = session?.user?.id

      let role: 'tourist' | 'admin' = 'tourist'
      if (userId) role = await fetchRole(userId)

      set({
        session,
        user:    session?.user ?? null,
        loading: false,
        role,
        isAdmin: role === 'admin',
      })
    })
  },
}))
