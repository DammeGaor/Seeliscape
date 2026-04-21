import { Stack } from 'expo-router'
import { Colors } from '@/constants/theme'

// Hides the default header for all auth screens — AuthLayout provides its own chrome
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
        animation: 'slide_from_right',
      }}
    />
  )
}
