// ---------------------------------------------------------------------------
// Route profiles supported by Mapbox Directions API
// ---------------------------------------------------------------------------
export type RouteProfile = 'walking' | 'driving' | 'cycling'

// ---------------------------------------------------------------------------
// Shape returned by fetchRoute — consumed by index.tsx
// ---------------------------------------------------------------------------
export interface RouteResult {
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
}

// ---------------------------------------------------------------------------
// Fetch a route between two coordinates using the Mapbox Directions API.
// Returns null if no route is found or the request fails.
// ---------------------------------------------------------------------------
export async function fetchRoute(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number,
  profile: RouteProfile = 'driving',
  mapboxToken: string,
): Promise<RouteResult | null> {
  const profileMap: Record<RouteProfile, string> = {
    driving: 'mapbox/driving',
    walking: 'mapbox/walking',
    cycling: 'mapbox/cycling',
  }

  const url =
    `https://api.mapbox.com/directions/v5/${profileMap[profile]}/` +
    `${originLng},${originLat};${destLng},${destLat}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${mapboxToken}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[fetchRoute] HTTP error:', res.status, res.statusText)
      return null
    }

    const json = await res.json()

    if (!json.routes || json.routes.length === 0) {
      console.warn('[fetchRoute] No routes returned by Mapbox.')
      return null
    }

    const route = json.routes[0]

    return {
      coordinates: route.geometry.coordinates as [number, number][],
      distanceMeters: route.distance as number,
      durationSeconds: route.duration as number,
    }
  } catch (err) {
    console.error('[fetchRoute] Fetch failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Format helpers used in RouteInfoPill
// ---------------------------------------------------------------------------

export function formatRouteDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`
  }
  const totalMinutes = Math.round(seconds / 60)
  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`
}
