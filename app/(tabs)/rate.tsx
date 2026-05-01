// ---------------------------------------------------------------------------
// app/(tabs)/rate.tsx
// Post-session relevance rating screen for NDCG evaluation.
//
// Flow:
//   1. User enters an anonymous respondent ID
//   2. Rates each of the 10 recommended destinations (0–4 scale), one at a time
//   3. On submit: computes NDCG@5 and NDCG@10, writes session + results + scores
//      to Supabase, then navigates back to the recommend tab
// ---------------------------------------------------------------------------

import React, { useState, useMemo, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'
import { RankedSite, CriteriaWeights } from '@/lib/topsis.service'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Relevance scale
// ---------------------------------------------------------------------------
const RELEVANCE_LABELS: Record<number, { label: string; desc: string; color: string }> = {
  0: { label: 'Not Relevant',      desc: "I wouldn't visit this at all",           color: '#C0392B' },
  1: { label: 'Poor Match',        desc: "Doesn't really suit my preferences",     color: '#E07A30' },
  2: { label: 'Somewhat Relevant', desc: 'Mildly interesting but not quite right', color: '#8B6914' },
  3: { label: 'Good Match',        desc: "I'd definitely consider visiting this",  color: '#2980C4' },
  4: { label: 'Perfect Match',     desc: 'Exactly what I was looking for',         color: '#1A7A4A' },
}

// ---------------------------------------------------------------------------
// NDCG computation
// ---------------------------------------------------------------------------
function dcg(ratings: number[], k: number): number {
  return ratings.slice(0, k).reduce((acc, rel, i) => {
    return acc + (Math.pow(2, rel) - 1) / Math.log2(i + 2)
  }, 0)
}

function computeNDCG(
  ratings: number[],
  k: number,
): { ndcg: number; idealDcg: number; actualDcg: number } {
  const actualDcg = dcg(ratings, k)
  const idealDcg  = dcg([...ratings].sort((a, b) => b - a), k)
  const ndcg      = idealDcg === 0 ? 0 : actualDcg / idealDcg
  return { ndcg, idealDcg, actualDcg }
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function RateScreen() {
  const params  = useLocalSearchParams<{ results: string; weights: string }>()
  const results: RankedSite[]    = useMemo(() => JSON.parse(params.results ?? '[]'), [params.results])
  const weights: CriteriaWeights = useMemo(() => JSON.parse(params.weights ?? '{}'), [params.weights])

  // ── State ─────────────────────────────────────────────────────────────────
  const [respondentId, setRespondentId] = useState('')
  const [idSubmitted,  setIdSubmitted]  = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [ratings,      setRatings]      = useState<(number | undefined)[]>(
    Array(results.length).fill(undefined),
  )
  const [submitting,   setSubmitting]   = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [submitted,    setSubmitted]    = useState(false)
  // Ref-based guard fires synchronously — prevents double-submission from
  // React Strict Mode double-invocation or rapid double-tap.
  const isSubmittingRef = useRef(false)

  const totalSites    = results.length
  const currentSite   = results[currentIndex]
  const currentRating = ratings[currentIndex]
  const allRated      = ratings.every((r) => r !== undefined)
  const unratedCount  = ratings.filter((r) => r === undefined).length

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleIdSubmit() {
    if (respondentId.trim().length < 2) {
      Alert.alert('ID Required', 'Please enter a respondent ID of at least 2 characters.')
      return
    }
    setIdSubmitted(true)
  }

  function handleRate(score: number) {
    setRatings((prev) => {
      const next = [...prev]
      next[currentIndex] = score
      return next
    })
  }

  function handleNext() {
    if (currentIndex < totalSites - 1) {
      setCurrentIndex((i) => i + 1)
      setDescExpanded(false)
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
      setDescExpanded(false)
    }
  }

  async function handleSubmit() {
    if (!allRated || isSubmittingRef.current) return
    isSubmittingRef.current = true
    setSubmitting(true)

    try {
      const definedRatings = ratings as number[]

      // ── Compute NDCG ──────────────────────────────────────────────────────
      const ndcg5  = computeNDCG(definedRatings, 5)
      const ndcg10 = computeNDCG(definedRatings, 10)

      // ── Insert evaluation_sessions ────────────────────────────────────────
      const { data: sessionData, error: sessionError } = await supabase
        .from('evaluation_sessions')
        .insert({
          respondent_id: respondentId.trim(),
          weights,
          preset_used: null,
        })
        .select('id')
        .single()

      if (sessionError) throw sessionError
      const sessionId = sessionData.id

      // ── Insert evaluation_results (one row per site) ──────────────────────
      const resultRows = results.map((site, i) => ({
        session_id:       sessionId,
        site_id:          site.id,
        site_name:        site.name,
        topsis_rank:      site.rank,
        topsis_score:     site.topsisScore,
        relevance_rating: definedRatings[i],
      }))

      const { error: resultsError } = await supabase
        .from('evaluation_results')
        .insert(resultRows)

      if (resultsError) throw resultsError

      // ── Insert ndcg_scores ────────────────────────────────────────────────
      const { error: ndcgError } = await supabase
        .from('ndcg_scores')
        .insert({
          session_id:    sessionId,
          ndcg_at_5:     ndcg5.ndcg,
          ndcg_at_10:    ndcg10.ndcg,
          ideal_dcg_5:   ndcg5.idealDcg,
          actual_dcg_5:  ndcg5.actualDcg,
          ideal_dcg_10:  ndcg10.idealDcg,
          actual_dcg_10: ndcg10.actualDcg,
        })

      if (ndcgError) throw ndcgError

      // ── Show thank-you, then navigate ────────────────────────────────────
      setSubmitted(true)
      setTimeout(() => {
        router.replace('/(tabs)/recommend')
      }, 2200)

    } catch (e: any) {
      Alert.alert('Submission Failed', e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
      isSubmittingRef.current = false
    }
  }

  // ── Thank-you screen ─────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.thankYouScreen}>
          <View style={styles.thankYouCard}>
            <Text style={styles.thankYouEmoji}>🎉</Text>
            <Text style={styles.thankYouTitle}>Thank you!</Text>
            <Text style={styles.thankYouDesc}>
              Your ratings have been recorded.{'\n'}
              This feedback helps improve the recommendation algorithm.
            </Text>
            <View style={styles.thankYouDivider} />
            <Text style={styles.thankYouSub}>Returning to recommendations…</Text>
            <ActivityIndicator
              size="small"
              color={Colors.primary}
              style={{ marginTop: Spacing.sm }}
            />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // ── Step 0: Respondent ID entry ───────────────────────────────────────────
  if (!idSubmitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/recommend')} activeOpacity={0.75}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Rate Your Results</Text>
            <Text style={styles.headerSub}>NDCG Evaluation</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.idScreen}>
          <View style={styles.idCard}>
            <Text style={styles.idEmoji}>🪪</Text>
            <Text style={styles.idTitle}>Enter Respondent ID</Text>
            <Text style={styles.idDesc}>
              This ID will be used to identify your responses in the evaluation dataset.
              It was provided to you by the researcher.
            </Text>
            <TextInput
              style={styles.idInput}
              value={respondentId}
              onChangeText={setRespondentId}
              placeholder="e.g. R-01"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleIdSubmit}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, respondentId.trim().length < 2 && styles.primaryBtnDisabled]}
              onPress={handleIdSubmit}
              activeOpacity={0.85}
              disabled={respondentId.trim().length < 2}
            >
              <Text style={styles.primaryBtnTxt}>Continue →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>What you'll do next</Text>
            <Text style={styles.instructionTxt}>
              You'll be shown each of the {totalSites} recommended destinations one at a time.
              For each one, rate how relevant it is to what you were looking for —{' '}
              from <Text style={styles.bold}>Not Relevant (0)</Text> to{' '}
              <Text style={styles.bold}>Perfect Match (4)</Text>.{'\n\n'}
              You can go back and change any rating before submitting.
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Step 1: Rating cards ──────────────────────────────────────────────────
  const matchPct = Math.round(currentSite.topsisScore * 100)

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)/recommend')} activeOpacity={0.75}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Rate Destinations</Text>
          <Text style={styles.headerSub}>
            {respondentId.trim()}  ·  {currentIndex + 1} of {totalSites}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { flex: (currentIndex + 1) / totalSites }]} />
        <View style={{ flex: 1 - (currentIndex + 1) / totalSites }} />
      </View>

      <ScrollView contentContainerStyle={styles.ratingScreen} showsVerticalScrollIndicator={false}>

        {/* Site info card */}
        <View style={styles.siteCard}>
          {/* Hero image */}
          {(currentSite as any).imageUrl ? (
            <Image
              source={{ uri: (currentSite as any).imageUrl }}
              style={styles.siteHeroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.siteHeroPlaceholder}>
              <Text style={styles.siteHeroPlaceholderEmoji}>🏞️</Text>
            </View>
          )}

          <View style={styles.siteCardBody}>
            <View style={styles.siteRankRow}>
              <Text style={styles.siteRank}>#{currentSite.rank}</Text>
              <View style={styles.matchChip}>
                <Text style={styles.matchChipTxt}>{matchPct}% Match</Text>
              </View>
            </View>
            <Text style={styles.siteName}>{currentSite.name}</Text>
            {/* Full description — expandable */}
            {(currentSite as any).description ? (
              <>
                <Text
                  style={styles.siteDesc}
                  numberOfLines={descExpanded ? undefined : 3}
                >
                  {(currentSite as any).description}
                </Text>
                <TouchableOpacity onPress={() => setDescExpanded(v => !v)} activeOpacity={0.7}>
                  <Text style={styles.siteDescToggle}>
                    {descExpanded ? '▲ Show less' : '▼ Show more'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (currentSite as any).shortDescription ? (
              <Text style={styles.siteDesc}>
                {(currentSite as any).shortDescription}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Rating prompt */}
        <Text style={styles.ratingPrompt}>
          How relevant is this destination to what you were looking for?
        </Text>

        {/* 0–4 rating buttons */}
        <View style={styles.ratingGrid}>
          {([0, 1, 2, 3, 4] as const).map((score) => {
            const meta       = RELEVANCE_LABELS[score]
            const isSelected = currentRating === score
            return (
              <TouchableOpacity
                key={score}
                style={[
                  styles.ratingBtn,
                  isSelected && { backgroundColor: meta.color, borderColor: meta.color },
                ]}
                onPress={() => handleRate(score)}
                activeOpacity={0.8}
              >
                <Text style={[styles.ratingScore, isSelected && styles.ratingScoreSelected]}>
                  {score}
                </Text>
                <View style={styles.ratingTextCol}>
                  <Text style={[styles.ratingLabel, isSelected && styles.ratingLabelSelected]}>
                    {meta.label}
                  </Text>
                  <Text style={[styles.ratingDesc, isSelected && styles.ratingDescSelected]}>
                    {meta.desc}
                  </Text>
                </View>
                {isSelected && <Text style={styles.ratingCheck}>✓</Text>}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Progress dots — tappable to jump to any site */}
        <View style={styles.dotsRow}>
          {results.map((_, i) => {
            const rated   = ratings[i] !== undefined
            const current = i === currentIndex
            return (
              <TouchableOpacity
                key={i}
                onPress={() => { setCurrentIndex(i); setDescExpanded(false) }}
                style={[
                  styles.dot,
                  rated   && styles.dotRated,
                  current && styles.dotCurrent,
                ]}
              />
            )
          })}
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            onPress={handlePrev}
            disabled={currentIndex === 0}
            activeOpacity={0.75}
          >
            <Text style={styles.navBtnTxt}>← Prev</Text>
          </TouchableOpacity>

          {currentIndex < totalSites - 1 ? (
            <TouchableOpacity
              style={styles.navBtnPrimary}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.navBtnPrimaryTxt}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitBtn, (!allRated || submitting) && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              disabled={!allRated || submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnTxt}>
                    {allRated ? '✦  Submit Ratings' : `${unratedCount} unrated — go back`}
                  </Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Unrated hint on last card */}
        {currentIndex === totalSites - 1 && !allRated && (
          <Text style={styles.unratedNote}>
            Tap any dot above to jump to an unrated destination.
          </Text>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgCard },

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
  headerTitle: {
    fontFamily: Typography.displayFont, fontSize: 20,
    color: Colors.textPrimary, letterSpacing: -0.4,
  },
  headerSub: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  // Progress bar
  progressTrack: { height: 3, flexDirection: 'row', backgroundColor: Colors.border },
  progressFill:  { height: 3, backgroundColor: Colors.primary },

  // ── ID screen ──────────────────────────────────────────────────────────────
  idScreen: { padding: Spacing.lg, gap: Spacing.md },

  idCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, gap: Spacing.sm, alignItems: 'center',
  },
  idEmoji: { fontSize: 36, marginBottom: 4 },
  idTitle: {
    fontFamily: Typography.displayFont, fontSize: 22,
    color: Colors.textPrimary, letterSpacing: -0.4,
  },
  idDesc: {
    fontFamily: Typography.bodyFont, fontSize: 13,
    color: Colors.textMuted, lineHeight: 19, textAlign: 'center',
  },
  idInput: {
    width: '100%', height: 48,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontFamily: Typography.bodyMedium, fontSize: 16,
    color: Colors.textPrimary, backgroundColor: Colors.bg,
    marginTop: Spacing.sm, textAlign: 'center', letterSpacing: 2,
  },

  instructionCard: {
    backgroundColor: Colors.primary + '0E', borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.primary + '25',
    padding: Spacing.md, gap: 6,
  },
  instructionTitle: {
    fontFamily: Typography.bodySemiBold, fontSize: 13,
    color: Colors.primary, letterSpacing: 0.2,
  },
  instructionTxt: {
    fontFamily: Typography.bodyFont, fontSize: 13,
    color: Colors.textSecondary, lineHeight: 20,
  },
  bold: { fontFamily: Typography.bodySemiBold, color: Colors.textPrimary },

  // ── Rating screen ──────────────────────────────────────────────────────────
  ratingScreen: { padding: Spacing.lg, gap: Spacing.md },

  siteCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  siteHeroImage: {
    width: '100%', height: 180,
  },
  siteHeroPlaceholder: {
    width: '100%', height: 180,
    backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  siteHeroPlaceholderEmoji: { fontSize: 48 },
  siteCardBody: {
    padding: Spacing.md, gap: 6,
  },
  siteRankRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  siteRank:    { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.textMuted },
  matchChip:   {
    backgroundColor: Colors.primary + '15', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  matchChipTxt: { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.primary },
  siteName: {
    fontFamily: Typography.displayFont, fontSize: 20,
    color: Colors.textPrimary, letterSpacing: -0.3,
  },
  siteDesc: {
    fontFamily: Typography.bodyFont, fontSize: 13,
    color: Colors.textSecondary, lineHeight: 20,
  },
  siteDescToggle: {
    fontFamily: Typography.bodyMedium, fontSize: 12,
    color: Colors.primary, marginTop: 2,
  },

  ratingPrompt: {
    fontFamily: Typography.bodyMedium, fontSize: 14,
    color: Colors.textSecondary, lineHeight: 20,
  },

  ratingGrid: { gap: 8 },
  ratingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.sm,
    backgroundColor: Colors.bgCard,
  },
  ratingScore:         { fontFamily: Typography.displayFont, fontSize: 22, color: Colors.textMuted, width: 28, textAlign: 'center' },
  ratingScoreSelected: { color: '#fff' },
  ratingTextCol:       { flex: 1, gap: 1 },
  ratingLabel:         { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.textPrimary },
  ratingLabelSelected: { color: '#fff' },
  ratingDesc:          { fontFamily: Typography.bodyFont, fontSize: 11, color: Colors.textMuted },
  ratingDescSelected:  { color: 'rgba(255,255,255,0.8)' },
  ratingCheck:         { fontSize: 16, color: '#fff' },

  // Dots
  dotsRow:    { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotRated:   { backgroundColor: Colors.primary + '60' },
  dotCurrent: { backgroundColor: Colors.primary, width: 20, borderRadius: 4 },

  // Navigation
  navRow: { flexDirection: 'row', gap: 10 },
  navBtn: {
    height: 48, paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled:   { opacity: 0.35 },
  navBtnTxt:        { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.textSecondary },
  navBtnPrimary: {
    flex: 1, height: 48,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  navBtnPrimaryTxt: { fontFamily: Typography.bodySemiBold, fontSize: 15, color: '#fff' },
  submitBtn: {
    flex: 1, height: 48,
    backgroundColor: '#1A7A4A', borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1A7A4A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  submitBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 15, color: '#fff' },

  unratedNote: {
    fontFamily: Typography.bodyFont, fontSize: 12,
    color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic',
  },

  // Shared
  primaryBtn: {
    width: '100%', height: 52, backgroundColor: Colors.primary,
    borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5, marginTop: Spacing.sm,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 16, color: '#fff', letterSpacing: 0.3 },

  // ── Thank-you screen ──────────────────────────────────────────────────────
  thankYouScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.bg,
  },
  thankYouCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  thankYouEmoji: { fontSize: 52, marginBottom: Spacing.xs },
  thankYouTitle: {
    fontFamily: Typography.displayFont, fontSize: 28,
    color: Colors.textPrimary, letterSpacing: -0.5,
  },
  thankYouDesc: {
    fontFamily: Typography.bodyFont, fontSize: 14,
    color: Colors.textSecondary, lineHeight: 22,
    textAlign: 'center',
  },
  thankYouDivider: {
    width: 48, height: 1.5,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  thankYouSub: {
    fontFamily: Typography.bodyFont, fontSize: 13,
    color: Colors.textMuted, fontStyle: 'italic',
  },
})
