// ---------------------------------------------------------------------------
// recommendations.service.ts
//
// Handles tourist reviews and dynamic 6A score blending.
//
// Blending strategy:
//   Tourists rate each of the 6A criteria individually (1–5).
//   Each criterion's tourist average is blended independently with its
//   expert score. Poor accessibility reported by tourists drags down only
//   accessibility — great activities ratings lift only activities.
//
//   blended[k] = (expertWeight × expert[k]) + (touristWeight × touristAvg[k])
//
//   expertWeight  = max(0.4, 1 − (reviewCount / (reviewCount + TRUST_K)))
//   touristWeight = 1 − expertWeight
//   TRUST_K = 10  → tourist consensus reaches 50% influence at ~10 reviews
// ---------------------------------------------------------------------------

import { supabase } from './supabase'
import { LandmarkRow } from './topsis.service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CriterionRatings {
  attraction: number | null
  accessibility: number | null
  amenities: number | null
  availablePackages: number | null
  activities: number | null
  ancillaryServices: number | null
}

export interface SiteReview {
  site_id: string
  user_id: string
  visited: boolean
  ratings: CriterionRatings
  comment: string | null
  visited_at: string | null
}

export interface ReviewRecord {
  id: string
  site_id: string
  user_id: string
  visited: boolean
  rating_attraction: number | null
  rating_accessibility: number | null
  rating_amenities: number | null
  rating_available_packages: number | null
  rating_activities: number | null
  rating_ancillary_services: number | null
  comment: string | null
  visited_at: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TRUST_K = 10
const MIN_EXPERT_WEIGHT = 0.40

// ---------------------------------------------------------------------------
// Submit a per-criterion review and update blended 6A scores
// ---------------------------------------------------------------------------
export async function submitSiteReview(review: SiteReview): Promise<void> {
  const { ratings } = review

  const { error: reviewError } = await supabase
    .from('site_reviews')
    .upsert(
      {
        site_id:                   review.site_id,
        user_id:                   review.user_id,
        visited:                   review.visited,
        rating_attraction:         ratings.attraction,
        rating_accessibility:      ratings.accessibility,
        rating_amenities:          ratings.amenities,
        rating_available_packages: ratings.availablePackages,
        rating_activities:         ratings.activities,
        rating_ancillary_services: ratings.ancillaryServices,
        comment:                   review.comment,
        visited_at:                review.visited_at,
      },
      { onConflict: 'user_id,site_id' },
    )

  if (reviewError) throw new Error(reviewError.message)
  if (!review.visited) return
  await recalculateBlendedScores(review.site_id)
}

// ---------------------------------------------------------------------------
// Recalculate blended 6A scores independently per criterion.
//
// Scale contract:
//   expert_* columns  → real, range 1–5 (your adviser's scores)
//   rating_* columns  → integer, range 1–5 (tourist per-criterion ratings)
//   live columns      → real, blended result written back to landmarkData
//
// If expert_* columns are null for a site, the live column keeps its current
// integer value (set at row creation) and tourist ratings are blended against
// that fallback so scores are never wiped.
// ---------------------------------------------------------------------------
async function recalculateBlendedScores(siteId: string): Promise<void> {
  // 1. Fetch all reviews for this site
  const { data: reviews, error: reviewsError } = await supabase
    .from('site_reviews')
    .select(`
      rating_attraction,
      rating_accessibility,
      rating_amenities,
      rating_available_packages,
      rating_activities,
      rating_ancillary_services
    `)
    .eq('site_id', siteId)

  if (reviewsError) {
    console.error('[recalculate] reviews fetch error:', reviewsError.message)
    return
  }
  if (!reviews || reviews.length === 0) return

  // 2. Fetch expert baseline + current live scores as fallback
  const { data: landmark, error: landmarkError } = await supabase
    .from('landmarkData')
    .select(`
      id,
      attraction, accessibility, amenities,
      "availablePackages", activities, "ancillaryServices",
      expert_attraction,
      expert_accessibility,
      expert_amenities,
      expert_availablepackages,
      expert_activities,
      expert_ancillaryservices
    `)
    .eq('id', siteId)
    .single()

  if (landmarkError || !landmark) {
    console.error('[recalculate] landmark fetch error:', landmarkError?.message)
    return
  }

  // 3. Per-criterion tourist average (only non-null ratings count)
  function criterionAvg(dbKey: string): { avg: number | null; n: number } {
    const vals = (reviews as any[])
      .map((r) => r[dbKey])
      .filter((v) => v !== null && v !== undefined) as number[]
    if (vals.length === 0) return { avg: null, n: 0 }
    return { avg: vals.reduce((s, v) => s + v, 0) / vals.length, n: vals.length }
  }

  // 4. Blend: expert score wins early, tourist consensus grows with n.
  //    Both scales are 1–5, so we blend raw values directly.
  //    Falls back to current live integer value if expert_* is null.
  function blend(
    expertVal: number | null,
    currentLive: number,
    touristAvg: number | null,
    n: number,
  ): number {
    const baseline = expertVal ?? currentLive   // prefer expert, fall back to live
    if (touristAvg === null || n === 0) return baseline
    const expertWeight = Math.max(MIN_EXPERT_WEIGHT, 1 - n / (n + TRUST_K))
    return expertWeight * baseline + (1 - expertWeight) * touristAvg
  }

  const a  = criterionAvg('rating_attraction')
  const ac = criterionAvg('rating_accessibility')
  const am = criterionAvg('rating_amenities')
  const pk = criterionAvg('rating_available_packages')
  const av = criterionAvg('rating_activities')
  const an = criterionAvg('rating_ancillary_services')

  // 5. Overall avg review score = mean of all submitted criterion ratings
  const allRatings: number[] = (reviews as any[]).flatMap((r) =>
    [
      r.rating_attraction,
      r.rating_accessibility,
      r.rating_amenities,
      r.rating_available_packages,
      r.rating_activities,
      r.rating_ancillary_services,
    ].filter((v) => v !== null)
  )
  const overallAvg = allRatings.length > 0
    ? allRatings.reduce((s, v) => s + v, 0) / allRatings.length
    : null

  // 6. Build update payload.
  //    IMPORTANT: keys must exactly match the Postgres column names.
  //    "availablePackages" and "ancillaryServices" are quoted camelCase identifiers —
  //    PostgREST is case-sensitive; a wrong key is silently ignored.
  // landmarkData live columns are INTEGER — round blended floats before writing
  const payload: Record<string, any> = {
    attraction:        Math.round(blend(landmark.expert_attraction,        landmark.attraction,        a.avg,  a.n)),
    accessibility:     Math.round(blend(landmark.expert_accessibility,     landmark.accessibility,     ac.avg, ac.n)),
    amenities:         Math.round(blend(landmark.expert_amenities,         landmark.amenities,         am.avg, am.n)),
    availablePackages: Math.round(blend(landmark.expert_availablepackages, landmark.availablePackages, pk.avg, pk.n)),
    activities:        Math.round(blend(landmark.expert_activities,        landmark.activities,        av.avg, av.n)),
    ancillaryServices: Math.round(blend(landmark.expert_ancillaryservices, landmark.ancillaryServices, an.avg, an.n)),
    avg_review_score:  overallAvg,          // real column — float is fine
    review_count:      reviews.length,      // integer — already whole number
  }

  console.log('[recalculate] writing payload for site', siteId, payload)

  const { error: updateError } = await supabase
    .from('landmarkData')
    .update(payload)
    .eq('id', siteId)

  if (updateError) {
    console.error('[recalculate] update error:', updateError.message, updateError.details)
    throw new Error(updateError.message)
  }
}

// ---------------------------------------------------------------------------
// Fetch all landmarks formatted for TOPSIS ranking
// ---------------------------------------------------------------------------
export async function fetchLandmarksForTOPSIS(): Promise<LandmarkRow[]> {
  const { data, error } = await supabase
    .from('landmarkData')
    .select(`
      id, name, description, img_url,
      attraction, accessibility, amenities,
      "availablePackages", activities, "ancillaryServices",
      avg_review_score, review_count
    `)
    .order('name', { ascending: true })

  if (error) {
    console.error('[fetchLandmarksForTOPSIS] Supabase error:', error.message)
    throw new Error(error.message)
  }

  return (data ?? []).map((row: any) => ({
    id:                String(row.id),
    name:              row.name,
    category:          '',
    barangay:          '',
    municipality:      '',
    description:       row.description ?? '',
    shortDescription:  (row.description ?? '').slice(0, 80),
    latitude:          0,
    longitude:         0,
    imageUrl:          row.img_url ?? undefined,
    attraction:        row.attraction        ?? 0,
    accessibility:     row.accessibility     ?? 0,
    amenities:         row.amenities         ?? 0,
    availablePackages: row.availablePackages  ?? 0,
    activities:        row.activities        ?? 0,
    ancillaryServices: row.ancillaryServices  ?? 0,
    avgReviewScore:    row.avg_review_score  ?? undefined,
  }))
}

// ---------------------------------------------------------------------------
// Fetch all reviews for a specific site
// ---------------------------------------------------------------------------
export async function fetchSiteReviews(siteId: string): Promise<ReviewRecord[]> {
  const { data, error } = await supabase
    .from('site_reviews')
    .select(`
      id, site_id, user_id, visited,
      rating_attraction, rating_accessibility, rating_amenities,
      rating_available_packages, rating_activities, rating_ancillary_services,
      comment, visited_at, created_at
    `)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ReviewRecord[]
}

// ---------------------------------------------------------------------------
// Fetch all reviews submitted by a specific user
// ---------------------------------------------------------------------------
export async function fetchUserReviews(userId: string): Promise<ReviewRecord[]> {
  const { data, error } = await supabase
    .from('site_reviews')
    .select(`
      id, site_id, user_id, visited,
      rating_attraction, rating_accessibility, rating_amenities,
      rating_available_packages, rating_activities, rating_ancillary_services,
      comment, visited_at, created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ReviewRecord[]
}

// ---------------------------------------------------------------------------
// Check whether a user has already reviewed a specific site
// ---------------------------------------------------------------------------
export async function fetchUserReviewForSite(
  userId: string,
  siteId: string,
): Promise<ReviewRecord | null> {
  const { data, error } = await supabase
    .from('site_reviews')
    .select(`
      id, site_id, user_id, visited,
      rating_attraction, rating_accessibility, rating_amenities,
      rating_available_packages, rating_activities, rating_ancillary_services,
      comment, visited_at, created_at
    `)
    .eq('user_id', userId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as ReviewRecord | null
}
