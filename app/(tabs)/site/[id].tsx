// ---------------------------------------------------------------------------
// app/site/[id].tsx  —  Destination detail view
//
// FIXES vs previous version:
//  1. handleGetDirections uses router.back() (not push) so the already-mounted
//     map screen resumes with live location — no remount, no location delay.
//  2. Full UI/UX overhaul:
//     - Taller hero (320 px) with a proper two-stop scrim
//     - Sticky floating action bar at the bottom (Directions + AR)
//     - Content card overlaps hero with 24 px rounded top corners
//     - Name + location + rating chip sit in one clean meta row
//     - Locked notice is a slim pill, not a tall box
//     - Community score bars use a capsule grid with a cleaner layout
//     - Review CTA has a chevron; "already reviewed" is compact
//  3. Back button now reads the `from` query param passed by the caller.
//     history.tsx passes ?from=history so the back button returns to the
//     history tab instead of defaulting to the map when canGoBack() is false.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'
import {
  TourismSite,
  CATEGORY_CONFIG,
  formatDistance,
  getDistanceMeters,
} from '@/lib/tourism-sites'
import { fetchDestinations } from '@/lib/destinations.service'
import { useMapStore } from '@/store/map.store'
import { useAuthStore } from '@/store/auth.store'
import {
  submitSiteReview,
  fetchUserReviewForSite,
  CriterionRatings,
  ReviewRecord,
} from '@/lib/recommendations.service'

const ARView = React.lazy(() =>
  import('@/components/ar/ARView').then((m) => ({ default: m.ARView }))
)

const HERO_HEIGHT = 320
const STATUS_BAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44

// ---------------------------------------------------------------------------
// Criterion metadata
// ---------------------------------------------------------------------------
const CRITERIA: {
  key: keyof CriterionRatings
  label: string
  shortLabel: string
  emoji: string
  hint: string
}[] = [
  { key: 'attraction',       label: 'Attraction',      shortLabel: 'Attraction', emoji: '✨', hint: 'Scenic beauty, uniqueness, and overall wow-factor' },
  { key: 'accessibility',    label: 'Accessibility',   shortLabel: 'Access',     emoji: '🛣️', hint: 'Ease of getting here — roads, signage, and transport' },
  { key: 'amenities',        label: 'Amenities',       shortLabel: 'Amenities',  emoji: '🏪', hint: 'Restrooms, food stalls, parking, and basic facilities' },
  { key: 'availablePackages',label: 'Tour Packages',   shortLabel: 'Packages',   emoji: '🎒', hint: 'Availability and value of guided tours or bundled offers' },
  { key: 'activities',       label: 'Activities',      shortLabel: 'Activities', emoji: '🏄', hint: 'Things to do — adventures, cultural experiences, and more' },
  { key: 'ancillaryServices',label: 'Support Services',shortLabel: 'Services',   emoji: '🛎️', hint: 'Staff, guides, safety, and other visitor support' },
]

const STAR_LABELS: Record<number, string> = {
  1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent',
}

// ---------------------------------------------------------------------------
// StarRating
// ---------------------------------------------------------------------------
function StarRating({ value, onChange, size = 26 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <View style={srWrap}>
      <View style={srRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Text style={{ fontSize: size, opacity: star <= value ? 1 : 0.15 }}>⭐</Text>
          </TouchableOpacity>
        ))}
      </View>
      {value > 0 && <Text style={srLabel}>{STAR_LABELS[value]}</Text>}
    </View>
  )
}
const srWrap:  import('react-native').ViewStyle = { alignItems: 'flex-end', gap: 2 }
const srRow:   import('react-native').ViewStyle = { flexDirection: 'row', gap: 4 }
const srLabel: import('react-native').TextStyle = { fontSize: 11, color: Colors.primary, fontStyle: 'italic', textAlign: 'right' }

// ---------------------------------------------------------------------------
// ScoreBar
// ---------------------------------------------------------------------------
function ScoreBar({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  const pct = Math.round((value / 5) * 100)
  return (
    <View style={sbRow}>
      <Text style={sbEmoji}>{emoji}</Text>
      <Text style={sbLabel}>{label}</Text>
      <View style={sbTrack}><View style={[sbFill, { width: `${pct}%` }]} /></View>
      <Text style={sbVal}>{value > 0 ? value.toFixed(1) : '—'}</Text>
    </View>
  )
}
const sbRow:   import('react-native').ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 8 }
const sbEmoji: import('react-native').TextStyle = { fontSize: 13, width: 18 }
const sbLabel: import('react-native').TextStyle = { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textSecondary, width: 68 }
const sbTrack: import('react-native').ViewStyle = { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' }
const sbFill:  import('react-native').ViewStyle = { height: 8, backgroundColor: Colors.primary, borderRadius: 4 }
const sbVal:   import('react-native').TextStyle = { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textSecondary, width: 28, textAlign: 'right' }

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function SiteDetailScreen() {
  // FIX: read the optional `from` param so we know where to go on back
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>()
  const { session } = useAuthStore()
  const { userLocation, unlockedSiteIds, unlockSite, arEnabledSiteIds, setPendingDirectionsSiteId } = useMapStore()
  const userId = session?.user?.id ?? ''

  const [site,        setSite]        = useState<TourismSite | null>(null)
  const [siteLoading, setSiteLoading] = useState(true)
  const [siteError,   setSiteError]   = useState<string | null>(null)

  useEffect(() => {
    fetchDestinations()
      .then((all) => {
        const found = all.find((s) => s.id === id)
        if (found) setSite(found)
        else setSiteError('Destination not found.')
      })
      .catch((e) => setSiteError(e?.message ?? 'Failed to load destination.'))
      .finally(() => setSiteLoading(false))
  }, [id])

  const config       = site ? CATEGORY_CONFIG[site.category] : null
  const distanceMeters = site && userLocation
    ? getDistanceMeters(userLocation.latitude, userLocation.longitude, site.coordinates.latitude, site.coordinates.longitude)
    : null
  const isUnlocked = site ? unlockedSiteIds.has(site.id) : false
  const isInRange  = distanceMeters !== null && site !== null && distanceMeters <= site.unlockRadiusMeters
  const hasAR      = site ? arEnabledSiteIds.has(site.id) : false

  useEffect(() => {
    if (site && isInRange && !isUnlocked) unlockSite(site.id)
  }, [isInRange, isUnlocked, site?.id])

  const [descExpanded,    setDescExpanded]    = useState(false)
  const [descNeedsToggle, setDescNeedsToggle] = useState(false)
  const [arVisible,       setARVisible]       = useState(false)

  const emptyRatings: CriterionRatings = {
    attraction: null, accessibility: null, amenities: null,
    availablePackages: null, activities: null, ancillaryServices: null,
  }
  const [reviewOpen,      setReviewOpen]      = useState(false)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const [existingRecord,  setExistingRecord]  = useState<ReviewRecord | null>(null)
  const [ratings,         setRatings]         = useState<CriterionRatings>(emptyRatings)
  const [comment,         setComment]         = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [submitted,       setSubmitted]       = useState(false)
  const [reviewLoading,   setReviewLoading]   = useState(false)

  useEffect(() => {
    if (!userId || !id) return
    setReviewLoading(true)
    fetchUserReviewForSite(userId, id)
      .then((existing) => { if (existing) { setAlreadyReviewed(true); setExistingRecord(existing) } })
      .catch(() => {})
      .finally(() => setReviewLoading(false))
  }, [userId, id])

  const setRating = useCallback((key: keyof CriterionRatings, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }))
  }, [])
  const hasAnyRating = Object.values(ratings).some((v) => v !== null)

  async function handleSubmitReview() {
    if (!userId) { Alert.alert('Sign in required', 'Please sign in to leave a review.'); return }
    if (!hasAnyRating) { Alert.alert('Rating required', 'Please rate at least one criterion.'); return }
    setSubmitting(true)
    try {
      await submitSiteReview({
        site_id: id, user_id: userId, visited: true, ratings,
        comment: comment.trim() || null,
        visited_at: new Date().toISOString().slice(0, 10),
      })
      setSubmitted(true); setAlreadyReviewed(true); setReviewOpen(false)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // FIX: goBack helper — honours the `from` param so that when this screen
  // was opened from history.tsx (which passes ?from=history), the back button
  // returns to the history tab instead of the map.
  //
  // Navigation priority:
  //   1. If there is a real back entry in the stack, pop it (covers both the
  //      map-opened and history-opened cases when push() was used).
  //   2. Otherwise fall back to an explicit replace() using the `from` param.
  // ---------------------------------------------------------------------------
  function goBack() {
    if (from === 'history') {
      // back() pops [id].tsx off the history tab's stack — history screen
      // was the pusher so it's still mounted underneath; this correctly
      // resumes it without adding a new entry or leaving a stale [id] entry.
      if (router.canGoBack()) {
        router.back()
      } else {
        router.replace('/(tabs)/history')
      }
    } else {
      // map used router.push(), so back() correctly pops back to the map.
      if (router.canGoBack()) {
        router.back()
      } else {
        router.replace('/(tabs)/')
      }
    }
  }

  function handleGetDirections() {
    if (!site) return
    setPendingDirectionsSiteId(site.id)
    // Directions always targets the map regardless of where we came from.
    router.replace('/(tabs)/')
  }

  if (siteLoading) {
    return (
      <SafeAreaView style={styles.centred}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    )
  }
  if (siteError || !site || !config) {
    return (
      <SafeAreaView style={styles.centred}>
        <Text style={styles.errorTxt}>{siteError ?? 'Something went wrong.'}</Text>
        <TouchableOpacity style={styles.backFallbackBtn} onPress={goBack} activeOpacity={0.8}>
          <Text style={styles.backFallbackTxt}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Hero ── */}
        <View style={styles.heroWrapper}>
          {site.imageUrl
            ? <Image source={{ uri: site.imageUrl }} style={styles.heroImage} resizeMode="cover" />
            : <View style={styles.heroPlaceholder}><Text style={styles.heroPlaceholderEmoji}>{config.emoji}</Text></View>
          }

          {/* Top scrim — single layer, dark at top fading to transparent */}
          <View style={styles.scrimTop} />

          {/* Bottom scrim — single layer, transparent at middle fading to dark at bottom */}
          <View style={styles.scrimBottom} />

          {/* FIX: back button now calls goBack() instead of router.back() */}
          <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.85}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* Category + distance badges row */}
          <View style={styles.heroBadgeRow}>
            {site.category !== 'default' && (
              <View style={[styles.categoryBadge, { backgroundColor: config.color + 'cc' }]}>
                <Text style={styles.categoryEmoji}>{config.emoji}</Text>
                <Text style={styles.categoryLabel}>
                  {site.category.charAt(0).toUpperCase() + site.category.slice(1)}
                </Text>
              </View>
            )}
            {distanceMeters !== null && (
              <View style={[styles.distanceBadge, isInRange && styles.distanceBadgeClose]}>
                <Text style={[styles.distanceTxt, isInRange && styles.distanceTxtClose]}>
                  {isInRange ? "📍 You're here!" : `📍 ${formatDistance(distanceMeters)} away`}
                </Text>
              </View>
            )}
          </View>

          {/* Magazine-style name / location / rating pinned to hero bottom */}
          <View style={styles.heroMeta}>
            <Text style={styles.heroSiteName} numberOfLines={2}>{site.name}</Text>
            <View style={styles.heroMetaRow}>
              {(site.barangay || site.municipality) ? (
                <Text style={styles.heroLocation} numberOfLines={1}>
                  📍 {[site.barangay, site.municipality].filter(Boolean).join(', ')}
                </Text>
              ) : null}
              {site.avgReviewScore ? (
                <View style={styles.heroRatingChip}>
                  <Text style={styles.heroRatingTxt}>
                    ⭐ {site.avgReviewScore.toFixed(1)}
                    {site.reviewCount ? `  ·  ${site.reviewCount}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Content card ── */}
        <View style={styles.card}>

          {/* Description */}
          {site.description ? (
            <View style={styles.descBlock}>
              <Text
                style={styles.description}
                numberOfLines={descExpanded ? undefined : 3}
                onTextLayout={(e) => { if (!descExpanded) setDescNeedsToggle(e.nativeEvent.lines.length >= 3) }}
              >
                {site.description}
              </Text>
              {descNeedsToggle && (
                <TouchableOpacity onPress={() => setDescExpanded((v) => !v)} activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={styles.descToggle}>{descExpanded ? '▲ Show less' : '▼ Show more'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Locked pill */}
          {!isUnlocked && (
            <View style={styles.lockedPill}>
              <Text style={styles.lockedEmoji}>🔒</Text>
              <Text style={styles.lockedTxt}>
                Visit within{' '}
                {site.unlockRadiusMeters >= 1000
                  ? `${(site.unlockRadiusMeters / 1000).toFixed(1)} km`
                  : `${site.unlockRadiusMeters} m`}{' '}
                to unlock ratings & reviews
              </Text>
            </View>
          )}

          {/* AR teaser */}
          {hasAR && !isInRange && (
            <View style={styles.arTeaserBadge}>
              <Text style={styles.arTeaserEmoji}>🔮</Text>
              <Text style={styles.arTeaserTxt}>AR experience unlocks when you arrive at this destination</Text>
            </View>
          )}

          {/* Community scores + review — unlocked only */}
          {isUnlocked && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tourist Consensus</Text>
                {reviewLoading && <ActivityIndicator size="small" color={Colors.primary} />}
              </View>
              <Text style={styles.sectionSub}>Rated by visitors across 6 aspects of your trip</Text>

              {site.sixAScores && (
                <View style={styles.scoresGrid}>
                  {CRITERIA.map(({ key, shortLabel, emoji }) => (
                    <ScoreBar key={key} emoji={emoji} label={shortLabel} value={(site.sixAScores as any)[key] ?? 0} />
                  ))}
                </View>
              )}

              {!submitted && !alreadyReviewed && (
                <Text style={styles.consensusCtx}>
                  {site.reviewCount && site.reviewCount > 0
                    ? `Based on ${site.reviewCount} visitor rating${site.reviewCount !== 1 ? 's' : ''} — yours will update these in real time`
                    : 'No ratings yet — be the first to rate this site'}
                </Text>
              )}

              <View style={styles.divider} />

              {submitted || alreadyReviewed ? (
                <View style={styles.reviewedBanner}>
                  <Text style={styles.reviewedIcon}>✓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewedTitle}>Review submitted</Text>
                    <Text style={styles.reviewedSub}>Thanks for helping fellow tourists!</Text>
                    {existingRecord && (
                      <View style={styles.reviewedGrid}>
                        {CRITERIA.map((c) => {
                          const dbKey = `rating_${c.key.replace(/([A-Z])/g, '_$1').toLowerCase()}` as keyof ReviewRecord
                          const val = existingRecord[dbKey] as number | null
                          return (
                            <View key={c.key} style={styles.reviewedRow}>
                              <Text style={styles.reviewedRowEmoji}>{c.emoji}</Text>
                              <Text style={styles.reviewedRowName}>{c.label}</Text>
                              <Text style={styles.reviewedRowVal}>{val !== null ? `${val}/5` : '—'}</Text>
                            </View>
                          )
                        })}
                      </View>
                    )}
                  </View>
                </View>
              ) : !reviewOpen ? (
                <TouchableOpacity style={styles.leaveReviewBtn} onPress={() => setReviewOpen(true)} activeOpacity={0.75}>
                  <Text style={styles.leaveReviewEmoji}>⭐</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaveReviewTitle}>Rate your visit</Text>
                    <Text style={styles.leaveReviewSub}>~30 seconds · all criteria optional</Text>
                  </View>
                  <Text style={styles.leaveReviewChevron}>›</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.reviewForm}>
                  <View style={styles.reviewGuide}>
                    <Text style={styles.reviewGuideTitle}>How to rate</Text>
                    <Text style={styles.reviewGuideTxt}>Tap stars for each aspect. Skip anything that doesn't apply.</Text>
                  </View>

                  {CRITERIA.map((c) => (
                    <View key={c.key} style={styles.criterionCard}>
                      <View style={styles.criterionHeader}>
                        <Text style={styles.criterionEmoji}>{c.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.criterionName}>{c.label}</Text>
                          <Text style={styles.criterionHint}>{c.hint}</Text>
                        </View>
                      </View>
                      <View style={styles.criterionStarRow}>
                        {(ratings[c.key] === null || ratings[c.key] === 0) && (
                          <Text style={styles.criterionUnrated}>Tap to rate</Text>
                        )}
                        <StarRating value={ratings[c.key] ?? 0} onChange={(v) => setRating(c.key, v)} />
                      </View>
                    </View>
                  ))}

                  <View style={styles.commentSection}>
                    <Text style={styles.commentLabel}>
                      💬 Comments <Text style={styles.commentOptional}>(optional)</Text>
                    </Text>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Share what stood out — good or bad…"
                      placeholderTextColor={Colors.textMuted}
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  {!hasAnyRating && (
                    <Text style={styles.submitHint}>☝️ Rate at least one aspect to submit</Text>
                  )}

                  <View style={styles.reviewFormActions}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => { setReviewOpen(false); setRatings(emptyRatings); setComment('') }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelBtnTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitBtn, (submitting || !hasAnyRating) && styles.submitBtnDisabled]}
                      onPress={handleSubmitReview}
                      disabled={submitting || !hasAnyRating}
                      activeOpacity={0.85}
                    >
                      {submitting
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.submitBtnTxt}>Submit rating</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 96 }} />
        </View>
      </ScrollView>

      {/* ── Sticky action bar ── */}
      <View style={styles.stickyBar}>
        <TouchableOpacity style={styles.directionsBtn} onPress={handleGetDirections} activeOpacity={0.88}>
          <Text style={styles.directionsBtnTxt}>🗺️  Get Directions</Text>
        </TouchableOpacity>
        {hasAR && isInRange && userLocation && (
          <TouchableOpacity style={styles.arBtn} onPress={() => setARVisible(true)} activeOpacity={0.85}>
            <Text style={styles.arBtnTxt}>🔮 AR</Text>
          </TouchableOpacity>
        )}
      </View>

      {arVisible && (
        <React.Suspense fallback={null}>
          <ARView landmarkId={Number(site.id)} onClose={() => setARVisible(false)} />
        </React.Suspense>
      )}
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xxl },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  errorTxt: { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.error, textAlign: 'center' },
  backFallbackBtn: {
    marginTop: Spacing.sm, backgroundColor: Colors.primary,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: 12,
  },
  backFallbackTxt: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.textInverse },

  // ── Hero ─────────────────────────────────────────────────────────────────
  heroWrapper: { width: '100%', height: HERO_HEIGHT, position: 'relative', backgroundColor: Colors.bg },
  heroImage: { width: '100%', height: HERO_HEIGHT },
  heroPlaceholder: { width: '100%', height: HERO_HEIGHT, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  heroPlaceholderEmoji: { fontSize: 80, opacity: 0.25 },
  scrimTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scrimBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  backBtn: {
    position: 'absolute', top: STATUS_BAR_H + 8, left: Spacing.md,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  backArrow: { fontSize: 20, color: '#fff', lineHeight: 22 },
  heroBadgeRow: {
    position: 'absolute', bottom: 70, left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  heroMeta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md + 8,
    gap: 4,
  },
  heroSiteName: {
    fontFamily: Typography.displayFont, fontSize: 26,
    color: '#fff', letterSpacing: -0.4, lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroLocation: {
    fontFamily: Typography.bodyFont, fontSize: 13,
    color: 'rgba(255,255,255,0.85)', flex: 1,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  heroRatingChip: {
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: Radius.full,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroRatingTxt: { fontFamily: Typography.bodyMedium, fontSize: 12, color: '#fff' },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
  },
  categoryEmoji: { fontSize: 13 },
  categoryLabel: { fontFamily: Typography.bodyMedium, fontSize: 12, color: '#fff', letterSpacing: 0.3 },
  distanceBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.90)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  distanceBadgeClose: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  distanceTxt: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textMuted },
  distanceTxtClose: { color: Colors.success },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg,
    gap: Spacing.md, minHeight: 500,
  },

  descBlock: { gap: 4 },
  description: { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  descToggle: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.primary, marginTop: 2 },

  // ── Locked pill ───────────────────────────────────────────────────────────
  lockedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  lockedEmoji: { fontSize: 15 },
  lockedTxt: { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.textMuted, flex: 1 },

  // ── AR teaser ─────────────────────────────────────────────────────────────
  arTeaserBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1a0533', borderRadius: Radius.md,
    borderWidth: 1, borderColor: '#7c3aed40',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  arTeaserEmoji: { fontSize: 16 },
  arTeaserTxt: { fontFamily: Typography.bodyFont, fontSize: 13, color: '#c4b5fd', flex: 1, lineHeight: 18 },

  // ── Section ───────────────────────────────────────────────────────────────
  section: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: Typography.bodySemiBold, fontSize: 15, color: Colors.textPrimary },
  sectionSub: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted, marginTop: -4 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  scoresGrid: {
    gap: 8, backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  consensusCtx: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted, lineHeight: 18, fontStyle: 'italic' },

  // ── Already reviewed ──────────────────────────────────────────────────────
  reviewedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.successLight, borderRadius: Radius.md, padding: Spacing.sm,
  },
  reviewedIcon: { fontSize: 18, color: Colors.success },
  reviewedTitle: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.success },
  reviewedSub: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.success, marginTop: 2 },
  reviewedGrid: { marginTop: Spacing.sm, gap: 4 },
  reviewedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewedRowEmoji: { fontSize: 12, width: 18 },
  reviewedRowName: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.success, flex: 1 },
  reviewedRowVal: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.success },

  // ── Leave review CTA ──────────────────────────────────────────────────────
  leaveReviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: Radius.md, backgroundColor: Colors.bgCard,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: Spacing.md,
  },
  leaveReviewEmoji: { fontSize: 26 },
  leaveReviewTitle: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.textPrimary },
  leaveReviewSub: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  leaveReviewChevron: { fontSize: 22, color: Colors.textMuted, lineHeight: 24 },

  // ── Review form ───────────────────────────────────────────────────────────
  reviewForm: { gap: Spacing.md },
  reviewGuide: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
    padding: Spacing.sm, gap: 3,
  },
  reviewGuideTitle: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.textPrimary },
  reviewGuideTxt: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  criterionCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, gap: Spacing.xs,
  },
  criterionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  criterionEmoji: { fontSize: 18, marginTop: 1 },
  criterionName: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.textPrimary },
  criterionHint: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted, lineHeight: 16, marginTop: 2 },
  criterionStarRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 2,
  },
  criterionUnrated: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
  commentSection: { gap: 6 },
  commentLabel: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  commentOptional: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },
  commentInput: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm, fontFamily: Typography.bodyFont,
    fontSize: 13, color: Colors.textPrimary, minHeight: 80,
  },
  submitHint: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic' },
  reviewFormActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textMuted },
  submitBtn: {
    flex: 2, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.textInverse },

  // ── Sticky action bar ─────────────────────────────────────────────────────
  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  directionsBtn: {
    flex: 1, height: 50,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 10, elevation: 6,
  },
  directionsBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 15, color: Colors.textInverse, letterSpacing: 0.2 },
  arBtn: {
    height: 50, paddingHorizontal: Spacing.lg,
    backgroundColor: '#1a0533', borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#7c3aed',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  arBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 15, color: '#e9d5ff', letterSpacing: 0.3 },
})
