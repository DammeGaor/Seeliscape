import React, { useEffect, useRef, useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  FlatList,
  Keyboard,
  ActivityIndicator,
  Image,
} from 'react-native'
import MapboxGL from '@rnmapbox/maps'
import type GeoJSON from 'geojson'
import * as Location from 'expo-location'
import { useMapStore } from '@/store/map.store'
import { SiteSheet } from '@/components/map/SiteSheet'
import { signOut } from '@/lib/auth.service'
import { InfoModal } from '@/components/map/InfoModal'
import { router } from 'expo-router'
import {
  TourismSite,
  CATEGORY_CONFIG,
  getDistanceMeters,
} from '@/lib/tourism-sites'
import { fetchDestinations } from '@/lib/destinations.service'
import {
  fetchRoute,
  formatDuration,
  formatRouteDistance,
  RouteProfile,
} from '@/lib/directions.service'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

// ---------------------------------------------------------------------------
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')

const ALBAY_CENTER: [number, number] = [123.7, 13.18]
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? ''

// ---------------------------------------------------------------------------
// Route state type
// ---------------------------------------------------------------------------
interface ActiveRoute {
  coordinates: [number, number][]
  distanceMeters: number
  durationSeconds: number
  profile: RouteProfile
}

// ---------------------------------------------------------------------------
// Custom marker component
// ---------------------------------------------------------------------------
function SiteMarker({
  site,
  isUnlocked,
  isSelected,
  onPress,
}: {
  site: TourismSite
  isUnlocked: boolean
  isSelected: boolean
  onPress: () => void
}) {
  const config = CATEGORY_CONFIG[site.category]

  return (
    <MapboxGL.MarkerView
      coordinate={[site.coordinates.longitude, site.coordinates.latitude]}
      anchor={{ x: 0.5, y: 1 }}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <View style={[
          styles.marker,
          isSelected && styles.markerSelected,
          !isUnlocked && styles.markerLocked,
        ]}>
          {site.imageUrl ? (
            <>
              <Image
                source={{ uri: site.imageUrl }}
                style={[
                  styles.markerImage,
                  !isUnlocked && styles.markerImageLocked,
                ]}
                resizeMode="cover"
              />
              {!isUnlocked && (
                <View style={styles.markerLockOverlay}>
                  <Text style={styles.markerLockIcon}>🔒</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.markerEmoji}>{config.emoji}</Text>
          )}
        </View>
        <View style={[styles.markerTail, isSelected && styles.markerTailSelected]} />
      </TouchableOpacity>
    </MapboxGL.MarkerView>
  )
}

// ---------------------------------------------------------------------------
// Search result row
// ---------------------------------------------------------------------------
function SearchResult({ site, onPress }: { site: TourismSite; onPress: () => void }) {
  const config = CATEGORY_CONFIG[site.category]
  return (
    <TouchableOpacity style={styles.searchResult} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.searchResultEmoji}>{config.emoji}</Text>
      <View style={styles.searchResultText}>
        <Text style={styles.searchResultName}>{site.name}</Text>
        <Text style={styles.searchResultSub}>{site.municipality}</Text>
      </View>
    </TouchableOpacity>
  )
}

// ---------------------------------------------------------------------------
// Route info pill shown at top when a route is active
// ---------------------------------------------------------------------------
function RouteInfoPill({
  route,
  onClear,
  onChangeProfile,
}: {
  route: ActiveRoute
  onClear: () => void
  onChangeProfile: (p: RouteProfile) => void
}) {
  const profiles: { key: RouteProfile; label: string }[] = [
    { key: 'walking', label: '🚶' },
    { key: 'driving', label: '🚗' },
    { key: 'cycling', label: '🚴' },
  ]

  return (
    <View style={styles.routePill}>
      {/* Distance + duration */}
      <View style={styles.routeInfo}>
        <Text style={styles.routeDistance}>{formatRouteDistance(route.distanceMeters)}</Text>
        <Text style={styles.routeDot}>·</Text>
        <Text style={styles.routeDuration}>{formatDuration(route.durationSeconds)}</Text>
      </View>

      {/* Profile switcher */}
      <View style={styles.profileRow}>
        {profiles.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.profileBtn, route.profile === p.key && styles.profileBtnActive]}
            onPress={() => onChangeProfile(p.key)}
          >
            <Text style={styles.profileEmoji}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Clear button */}
      <TouchableOpacity style={styles.routeClearBtn} onPress={onClear}>
        <Text style={styles.routeClearTxt}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function MapScreen() {
  const {
    userLocation,
    locationError,
    locationLoading,
    selectedSite,
    unlockedSiteIds,
    followUserLocation,
    proximityAlerts,
    highAccuracy,
    showUnlocked,
    setUserLocation,
    setLocationError,
    setLocationLoading,
    setSelectedSite,
    setFollowUserLocation,
    pendingDirectionsSiteId,
    setPendingDirectionsSiteId,
  } = useMapStore()

  const cameraRef = useRef<MapboxGL.Camera>(null)
  const cameraInitialized = useRef(false)
  const alertedSiteIds = useRef<Set<string>>(new Set())
  const activeRouteSite = useRef<TourismSite | null>(null)
  const routeCache = useRef<Partial<Record<RouteProfile, ActiveRoute>>>({})
  const [pulsePhase, setPulsePhase] = useState(0)
  const [infoVisible, setInfoVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  // Supabase destinations
  const [sites, setSites] = useState<TourismSite[]>([])
  const [sitesLoading, setSitesLoading] = useState(true)
  const [sitesError, setSitesError] = useState<string | null>(null)

  // Routing state
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

  useEffect(() => {
    fetchDestinations()
      .then((data) => setSites(data))
      .catch((e: Error) => {
        console.error('[MapScreen] fetchDestinations failed:', e?.message)
        setSitesError(`Failed to load destinations: ${e?.message ?? 'unknown error'}`)
      })
      .finally(() => setSitesLoading(false))
  }, [])

  // Auto-trigger directions when returning from recommend screen
  useEffect(() => {
    if (!pendingDirectionsSiteId || sites.length === 0) return
    const site = sites.find((s) => s.id === pendingDirectionsSiteId)
    if (!site) return
    setPendingDirectionsSiteId(null)
    setSelectedSite(site)
    handleGetDirections(site, 'driving')
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [site.coordinates.longitude, site.coordinates.latitude],
        zoomLevel: 14,
        animationDuration: 800,
      })
    }
  }, [pendingDirectionsSiteId, sites])

  // Pulse animation for route line using interval (rnmapbox doesn't support Animated.Value in LineLayer)
  useEffect(() => {
    if (!activeRoute) {
      setPulsePhase(0)
      return
    }

    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) % 1800
      const t = elapsed < 900 ? elapsed / 900 : (1800 - elapsed) / 900
      setPulsePhase(t)
    }, 32) // ~30fps

    return () => clearInterval(interval)
  }, [activeRoute])

  const pulseOpacity = 0.15 + pulsePhase * 0.4   // 0.15 → 0.55
  const pulseWidth = 10 + pulsePhase * 8           // 10 → 18

  const searchResults = useMemo(() => {
    if (searchQuery.trim().length === 0) return []
    return sites.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.municipality.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery, sites])

  // ---------------------------------------------------------------------------
  // Location
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null

    async function startTracking() {
      setLocationLoading(true)
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setLocationError('Location permission denied.')
        return
      }
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      setUserLocation({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
        accuracy: initial.coords.accuracy ?? undefined,
      })
      setLocationLoading(false)
      // Fly to user once on first fix — after this the camera is user-controlled
      if (!cameraInitialized.current) {
        cameraInitialized.current = true
        cameraRef.current?.setCamera({
          centerCoordinate: [initial.coords.longitude, initial.coords.latitude],
          zoomLevel: 17.5,
          pitch: 60,
          animationMode: 'flyTo',
          animationDuration: 800,
        })
      }
      subscription = await Location.watchPositionAsync(
        {
          accuracy: highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
          distanceInterval: highAccuracy ? 5 : 10,
        },
        (loc) => {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? undefined,
          })
          checkProximity(loc.coords.latitude, loc.coords.longitude)
        },
      )
    }

    startTracking()
    return () => { subscription?.remove() }
  }, [highAccuracy])

  function checkProximity(lat: number, lon: number) {
    sites.forEach((site) => {
      const dist = getDistanceMeters(lat, lon, site.coordinates.latitude, site.coordinates.longitude)
      if (dist <= site.unlockRadiusMeters && !alertedSiteIds.current.has(site.id)) {
        alertedSiteIds.current.add(site.id)
        if (proximityAlerts) setSelectedSite(site)
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Directions — called from SiteSheet's "Get Directions" button
  // ---------------------------------------------------------------------------
  async function handleGetDirections(site: TourismSite, profile: RouteProfile = 'walking') {
    if (!userLocation) {
      setRouteError('Your location is not available yet.')
      return
    }

    activeRouteSite.current = site
    setRouteError(null)

    // Clear cache when destination changes
    if (!routeCache.current[profile] || activeRouteSite.current?.id !== site.id) {
      routeCache.current = {}
    }

    // Instant switch if already cached
    if (routeCache.current[profile]) {
      setActiveRoute(routeCache.current[profile]!)
      fitCameraToRoute(site)
      prefetchMissingProfiles(site)
      return
    }

    // First load: fetch all 3 profiles in parallel
    setRouteLoading(true)
    setActiveRoute(null)

    const allProfiles: RouteProfile[] = ['walking', 'driving', 'cycling']
    const results = await Promise.all(
      allProfiles.map((p) =>
        fetchRoute(
          userLocation.longitude,
          userLocation.latitude,
          site.coordinates.longitude,
          site.coordinates.latitude,
          p,
          MAPBOX_TOKEN,
        ).then((r) => (r ? { ...r, profile: p } : null))
      )
    )

    setRouteLoading(false)

    // Populate cache with all results
    allProfiles.forEach((p, i) => {
      if (results[i]) routeCache.current[p] = results[i]!
    })

    const chosen = routeCache.current[profile]
    if (!chosen) {
      setRouteError('Could not find a route. Try a different mode.')
      return
    }

    setActiveRoute(chosen)
    fitCameraToRoute(site)
  }

  function fitCameraToRoute(site: TourismSite) {
    if (!userLocation) return
    cameraRef.current?.fitBounds(
      [
        Math.min(userLocation.longitude, site.coordinates.longitude),
        Math.min(userLocation.latitude, site.coordinates.latitude),
      ],
      [
        Math.max(userLocation.longitude, site.coordinates.longitude),
        Math.max(userLocation.latitude, site.coordinates.latitude),
      ],
      [120, 60, 60, 60],
      800,
    )
  }

  // Silently fills any missing profiles in the background
  async function prefetchMissingProfiles(site: TourismSite) {
    if (!userLocation) return
    const allProfiles: RouteProfile[] = ['walking', 'driving', 'cycling']
    await Promise.all(
      allProfiles
        .filter((p) => !routeCache.current[p])
        .map((p) =>
          fetchRoute(
            userLocation.longitude,
            userLocation.latitude,
            site.coordinates.longitude,
            site.coordinates.latitude,
            p,
            MAPBOX_TOKEN,
          ).then((r) => { if (r) routeCache.current[p] = { ...r, profile: p } })
        )
    )
  }

  function handleClearRoute() {
    setActiveRoute(null)
    setRouteError(null)
    activeRouteSite.current = null
    routeCache.current = {}
  }

  function handleChangeProfile(profile: RouteProfile) {
    const site = selectedSite ?? activeRouteSite.current
    if (!site) return

    // Instant switch from cache
    if (routeCache.current[profile]) {
      setActiveRoute(routeCache.current[profile]!)
      fitCameraToRoute(site)
      return
    }

    // Fallback: fetch if cache is missing this profile
    handleGetDirections(site, profile)
  }

  // ---------------------------------------------------------------------------
  // Camera helpers
  // ---------------------------------------------------------------------------
  function flyToUser() {
    if (!userLocation) return
    setFollowUserLocation(true)
    cameraRef.current?.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: 17.5,
      pitch: 60,
      animationMode: 'flyTo',
      animationDuration: 800,
    })
  }

  function flyToSite(site: TourismSite) {
    setFollowUserLocation(false)
    cameraRef.current?.setCamera({
      centerCoordinate: [site.coordinates.longitude, site.coordinates.latitude],
      zoomLevel: 17.5,
      pitch: 40,
      animationMode: 'flyTo',
      animationDuration: 800,
    })
  }

  function handleSelectSite(site: TourismSite) {
    setSelectedSite(site)
    flyToSite(site)
    setSearchQuery('')
    Keyboard.dismiss()
  }

  // GeoJSON source for the route line
  const routeGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: activeRoute
      ? [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: activeRoute.coordinates },
          properties: {},
        }]
      : [],
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* ── Mapbox Map ── */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL="mapbox://styles/cqrl/cmo9oio09001j01spaoqp2dtn"
        onPress={() => {
          setFollowUserLocation(false)
          if (!searchFocused) setSelectedSite(null)
          Keyboard.dismiss()
        }}
        onCameraChanged={(state) => {
          if (state.gestures?.isGestureActive) {
            setFollowUserLocation(false)
          }
        }}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
        compassPosition={{ bottom: 100, right: Spacing.md }}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: ALBAY_CENTER,
            zoomLevel: 10,
            pitch: 0,
            heading: 0,
          }}
        />

        {/* User location puck */}
        <MapboxGL.UserLocation
          visible
          showsUserHeadingIndicator
          renderMode={MapboxGL.UserLocationRenderMode.Native}
        />

        {/* ── Route line ── */}
        {activeRoute && (
          <MapboxGL.ShapeSource id="route-source" shape={routeGeoJSON}>
            {/* Outer pulse glow — animates width + opacity */}
            <MapboxGL.LineLayer
              id="route-pulse"
              style={{
                lineColor: Colors.primary,
                lineWidth: pulseWidth,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: pulseOpacity,
                lineBlur: 4,
              }}
            />
            {/* White casing for contrast */}
            <MapboxGL.LineLayer
              id="route-casing"
              style={{
                lineColor: '#ffffff',
                lineWidth: 8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Solid main route line */}
            <MapboxGL.LineLayer
              id="route-line"
              style={{
                lineColor: Colors.primary,
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 1,
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Destination pin for active route */}
        {activeRoute && selectedSite && (
          <MapboxGL.MarkerView
            coordinate={[selectedSite.coordinates.longitude, selectedSite.coordinates.latitude]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.destinationPin}>
              <Text style={styles.destinationPinEmoji}>
                {CATEGORY_CONFIG[selectedSite.category].emoji}
              </Text>
            </View>
          </MapboxGL.MarkerView>
        )}

        {/* Tourism site markers */}
        {sites
          .filter((site) => showUnlocked ? true : !unlockedSiteIds.has(site.id))
          .map((site) => (
          <SiteMarker
            key={site.id}
            site={site}
            isUnlocked={unlockedSiteIds.has(site.id)}
            isSelected={selectedSite?.id === site.id}
            onPress={() => handleSelectSite(site)}
          />
        ))}
      </MapboxGL.MapView>

      {/* ── Route loading indicator ── */}
      {routeLoading && (
        <View style={styles.routeLoadingOverlay}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.routeLoadingTxt}>Finding route…</Text>
        </View>
      )}

      {/* ── Route error ── */}
      {routeError && (
        <View style={styles.routeErrorBanner}>
          <Text style={styles.routeErrorTxt}>{routeError}</Text>
          <TouchableOpacity onPress={() => setRouteError(null)}>
            <Text style={styles.routeErrorClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom-left: recommend button ── */}
      <TouchableOpacity
        style={styles.recommendBtn}
        onPress={() => router.push('/(tabs)/recommend')}
        activeOpacity={0.85}
      >
        <Text style={styles.topActionEmoji}>✦</Text>
      </TouchableOpacity>

      {/* ── Right-side cluster: recenter + info + settings (equally spaced) ── */}
      <View style={styles.rightCluster}>
        {userLocation && (
          <TouchableOpacity
            style={[styles.clusterBtn, followUserLocation && styles.clusterBtnActive]}
            onPress={flyToUser}
            activeOpacity={0.85}
          >
            <Text style={[styles.clusterBtnIcon, followUserLocation && styles.clusterBtnIconActive]}>◎</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.clusterBtn}
          onPress={() => setInfoVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.topActionTxt}>i</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.clusterBtn}
          onPress={() => router.push('/(tabs)/settings')}
          activeOpacity={0.85}
        >
          <Text style={styles.topActionEmoji}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search sites, beaches, ruins…"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {searchFocused && searchResults.length > 0 && (
          <View style={styles.searchDropdown}>
            <FlatList
              data={searchResults}
              keyExtractor={(s) => s.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <SearchResult site={item} onPress={() => handleSelectSite(item)} />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        )}
      </View>

      {/* ── Route info pill — rendered after search bar so it sits on top ── */}
      {activeRoute && (
        <View style={styles.routePillContainer}>
          <RouteInfoPill
            route={activeRoute}
            onClear={handleClearRoute}
            onChangeProfile={handleChangeProfile}
          />
        </View>
      )}

      {/* ── Loading/error badges ── */}
      {sitesLoading && (
        <View style={styles.locationLoadingBadge}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.locationLoadingTxt}>Loading destinations…</Text>
        </View>
      )}
      {sitesError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTxt}>{sitesError}</Text>
        </View>
      )}
      {locationLoading && !sitesLoading && (
        <View style={styles.locationLoadingBadge}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.locationLoadingTxt}>Finding your location…</Text>
        </View>
      )}
      {locationError && !sitesError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTxt}>{locationError}</Text>
        </View>
      )}

      {/* ── Site counter pill ── */}
      <View style={styles.counterPill}>
        <Text style={styles.counterTxt}>
          {unlockedSiteIds.size}/{sites.length} sites unlocked
        </Text>
      </View>

      {/* ── Info modal ── */}
      <InfoModal visible={infoVisible} onClose={() => setInfoVisible(false)} />

      {/* ── Dev sign-out ── */}
      <TouchableOpacity
        style={styles.devSignOut}
        onPress={async () => { await signOut(); router.replace('/(auth)/login') }}
      >
        <Text style={styles.devSignOutTxt}>Sign out</Text>
      </TouchableOpacity>

      {/* ── Site detail bottom sheet ── */}
      {selectedSite && (
        <SiteSheet
          site={selectedSite}
          onClose={() => setSelectedSite(null)}
          onGetDirections={(profile) => handleGetDirections(selectedSite, profile)}
          hasActiveRoute={!!activeRoute}
          onClearRoute={handleClearRoute}
        />
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  map: { flex: 1 },

  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    borderWidth: 2.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  markerSelected: {
    borderColor: Colors.accent,
    transform: [{ scale: 1.15 }],
    shadowOpacity: 0.28,
  },
  markerLocked: { borderColor: Colors.border, opacity: 0.75 },
  markerEmoji: { fontSize: 20 },
  // Image marker styles
  markerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  markerImageLocked: {
    opacity: 0.55,
  },
  markerLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
  },
  markerLockIcon: { fontSize: 14 },
  markerTail: {
    width: 8,
    height: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: -2,
  },
  markerTailSelected: { backgroundColor: Colors.accent },

  // Destination pin (shown during active route)
  destinationPin: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgCard,
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  destinationPinEmoji: { fontSize: 24 },

  // Route pill
  routePillContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 112 : 120,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 20,
  },
  routePill: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  routeDistance: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  routeDot: {
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textMuted,
  },
  routeDuration: {
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 4,
  },
  profileBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  profileBtnActive: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  profileEmoji: { fontSize: 16 },
  routeClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeClearTxt: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Typography.bodySemiBold,
  },

  // Route loading
  routeLoadingOverlay: {
    position: 'absolute',
    bottom: 200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  routeLoadingTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Route error
  routeErrorBanner: {
    position: 'absolute',
    bottom: 200,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#F5C6C1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeErrorTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  routeErrorClose: {
    fontSize: 13,
    color: Colors.error,
    paddingLeft: 8,
  },

  // Bottom-right cluster — compass at bottom:212, info at bottom:156, settings at bottom:100
  // Each element is ~44px tall, gap between each is 12px for even spacing
  rightCluster: {
    position: 'absolute',
    bottom: 260,
    right: Spacing.md,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    zIndex: 15,
  },
  recommendBtn: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    zIndex: 10,
  },
  clusterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  clusterBtnActive: {
    backgroundColor: '#E8F4FD',
    borderColor: Colors.primary,
  },
  clusterBtnIcon: { fontSize: 22, color: Colors.primary },
  clusterBtnIconActive: { color: Colors.primary },
  topActionTxt: {
    fontFamily: Typography.displayFont,
    fontSize: 17,
    color: Colors.primary,
    fontStyle: 'italic',
  },
  topActionEmoji: { fontSize: 20 },

  // Search
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 52 : 60,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    height: 52,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchBarFocused: { borderColor: Colors.borderFocus },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontFamily: Typography.bodyFont,
    fontSize: 15,
    color: Colors.textPrimary,
    height: '100%',
  },
  searchClear: { fontSize: 13, color: Colors.textMuted, paddingLeft: 4 },
  searchDropdown: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    marginTop: 6,
    maxHeight: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  searchResultEmoji: { fontSize: 20 },
  searchResultText: { flex: 1 },
  searchResultName: {
    fontFamily: Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  searchResultSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
  },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 52 },

  // Loading / error badges
  locationLoadingBadge: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  locationLoadingTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#F5C6C1',
  },
  errorBannerTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },



  counterPill: {
    position: 'absolute',
    bottom: Spacing.xl,
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  counterTxt: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },

  devSignOut: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 52 : 60,
    right: Spacing.lg + 200,
    display: 'none',
  },
  devSignOutTxt: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.error,
  },
})
