import { useEffect } from 'react'
import { Slot, router, useSegments } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'

// ---------------------------------------------------------------------------
// Auth guard — redirects unauthenticated users to login
// ---------------------------------------------------------------------------
function AuthGuard() {
  const { session, loading } = useAuthStore()
  const segments = useSegments()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!session && !inAuthGroup) {
      // Not signed in → send to login
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      // Already signed in → send to main app
      router.replace('/(tabs)/')
    }
  }, [session, loading, segments])

  return null
}

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [])

  return (
    <>
      <AuthGuard />
      <Slot />
    </>
  )
}
