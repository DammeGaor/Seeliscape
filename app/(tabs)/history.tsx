// ---------------------------------------------------------------------------
// app/(tabs)/history.tsx  (or wherever you mount it)
//
// Feature #5 — Visited sites history
// Shows every site the tourist has unlocked + their ratings for each.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'
import { useAuthStore } from '@/store/auth.store'
import { useMapStore } from '@/store/map.store'
import { fetchUserReviews, ReviewRecord } from '@/lib/recommendations.service'
import { fetchDestinations } from '@/lib/destinations.service'
import { TourismSite } from '@/lib/tourism-sites'

// Criterion display order
const CRITERIA: { dbKey: keyof ReviewRecord; label: string; emoji: string }[] = [
  { dbKey: 'rating_attraction',         label: 'Attraction',    emoji: '✨' },
  { dbKey: 'rating_accessibility',      label: 'Accessibility', emoji: '🛣️' },
  { dbKey: 'rating_amenities',          label: 'Amenities',     emoji: '🏪' },
  { dbKey: 'rating_available_packages', label: 'AvailablePackages',      emoji: '🎒' },
  { dbKey: 'rating_activities',         label: 'Activities',    emoji: '🏄' },
  { dbKey: 'rating_ancillary_services', label: 'Ancillary Services',     emoji: '🛎️' },
]

function StarRow({ value }: { value: number | null }) {
  if (value === null) return <Text style={styles.notRated}>not rated</Text>
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={{ fontSize: 11, opacity: s <= value ? 1 : 0.18 }}>⭐</Text>
      ))}
    </View>
  )
}

export default function HistoryScreen() {
  const { session } = useAuthStore()
  const { unlockedSiteIds, setPendingDirectionsSiteId } = useMapStore()
  const userId = session?.user?.id ?? ''

  const [reviews,  setReviews]  = useState<ReviewRecord[]>([])
  const [sites,    setSites]    = useState<Record<string, TourismSite>>({})
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    Promise.all([
      fetchUserReviews(userId),
      fetchDestinations(),
    ])
      .then(([userReviews, allSites]) => {
        setReviews(userReviews)
        const map: Record<string, TourismSite> = {}
        allSites.forEach((s) => { map[s.id] = s })
        setSites(map)
      })
      .catch((e) => setError(e?.message ?? 'Failed to load history.'))
      .finally(() => setLoading(false))
  }, [userId])

  // Merge: all unlocked sites, whether reviewed or not
  const unlockedIds = Array.from(unlockedSiteIds)
  const reviewMap: Record<string, ReviewRecord> = {}
  reviews.forEach((r) => { reviewMap[r.site_id] = r })

  const visitedEntries = unlockedIds
    .map((id) => ({ site: sites[id], review: reviewMap[id] ?? null }))
    .filter((e) => !!e.site)

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Exploration Trail</Text>
          <Text style={styles.headerSub}>
            {visitedEntries.length} site{visitedEntries.length !== 1 ? 's' : ''} visited
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centred}>
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      ) : visitedEntries.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyTitle}>No sites visited yet</Text>
          <Text style={styles.emptySub}>
            Explore Albay destinations to build your personal trail.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => router.push('/(tabs)/')}
            activeOpacity={0.8}
          >
            <Text style={styles.exploreBtnTxt}>Open Map</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {visitedEntries.map(({ site, review }) => {
            const ratedCount = review
              ? CRITERIA.filter((c) => review[c.dbKey] !== null).length
              : 0

            return (
              <View key={site.id} style={styles.card}>
                {/* Site image */}
                {site.imageUrl ? (
                  <Image
                    source={{ uri: site.imageUrl }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <Text style={{ fontSize: 32, opacity: 0.3 }}>🏔️</Text>
                  </View>
                )}

                <View style={styles.cardBody}>
                  {/* Name + unlock badge */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={1}>{site.name}</Text>
                    <View style={styles.unlockedPill}>
                      <Text style={styles.unlockedPillTxt}>🔓 Visited</Text>
                    </View>
                  </View>

                  {/* Visit date */}
                  {review?.visited_at && (
                    <Text style={styles.visitDate}>
                      📅 {new Date(review.visited_at).toLocaleDateString('en-PH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </Text>
                  )}

                  {/* Per-criterion ratings */}
                  {review ? (
                    <View style={styles.ratingsGrid}>
                      {CRITERIA.map((c) => (
                        <View key={c.dbKey} style={styles.ratingRow}>
                          <Text style={styles.ratingEmoji}>{c.emoji}</Text>
                          <Text style={styles.ratingLabel}>{c.label}</Text>
                          <StarRow value={review[c.dbKey] as number | null} />
                        </View>
                      ))}
                      {review.comment ? (
                        <Text style={styles.comment}>💬 "{review.comment}"</Text>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.noReviewBox}>
                      <Text style={styles.noReviewTxt}>You haven't rated this site yet.</Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.directionsBtn}
                      onPress={() => {
                        setPendingDirectionsSiteId(site.id)
                        router.push('/(tabs)/')
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.directionsBtnTxt}>🗺️ Directions</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          })}

          {/* Summary stats */}
          <View style={styles.statsBox}>
            <Text style={styles.statsTitle}>Your Trail Summary</Text>
            <Text style={styles.statLine}>🏅 Sites visited: {visitedEntries.length}</Text>
            <Text style={styles.statLine}>📝 Sites reviewed: {reviews.length}</Text>
            <Text style={styles.statLine}>
              ⭐ Your contributions help shape recommendations for all tourists in Albay.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'android'
      ? (StatusBar.currentHeight ?? 24) + Spacing.sm
      : Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  backArrow: { fontSize: 18, color: Colors.primary, fontFamily: Typography.bodySemiBold },
  headerCenter: { flex: 1 },
  headerTitle: { fontFamily: Typography.displayFont, fontSize: 20, color: Colors.textPrimary, letterSpacing: -0.4 },
  headerSub: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  errorTxt: { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.error, textAlign: 'center' },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: Typography.displayFont, fontSize: 22, color: Colors.textPrimary },
  emptySub: { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  exploreBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
  },
  exploreBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.textInverse },

  list: { padding: Spacing.lg, gap: Spacing.md },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 110 },
  cardImagePlaceholder: { backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: Spacing.md, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName: { fontFamily: Typography.bodySemiBold, fontSize: 16, color: Colors.textPrimary, flex: 1 },
  unlockedPill: {
    backgroundColor: '#1A7A4A18', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  unlockedPillTxt: { fontFamily: Typography.bodyMedium, fontSize: 11, color: '#1A7A4A' },

  visitDate: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },

  ratingsGrid: { gap: 4, backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingEmoji: { fontSize: 12, width: 18 },
  ratingLabel: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textSecondary, width: 80 },
  notRated: { fontFamily: Typography.bodyFont, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  comment: {
    fontFamily: Typography.bodyFont, fontSize: 12,
    color: Colors.textSecondary, fontStyle: 'italic',
    lineHeight: 17, marginTop: 4,
  },

  noReviewBox: {
    backgroundColor: Colors.bg, borderRadius: Radius.md,
    padding: Spacing.sm, borderWidth: 1,
    borderColor: Colors.border, borderStyle: 'dashed',
  },
  noReviewTxt: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },

  cardActions: { flexDirection: 'row', gap: 8 },
  directionsBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1, borderColor: Colors.primary + '40',
  },
  directionsBtnTxt: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.primary },

  statsBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  statsTitle: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.textPrimary, marginBottom: 4 },
  statLine:  { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
})
