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

// ─── Chevron drawn with pure View borders (no icon library needed) ────────────
function Chevron() {
  return (
    <View style={chevronStyles.wrap}>
      <View style={chevronStyles.arm} />
    </View>
  )
}

const chevronStyles = StyleSheet.create({
  wrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  arm: {
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    borderColor: Colors.textMuted,
    transform: [{ rotate: '45deg' }],
    marginLeft: -3,
  },
})

// ─── Row ─────────────────────────────────────────────────────────────────────
function SettingsRow({
  label,
  sublabel,
  onPress,
  danger,
  rightElement,
  showChevron,
}: {
  label: string
  sublabel?: string
  onPress?: () => void
  danger?: boolean
  rightElement?: React.ReactNode
  showChevron?: boolean
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.55 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.rowSublabel}>{sublabel}</Text>
        ) : null}
      </View>
      {rightElement ?? (showChevron ? <Chevron /> : null)}
    </TouchableOpacity>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  )
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
          <View style={styles.backArrowIcon} />
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
            <View style={styles.profileStatRow}>
              <View style={styles.profileStatDot} />
              <Text style={styles.profileStat}>
                {unlockedCount} site{unlockedCount !== 1 ? 's' : ''} unlocked
              </Text>
            </View>
          </View>
        </View>

        {/* ── Map section ── */}
        <SectionHeader title="Map" />
        <View style={styles.section}>
          <SettingsRow
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
            label="Unlocked sites"
            sublabel={`${unlockedCount} landmark${unlockedCount !== 1 ? 's' : ''} visited`}
          />
          <Separator />
          <SettingsRow
            label="Reset progress"
            sublabel="Clear all unlocked sites"
            onPress={handleResetProgress}
            showChevron
          />
        </View>

        {/* ── About section ── */}
        <SectionHeader title="About" />
        <View style={styles.section}>
          <SettingsRow
            label="App version"
            sublabel="1.0.0 (Beta)"
            rightElement={
              <Text style={styles.versionBadge}>1.0.0</Text>
            }
          />
        </View>

        {/* ── Admin section — only visible to admins ── */}
        {isAdmin && (
          <>
            <SectionHeader title="Admin" />
            <View style={styles.section}>
              <SettingsRow
                label="Admin Panel"
                sublabel="Manage destinations and content"
                onPress={() => router.push('/(admin)/')}
                showChevron
              />
            </View>
          </>
        )}

        {/* ── Account section ── */}
        <SectionHeader title="Account" />
        <View style={styles.section}>
          <SettingsRow
            label="Sign out"
            onPress={handleSignOut}
            danger
          />
        </View>

        <Text style={styles.footer}>Seeliscape · Explore the beauty of Bicol</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    paddingTop: Platform.OS === 'android' ? Spacing.xl + 8 : Spacing.xl,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pure-View back arrow (no emoji, no icon library)
  backArrowIcon: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: Colors.textPrimary,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },
  headerTitle: {
    fontFamily: Typography.displayFont,
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 56 },

  // ── Profile card ──
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    margin: Spacing.lg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarTxt: {
    fontFamily: Typography.displayFont,
    fontSize: 19,
    color: Colors.textInverse,
    letterSpacing: 0,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileEmail: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  profileStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileStatDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    opacity: 0.7,
  },
  profileStat: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
  },

  // ── Section header ──
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionHeaderLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // ── Section card ──
  section: {
    backgroundColor: Colors.bgCard,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // ── Row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    gap: Spacing.sm,
    minHeight: 52,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  rowLabelDanger: {
    color: Colors.error,
    fontFamily: Typography.bodyFont,
  },
  rowSublabel: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md,
  },

  // ── Version badge ──
  versionBadge: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    backgroundColor: Colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // ── Footer ──
  footer: {
    fontFamily: Typography.bodyFont,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: Spacing.xl,
    opacity: 0.7,
  },
})
