// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SixAScores {
  attraction:        number
  accessibility:     number
  amenities:         number
  availablePackages: number
  activities:        number
  ancillaryServices: number
}

export interface TourismSite {
  id: string
  name: string
  category: SiteCategory
  description: string
  shortDescription: string
  coordinates: { latitude: number; longitude: number }
  unlockRadiusMeters: number   // how close tourist must be to unlock full info
  imageUrl?: string
  barangay: string
  municipality: string
  sixAScores?: SixAScores
  avgReviewScore?: number | null
  reviewCount?: number | null
}

export type SiteCategory =
  | 'volcano'
  | 'ruins'
  | 'beach'
  | 'church'
  | 'park'
  | 'waterfall'
  | 'island'
  | 'default'

// Category display config
export const CATEGORY_CONFIG: Record<SiteCategory, { emoji: string; color: string }> = {
  volcano:  { emoji: '🌋', color: '#C0392B' },
  ruins:    { emoji: '🏛️', color: '#8B6914' },
  beach:    { emoji: '🏖️', color: '#2980C4' },
  church:   { emoji: '⛪', color: '#6C3483' },
  park:     { emoji: '🌿', color: '#1A7A4A' },
  waterfall:{ emoji: '💧', color: '#1A8FA0' },
  island:   { emoji: '🏝️', color: '#E07A30' },
  default:  { emoji: '📍', color: '#7F8C8D' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Haversine formula — returns distance in meters between two coordinates
export function getDistanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Returns sites within given radius, sorted by distance
export function getNearbySites(
  sites: TourismSite[],
  userLat: number,
  userLon: number,
  radiusMeters = 10000,
): Array<TourismSite & { distanceMeters: number }> {
  return sites
    .map((site) => ({
      ...site,
      distanceMeters: getDistanceMeters(
        userLat, userLon,
        site.coordinates.latitude, site.coordinates.longitude,
      ),
    }))
    .filter((s) => s.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
}

// Format distance nicely
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}
