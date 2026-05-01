import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { TourismSite, CATEGORY_CONFIG, formatDistance, getDistanceMeters } from '@/lib/tourism-sites'
import { RouteProfile } from '@/lib/directions.service'
import { useMapStore } from '@/store/map.store'
import { useAuthStore } from '@/store/auth.store'
import {
  submitSiteReview,
  fetchUserReviewForSite,
  CriterionRatings,
  ReviewRecord,
} from '@/lib/recommendations.service'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

const ARView = React.lazy(() =>
  import('@/components/ar/ARView').then((m) => ({ default: m.ARView }))
)

const { height: SCREEN_H } = Dimensions.get('window')
const SHEET_HEIGHT = SCREEN_H * 0.78
const IMAGE_HEIGHT = 200

// ---------------------------------------------------------------------------
// Criterion metadata for the review form
// ---------------------------------------------------------------------------
const CRITERIA: { key: keyof CriterionRatings; label: string; emoji: string }[] = [
  { key: 'attraction',        label: 'Attraction',         emoji: '✨' },
  { key: 'accessibility',     label: 'Accessibility',      emoji: '🛣️' },
  { key: 'amenities',         label: 'Amenities',          emoji: '🏪' },
  { key: 'availablePackages', label: 'Packages',           emoji: '🎒' },
  { key: 'activities',        label: 'Activities',         emoji: '🏄' },
  { key: 'ancillaryServices', label: 'Ancillary Services', emoji: '🛎️' },
]

// ---------------------------------------------------------------------------
// StarRating
// ---------------------------------------------------------------------------
function StarRating({
  value,
  onChange,
  size = 24,
}: {
  value: number
  onChange: (v: number) => void
  size?: number
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7}>
          <Text style={{ fontSize: size, opacity: star <= value ? 1 : 0.2 }}>⭐</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SiteSheetProps {
  site: TourismSite
  onClose: () => void
  onGetDirections: (profile: RouteProfile) => void
  hasActiveRoute: boolean
  onClearRoute: () => void
}

// ---------------------------------------------------------------------------
// SiteSheet
// ---------------------------------------------------------------------------
export function SiteSheet({
  site,
  onClose,
  onGetDirections,
  hasActiveRoute,
  onClearRoute,
}: SiteSheetProps) {
  const { userLocation, unlockedSiteIds, unlockSite, arEnabledSiteIds } = useMapStore()
  const { session } = useAuthStore()
  const userId = session?.user?.id ?? ''

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current
  const [arVisible, setARVisible] = useState(false)
  const config = CATEGORY_CONFIG[site.category]

  const distanceMeters = userLocation
    ? getDistanceMeters(
        userLocation.latitude, userLocation.longitude,
        site.coordinates.latitude, site.coordinates.longitude,
      )
    : null

  const isUnlocked = unlockedSiteIds.has(site.id)
  const isInRange  = distanceMeters !== null && distanceMeters <= site.unlockRadiusMeters
  const hasAR      = arEnabledSiteIds.has(site.id)

  // ── Review state ──────────────────────────────────────────────────────────
  const emptyRatings: CriterionRatings = {
    attraction: null, accessibility: null, amenities: null,
    availablePackages: null, activities: null, ancillaryServices: null,
  }

  const [descExpanded,    setDescExpanded]    = useState(false)
  const [reviewOpen,      setReviewOpen]      = useState(false)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const [existingRecord,  setExistingRecord]  = useState<ReviewRecord | null>(null)
  const [ratings,         setRatings]         = useState<CriterionRatings>(emptyRatings)
  const [comment,         setComment]         = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [submitted,       setSubmitted]       = useState(false)
  const [reviewLoading,   setReviewLoading]   = useState(false)

  // Auto-unlock when in range
  useEffect(() => {
    if (isInRange && !isUnlocked) unlockSite(site.id)
  }, [isInRange, isUnlocked, site.id])

  // Check if user already reviewed this site
  useEffect(() => {
    if (!userId || !isUnlocked) return
    setReviewLoading(true)
    fetchUserReviewForSite(userId, site.id)
      .then((existing) => {
        if (existing) {
          setAlreadyReviewed(true)
          setExistingRecord(existing)
        }
      })
      .catch(() => {})
      .finally(() => setReviewLoading(false))
  }, [userId, site.id, isUnlocked])

  // Slide up animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start()
  }, [])

  function handleGetDirections(profile: RouteProfile) {
    Animated.timing(slideAnim, {
      toValue: SHEET_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      if (hasActiveRoute) onClearRoute()
      onGetDirections(profile)
      onClose()
    })
  }

  function handleClose() {
    Animated.timing(slideAnim, {
      toValue: SHEET_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose)
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderRelease: (_, g) => { if (g.dy > 60) handleClose() },
    })
  ).current

  function setRating(key: keyof CriterionRatings, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }))
  }

  // At least one criterion must be rated to submit
  const hasAnyRating = Object.values(ratings).some((v) => v !== null)

  async function handleSubmitReview() {
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to leave a review.')
      return
    }
    if (!hasAnyRating) {
      Alert.alert('Rating required', 'Please rate at least one criterion.')
      return
    }
    setSubmitting(true)
    try {
      await submitSiteReview({
        site_id:    site.id,
        user_id:    userId,
        visited:    true,
        ratings,
        comment:    comment.trim() || null,
        visited_at: new Date().toISOString().slice(0, 10),
      })
      setSubmitted(true)
      setAlreadyReviewed(true)
      setReviewOpen(false)
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  // Summary of existing per-criterion ratings for the "already reviewed" banner
  function existingRatingSummary(): string {
    if (!existingRecord) return ''
    const pairs = CRITERIA.map((c) => {
      const dbKey = `rating_${c.key.replace(/([A-Z])/g, '_$1').toLowerCase()}` as keyof ReviewRecord
      const val = existingRecord[dbKey] as number | null
      return val !== null ? `${c.emoji} ${val}/5` : null
    }).filter(Boolean)
    return pairs.join('  ·  ')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
      {/* ── Hero image with drag handle overlay ── */}
      <View {...panResponder.panHandlers} style={styles.heroWrapper}>
        {site.imageUrl ? (
          <Image
            source={{ uri: site.imageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroPlaceholderEmoji}>{config.emoji}</Text>
          </View>
        )}
        {/* Gradient scrim so text is readable over image */}
        <View style={styles.heroScrim} />
        {/* Drag handle sits on top of image */}
        <View style={styles.handleOnImage} />
        {/* Category + distance badges float over image */}
        <View style={styles.heroBadgeRow}>
          {site.category !== 'default' && (
            <View style={[styles.categoryBadge, { backgroundColor: config.color + 'cc' }]}>
              <Text style={styles.categoryEmoji}>{config.emoji}</Text>
              <Text style={[styles.categoryLabel, { color: '#fff' }]}>
                {site.category.charAt(0).toUpperCase() + site.category.slice(1)}
              </Text>
            </View>
          )}
          {distanceMeters !== null && (
            <View style={[styles.distanceBadge, isInRange && styles.distanceBadgeClose]}>
              <Text style={[styles.distanceTxt, isInRange && styles.distanceTxtClose]}>
                {isInRange ? "📍 You're here!" : `${formatDistance(distanceMeters)} away`}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Close button floats over hero */}
      <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
        <Text style={styles.closeTxt}>✕</Text>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Site name + location ── */}
        <Text style={styles.siteName}>{site.name}</Text>
        {(site.barangay || site.municipality) ? (
          <Text style={styles.siteLocation}>
            {[site.barangay, site.municipality].filter(Boolean).join(', ')}
          </Text>
        ) : null}

        {/* ── Review score pill ── */}
        {site.avgReviewScore ? (
          <View style={styles.ratingPill}>
            <Text style={styles.ratingPillTxt}>
              ⭐ {site.avgReviewScore.toFixed(1)}
              {site.reviewCount
                ? `  ·  ${site.reviewCount} review${site.reviewCount !== 1 ? 's' : ''}`
                : ''}
            </Text>
          </View>
        ) : null}

        {/* ── Description ── */}
        {isUnlocked ? (
          <>
            <View style={styles.unlockedBanner}>
              <Text style={styles.unlockedTxt}>Site unlocked! You visited this location.</Text>
            </View>
            <Text
              style={styles.description}
              numberOfLines={descExpanded ? undefined : 3}
            >
              {site.description}
            </Text>
            <TouchableOpacity onPress={() => setDescExpanded((v) => !v)} activeOpacity={0.7}>
              <Text style={styles.descToggle}>
                {descExpanded ? '▲ Show less' : '▼ Show more'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text
              style={styles.description}
              numberOfLines={descExpanded ? undefined : 3}
            >
              {site.shortDescription}
            </Text>
            <TouchableOpacity onPress={() => setDescExpanded((v) => !v)} activeOpacity={0.7}>
              <Text style={styles.descToggle}>
                {descExpanded ? '▲ Show less' : '▼ Show more'}
              </Text>
            </TouchableOpacity>
            <View style={styles.lockedBanner}>
              <Text style={styles.lockedIcon}>🔒</Text>
              <View>
                <Text style={styles.lockedTitle}>Visit to unlock</Text>
                <Text style={styles.lockedSub}>
                  Get within {site.unlockRadiusMeters >= 1000
                    ? `${(site.unlockRadiusMeters / 1000).toFixed(1)}km`
                    : `${site.unlockRadiusMeters}m`} to unlock full details
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ── View in AR button — only when in range AND site has AR ── */}
        {hasAR && isInRange && userLocation && (
          <TouchableOpacity
            style={styles.arBtn}
            onPress={() => setARVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.arBtnTxt}>View in AR</Text>
          </TouchableOpacity>
        )}

        {/* AR teaser — visible when not yet in range but AR is available */}
        {hasAR && !isInRange && (
          <View style={styles.arTeaserBadge}>
            <Text style={styles.arTeaserEmoji}></Text>
            <Text style={styles.arTeaserTxt}>AR experience available when you arrive</Text>
          </View>
        )}

        {/* ── Directions button ── */}
        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={() => handleGetDirections('walking')}
          activeOpacity={0.85}
        >
          <Text style={styles.directionsBtnTxt}>
            {hasActiveRoute ? '🔄  Reroute' : 'Get Directions'}
          </Text>
        </TouchableOpacity>

        {hasActiveRoute && (
          <TouchableOpacity style={styles.clearRouteBtn} onPress={onClearRoute} activeOpacity={0.7}>
            <Text style={styles.clearRouteTxt}>Clear route</Text>
          </TouchableOpacity>
        )}

        {/* ── Review section — unlocked sites only ── */}
        {isUnlocked && (
          <View style={styles.reviewSection}>
            <View style={styles.reviewSectionHeader}>
              <Text style={styles.reviewSectionTitle}>Tourist Consensus</Text>
              {reviewLoading && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>

            {/* Feature #6: per-criterion live scores ── */}
            {site.sixAScores && (
              <View style={styles.scoresGrid}>
                {([
                  { key: 'attraction',        label: 'Attraction',    emoji: '✨' },
                  { key: 'accessibility',     label: 'Access',        emoji: '🛣️' },
                  { key: 'amenities',         label: 'Amenities',     emoji: '🏪' },
                  { key: 'availablePackages', label: 'Packages',      emoji: '🎒' },
                  { key: 'activities',        label: 'Activities',    emoji: '🏄' },
                  { key: 'ancillaryServices', label: 'Ancillary',     emoji: '🛎️' },
                ] as const).map(({ key, label, emoji }) => {
                  const live = site.sixAScores[key] ?? 0
                  const pct  = Math.round((live / 5) * 100)
                  return (
                    <View key={key} style={styles.scoreCell}>
                      <Text style={styles.scoreCellEmoji}>{emoji}</Text>
                      <View style={styles.scoreCellBar}>
                        <View style={[styles.scoreCellFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.scoreCellVal}>{live}/5</Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Feature #4: contribution context ── */}
            {!submitted && !alreadyReviewed && (
              <Text style={styles.consensusContext}>
                {site.reviewCount && site.reviewCount > 0
                  ? `${site.reviewCount} tourist${site.reviewCount !== 1 ? 's' : ''} have rated this site · your vote will update these scores`
                  : 'No tourist reviews yet — be the first to rate this site and shape the data'}
              </Text>
            )}

            {submitted || alreadyReviewed ? (
              <View style={styles.reviewedBanner}>
                <Text style={styles.reviewedIcon}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewedTitle}>Review submitted</Text>
                  {existingRecord && (
                    <Text style={styles.reviewedSub}>{existingRatingSummary()}</Text>
                  )}
                </View>
              </View>
            ) : (
              <>
                {!reviewOpen ? (
                  <TouchableOpacity
                    style={styles.leaveReviewBtn}
                    onPress={() => setReviewOpen(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.leaveReviewTxt}>Rate your experience</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.reviewForm}>
                    <Text style={styles.reviewFormSubtitle}>
                      Rate each aspect of your visit. Your ratings directly shape the scores
                      other tourists see.
                    </Text>

                    {/* Per-criterion star pickers */}
                    {CRITERIA.map((c) => (
                      <View key={c.key} style={styles.criterionRow}>
                        <View style={styles.criterionLabel}>
                          <Text style={styles.criterionEmoji}>{c.emoji}</Text>
                          <Text style={styles.criterionName}>{c.label}</Text>
                        </View>
                        <StarRating
                          value={ratings[c.key] ?? 0}
                          onChange={(v) => setRating(c.key, v)}
                          size={22}
                        />
                      </View>
                    ))}

                    <TextInput
                      style={styles.commentInput}
                      placeholder="Share what you loved… (optional)"
                      placeholderTextColor={Colors.textMuted}
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />

                    <View style={styles.reviewFormActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => {
                          setReviewOpen(false)
                          setRatings(emptyRatings)
                          setComment('')
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cancelBtnTxt}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.submitBtn,
                          (submitting || !hasAnyRating) && styles.submitBtnDisabled,
                        ]}
                        onPress={handleSubmitReview}
                        disabled={submitting || !hasAnyRating}
                        activeOpacity={0.85}
                      >
                        {submitting
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={styles.submitBtnTxt}>Submit</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
      </Animated.View>

      {/* ── Full-screen AR overlay ── */}
      {arVisible && (
        <React.Suspense fallback={null}>
          <ARView
            landmarkId={Number(site.id)}
            onClose={() => setARVisible(false)}
          />
        </React.Suspense>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 24,
    zIndex: 50,
    overflow: 'hidden',
  },
  // Hero image
  heroWrapper: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  heroPlaceholder: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderEmoji: {
    fontSize: 56,
    opacity: 0.35,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  handleOnImage: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  heroBadgeRow: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // kept for spacing — no longer rendered
  dragArea: { height: 0 },
  handle: { height: 0 },
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeTxt: { fontSize: 13, color: '#fff', fontWeight: '600' },

  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  categoryEmoji: { fontSize: 13 },
  categoryLabel: { fontFamily: Typography.bodyMedium, fontSize: 12, letterSpacing: 0.3 },
  distanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  distanceBadgeClose: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  distanceTxt: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textMuted },
  distanceTxtClose: { color: Colors.success },

  siteName: {
    fontFamily: Typography.displayFont,
    fontSize: 26,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  siteLocation: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.textMuted,
  },

  ratingPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bg,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ratingPillTxt: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  unlockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  unlockedIcon: { fontSize: 16 },
  unlockedTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.success, flex: 1 },

  description: {
    fontFamily: Typography.bodyFont,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
  },
  descToggle: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.primary,
    marginTop: -4,
  },

  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: Spacing.md,
  },
  lockedIcon: { fontSize: 22 },
  lockedTitle: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.textPrimary, marginBottom: 2 },
  lockedSub: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },

  directionsBtn: {
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  directionsBtnTxt: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 15,
    color: Colors.textInverse,
    letterSpacing: 0.2,
  },
  clearRouteBtn: { alignItems: 'center', paddingVertical: Spacing.xs },
  clearRouteTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.error },

  // AR button — primary CTA when in range
  arBtn: {
    height: 50,
    backgroundColor: '#1a0533',
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#7c3aed',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  arBtnTxt: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 15,
    color: '#e9d5ff',
    letterSpacing: 0.3,
  },

  // AR teaser badge — shown when not yet in range
  arTeaserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a0533',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#7c3aed40',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  arTeaserEmoji: { fontSize: 14 },
  arTeaserTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: '#c4b5fd',
    flex: 1,
  },

  reviewSection: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewSectionTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  reviewedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  reviewedIcon: { fontSize: 18, color: Colors.success },
  reviewedTitle: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.success },
  reviewedSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.success,
    marginTop: 4,
    lineHeight: 18,
  },

  leaveReviewBtn: {
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveReviewTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textSecondary },

  reviewForm: { gap: Spacing.sm },

  reviewFormSubtitle: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },

  // Per-criterion row
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  criterionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  criterionEmoji: { fontSize: 16 },
  criterionName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },

  commentInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.textPrimary,
    minHeight: 72,
    marginTop: Spacing.xs,
  },
  reviewFormActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textMuted },
  submitBtn: {
    flex: 2,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.textInverse },

  // Feature #6: per-criterion score grid
  scoresGrid: {
    gap: 6,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreCellEmoji: { fontSize: 13, width: 20 },
  scoreCellBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreCellFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  scoreCellVal: {
    fontFamily: Typography.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
    width: 28,
    textAlign: 'right',
  },

  // Feature #4: contribution context
  consensusContext: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    fontStyle: 'italic',
  },
})