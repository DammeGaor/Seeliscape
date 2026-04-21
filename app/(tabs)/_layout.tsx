import { Stack } from 'expo-router'

// Single full-screen map — no tab bar needed yet
export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}
