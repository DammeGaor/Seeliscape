// ---------------------------------------------------------------------------
// app/(tabs)/recommend.tsx  — Improved UX/UI
// Full recommendation flow:
//   Step 1 — Preset profiles OR manual 6A criteria weighting
//   Step 2 — TOPSIS results with images, per-criterion breakdown, AI summary,
//             and save-list feature
// ---------------------------------------------------------------------------

import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'
import { runTOPSIS, CriteriaWeights, RankedSite, CRITERIA_META, SixAs } from '@/lib/topsis.service'
import { fetchLandmarksForTOPSIS } from '@/lib/recommendations.service'
import { useAuthStore } from '@/store/auth.store'
import { useMapStore } from '@/store/map.store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Step = 'criteria' | 'results'

const CRITERIA_KEYS = Object.keys(CRITERIA_META) as (keyof SixAs)[]

// ---------------------------------------------------------------------------
// Tint colours per criterion
// ---------------------------------------------------------------------------
const TINTS: Record<string, string> = {
  attraction:        '#E07A30',
  accessibility:     '#2980C4',
  amenities:         '#1A7A4A',
  availablePackages: '#8B6914',
  activities:        '#C0392B',
  ancillaryServices: '#6C3483',
}

// ---------------------------------------------------------------------------
// Preset profiles
// ---------------------------------------------------------------------------
interface Preset {
  label: string
  emoji: string
  description: string
  weights: CriteriaWeights
}

const PRESETS: Preset[] = [
  {
    label: 'Adventure Seeker',
    emoji: '🏄',
    description: 'Thrills, outdoor activities & unique experiences',
    weights: { attraction: 4, accessibility: 3, amenities: 2, availablePackages: 3, activities: 5, ancillaryServices: 2 },
  },
  {
    label: 'Family Trip',
    emoji: '👨‍👩‍👧',
    description: 'Safety, amenities & organised packages',
    weights: { attraction: 3, accessibility: 4, amenities: 5, availablePackages: 4, activities: 3, ancillaryServices: 4 },
  },
  {
    label: 'History Buff',
    emoji: '🏛️',
    description: 'Cultural significance & unique attractions',
    weights: { attraction: 5, accessibility: 3, amenities: 2, availablePackages: 3, activities: 2, ancillaryServices: 3 },
  },
  {
    label: 'Budget Traveller',
    emoji: '💰',
    description: 'Accessible, easy to reach, good value packages',
    weights: { attraction: 3, accessibility: 5, amenities: 3, availablePackages: 5, activities: 3, ancillaryServices: 2 },
  },
  {
    label: 'Relaxed Explorer',
    emoji: '🌅',
    description: 'Comfort, scenery & support services',
    weights: { attraction: 4, accessibility: 3, amenities: 4, availablePackages: 3, activities: 2, ancillaryServices: 4 },
  },
]

// ---------------------------------------------------------------------------
// Filter — scope options
// ---------------------------------------------------------------------------
type FilterScope = 'all' | 'popular' | 'municipality'

const MUNICIPALITIES = [
  'Legazpi City', 'Ligao City', 'Tabaco City', 'Bacacay', 'Daraga',
  'Camalig', 'Guinobatan', 'Jovellar', 'Libon', 'Malinao', 'Malilipot',
  'Manito', 'Oas', 'Polangui', 'Pio Duran', 'Rapu Rapu', 'Tiwi', 'Sto. Domingo',
]

// ---------------------------------------------------------------------------
// WeightPicker — row of 5 pips, with unset (0) state
// ---------------------------------------------------------------------------
function WeightPicker({
  value, onChange, color,
}: { value: number; onChange: (v: number) => void; color: string }) {
  const labels = ['Low', '', 'Mid', '', 'High']
  return (
    <View style={wStyles.container}>
      <View style={wStyles.row}>
        {[1, 2, 3, 4, 5].map((pip) => (
          <TouchableOpacity
            key={pip}
            style={[
              wStyles.pip,
              value === 0 && wStyles.pipUnset,
              pip <= value && { backgroundColor: color, borderColor: color },
            ]}
            onPress={() => onChange(pip)}
            activeOpacity={0.75}
          >
            <Text style={[wStyles.pipTxt, pip <= value && { color: '#fff', fontFamily: Typography.bodySemiBold }]}>
              {pip}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {value === 0 && (
        <Text style={wStyles.tapHint}>Tap a number to rate this</Text>
      )}
    </View>
  )
}

const wStyles = StyleSheet.create({
  container: { gap: 4 },
  row: { flexDirection: 'row', gap: 6 },
  pip: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pipUnset: {
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  pipTxt: { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.textMuted },
  tapHint: {
    fontFamily: Typography.bodyFont, fontSize: 10,
    color: Colors.textMuted, fontStyle: 'italic',
  },
})

// ---------------------------------------------------------------------------
// CriterionBar — shows a site's score for one criterion as a filled bar
// ---------------------------------------------------------------------------
function CriterionBar({
  criterionKey, score, weight,
}: { criterionKey: keyof SixAs; score: number; weight: number }) {
  const meta  = CRITERIA_META[criterionKey]
  const color = TINTS[criterionKey] ?? Colors.primary
  const pct   = Math.min(1, Math.max(0, score / 5))
  const isHighPriority = weight >= 4
  const isLowPriority  = weight <= 2

  return (
    <View style={barStyles.row}>
      <Text style={barStyles.emoji}>{meta.emoji}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { flex: pct, backgroundColor: color }]} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={[barStyles.score, { color }]}>{score}/5</Text>
      {isHighPriority && <Text style={barStyles.priorityHigh}>↑</Text>}
      {isLowPriority  && <Text style={barStyles.priorityLow}>↓</Text>}
    </View>
  )
}

const barStyles = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 },
  emoji:        { fontSize: 13, width: 20 },
  track:        { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
  fill:         { height: 6, borderRadius: 3 },
  score:        { fontFamily: Typography.bodyMedium, fontSize: 11, width: 28, textAlign: 'right' },
  priorityHigh: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: '#1A7A4A', width: 12 },
  priorityLow:  { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textMuted, width: 12 },
})

// ---------------------------------------------------------------------------
// TOPSISAlgorithmPanel — transparent score breakdown
// ---------------------------------------------------------------------------
function TOPSISAlgorithmPanel({
  site, weights, allSites,
}: { site: RankedSite; weights: CriteriaWeights; allSites: RankedSite[] }) {

  const weightRows = CRITERIA_KEYS.map((k) => ({
    key: k,
    label: CRITERIA_META[k].label,
    emoji: CRITERIA_META[k].emoji,
    weight: weights[k],
    color: TINTS[k] ?? Colors.primary,
  }))

  const colNorms: Record<keyof SixAs, number> = {} as any
  CRITERIA_KEYS.forEach((k) => {
    const sumSq = allSites.reduce((acc, s) => acc + ((s as any)[k] ?? 0) ** 2, 0)
    colNorms[k] = Math.sqrt(sumSq) || 1
  })
  const weightedContribs = CRITERIA_KEYS.map((k) => {
    const normScore = ((site as any)[k] ?? 0) / colNorms[k]
    const contrib   = normScore * weights[k]
    return { key: k, contrib }
  })
  const maxContrib = Math.max(...weightedContribs.map((c) => c.contrib), 0.0001)

  const score    = site.topsisScore
  const total    = allSites.length
  const beaten   = allSites.filter((s) => s.topsisScore < score).length
  const pctLabel = `${Math.round(score * 100)}%`

  const minScore = Math.min(...allSites.map((s) => s.topsisScore))
  const maxScore = Math.max(...allSites.map((s) => s.topsisScore))
  const spectrumPct = maxScore === minScore
    ? 1
    : (score - minScore) / (maxScore - minScore)

  return (
    <View style={algoStyles.container}>
      <View style={algoStyles.divider} />
      <Text style={algoStyles.sectionHeader}>HOW THE SCORE WAS CALCULATED</Text>

      <View style={algoStyles.stepBlock}>
        <Text style={algoStyles.stepTitle}>① Your Priorities</Text>
        <Text style={algoStyles.stepDesc}>
          These are the importance levels you set. Higher weight = the algorithm
          valued this criterion more when ranking sites.
        </Text>
        <View style={algoStyles.weightGrid}>
          {weightRows.map(({ key, label, emoji, weight, color }) => (
            <View key={key} style={algoStyles.weightRow}>
              <Text style={algoStyles.weightEmoji}>{emoji}</Text>
              <Text style={algoStyles.weightLabel}>{label}</Text>
              <View style={algoStyles.pipStrip}>
                {[1,2,3,4,5].map((pip) => (
                  <View
                    key={pip}
                    style={[
                      algoStyles.pip,
                      pip <= weight && { backgroundColor: color },
                    ]}
                  />
                ))}
              </View>
              <Text style={[algoStyles.weightNum, { color }]}>{weight}/5</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={algoStyles.stepBlock}>
        <Text style={algoStyles.stepTitle}>② Weighted Contribution per Criterion</Text>
        <Text style={algoStyles.stepDesc}>
          Each bar shows how much a criterion actually pushed this site up the
          rankings — a combination of the site's raw score and your weight for it.
        </Text>
        {weightedContribs.map(({ key, contrib }) => {
          const color    = TINTS[key] ?? Colors.primary
          const fillFlex = contrib / maxContrib
          return (
            <View key={key} style={algoStyles.contribRow}>
              <Text style={algoStyles.contribEmoji}>{CRITERIA_META[key].emoji}</Text>
              <View style={algoStyles.contribTrack}>
                <View style={[algoStyles.contribFill, { flex: fillFlex, backgroundColor: color }]} />
                <View style={{ flex: 1 - fillFlex }} />
              </View>
              <Text style={[algoStyles.contribNum, { color }]}>
                {contrib.toFixed(3)}
              </Text>
            </View>
          )
        })}
        <Text style={algoStyles.contribNote}>
          Contribution = (site score ÷ column norm) × your weight
        </Text>
      </View>

      <View style={algoStyles.stepBlock}>
        <Text style={algoStyles.stepTitle}>③ Final Match Score</Text>
        <Text style={algoStyles.stepDesc}>
          TOPSIS measures how close this site is to the <Text style={algoStyles.emphasis}>ideal</Text> (best
          possible on all your priorities) versus how far it is from the{' '}
          <Text style={algoStyles.emphasis}>worst</Text>. The closer to ideal, the higher the score.
        </Text>

        <View style={algoStyles.spectrumWrap}>
          <Text style={algoStyles.spectrumEndLabel}>Worst</Text>
          <View style={algoStyles.spectrumTrack}>
            <View style={[algoStyles.spectrumFill, { flex: spectrumPct }]} />
            <View style={algoStyles.spectrumDot} />
            <View style={{ flex: Math.max(0, 1 - spectrumPct) }} />
          </View>
          <Text style={algoStyles.spectrumEndLabel}>Best</Text>
        </View>

        <Text style={algoStyles.closenessPlain}>
          This site scored{' '}<Text style={algoStyles.closenessScore}>{pctLabel}</Text> — it
          was closer to ideal than{'  '}
          <Text style={algoStyles.closenessScore}>{beaten} out of {total}</Text>{'  '}
          sites based on your priorities.
        </Text>
      </View>

    </View>
  )
}

const algoStyles = StyleSheet.create({
  container:        { marginTop: 6 },
  divider:          { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  sectionHeader:    {
    fontFamily: Typography.bodySemiBold, fontSize: 9,
    color: Colors.textMuted, letterSpacing: 1.3,
    marginBottom: 6,
  },
  stepBlock:        { marginBottom: 10 },
  stepTitle:        { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textPrimary, marginBottom: 3 },
  stepDesc:         { fontFamily: Typography.bodyFont, fontSize: 11, color: Colors.textMuted, lineHeight: 16, marginBottom: 6 },
  emphasis:         { fontFamily: Typography.bodyMedium, color: Colors.textSecondary },

  weightGrid:       { gap: 4 },
  weightRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightEmoji:      { fontSize: 12, width: 18 },
  weightLabel:      { fontFamily: Typography.bodyFont, fontSize: 11, color: Colors.textSecondary, flex: 1 },
  pipStrip:         { flexDirection: 'row', gap: 3 },
  pip:              { width: 8, height: 8, borderRadius: 2, backgroundColor: Colors.border },
  weightNum:        { fontFamily: Typography.bodySemiBold, fontSize: 11, width: 24, textAlign: 'right' },

  contribRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 },
  contribEmoji:     { fontSize: 12, width: 18 },
  contribTrack:     {
    flex: 1, height: 5, borderRadius: 3,
    backgroundColor: Colors.border, overflow: 'hidden', flexDirection: 'row',
  },
  contribFill:      { height: 5, borderRadius: 3 },
  contribNum:       { fontFamily: Typography.bodyMedium, fontSize: 10, width: 36, textAlign: 'right' },
  contribNote:      { fontFamily: Typography.bodyFont, fontSize: 9, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },

  spectrumWrap:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  spectrumEndLabel: { fontFamily: Typography.bodyFont, fontSize: 9, color: Colors.textMuted, flexShrink: 0 },
  spectrumTrack:    {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', overflow: 'visible',
  },
  spectrumFill:     { height: 8, backgroundColor: Colors.primary + '40', borderRadius: 4 },
  spectrumDot:      {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.bgCard,
    marginHorizontal: -7, zIndex: 2,
  },
  closenessPlain:   { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  closenessScore:   { fontFamily: Typography.bodySemiBold, color: Colors.primary },
})

// ---------------------------------------------------------------------------
// AI summary
// ---------------------------------------------------------------------------
async function generateSummary(results: RankedSite[], weights: CriteriaWeights): Promise<string> {
  const prioritized = CRITERIA_KEYS.slice().sort((a, b) => weights[b] - weights[a])
  const high = prioritized.filter((k) => weights[k] >= 4).map((k) => CRITERIA_META[k].label)
  const low  = prioritized.filter((k) => weights[k] <= 2).map((k) => CRITERIA_META[k].label)

  const top3 = results.slice(0, 3)
  const siteDetails = top3
    .map((s, i) => {
      const scores = CRITERIA_KEYS
        .map((k) => `${CRITERIA_META[k].label}: ${(s as any)[k] ?? 0}/5`)
        .join(', ')
      const reviewNote = s.avgReviewScore
        ? `tourist avg ${s.avgReviewScore.toFixed(1)}/5 from ${(s as any).reviewCount ?? 0} reviews`
        : 'no tourist reviews yet'
      return `${i + 1}. ${s.name} — match score ${(s.topsisScore * 100).toFixed(1)}%; ${reviewNote}; 6A scores: ${scores}`
    })
    .join('\n')

  const allNames = results.map((s, i) => `${i + 1}. ${s.name}`).join(', ')

  const prompt = `You are a knowledgeable and enthusiastic tourism guide for Albay, Bicol, Philippines. A visitor has just received personalised destination recommendations based on the 6A tourism framework (Attractions, Accessibility, Amenities, Available Packages, Activities, Ancillary Services).

Their stated priorities:
- Highly important (4–5/5): ${high.length > 0 ? high.join(', ') : 'none specified'}
- Less important (1–2/5): ${low.length > 0 ? low.join(', ') : 'none'}

Top 3 recommended destinations with scores and tourist feedback:
${siteDetails}

Full top 10: ${allNames}

Write a warm, personal 3–4 sentence paragraph explaining why these destinations rose to the top. Be specific — name the #1 destination and at least one runner-up. Tie their strengths directly to what the visitor said they care about most. Where a site has tourist reviews, naturally weave in that real visitors agree (or flag if no reviews yet). Reference real qualities of Albay destinations (volcanic scenery, Mayon views, beach life, historical sites, adventure activities, local food) where appropriate. Do not mention distance. Sound like a friend who knows Albay well, not a travel brochure.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    const text = data.content?.map((c: any) => c.text ?? '').join('') ?? ''
    return text.trim() || fallbackSummary(results, weights)
  } catch {
    return fallbackSummary(results, weights)
  }
}

function fallbackSummary(results: RankedSite[], weights: CriteriaWeights): string {
  const top     = CRITERIA_KEYS.slice().sort((a, b) => weights[b] - weights[a])
  const high    = top.filter((k) => weights[k] >= 4).map((k) => CRITERIA_META[k].label.toLowerCase())
  const topSite = results[0]?.name ?? 'your top pick'
  const second  = results[1]?.name
  const phrase  = high.length > 0
    ? `your emphasis on ${high.slice(0, 2).join(' and ')}`
    : 'your balanced priorities across all criteria'
  return `Based on ${phrase}, ${topSite} came out on top — it scored exceptionally well on the factors you care about most.${second ? ` ${second} followed closely behind as a strong match.` : ''} These ${results.length} destinations were ranked purely on how well they align with your 6A preferences.`
}

// ---------------------------------------------------------------------------
// Progress indicator for criteria step
// ---------------------------------------------------------------------------
function CriteriaProgress({ weights }: { weights: CriteriaWeights }) {
  const rated = CRITERIA_KEYS.filter((k) => weights[k] > 0).length
  const total = CRITERIA_KEYS.length
  const allDone = rated === total

  return (
    <View style={progStyles.container}>
      <View style={progStyles.track}>
        <View style={[progStyles.fill, { flex: rated / total }, allDone && progStyles.fillDone]} />
        <View style={{ flex: 1 - rated / total }} />
      </View>
      <Text style={[progStyles.label, allDone && progStyles.labelDone]}>
        {allDone ? '✓ All rated — ready to find your matches!' : `${rated} of ${total} rated`}
      </Text>
    </View>
  )
}

const progStyles = StyleSheet.create({
  container: { gap: 6 },
  track: {
    height: 4, borderRadius: 2,
    backgroundColor: Colors.border, flexDirection: 'row', overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: Colors.primary + '70' },
  fillDone: { backgroundColor: '#1A7A4A' },
  label: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },
  labelDone: { color: '#1A7A4A', fontFamily: Typography.bodyMedium },
})

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function RecommendScreen() {
  const { setPendingDirectionsSiteId } = useMapStore()

  const [step,           setStep]           = useState<Step>('criteria')
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)

  // All weights start at 0 — no defaults, user must actively choose
  const [weights, setWeights] = useState<CriteriaWeights>({
    attraction: 0, accessibility: 0, amenities: 0,
    availablePackages: 0, activities: 0, ancillaryServices: 0,
  })

  const [results,        setResults]        = useState<RankedSite[]>([])
  const [summary,        setSummary]        = useState('')
  const [loading,        setLoading]        = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [expandedId,          setExpandedId]          = useState<string | number | null>(null)
  const [algorithmExpandedId, setAlgorithmExpandedId] = useState<string | number | null>(null)

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterScope,        setFilterScope]        = useState<FilterScope>('all')
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null)
  const [showMunicipalityPicker, setShowMunicipalityPicker] = useState(false)

  // How many criteria have been rated
  const ratedCount = CRITERIA_KEYS.filter((k) => weights[k] > 0).length
  const allRated   = ratedCount === CRITERIA_KEYS.length

  // ── Apply preset ─────────────────────────────────────────────────────────
  function applyPreset(index: number) {
    setSelectedPreset(index)
    setWeights(PRESETS[index].weights)
  }

  // ── Reset to blank ───────────────────────────────────────────────────────
  function resetWeights() {
    setSelectedPreset(null)
    setWeights({
      attraction: 0, accessibility: 0, amenities: 0,
      availablePackages: 0, activities: 0, ancillaryServices: 0,
    })
  }

  // ── Run TOPSIS ───────────────────────────────────────────────────────────
  async function handleRunTOPSIS() {
    setLoading(true)
    setError(null)
    // Use weight of 1 for any unset criteria (treat as neutral)
    const effectiveWeights: CriteriaWeights = {
      attraction:        weights.attraction        || 1,
      accessibility:     weights.accessibility     || 1,
      amenities:         weights.amenities         || 1,
      availablePackages: weights.availablePackages || 1,
      activities:        weights.activities        || 1,
      ancillaryServices: weights.ancillaryServices || 1,
    }
    try {
      const landmarks = await fetchLandmarksForTOPSIS()
      if (landmarks.length === 0) {
        setError('No destination data found. Please try again later.')
        setLoading(false)
        return
      }

      // ── Apply scope filter ───────────────────────────────────────────────
      let filtered = landmarks
      if (filterScope === 'popular') {
        filtered = landmarks.filter((l: any) => l.is_popular === true || l.isPopular === true)
      } else if (filterScope === 'municipality' && selectedMunicipality) {
        filtered = landmarks.filter((l: any) =>
          (l.city ?? '').trim().toLowerCase() === selectedMunicipality.trim().toLowerCase()
        )
      }

      if (filtered.length === 0) {
        const scopeLabel =
          filterScope === 'popular'
            ? 'popular destinations'
            : filterScope === 'municipality' && selectedMunicipality
            ? selectedMunicipality
            : 'the selected filter'
        setError(`No destinations found for ${scopeLabel}. Try a different filter.`)
        setLoading(false)
        return
      }

      const ranked = runTOPSIS(filtered, effectiveWeights, 10)
      setResults(ranked)
      setStep('results')
      setSummaryLoading(true)
      generateSummary(ranked, effectiveWeights).then((text) => {
        setSummary(text)
        setSummaryLoading(false)
      })
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Medal emoji for top 3 ────────────────────────────────────────────────
  function rankEmoji(rank: number): string {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  // ── Criteria step ────────────────────────────────────────────────────────
  function renderCriteria() {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero onboarding banner ── */}
        <View style={styles.heroBanner}>
          <Text style={styles.heroTitle}>Find Your Perfect Destination</Text>
          <Text style={styles.heroBody}>
            Tell us what matters most to you — we'll rank every destination in Albay to find your ideal match using the 6A Tourism Framework.
          </Text>
          <View style={styles.heroSteps}>
            <View style={styles.heroStep}>
              <View style={styles.heroStepNum}><Text style={styles.heroStepNumTxt}>1</Text></View>
              <Text style={styles.heroStepTxt}>Pick a travel style or rate each factor yourself</Text>
            </View>
            <View style={styles.heroStep}>
              <View style={styles.heroStepNum}><Text style={styles.heroStepNumTxt}>2</Text></View>
              <Text style={styles.heroStepTxt}>We run the algorithm and surface your top 10</Text>
            </View>
            <View style={styles.heroStep}>
              <View style={styles.heroStepNum}><Text style={styles.heroStepNumTxt}>3</Text></View>
              <Text style={styles.heroStepTxt}>Explore results with scores, reviews & directions</Text>
            </View>
          </View>
        </View>

        {/* ── Filter scope ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabelTxt}>FILTER DESTINATIONS</Text>
          <Text style={styles.sectionSub}>Narrow down which destinations to rank</Text>
        </View>

        <View style={filterStyles.scopeRow}>
          {([
            { scope: 'all'          as FilterScope, label: '🌏 All',       sub: 'All destinations' },
            { scope: 'popular'      as FilterScope, label: '⭐ Popular',    sub: 'Marked as popular' },
            { scope: 'municipality' as FilterScope, label: '📍 By City',   sub: 'Pick a municipality' },
          ] as { scope: FilterScope; label: string; sub: string }[]).map(({ scope, label, sub }) => (
            <TouchableOpacity
              key={scope}
              style={[filterStyles.scopeBtn, filterScope === scope && filterStyles.scopeBtnActive]}
              onPress={() => {
                setFilterScope(scope)
                if (scope !== 'municipality') setShowMunicipalityPicker(false)
                else setShowMunicipalityPicker(true)
              }}
              activeOpacity={0.8}
            >
              <Text style={[filterStyles.scopeLabel, filterScope === scope && filterStyles.scopeLabelActive]}>
                {label}
              </Text>
              <Text style={filterStyles.scopeSub}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Municipality picker */}
        {filterScope === 'municipality' && (
          <View style={filterStyles.municipalityWrap}>
            <TouchableOpacity
              style={filterStyles.municipalityToggle}
              onPress={() => setShowMunicipalityPicker((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={filterStyles.municipalityToggleTxt}>
                {selectedMunicipality ? `📍 ${selectedMunicipality}` : '📍 Select a municipality…'}
              </Text>
              <Text style={filterStyles.municipalityChevron}>
                {showMunicipalityPicker ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {showMunicipalityPicker && (
              <View style={filterStyles.municipalityList}>
                {MUNICIPALITIES.map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={[
                      filterStyles.municipalityItem,
                      selectedMunicipality === city && filterStyles.municipalityItemActive,
                    ]}
                    onPress={() => {
                      setSelectedMunicipality(city)
                      setShowMunicipalityPicker(false)
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[
                      filterStyles.municipalityItemTxt,
                      selectedMunicipality === city && filterStyles.municipalityItemTxtActive,
                    ]}>
                      {city}
                    </Text>
                    {selectedMunicipality === city && (
                      <Text style={filterStyles.municipalityCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Preset profiles ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabelTxt}>QUICK START — CHOOSE YOUR TRAVEL STYLE</Text>
          <Text style={styles.sectionSub}>Don't want to set each factor? Pick a profile that fits you.</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
        >
          {PRESETS.map((preset, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.presetCard, selectedPreset === i && styles.presetCardActive]}
              onPress={() => applyPreset(i)}
              activeOpacity={0.8}
            >
              {selectedPreset === i && (
                <View style={styles.presetCheckmark}>
                  <Text style={styles.presetCheckmarkTxt}>✓</Text>
                </View>
              )}
              <Text style={styles.presetEmoji}>{preset.emoji}</Text>
              <Text style={[styles.presetLabel, selectedPreset === i && styles.presetLabelActive]}>
                {preset.label}
              </Text>
              <Text style={styles.presetDesc}>{preset.description}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Divider with "or" ── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerTxt}>or fine-tune below</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Section: manual criteria ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabelTxt}>RATE EACH FACTOR — 1 (Low) to 5 (High)</Text>
              <Text style={styles.sectionSub}>How much does this matter for your ideal trip?</Text>
            </View>
            {selectedPreset !== null || ratedCount > 0 ? (
              <TouchableOpacity onPress={resetWeights} style={styles.clearBtn}>
                <Text style={styles.clearBtnTxt}>Clear all</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Progress bar */}
        <CriteriaProgress weights={weights} />

        {CRITERIA_KEYS.map((key) => {
          const meta  = CRITERIA_META[key]
          const color = TINTS[key] ?? Colors.primary
          const isRated = weights[key] > 0
          return (
            <View
              key={key}
              style={[styles.criteriaRow, !isRated && styles.criteriaRowUnset]}
            >
              <View style={styles.criteriaLabel}>
                <View style={[styles.criteriaIconBox, { backgroundColor: color + '18' }]}>
                  <Text style={styles.criteriaEmoji}>{meta.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.criteriaName}>{meta.label}</Text>
                  <Text style={styles.criteriaDesc}>{meta.description}</Text>
                </View>
                {isRated ? (
                  <Text style={[styles.criteriaValue, { color }]}>{weights[key]}/5</Text>
                ) : (
                  <Text style={styles.criteriaValueUnset}>—</Text>
                )}
              </View>
              <WeightPicker
                value={weights[key]}
                onChange={(v) => {
                  setSelectedPreset(null)
                  setWeights((prev) => ({ ...prev, [key]: v }))
                }}
                color={color}
              />
            </View>
          )
        })}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        )}

        {/* CTA — disabled hint when nothing is rated */}
        {!allRated && ratedCount === 0 && (
          <View style={styles.ctaHint}>
            <Text style={styles.ctaHintTxt}>
              💡 Pick a travel style above or rate at least one factor to get started
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            (loading || ratedCount === 0) && styles.primaryBtnDisabled,
          ]}
          onPress={handleRunTOPSIS}
          disabled={loading || ratedCount === 0}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <View style={styles.primaryBtnInner}>
                <Text style={styles.primaryBtnTxt}>Find My Top 10</Text>
                {!allRated && ratedCount > 0 && (
                  <Text style={styles.primaryBtnSub}>Unrated factors treated as neutral</Text>
                )}
              </View>
            )
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    )
  }

  // ── Results step ──────────────────────────────────────────────────────────
  function renderResults() {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>✦  Why these 10?</Text>
          {summaryLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.summaryGenerating}>Generating insight…</Text>
            </View>
          ) : (
            <Text style={styles.summaryTxt}>{summary}</Text>
          )}
        </View>

        {/* Result cards */}
        {results.map((site) => {
          const isExpanded = expandedId === site.id
          const matchPct   = Math.round(site.topsisScore * 100)
          const hasImg     = !!(site as any).imageUrl
          const reviewCount = (site as any).reviewCount ?? 0
          const avgReview   = site.avgReviewScore

          return (
            <View key={site.id} style={styles.resultCard}>

              {/* ── Hero thumbnail ── */}
              {hasImg ? (
                <Image
                  source={{ uri: (site as any).imageUrl }}
                  style={styles.resultImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.resultImagePlaceholder}>
                  <Text style={{ fontSize: 28, opacity: 0.3 }}>🏔️</Text>
                </View>
              )}

              <View style={styles.resultBody}>

                {/* ── Rank + name + match chip ── */}
                <View style={styles.resultHeader}>
                  <Text style={styles.rankEmoji}>{rankEmoji(site.rank)}</Text>
                  <Text style={styles.resultName} numberOfLines={1}>{site.name}</Text>
                  <View style={[
                    styles.scoreChip,
                    matchPct >= 80 && styles.scoreChipHigh,
                    matchPct < 60  && styles.scoreChipLow,
                  ]}>
                    <Text style={[
                      styles.scoreTxt,
                      matchPct >= 80 && styles.scoreTxtHigh,
                      matchPct < 60  && styles.scoreTxtLow,
                    ]}>
                      {matchPct}% Match
                    </Text>
                  </View>
                </View>

                {/* ── Tourist consensus badge ── */}
                {reviewCount > 0 && avgReview ? (
                  <View style={styles.consensusBadge}>
                    <Text style={styles.consensusTxt}>
                      ⭐ {avgReview.toFixed(1)}  ·  {reviewCount} tourist{reviewCount !== 1 ? 's' : ''} reviewed
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noReviewTxt}>No tourist reviews yet — expert data only</Text>
                )}

                {/* ── Short description ── */}
                {(site as any).shortDescription ? (
                  <Text style={styles.resultDesc} numberOfLines={2}>
                    {(site as any).shortDescription}
                  </Text>
                ) : null}

                {/* ── Per-criterion breakdown toggle ── */}
                <TouchableOpacity
                  style={styles.breakdownToggle}
                  onPress={() => setExpandedId(isExpanded ? null : site.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.breakdownToggleTxt}>
                    {isExpanded ? '▲ Hide breakdown' : '▼ See score breakdown'}
                  </Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.breakdownPanel}>
                    <Text style={styles.breakdownNote}>
                      ↑ = your high priority  ·  ↓ = your low priority
                    </Text>
                    {CRITERIA_KEYS.map((k) => (
                      <CriterionBar
                        key={k}
                        criterionKey={k}
                        score={(site as any)[k] ?? 0}
                        weight={weights[k]}
                      />
                    ))}
                    {reviewCount > 0 && (
                      <Text style={styles.breakdownConsensusNote}>
                        🗳️ Tourist consensus has shaped these scores ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                      </Text>
                    )}

                    {/* ── TOPSIS algorithm panel toggle ── */}
                    <TouchableOpacity
                      style={styles.algoToggle}
                      onPress={() =>
                        setAlgorithmExpandedId(
                          algorithmExpandedId === site.id ? null : site.id
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.algoToggleTxt}>
                        {algorithmExpandedId === site.id
                          ? '▲ Hide calculation'
                          : '🔬 How was this calculated?'}
                      </Text>
                    </TouchableOpacity>

                    {algorithmExpandedId === site.id && (
                      <TOPSISAlgorithmPanel
                        site={site}
                        weights={weights}
                        allSites={results}
                      />
                    )}
                  </View>
                )}

                {/* ── Actions ── */}
                <View style={styles.resultActions}>
                  <TouchableOpacity
                    style={styles.directionsBtn}
                    onPress={() => {
                      setPendingDirectionsSiteId(String(site.id))
                      // FIX (Issue 5 & 6): router.back() resumes the already-mounted
                      // map tab so userLocation is still live when the pending
                      // directions effect fires. router.push('/(tabs)/') would
                      // remount the map fresh — userLocation starts null and the
                      // route silently fails.
                      if (router.canGoBack()) {
                        router.back()
                      } else {
                        router.replace('/(tabs)/')
                      }
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

        {/* Rate results button */}
        <TouchableOpacity
          style={styles.rateBtn}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/rate',
              params: {
                results: JSON.stringify(results),
                weights: JSON.stringify(weights),
              },
            })
          }
          activeOpacity={0.8}
        >
          <Text style={styles.rateBtnTxt}>⭐  Rate These Results</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    )
  }

  // ── Shell ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {step === 'criteria' ? 'Recommend' : 'Your Top 10 Picks'}
          </Text>
          {step === 'results' && (
            <Text style={styles.headerSub}>
              Ranked by TOPSIS · {
                filterScope === 'popular'
                  ? 'Popular destinations only'
                  : filterScope === 'municipality' && selectedMunicipality
                  ? selectedMunicipality
                  : 'All destinations'
              }
            </Text>
          )}
        </View>

        {step === 'results' && (
          <TouchableOpacity
            style={styles.restartBtn}
            onPress={() => {
              setStep('criteria')
              setResults([])
              setSummary('')
              setError(null)
              setExpandedId(null)
              resetWeights()
              setFilterScope('all')
              setSelectedMunicipality(null)
              setShowMunicipalityPicker(false)
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.restartTxt}>Redo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {step === 'criteria' && renderCriteria()}
        {step === 'results'  && renderResults()}
      </View>
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
  restartBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.md, backgroundColor: Colors.bg,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  restartTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textSecondary },

  content: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md },

  // ── Hero onboarding banner ──
  heroBanner: {
    backgroundColor: Colors.primary + '0C',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    gap: Spacing.sm,
  },
  heroTitle: {
    fontFamily: Typography.displayFont, fontSize: 18,
    color: Colors.textPrimary, letterSpacing: -0.3,
  },
  heroBody: {
    fontFamily: Typography.bodyFont, fontSize: 13,
    color: Colors.textSecondary, lineHeight: 19,
  },
  heroSteps: { gap: 6, marginTop: 2 },
  heroStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  heroStepNum: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  heroStepNumTxt: {
    fontFamily: Typography.bodySemiBold, fontSize: 11,
    color: '#fff',
  },
  heroStepTxt: {
    fontFamily: Typography.bodyFont, fontSize: 12,
    color: Colors.textSecondary, lineHeight: 18, flex: 1,
  },

  // ── Section labels ──
  sectionHeader: { gap: 3 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  sectionLabelTxt: {
    fontFamily: Typography.bodySemiBold, fontSize: 10,
    color: Colors.textMuted, letterSpacing: 1.2,
  },
  sectionSub: {
    fontFamily: Typography.bodyFont, fontSize: 12,
    color: Colors.textMuted,
  },

  // ── Divider ──
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerTxt: {
    fontFamily: Typography.bodyFont, fontSize: 12,
    color: Colors.textMuted, flexShrink: 0,
  },

  // ── Clear button ──
  clearBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  clearBtnTxt: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textMuted },

  // ── CTA hint ──
  ctaHint: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  ctaHintTxt: {
    fontFamily: Typography.bodyFont, fontSize: 13,
    color: Colors.textMuted, textAlign: 'center', lineHeight: 18,
  },

  // ── Preset cards ──
  presetRow: { gap: 10, paddingBottom: 4, paddingRight: Spacing.lg },
  presetCard: {
    width: 140,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 4,
  },
  presetCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '0A',
  },
  presetEmoji: { fontSize: 22 },
  presetLabel: {
    fontFamily: Typography.bodySemiBold, fontSize: 13,
    color: Colors.textPrimary,
  },
  presetLabelActive: { color: Colors.primary },
  presetDesc: {
    fontFamily: Typography.bodyFont, fontSize: 11,
    color: Colors.textMuted, lineHeight: 15,
  },
  presetCheckmark: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  presetCheckmarkTxt: {
    fontFamily: Typography.bodySemiBold, fontSize: 10, color: '#fff',
  },

  // ── Criteria rows ──
  criteriaRow: {
    gap: Spacing.sm, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  criteriaRowUnset: {
    borderColor: Colors.border,
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  criteriaLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  criteriaIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  criteriaEmoji: { fontSize: 18 },
  criteriaName: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  criteriaDesc: { fontFamily: Typography.bodyFont, fontSize: 11, color: Colors.textMuted, lineHeight: 15 },
  criteriaValue: { fontFamily: Typography.bodySemiBold, fontSize: 14 },
  criteriaValueUnset: {
    fontFamily: Typography.bodySemiBold, fontSize: 14,
    color: Colors.border,
  },

  // ── Error ──
  errorBox: {
    backgroundColor: Colors.errorLight, borderRadius: Radius.md,
    padding: Spacing.sm, borderWidth: 1, borderColor: '#F5C6C1',
  },
  errorTxt: { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.error, textAlign: 'center' },

  // ── CTA button ──
  primaryBtn: {
    minHeight: 52, backgroundColor: Colors.primary,
    borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5, marginTop: Spacing.sm,
    paddingVertical: 10,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnInner: { alignItems: 'center', gap: 2 },
  primaryBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 16, color: Colors.textInverse, letterSpacing: 0.3 },
  primaryBtnSub: { fontFamily: Typography.bodyFont, fontSize: 11, color: Colors.textInverse + 'BB' },

  // ── AI summary ──
  summaryBox: {
    backgroundColor: Colors.primary + '0E', borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary + '25',
  },
  summaryLabel: {
    fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.primary,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  },
  summaryGenerating: { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.textMuted },
  summaryTxt: { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  // ── Result cards ──
  resultCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  resultImage: { width: '100%', height: 130 },
  resultImagePlaceholder: {
    width: '100%', height: 130,
    backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  resultBody: { padding: Spacing.md, gap: 6 },

  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rankEmoji: { fontSize: 18, flexShrink: 0 },
  resultName: {
    fontFamily: Typography.bodySemiBold, fontSize: 15,
    color: Colors.textPrimary, flex: 1,
  },

  scoreChip: {
    backgroundColor: Colors.primary + '15', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  scoreChipHigh: { backgroundColor: '#1A7A4A20' },
  scoreChipLow:  { backgroundColor: Colors.errorLight },
  scoreTxt:      { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.primary, letterSpacing: 0.3 },
  scoreTxtHigh:  { color: '#1A7A4A' },
  scoreTxtLow:   { color: Colors.error },

  consensusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#8B691415',
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  consensusTxt: { fontFamily: Typography.bodyMedium, fontSize: 11, color: '#8B6914' },
  noReviewTxt:  { fontFamily: Typography.bodyFont,   fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

  resultDesc: {
    fontFamily: Typography.bodyFont, fontSize: 12,
    color: Colors.textSecondary, lineHeight: 17,
  },

  breakdownToggle: { marginTop: 2 },
  breakdownToggleTxt: {
    fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.primary,
  },
  breakdownPanel: {
    marginTop: 4,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  breakdownNote: {
    fontFamily: Typography.bodyFont, fontSize: 10,
    color: Colors.textMuted, marginBottom: 4,
  },
  breakdownConsensusNote: {
    fontFamily: Typography.bodyFont, fontSize: 11,
    color: '#8B6914', marginTop: 6, lineHeight: 16,
  },

  algoToggle: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  algoToggleTxt: {
    fontFamily: Typography.bodyMedium, fontSize: 12,
    color: Colors.textMuted,
  },

  resultActions: { flexDirection: 'row', gap: 8, marginTop: Spacing.xs },
  directionsBtn: {
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1, borderColor: Colors.primary + '40',
  },
  directionsBtnTxt: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.primary },

  rateBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  rateBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 16, color: Colors.textInverse, letterSpacing: 0.3 },
})

// ---------------------------------------------------------------------------
// Filter styles
// ---------------------------------------------------------------------------
const filterStyles = StyleSheet.create({
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopeBtn: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 2,
    alignItems: 'center',
  },
  scopeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '0A',
  },
  scopeLabel: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  scopeLabelActive: {
    color: Colors.primary,
  },
  scopeSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 14,
  },

  municipalityWrap: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
  municipalityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 8,
  },
  municipalityToggleTxt: {
    flex: 1,
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  municipalityChevron: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    color: Colors.textMuted,
  },
  municipalityList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  municipalityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '60',
  },
  municipalityItemActive: {
    backgroundColor: Colors.primary + '0A',
  },
  municipalityItemTxt: {
    flex: 1,
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  municipalityItemTxtActive: {
    fontFamily: Typography.bodyMedium,
    color: Colors.primary,
  },
  municipalityCheck: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: Colors.primary,
  },
})
