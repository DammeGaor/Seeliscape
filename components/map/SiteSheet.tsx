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
const CRITERIA: {
  key: keyof CriterionRatings
  label: string
  shortLabel: string
  emoji: string
  hint: string
}[] = [
  {
    key: 'attraction', label: 'Attraction', shortLabel: 'Attraction', emoji: '✨',
    hint: 'Scenic beauty, uniqueness, and overall wow-factor',
  },
  {
    key: 'accessibility', label: 'Accessibility', shortLabel: 'Access', emoji: '🛣️',
    hint: 'Ease of getting here — roads, signage, and transport',
  },
  {
    key: 'amenities', label: 'Amenities', shortLabel: 'Amenities', emoji: '🏪',
    hint: 'Restrooms, food stalls, parking, and basic facilities',
  },
  {
    key: 'availablePackages', label: 'Tour Packages', shortLabel: 'Packages', emoji: '🎒',
    hint: 'Availability and value of guided tours or bundled offers',
  },
  {
    key: 'activities', label: 'Activities', shortLabel: 'Activities', emoji: '🏄',
    hint: 'Things to do — adventures, cultural experiences, and more',
  },
  {
    key: 'ancillaryServices', label: 'Support Services', shortLabel: 'Services', emoji: '🛎️',
    hint: 'Staff, guides, safety, and other visitor support',
  },
]

const STAR_LABELS: Record<number, string> = {
  1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent',
}

// ---------------------------------------------------------------------------
// StarRating
// ---------------------------------------------------------------------------
function StarRating({
  value,
  onChange,
  size = 26,
}: {
  value: number
  onChange: (v: number) => void
  size?: number
}) {
  return (
    <View style={starRatingWrap}>
      <View style={starRatingRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star)}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={{ fontSize: size, opacity: star <= value ? 1 : 0.15 }}>⭐</Text>
          </TouchableOpacity>
        ))}
      </View>
      {value > 0 && (
        <Text style={starRatingLabel}>{STAR_LABELS[value]}</Text>
      )}
    </View>
  )
}
const starRatingWrap: import('react-native').ViewStyle = { alignItems: 'flex-end', gap: 2 }
const starRatingRow:  import('react-native').ViewStyle = { flexDirection: 'row', gap: 6 }
const starRatingLabel: import('react-native').TextStyle = {
  fontSize: 11,
  color: Colors.primary,
  fontStyle: 'italic',
  textAlign: 'right',
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
  const [descNeedsToggle, setDescNeedsToggle] = useState(false)
  const [reviewOpen,      setReviewOpen]      = useState(false)
  const [alreadyReviewed, setAlreadyReviewed] = useState(false)
  const [existingRecord,  setExistingRecord]  = useState<ReviewRecord | null>(null)
  const [ratings,         setRatings]         = useState<CriterionRatings>(emptyRatings)
  const [comment,         setComment]         = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [submitted,       setSubmitted]       = useState(false)
  const [reviewLoading,   setReviewLoading]   = useState(false)

  // Reset description state when site changes
  useEffect(() => {
    setDescExpanded(false)
    setDescNeedsToggle(false)
  }, [site.id])

  // Auto-unlock when in range
  useEffect(() => {
    if (isInRange && !isUnlocked) unlockSite(site.id)
  }, [isInRange, isUnlocked, site.id])

  // Check if user already reviewed this site
  useEffect(() => {
    if (!userId) return
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
  }, [userId, site.id])

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

        {/* ── Description ──
            onTextLayout fires on the *collapsed* render (numberOfLines=2).
            If the native engine truncated anything, lines.length will equal
            numberOfLines AND the last line will contain an ellipsis — meaning
            there is more text. We use that to decide whether the toggle is needed.
            When expanded we remove numberOfLines so the full text is shown. */}
        {site.description ? (
          <>
            <Text
              style={styles.description}
              numberOfLines={descExpanded ? undefined : 2}
              onTextLayout={(e) => {
                if (!descExpanded) {
                  // If the layout clipped to exactly 2 lines the text overflows
                  setDescNeedsToggle(e.nativeEvent.lines.length >= 2)
                }
              }}
            >
              {site.description}
            </Text>
            {descNeedsToggle && (
              <TouchableOpacity
                onPress={() => setDescExpanded((v) => !v)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.descToggle}>
                  {descExpanded ? '▲ Show less' : '▼ Show more'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : null}

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
            {hasActiveRoute ? 'Reroute' : 'Get Directions'}
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

            {/* ── Section header ── */}
            <View style={styles.reviewSectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewSectionTitle}>Tourist Consensus</Text>
                <Text style={styles.reviewSectionSub}>
                  Scores rated by visitors like you across 6 aspects
                </Text>
              </View>
              {reviewLoading && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>

            {/* ── Community score bars ── */}
            {site.sixAScores && (
              <View style={styles.scoresGrid}>
                {CRITERIA.map(({ key, shortLabel, emoji }) => {
                  const live = (site.sixAScores as any)[key] ?? 0
                  const pct  = Math.round((live / 5) * 100)
                  return (
                    <View key={key} style={styles.scoreCell}>
                      <Text style={styles.scoreCellEmoji}>{emoji}</Text>
                      <Text style={styles.scoreCellLabel}>{shortLabel}</Text>
                      <View style={styles.scoreCellBar}>
                        <View style={[styles.scoreCellFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.scoreCellVal}>{live > 0 ? live.toFixed(1) : '—'}</Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* ── Contribution context ── */}
            {!submitted && !alreadyReviewed && (
              <Text style={styles.consensusContext}>
                {site.reviewCount && site.reviewCount > 0
                  ? `Based on ${site.reviewCount} visitor rating${site.reviewCount !== 1 ? 's' : ''} — yours will update these scores in real time`
                  : 'No ratings yet — be the first visitor to rate this site and help other tourists'}
              </Text>
            )}

            {/* ── Divider ── */}
            <View style={styles.reviewDivider} />

            {/* ── Reviewed banner OR rating flow ── */}
            {submitted || alreadyReviewed ? (
              <View style={styles.reviewedBanner}>
                <Text style={styles.reviewedIcon}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewedTitle}>Your review is submitted</Text>
                  <Text style={styles.reviewedSub}>
                    Thank you for helping fellow tourists explore Albay!
                  </Text>
                  {existingRecord && (
                    <View style={styles.reviewedScoreGrid}>
                      {CRITERIA.map((c) => {
                        const dbKey = `rating_${c.key.replace(/([A-Z])/g, '_$1').toLowerCase()}` as keyof ReviewRecord
                        const val = existingRecord[dbKey] as number | null
                        return (
                          <View key={c.key} style={styles.reviewedScoreRow}>
                            <Text style={styles.reviewedScoreEmoji}>{c.emoji}</Text>
                            <Text style={styles.reviewedScoreName}>{c.label}</Text>
                            <Text style={styles.reviewedScoreVal}>
                              {val !== null ? `${val}/5` : 'Not rated'}
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <>
                {!reviewOpen ? (
                  /* ── CTA to open form ── */
                  <TouchableOpacity
                    style={styles.leaveReviewBtn}
                    onPress={() => setReviewOpen(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.leaveReviewEmoji}>⭐</Text>
                    <View>
                      <Text style={styles.leaveReviewTitle}>Rate your visit</Text>
                      <Text style={styles.leaveReviewSub}>Takes about 30 seconds · all fields optional</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  /* ── Rating form ── */
                  <View style={styles.reviewForm}>

                    {/* Intro guide */}
                    <View style={styles.reviewGuide}>
                      <Text style={styles.reviewGuideTitle}>How to rate</Text>
                      <Text style={styles.reviewGuideTxt}>
                        Tap the stars for each aspect of your visit below. You only need to
                        rate what you experienced — skip anything that doesn't apply.
                      </Text>
                    </View>

                    {/* Per-criterion rows */}
                    {CRITERIA.map((c) => (
                      <View key={c.key} style={styles.criterionCard}>
                        {/* Criterion header */}
                        <View style={styles.criterionHeader}>
                          <Text style={styles.criterionEmoji}>{c.emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.criterionName}>{c.label}</Text>
                            <Text style={styles.criterionHint}>{c.hint}</Text>
                          </View>
                        </View>
                        {/* Stars sit on their own row for easy tapping */}
                        <View style={styles.criterionStarRow}>
                          <StarRating
                            value={ratings[c.key] ?? 0}
                            onChange={(v) => setRating(c.key, v)}
                            size={28}
                          />
                          {ratings[c.key] === null || ratings[c.key] === 0 ? (
                            <Text style={styles.criterionUnrated}>Tap to rate</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}

                    {/* Comment box */}
                    <View style={styles.commentSection}>
                      <Text style={styles.commentLabel}>💬 Additional comments <Text style={styles.commentOptional}>(optional)</Text></Text>
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

                    {/* Requirement hint */}
                    {!hasAnyRating && (
                      <Text style={styles.submitHint}>
                        ☝️ Rate at least one aspect above to submit
                      </Text>
                    )}

                    {/* Actions */}
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
                          : <Text style={styles.submitBtnTxt}>Submit rating</Text>}
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

  // ── Review section wrapper ──────────────────────────────────────────────
  reviewSection: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewSectionTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  reviewSectionSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },

  // ── Community score bars ─────────────────────────────────────────────────
  scoresGrid: {
    gap: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreCellEmoji: { fontSize: 13, width: 18 },
  scoreCellLabel: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textSecondary,
    width: 72,
  },
  scoreCellBar: {
    flex: 1,
    height: 7,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreCellFill: {
    height: 7,
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  scoreCellVal: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    width: 30,
    textAlign: 'right',
  },

  // ── Contribution context ─────────────────────────────────────────────────
  consensusContext: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // ── Divider between community scores and personal rating ─────────────────
  reviewDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: -Spacing.xs,
  },

  // ── Already-reviewed banner ──────────────────────────────────────────────
  reviewedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  reviewedIcon: { fontSize: 20, color: Colors.success },
  reviewedTitle: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: Colors.success },
  reviewedSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.success,
    marginTop: 2,
    lineHeight: 17,
  },
  reviewedScoreGrid: {
    marginTop: Spacing.sm,
    gap: 4,
  },
  reviewedScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewedScoreEmoji: { fontSize: 12, width: 18 },
  reviewedScoreName: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.success,
    flex: 1,
  },
  reviewedScoreVal: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    color: Colors.success,
  },

  // ── CTA button to open form ──────────────────────────────────────────────
  leaveReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
  },
  leaveReviewEmoji: { fontSize: 28 },
  leaveReviewTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  leaveReviewSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },

  // ── Rating form ──────────────────────────────────────────────────────────
  reviewForm: { gap: Spacing.md },

  reviewGuide: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    padding: Spacing.sm,
    gap: 4,
  },
  reviewGuideTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  reviewGuideTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Per-criterion card
  criterionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  criterionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  criterionEmoji: { fontSize: 20, marginTop: 1 },
  criterionName: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  criterionHint: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  criterionStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 2,
  },
  criterionUnrated: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // Comment
  commentSection: { gap: 6 },
  commentLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  commentOptional: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
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
    minHeight: 80,
  },

  // Submit hint
  submitHint: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Actions
  reviewFormActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    height: 44,
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
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.textInverse },
})