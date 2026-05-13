import 'buffer';
import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { Slot, router, useSegments } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { Colors, Typography } from '@/constants/theme'

// ---------------------------------------------------------------------------
// Splash / loading screen — shown while auth state is being resolved
// ---------------------------------------------------------------------------
function SplashScreen({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current
  const hasHidden = useRef(false)
  const dotScale1 = useRef(new Animated.Value(0.6)).current
  const dotScale2 = useRef(new Animated.Value(0.6)).current
  const dotScale3 = useRef(new Animated.Value(0.6)).current

  // Fade out when no longer visible
  useEffect(() => {
    if (!visible) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => { hasHidden.current = true })
    }
  }, [visible])

  // Bouncing dots loop
  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.6,
            duration: 380,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(760 - delay),
        ])
      )

    const a1 = animateDot(dotScale1, 0)
    const a2 = animateDot(dotScale2, 180)
    const a3 = animateDot(dotScale3, 360)
    a1.start(); a2.start(); a3.start()

    return () => { a1.stop(); a2.stop(); a3.stop() }
  }, [])

  if (!visible && hasHidden.current) return null

  return (
    <Animated.View style={[styles.splash, { opacity }]} pointerEvents="none">
      <View style={styles.splashInner}>
        <Text style={styles.splashTitle}>Seeliscape</Text>
        <Text style={styles.splashSub}>Discover Albay</Text>

        {/* Animated dots */}
        <View style={styles.dotsRow}>
          {[dotScale1, dotScale2, dotScale3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { transform: [{ scale: dot }], opacity: dot }]}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  )
}

// ---------------------------------------------------------------------------
// Auth guard — redirects unauthenticated users to login
// ---------------------------------------------------------------------------
function AuthGuard() {
  const { session, loading, isAdmin } = useAuthStore()
  const segments = useSegments() as string[]

  useEffect(() => {
    if (loading) return

    const inAuthGroup    = segments[0] === '(auth)'
    const inTabsGroup    = segments[0] === '(tabs)'
    const inAdminGroup   = segments[0] === '(admin)'
    const inOnboarding   = segments[0] === 'onboarding'   // root-level route
    const inSiteGroup = segments[0] === '(tabs)' && segments[1] === 'site'

    if (!session) {
      // Not logged in — send to login
      if (!inAuthGroup) router.replace('/(auth)/login')
      return
    }

    // Already on onboarding — let it render, don't redirect
    if (inOnboarding) return

    // Site detail page — let it render
    if (inSiteGroup) return

    // Just came from login (or any auth screen) → show onboarding
    if (inAuthGroup) {
      router.replace('/onboarding')
      return
    }

    // Not in any known group → send to onboarding
    if (!inTabsGroup && !inAdminGroup && !inSiteGroup) {
      router.replace('/onboarding')
      return
    }

    // Logged in admin trying to access admin panel — allow it
    if (inAdminGroup && isAdmin) return

    // Non-admin somehow in admin group — kick out
    if (inAdminGroup && !isAdmin) {
      router.replace('/(tabs)/')
    }
  }, [session, loading, isAdmin, segments])

  return null
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------
export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize)
  const loading = useAuthStore((s) => s.loading)

  useEffect(() => {
    initialize()
  }, [])

  return (
    <>
      <AuthGuard />
      <Slot />
      <SplashScreen visible={loading} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  splashInner: {
    alignItems: 'center',
    gap: 12,
  },

  // Text
  splashTitle: {
    fontFamily: Typography.displayFont,
    fontSize: 32,
    color: Colors.textPrimary,
    letterSpacing: -0.8,
  },
  splashSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: -4,
  },

  // Loading dots
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
})
