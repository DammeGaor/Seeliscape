// ---------------------------------------------------------------------------
// app/(admin)/_layout.tsx
// Route group guard — only admins can access anything under (admin)
// ---------------------------------------------------------------------------
import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { useAuthStore } from '@/store/auth.store'
import { View, ActivityIndicator } from 'react-native'
import { Colors } from '@/constants/theme'

export default function AdminLayout() {
  const { isAdmin, loading } = useAuthStore()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/(tabs)/')
    }
  }, [isAdmin, loading])

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  if (!isAdmin) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="destinations/index" />
      <Stack.Screen name="destinations/[id]" />
    </Stack>
  )
}
