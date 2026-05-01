import { supabase } from './supabase'
import { TourismSite, SiteCategory } from './tourism-sites'

// ---------------------------------------------------------------------------
// Supabase row shape — mirrors your table columns
// ---------------------------------------------------------------------------
type DestinationRow = {
  id: number
  name: string
  description: string | null
  latitude: number
  longitude: number
  img_url: string | null
  // Live blended 6A scores (expert × tourist — updated on each review)
  attraction: number | null
  accessibility: number | null
  amenities: number | null
  availablePackages: number | null   // was: available_packages
  activities: number | null
  ancillaryServices: number | null   // was: ancillary_services
  // Review aggregates
  avg_review_score: number | null
  review_count: number | null
}

// ---------------------------------------------------------------------------
// Maps a flat Supabase row → TourismSite used throughout the app
// ---------------------------------------------------------------------------
function mapToTourismSite(row: DestinationRow): TourismSite {
  const description = row.description ?? 'No description available.'

  return {
    id: String(row.id),
    name: row.name,
    description,
    shortDescription:
      description.length > 80
        ? description.slice(0, 80).trimEnd() + '…'
        : description,
    coordinates: {
      latitude: row.latitude,
      longitude: row.longitude,
    },
    imageUrl: row.img_url ?? undefined,
    // ── Defaults until you add these columns to Supabase ──────────────────
    category: 'default' as SiteCategory,
    barangay: '',
    municipality: '',
    unlockRadiusMeters: 20,
    // ── Live blended 6A scores ────────────────────────────────────────────
    sixAScores: {
      attraction:        row.attraction        ?? 0,
      accessibility:     row.accessibility     ?? 0,
      amenities:         row.amenities         ?? 0,
      availablePackages: row.availablePackages  ?? 0,
      activities:        row.activities        ?? 0,
      ancillaryServices: row.ancillaryServices  ?? 0,
    },
    avgReviewScore: row.avg_review_score ?? undefined,
    reviewCount:    row.review_count    ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Fetch all destinations from Supabase — includes live blended scores
// ---------------------------------------------------------------------------
export async function fetchDestinations(): Promise<TourismSite[]> {
  const { data, error } = await supabase
    .from('landmarkData')
    .select(`
      id, name, description, latitude, longitude, img_url,
      attraction, accessibility, amenities,
      "availablePackages", activities, "ancillaryServices",
      avg_review_score, review_count
    `)
    .order('name', { ascending: true })

  if (error) {
    console.error('[fetchDestinations] Supabase error:', error.code, error.message, error.details)
    throw new Error(error.message)
  }

  if (!data || data.length === 0) {
    console.warn('[fetchDestinations] Query succeeded but returned no rows.')
    return []
  }

  return (data as DestinationRow[]).map(mapToTourismSite)
}
