// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
}

export type SiteCategory =
  | 'volcano'
  | 'ruins'
  | 'beach'
  | 'church'
  | 'park'
  | 'waterfall'
  | 'island'

// Category display config
export const CATEGORY_CONFIG: Record<SiteCategory, { emoji: string; color: string }> = {
  volcano:  { emoji: '🌋', color: '#C0392B' },
  ruins:    { emoji: '🏛️', color: '#8B6914' },
  beach:    { emoji: '🏖️', color: '#2980C4' },
  church:   { emoji: '⛪', color: '#6C3483' },
  park:     { emoji: '🌿', color: '#1A7A4A' },
  waterfall:{ emoji: '💧', color: '#1A8FA0' },
  island:   { emoji: '🏝️', color: '#E07A30' },
}

// ---------------------------------------------------------------------------
// Seed data — real Albay tourism sites with real coordinates
// ---------------------------------------------------------------------------
export const ALBAY_SITES: TourismSite[] = [
  {
    id: 'mayon-volcano',
    name: 'Mayon Volcano',
    category: 'volcano',
    shortDescription: 'The world\'s most perfect cone',
    description: 'Mayon Volcano is an active stratovolcano in the province of Albay. Renowned for its perfect conical shape, it is the most active volcano in the Philippines and a UNESCO-listed natural wonder.',
    coordinates: { latitude: 13.2575, longitude: 123.6857 },
    unlockRadiusMeters: 5000,
    barangay: 'Buyuan',
    municipality: 'Legazpi City',
  },
  {
    id: 'cagsawa-ruins',
    name: 'Cagsawa Ruins',
    category: 'ruins',
    shortDescription: 'Church ruins framing Mayon',
    description: 'The Cagsawa Ruins are the remnants of an 18th-century Franciscan church buried by the 1814 eruption of Mayon Volcano. The iconic bell tower frames Mayon in the background.',
    coordinates: { latitude: 13.1577, longitude: 123.6844 },
    unlockRadiusMeters: 300,
    barangay: 'Busay',
    municipality: 'Daraga',
  },
  {
    id: 'sumlang-lake',
    name: 'Sumlang Lake',
    category: 'park',
    shortDescription: 'Mirror lake reflecting Mayon',
    description: 'Sumlang Lake is a serene crater lake offering stunning reflections of Mayon Volcano. Visitors can enjoy bamboo raft rides, kayaking, and lakeside dining with panoramic views.',
    coordinates: { latitude: 13.2008, longitude: 123.7272 },
    unlockRadiusMeters: 400,
    barangay: 'Sumlang',
    municipality: 'Camalig',
  },
  {
    id: 'misibis-bay',
    name: 'Misibis Bay Resort',
    category: 'beach',
    shortDescription: 'Luxury island escape in Cagraray',
    description: 'Misibis Bay is an award-winning luxury resort set on Cagraray Island with pristine beaches, crystal-clear waters, and views of both Mayon Volcano and the Pacific Ocean.',
    coordinates: { latitude: 13.4729, longitude: 124.0264 },
    unlockRadiusMeters: 500,
    barangay: 'Cagraray',
    municipality: 'Bacacay',
  },
  {
    id: 'hoyop-hoyopan-cave',
    name: 'Hoyop-Hoyopan Cave',
    category: 'park',
    shortDescription: 'Ancient cave with pre-colonial artifacts',
    description: 'Hoyop-Hoyopan, meaning "blowing cave," is a natural limestone cave system in Camalig containing ancient pottery and pre-colonial artifacts dating back 3,500 years.',
    coordinates: { latitude: 13.2347, longitude: 123.6611 },
    unlockRadiusMeters: 200,
    barangay: 'Cotmon',
    municipality: 'Camalig',
  },
  {
    id: 'lignon-hill',
    name: 'Lignon Hill Nature Park',
    category: 'park',
    shortDescription: 'Panoramic views of Legazpi & Mayon',
    description: 'Lignon Hill is a 207-meter volcanic hill in Legazpi City offering 360-degree views of Mayon Volcano, Legazpi Bay, and the Albay Gulf. Features zip lines, hanging bridges, and trekking trails.',
    coordinates: { latitude: 13.1383, longitude: 123.7344 },
    unlockRadiusMeters: 300,
    barangay: 'Bigaa',
    municipality: 'Legazpi City',
  },
  {
    id: 'santo-domingo-beach',
    name: 'Santo Domingo Black Sand Beach',
    category: 'beach',
    shortDescription: 'Volcanic black sand with Mayon views',
    description: 'Santo Domingo\'s unique black sand beaches are formed from volcanic deposits from Mayon Volcano. The dark shoreline offers dramatic scenery with Mayon rising in the background.',
    coordinates: { latitude: 13.2683, longitude: 123.5783 },
    unlockRadiusMeters: 400,
    barangay: 'Salvacion',
    municipality: 'Santo Domingo',
  },
  {
    id: 'vera-falls',
    name: 'Vera Falls',
    category: 'waterfall',
    shortDescription: 'Hidden jungle waterfall in Ligao',
    description: 'Vera Falls is a multi-tiered waterfall tucked inside a lush jungle in Ligao City. The trek involves river crossings and bamboo bridges, rewarding visitors with a 20-meter cascade.',
    coordinates: { latitude: 13.2156, longitude: 123.5289 },
    unlockRadiusMeters: 200,
    barangay: 'Vera',
    municipality: 'Ligao City',
  },
]

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
  userLat: number,
  userLon: number,
  radiusMeters = 10000,
): Array<TourismSite & { distanceMeters: number }> {
  return ALBAY_SITES
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
