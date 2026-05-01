import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  StatusBar,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { signOut } from '@/lib/auth.service'
import { useAuthStore } from '@/store/auth.store'
import { useMapStore } from '@/store/map.store'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

// ─── Row components ───────────────────────────────────────────────────────────
function SettingsRow({
  icon,
  label,
  sublabel,
  onPress,
  danger,
  rightElement,
}: {
  icon: string
  label: string
  sublabel?: string
  onPress?: () => void
  danger?: boolean
  rightElement?: React.ReactNode
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Text style={styles.rowIconEmoji}>{icon}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {rightElement ?? (onPress && !danger
        ? <Text style={styles.rowChevron}>›</Text>
        : null
      )}
    </TouchableOpacity>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

function Separator() {
  return <View style={styles.separator} />
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { session, isAdmin, role, loading } = useAuthStore()

  const {
    unlockedSiteIds,
    clearUnlockedSites,
    proximityAlerts,
    setProximityAlerts,
    highAccuracy,
    setHighAccuracy,
    showUnlocked,
    setShowUnlocked,
  } = useMapStore()

  const email = session?.user?.email ?? 'Unknown'
  const avatarLetter = email[0]?.toUpperCase() ?? 'U'
  const unlockedCount = unlockedSiteIds.size

  async function handleSignOut() {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut()
            router.replace('/(auth)/login')
          },
        },
      ]
    )
  }

  function handleResetProgress() {
    Alert.alert(
      'Reset progress',
      `This will clear all ${unlockedCount} unlocked site${unlockedCount !== 1 ? 's' : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => clearUnlockedSites?.(),
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgCard} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarTxt}>{avatarLetter}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileEmail}>{email}</Text>
            <Text style={styles.profileStat}>
              {unlockedCount} site{unlockedCount !== 1 ? 's' : ''} unlocked
            </Text>
          </View>
        </View>

        {/* ── Map section ── */}
        <SectionHeader title="Map" />
        <View style={styles.section}>
          <SettingsRow
            icon="🔔"
            label="Proximity alerts"
            sublabel="Notify when near a landmark"
            rightElement={
              <Switch
                value={proximityAlerts}
                onValueChange={setProximityAlerts}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.bgCard}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="📡"
            label="High accuracy GPS"
            sublabel="Uses more battery"
            rightElement={
              <Switch
                value={highAccuracy}
                onValueChange={setHighAccuracy}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.bgCard}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="🏆"
            label="Hide unlocked sites"
            sublabel="Only show landmarks you haven't visited"
            rightElement={
              <Switch
                value={!showUnlocked}
                onValueChange={(v) => setShowUnlocked(!v)}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.bgCard}
              />
            }
          />
        </View>

        {/* ── Progress section ── */}
        <SectionHeader title="Progress" />
        <View style={styles.section}>
          <SettingsRow
            icon="🗺️"
            label="Unlocked sites"
            sublabel={`${unlockedCount} landmark${unlockedCount !== 1 ? 's' : ''} visited`}
          />
          <Separator />
          <SettingsRow
            icon="🔄"
            label="Reset progress"
            sublabel="Clear all unlocked sites"
            onPress={handleResetProgress}
          />
        </View>

        {/* ── About section ── */}
        <SectionHeader title="About" />
        <View style={styles.section}>
          <SettingsRow
            icon="📱"
            label="App version"
            sublabel="1.0.0 (Beta)"
          />
        </View>

        {/* ── Admin section — only visible to admins ── */}
        {isAdmin && (
          <>
            <SectionHeader title="Admin" />
            <View style={styles.section}>
              <SettingsRow
                icon="🛠️"
                label="Admin Panel"
                sublabel="Manage destinations and content"
                onPress={() => router.push('/(admin)/')}
              />
            </View>
          </>
        )}

        {/* ── Account section ── */}
        <SectionHeader title="Account" />
        <View style={styles.section}>
          <SettingsRow
            icon="🚪"
            label="Sign out"
            onPress={handleSignOut}
            danger
          />
        </View>

        <Text style={styles.footer}>✦  Explore the beauty of Bicol  ✦</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    paddingTop: Platform.OS === 'android' ? Spacing.xl + 8 : Spacing.xl,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: Colors.textPrimary,
  },
  headerTitle: {
    fontFamily: Typography.displayFont,
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    margin: Spacing.lg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  profileAvatarTxt: {
    fontFamily: Typography.displayFont,
    fontSize: 20,
    color: Colors.textInverse,
  },
  profileInfo: { flex: 1 },
  profileEmail: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  profileStat: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Section
  sectionHeader: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  section: {
    backgroundColor: Colors.bgCard,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: '#FEE2E2' },
  rowIconEmoji: { fontSize: 18 },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  rowLabelDanger: { color: Colors.error },
  rowSublabel: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rowChevron: {
    fontSize: 20,
    color: Colors.textMuted,
    marginRight: 4,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 56 + Spacing.md,
  },

  footer: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: Spacing.xl,
  },
})
