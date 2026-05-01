// ---------------------------------------------------------------------------
// app/(admin)/index.tsx
// Admin dashboard — entry point with nav tiles
// ---------------------------------------------------------------------------
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'
import { useAuthStore } from '@/store/auth.store'
import { supabase } from '@/lib/supabase'

const TILES = [
  {
    emoji: '📍',
    title: 'Destinations',
    subtitle: 'Add, edit, or remove tourism sites',
    route: '/(admin)/destinations/',
    color: Colors.primary,
  },
]

export default function AdminDashboard() {
  const { user } = useAuthStore()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/(auth)/sign-in')
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Admin Panel</Text>
          <Text style={s.headerSub}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.75}>
          <Text style={s.signOutTxt}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.sectionLabel}>MANAGEMENT</Text>

        {TILES.map((tile) => (
          <TouchableOpacity
            key={tile.route}
            style={s.tile}
            onPress={() => router.push(tile.route as any)}
            activeOpacity={0.85}
          >
            <View style={[s.tileIcon, { backgroundColor: tile.color + '18' }]}>
              <Text style={s.tileEmoji}>{tile.emoji}</Text>
            </View>
            <View style={s.tileBody}>
              <Text style={s.tileTitle}>{tile.title}</Text>
              <Text style={s.tileSub}>{tile.subtitle}</Text>
            </View>
            <Text style={s.tileArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Back to app */}
        <TouchableOpacity
          style={s.backTile}
          onPress={() => router.replace('/(tabs)/')}
          activeOpacity={0.75}
        >
          <Text style={s.backTileTxt}>← Back to App</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'android'
      ? (StatusBar.currentHeight ?? 24) + Spacing.sm
      : Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: Typography.displayFont,
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  signOutBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  signOutTxt: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.error,
  },

  body: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },

  sectionLabel: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
  },

  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmoji: { fontSize: 22 },
  tileBody: { flex: 1 },
  tileTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  tileSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tileArrow: {
    fontSize: 22,
    color: Colors.textMuted,
    fontFamily: Typography.bodySemiBold,
  },

  backTile: {
    marginTop: Spacing.md,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backTileTxt: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.primary,
  },
})


