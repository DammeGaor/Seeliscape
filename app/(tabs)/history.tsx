// ---------------------------------------------------------------------------
// app/(tabs)/history.tsx
//
// Feature #5 — Exploration Trail
// Toggle between Unvisited / Visited destinations.
// Ratings are only shown for visited (unlocked) sites.
// Cards are tappable — tap opens the full detail view.
//
// FIXES vs previous version:
//  1. Back button now navigates explicitly to the map tab instead of calling
//     router.back(), which on a tab screen pops to whichever tab was last
//     active rather than reliably going to the map.
//  2. Description expand state uses useState<Set<string>> so React.memo
//     sees a new Set instance on every toggle and re-renders the card.
//     FlashList recycles views — the state lives in the screen, not the card.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'
import { useAuthStore } from '@/store/auth.store'
import { useMapStore } from '@/store/map.store'
import { fetchUserReviews, ReviewRecord } from '@/lib/recommendations.service'
import { fetchDestinations } from '@/lib/destinations.service'
import { TourismSite } from '@/lib/tourism-sites'

type Tab = 'unvisited' | 'visited'

// Criterion display order
const CRITERIA: { dbKey: keyof ReviewRecord; label: string; emoji: string }[] = [
  { dbKey: 'rating_attraction',         label: 'Attraction',         emoji: '✨' },
  { dbKey: 'rating_accessibility',      label: 'Accessibility',      emoji: '🛣️' },
  { dbKey: 'rating_amenities',          label: 'Amenities',          emoji: '🏪' },
  { dbKey: 'rating_available_packages', label: 'Packages',           emoji: '🎒' },
  { dbKey: 'rating_activities',         label: 'Activities',         emoji: '🏄' },
  { dbKey: 'rating_ancillary_services', label: 'Ancillary Services', emoji: '🛎️' },
]

// ---------------------------------------------------------------------------
// StarRow — memoized so it never re-renders unless value changes
// ---------------------------------------------------------------------------
const StarRow = React.memo(function StarRow({ value }: { value: number | null }) {
  if (value === null) return <Text style={styles.notRated}>not rated</Text>
  return (
    <View style={starRowStyle}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={{ fontSize: 11, opacity: s <= value ? 1 : 0.18 }}>⭐</Text>
      ))}
    </View>
  )
})
const starRowStyle = { flexDirection: 'row' as const, gap: 2 }

// ---------------------------------------------------------------------------
// ExpandableDescription
//
// expanded/onToggle are props — the parent screen owns the state.
// FlashList view recycling can never silently reset an open card.
// ---------------------------------------------------------------------------
type ExpandableDescriptionProps = {
  text: string
  expanded: boolean
  onToggle: () => void
}

const ExpandableDescription = React.memo(function ExpandableDescription({
  text,
  expanded,
  onToggle,
}: ExpandableDescriptionProps) {
  return (
    <>
      <Text style={styles.shortDesc} numberOfLines={expanded ? undefined : 2}>
        {text}
      </Text>
      <TouchableOpacity onPress={(e) => { e.stopPropagation(); onToggle() }} activeOpacity={0.7} hitSlop={HIT_SLOP}>
        <Text style={styles.seeMoreTxt}>
          {expanded ? '▲ Show less' : '▼ Show more'}
        </Text>
      </TouchableOpacity>
    </>
  )
})
const HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 }

// ---------------------------------------------------------------------------
// Visited card
// ---------------------------------------------------------------------------
type VisitedCardProps = {
  site: TourismSite
  review: ReviewRecord | null
  descExpanded: boolean
  onToggleDesc: (siteId: string) => void
  onDirections: (siteId: string) => void
  onPress: (site: TourismSite) => void
}

const VisitedCard = React.memo(function VisitedCard({
  site,
  review,
  descExpanded,
  onToggleDesc,
  onDirections,
  onPress,
}: VisitedCardProps) {
  const handleDirections = useCallback(
    () => onDirections(site.id),
    [onDirections, site.id],
  )
  const handlePress = useCallback(
    () => onPress(site),
    [onPress, site],
  )
  const handleToggleDesc = useCallback(
    () => onToggleDesc(site.id),
    [onToggleDesc, site.id],
  )

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      {site.imageUrl ? (
        <Image
          source={{ uri: site.imageUrl }}
          style={styles.cardImage}
          resizeMode="cover"
          fadeDuration={0}
        />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ fontSize: 32, opacity: 0.3 }}>🏔️</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>{site.name}</Text>
          <View style={styles.visitedPill}>
            <Text style={styles.visitedPillTxt}>✓ Visited</Text>
          </View>
        </View>

        {(site.barangay || site.municipality) ? (
          <Text style={styles.siteLocation}>
            📍 {[site.barangay, site.municipality].filter(Boolean).join(', ')}
          </Text>
        ) : null}

        {review?.visited_at && (
          <Text style={styles.visitDate}>
            📅 {new Date(review.visited_at).toLocaleDateString('en-PH', {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          </Text>
        )}

        {site.description ? (
          <ExpandableDescription
            text={site.description}
            expanded={descExpanded}
            onToggle={handleToggleDesc}
          />
        ) : null}

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

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={handleDirections}
            activeOpacity={0.75}
          >
            <Text style={styles.directionsBtnTxt}>Directions</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
})

// ---------------------------------------------------------------------------
// Unvisited card
// ---------------------------------------------------------------------------
type UnvisitedCardProps = {
  site: TourismSite
  descExpanded: boolean
  onToggleDesc: (siteId: string) => void
  onDirections: (siteId: string) => void
  onPress: (site: TourismSite) => void
}

const UnvisitedCard = React.memo(function UnvisitedCard({
  site,
  descExpanded,
  onToggleDesc,
  onDirections,
  onPress,
}: UnvisitedCardProps) {
  const handleDirections = useCallback(
    () => onDirections(site.id),
    [onDirections, site.id],
  )
  const handlePress = useCallback(
    () => onPress(site),
    [onPress, site],
  )
  const handleToggleDesc = useCallback(
    () => onToggleDesc(site.id),
    [onToggleDesc, site.id],
  )

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      {site.imageUrl ? (
        <Image
          source={{ uri: site.imageUrl }}
          style={styles.cardImage}
          resizeMode="cover"
          fadeDuration={0}
        />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ fontSize: 32, opacity: 0.3 }}>🏔️</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>{site.name}</Text>
          <View style={styles.unvisitedPill}>
            <Text style={styles.unvisitedPillTxt}>Not visited</Text>
          </View>
        </View>

        {(site.barangay || site.municipality) ? (
          <Text style={styles.siteLocation}>
            📍 {[site.barangay, site.municipality].filter(Boolean).join(', ')}
          </Text>
        ) : null}

        {(site.shortDescription || site.description) ? (
          <ExpandableDescription
            text={site.shortDescription || site.description || ""}
            expanded={descExpanded}
            onToggle={handleToggleDesc}
          />
        ) : null}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={handleDirections}
            activeOpacity={0.75}
          >
            <Text style={styles.directionsBtnTxt}>Directions</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
})

// ---------------------------------------------------------------------------
// ListFooter — stats shown at bottom of visited list
// ---------------------------------------------------------------------------
type FooterProps = { visitedCount: number; totalCount: number; reviewCount: number }
const ListFooter = React.memo(function ListFooter({
  visitedCount,
  totalCount,
  reviewCount,
}: FooterProps) {
  return (
    <View style={styles.statsBox}>
      <Text style={styles.statsTitle}>Your Trail Summary</Text>
      <Text style={styles.statLine}>Sites visited: {visitedCount} / {totalCount}</Text>
      <Text style={styles.statLine}>Sites reviewed: {reviewCount}</Text>
      <Text style={styles.statLine}>
        Your contributions help shape recommendations for all tourists in Albay.
      </Text>
    </View>
  )
})

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function HistoryScreen() {
  const { session } = useAuthStore()
  const { unlockedSiteIds, setPendingDirectionsSiteId } = useMapStore()
  const userId = session?.user?.id ?? ''

  const [activeTab,  setActiveTab]  = useState<Tab>('unvisited')
  const [reviews,    setReviews]    = useState<ReviewRecord[]>([])
  const [allSites,   setAllSites]   = useState<TourismSite[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  // Expand state as a proper useState Set — each toggle creates a new Set
  // instance so React.memo sees a genuinely changed prop and re-renders the
  // affected card. The useRef+tick approach looked correct but memo's shallow
  // comparison saw the same boolean value and bailed out silently.
  const [expandedDescIds, setExpandedDescIds] = useState<Set<string>>(new Set())

  const handleToggleDesc = useCallback((siteId: string) => {
    setExpandedDescIds((prev) => {
      const next = new Set(prev)
      if (next.has(siteId)) next.delete(siteId)
      else next.add(siteId)
      return next
    })
  }, [])

  useEffect(() => {
    const fetches: Promise<any>[] = [fetchDestinations()]
    if (userId) fetches.push(fetchUserReviews(userId))

    Promise.all(fetches)
      .then(([destinations, userReviews]) => {
        setAllSites(destinations)
        if (userReviews) setReviews(userReviews)
      })
      .catch((e) => setError(e?.message ?? 'Failed to load destinations.'))
      .finally(() => setLoading(false))
  }, [userId])

  // ── Memoized derived state ───────────────────────────────────────────────
  const reviewMap = useMemo<Record<string, ReviewRecord>>(() => {
    const map: Record<string, ReviewRecord> = {}
    reviews.forEach((r) => { map[r.site_id] = r })
    return map
  }, [reviews])

  const visitedSites = useMemo(
    () => allSites.filter((s) =>  unlockedSiteIds.has(s.id)),
    [allSites, unlockedSiteIds],
  )
  const unvisitedSites = useMemo(
    () => allSites.filter((s) => !unlockedSiteIds.has(s.id)),
    [allSites, unlockedSiteIds],
  )

  // ── Stable callbacks ─────────────────────────────────────────────────────
  const goDirections = useCallback((siteId: string) => {
    setPendingDirectionsSiteId(siteId)
    // router.back() resumes the already-mounted map tab with live location.
    // Falls back to replace() on cold-start deep links where back stack is empty.
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/')
    }
  }, [setPendingDirectionsSiteId])

  const handleSitePress = useCallback((site: TourismSite) => {
    // Push the detail screen on top of the history tab's stack. router.back()
    // inside [id].tsx will pop back here correctly.
    router.push(`/site/${site.id}?from=history`)
  }, [])

  // ── FlashList render functions ───────────────────────────────────────────
  // expandedDescIds is in the dep array — a new Set on each toggle causes
  // renderItem to recreate and memo to see a changed descExpanded prop.
  const renderUnvisited = useCallback(({ item }: { item: TourismSite }) => (
    <UnvisitedCard
      site={item}
      descExpanded={expandedDescIds.has(item.id)}
      onToggleDesc={handleToggleDesc}
      onDirections={goDirections}
      onPress={handleSitePress}
    />
  ), [expandedDescIds, goDirections, handleSitePress, handleToggleDesc])

  const renderVisited = useCallback(({ item }: { item: TourismSite }) => (
    <VisitedCard
      site={item}
      review={reviewMap[item.id] ?? null}
      descExpanded={expandedDescIds.has(item.id)}
      onToggleDesc={handleToggleDesc}
      onDirections={goDirections}
      onPress={handleSitePress}
    />
  ), [expandedDescIds, reviewMap, goDirections, handleSitePress, handleToggleDesc])

  const keyExtractor = useCallback((item: TourismSite) => item.id, [])

  const visitedFooter = useMemo(() => (
    <ListFooter
      visitedCount={visitedSites.length}
      totalCount={allSites.length}
      reviewCount={reviews.length}
    />
  ), [visitedSites.length, allSites.length, reviews.length])

  const listData   = activeTab === 'unvisited' ? unvisitedSites : visitedSites
  const renderItem = activeTab === 'unvisited' ? renderUnvisited : renderVisited

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Use router.back() to resume the map tab without remounting it —
            same pattern as recommend.tsx. Falls back to replace() if there's
            nothing in the stack (e.g. deep-link cold start). */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/')}
          activeOpacity={0.75}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Exploration Trail</Text>
          <Text style={styles.headerSub}>
            {visitedSites.length} of {allSites.length} site{allSites.length !== 1 ? 's' : ''} visited
          </Text>
        </View>
      </View>

      {/* Toggle — rendered regardless of content so it stays visible */}
      {!loading && !error && (
        <View style={styles.toggleWrap}>
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'unvisited' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('unvisited')}
              activeOpacity={0.75}
            >
              <Text style={[styles.toggleBtnTxt, activeTab === 'unvisited' && styles.toggleBtnTxtActive]}>
                Unvisited
              </Text>
              <View style={[styles.toggleCount, activeTab === 'unvisited' && styles.toggleCountActive]}>
                <Text style={[styles.toggleCountTxt, activeTab === 'unvisited' && styles.toggleCountTxtActive]}>
                  {unvisitedSites.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'visited' && styles.toggleBtnActive]}
              onPress={() => setActiveTab('visited')}
              activeOpacity={0.75}
            >
              <Text style={[styles.toggleBtnTxt, activeTab === 'visited' && styles.toggleBtnTxtActive]}>
                Visited
              </Text>
              <View style={[styles.toggleCount, activeTab === 'visited' && styles.toggleCountActive]}>
                <Text style={[styles.toggleCountTxt, activeTab === 'visited' && styles.toggleCountTxtActive]}>
                  {visitedSites.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centred}>
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      ) : activeTab === 'unvisited' && unvisitedSites.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>All sites visited!</Text>
          <Text style={styles.emptySub}>
            You've visited every destination in Albay. Impressive!
          </Text>
        </View>
      ) : activeTab === 'visited' && visitedSites.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyEmoji}>🥾</Text>
          <Text style={styles.emptyTitle}>No sites visited yet</Text>
          <Text style={styles.emptySub}>
            Explore Albay destinations to build your personal trail.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => router.navigate('/(tabs)/')}
            activeOpacity={0.8}
          >
            <Text style={styles.exploreBtnTxt}>Open Map</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList<TourismSite>
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          estimatedItemSize={300}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={activeTab === 'visited' ? visitedFooter : null}
          overScrollMode="never"
          // removeClippedSubviews — removed: clips dynamic height changes when cards expand
        />
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

  // ── Toggle ──
  toggleWrap: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: Radius.md,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  toggleBtnTxt: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },
  toggleBtnTxtActive: {
    color: Colors.textInverse,
  },
  toggleCount: {
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  toggleCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  toggleCountTxt: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 11,
    color: Colors.textMuted,
  },
  toggleCountTxtActive: {
    color: Colors.textInverse,
  },

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

  listContent: { padding: Spacing.lg, gap: Spacing.md },

  // ── Shared card ──
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  cardImage: { width: '100%', height: 110 },
  cardImagePlaceholder: { backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: Spacing.md, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName: { fontFamily: Typography.bodySemiBold, fontSize: 16, color: Colors.textPrimary, flex: 1 },

  siteLocation: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },
  shortDesc: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  seeMoreTxt: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.primary, marginTop: 2 },
  visitDate: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },

  // ── Status pills ──
  visitedPill: {
    backgroundColor: '#1A7A4A18', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  visitedPillTxt: { fontFamily: Typography.bodyMedium, fontSize: 11, color: '#1A7A4A' },
  unvisitedPill: {
    backgroundColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  unvisitedPillTxt: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.textMuted },

  // ── Ratings ──
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

  // ── Actions ──
  cardActions: { flexDirection: 'row', gap: 8 },
  directionsBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1, borderColor: Colors.primary + '40',
  },
  directionsBtnTxt: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.primary },

  // ── Summary stats ──
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
