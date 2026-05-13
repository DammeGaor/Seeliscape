// ---------------------------------------------------------------------------
// Technique for Order of Preference by Similarity to Ideal Solution (TOPSIS) Calculations
// ---------------------------------------------------------------------------

export interface SixAs {
  attraction: number
  accessibility: number
  amenities: number
  availablePackages: number
  activities: number
  ancillaryServices: number
}

export type CriteriaWeights = SixAs // user-supplied weights (1–5 scale)

export interface LandmarkRow {
  id: string | number
  name: string
  category: string
  barangay: string
  municipality: string
  description: string
  shortDescription: string
  latitude: number
  longitude: number
  unlockRadiusMeters?: number
  imageUrl?: string
  // 6A scores (admin-supplied, e.g. 1–5 or 1–10)
  attraction: number
  accessibility: number
  amenities: number
  availablePackages: number
  activities: number
  ancillaryServices: number
  // Aggregated from reviews (optional — used when available)
  avgReviewScore?: number | null
}

export interface RankedSite extends LandmarkRow {
  distanceMeters: number
  topsisScore: number       // 0–1, higher = better
  rank: number
}

// ---------------------------------------------------------------------------
// CRITERIA KEYS — in order
// ---------------------------------------------------------------------------
const CRITERIA_KEYS: (keyof SixAs)[] = [
  'attraction',
  'accessibility',
  'amenities',
  'availablePackages',
  'activities',
  'ancillaryServices',
]

// ---------------------------------------------------------------------------
// runTOPSIS
//
// Steps:
//   1. Build raw decision matrix (6A scores + proximity score)
//   2. Normalize each column (vector normalization)
//   3. Apply user weights
//   4. Find Positive Ideal Solution (PIS) and Negative Ideal Solution (NIS)
//   5. Calculate separation distances from PIS and NIS
//   6. Compute closeness coefficient Ci = d- / (d+ + d-)
//   7. Rank descending by Ci, return top `topN`
// ---------------------------------------------------------------------------
export function runTOPSIS(
  landmarks: LandmarkRow[],
  weights: CriteriaWeights,
  topN?: number,
): RankedSite[] {
  if (landmarks.length === 0) return []

  // ── Step 1: build raw matrix — purely 6A criteria scores ──────────────────
  // Each row: [attraction, accessibility, amenities, availablePackages, activities, ancillaryServices]
  const rawMatrix: number[][] = landmarks.map((lm) => [
    lm.attraction,
    lm.accessibility,
    lm.amenities,
    lm.availablePackages,
    lm.activities,
    lm.ancillaryServices,
  ])

  // ── Step 2: normalise each column (Euclidean vector normalisation) ──────────
  const numCols = rawMatrix[0].length
  const colNorms: number[] = Array(numCols).fill(0)

  rawMatrix.forEach((row) => {
    row.forEach((val, j) => {
      colNorms[j] += val * val
    })
  })
  colNorms.forEach((_, j) => {
    colNorms[j] = Math.sqrt(colNorms[j]) || 1
  })

  const normMatrix: number[][] = rawMatrix.map((row) =>
    row.map((val, j) => val / colNorms[j])
  )

  // ── Step 3: apply user weights (1–5 scale, purely 6A) ─────────────────────
  const colWeights: number[] = [
    weights.attraction,
    weights.accessibility,
    weights.amenities,
    weights.availablePackages,
    weights.activities,
    weights.ancillaryServices,
  ]

  const weightedMatrix: number[][] = normMatrix.map((row) =>
    row.map((val, j) => val * colWeights[j])
  )

  // ── Step 4: PIS and NIS ───────────────────────────────────────────────────
  // All columns are benefit criteria (higher = better)
  const PIS: number[] = Array(numCols).fill(-Infinity)
  const NIS: number[] = Array(numCols).fill(Infinity)

  weightedMatrix.forEach((row) => {
    row.forEach((val, j) => {
      if (val > PIS[j]) PIS[j] = val
      if (val < NIS[j]) NIS[j] = val
    })
  })

  // ── Step 5 & 6: separation distances + closeness coefficient ──────────────
  const scores: number[] = weightedMatrix.map((row) => {
    const dPlus = Math.sqrt(row.reduce((sum, val, j) => sum + (val - PIS[j]) ** 2, 0))
    const dMinus = Math.sqrt(row.reduce((sum, val, j) => sum + (val - NIS[j]) ** 2, 0))
    const denominator = dPlus + dMinus
    return denominator === 0 ? 0 : dMinus / denominator
  })

  // ── Step 7: rank and return (all sites, or top N if specified) ────────────
  const sorted = landmarks
    .map((lm, i) => ({ ...lm, distanceMeters: 0, topsisScore: scores[i] }))
    .sort((a, b) => b.topsisScore - a.topsisScore)

  const sliced = topN ? sorted.slice(0, topN) : sorted

  return sliced.map((lm, i) => ({ ...lm, rank: i + 1 }))
}

// ---------------------------------------------------------------------------
// Criteria metadata (for UI rendering)
// ---------------------------------------------------------------------------
export const CRITERIA_META: Record<
  keyof SixAs,
  { label: string; description: string; emoji: string }
> = {
  attraction: {
    label: 'Attraction',
    description: 'Natural beauty, cultural significance, uniqueness',
    emoji: '✨',
  },
  accessibility: {
    label: 'Accessibility',
    description: 'Ease of getting there — roads, transport, terrain',
    emoji: '🛣️',
  },
  amenities: {
    label: 'Amenities',
    description: 'Facilities like restrooms, food stalls, accommodation',
    emoji: '🏪',
  },
  availablePackages: {
    label: 'Packages',
    description: 'Tour packages, group deals, guided experiences',
    emoji: '🎒',
  },
  activities: {
    label: 'Activities',
    description: 'Things to do — hiking, swimming, cultural experiences',
    emoji: '🏄',
  },
  ancillaryServices: {
    label: 'Ancillary Services',
    description: 'Support services — guides, info centres, safety',
    emoji: '🛎️',
  },
}
