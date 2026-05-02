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
  Animated,
  Easing,
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
// Pure-View icon primitives — no emoji, no icon library
// ---------------------------------------------------------------------------

// × close mark
function IconClose({ size = 10, color = Colors.textMuted }: { size?: number; color?: string }) {
  const t = size * 0.12
  return (
    <View style={{ width: size, height: size }}>
      <View style={{
        position: 'absolute', top: '50%', left: 0,
        width: size, height: t, marginTop: -t / 2,
        backgroundColor: color, borderRadius: t,
        transform: [{ rotate: '45deg' }],
      }} />
      <View style={{
        position: 'absolute', top: '50%', left: 0,
        width: size, height: t, marginTop: -t / 2,
        backgroundColor: color, borderRadius: t,
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  )
}

// Magnifying glass search icon
function IconSearch({ size = 16, color = Colors.textMuted }: { size?: number; color?: string }) {
  const circleSize = size * 0.65
  const handleLen  = size * 0.38
  const t          = size * 0.13
  return (
    <View style={{ width: size, height: size }}>
      <View style={{
        width: circleSize, height: circleSize, borderRadius: circleSize / 2,
        borderWidth: t, borderColor: color,
        position: 'absolute', top: 0, left: 0,
      }} />
      <View style={{
        width: t, height: handleLen, backgroundColor: color, borderRadius: t,
        position: 'absolute',
        top: circleSize - t * 0.5,
        left: circleSize - t * 0.5,
        transform: [{ rotate: '45deg' }],
        transformOrigin: 'top center',
      }} />
    </View>
  )
}

// Location crosshair / recenter
function IconLocation({ size = 18, color = Colors.primary, active = false }:
  { size?: number; color?: string; active?: boolean }) {
  const t     = size * 0.1
  const inner = size * 0.28
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer circle */}
      <View style={{
        width: size * 0.72, height: size * 0.72,
        borderRadius: size * 0.36,
        borderWidth: t, borderColor: color,
        alignItems: 'center', justifyContent: 'center',
        position: 'absolute',
      }} />
      {/* Inner dot */}
      <View style={{
        width: inner, height: inner, borderRadius: inner / 2,
        backgroundColor: active ? color : 'transparent',
        borderWidth: active ? 0 : t, borderColor: color,
      }} />
      {/* Cross hairs — horizontal */}
      <View style={{ position: 'absolute', top: '50%', left: 0, width: size * 0.14, height: t, backgroundColor: color, marginTop: -t / 2 }} />
      <View style={{ position: 'absolute', top: '50%', right: 0, width: size * 0.14, height: t, backgroundColor: color, marginTop: -t / 2 }} />
      {/* Cross hairs — vertical */}
      <View style={{ position: 'absolute', left: '50%', top: 0, height: size * 0.14, width: t, backgroundColor: color, marginLeft: -t / 2 }} />
      <View style={{ position: 'absolute', left: '50%', bottom: 0, height: size * 0.14, width: t, backgroundColor: color, marginLeft: -t / 2 }} />
    </View>
  )
}

// Info — circle with "i"
function IconInfo({ size = 18, color = Colors.primary }: { size?: number; color?: string }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: size * 0.1, borderColor: color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontFamily: Typography.bodySemiBold,
        fontSize: size * 0.52,
        color,
        lineHeight: size * 0.62,
        letterSpacing: 0,
      }}>i</Text>
    </View>
  )
}

// Settings — three horizontal lines with dots (sliders icon)
function IconSettings({ size = 18, color = Colors.textSecondary }: { size?: number; color?: string }) {
  const t   = Math.max(1.5, size * 0.1)
  const gap = size * 0.28
  const dotR = t * 1.4
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', gap: gap * 0.3 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', height: t + dotR * 2 }}>
          {/* Left segment */}
          <View style={{
            flex: i === 0 ? 0.4 : i === 1 ? 0.6 : 0.3,
            height: t, backgroundColor: color, borderRadius: t,
          }} />
          {/* Dot handle */}
          <View style={{
            width: dotR * 2, height: dotR * 2, borderRadius: dotR,
            backgroundColor: color, marginHorizontal: 2,
          }} />
          {/* Right segment */}
          <View style={{ flex: 1, height: t, backgroundColor: color, borderRadius: t }} />
        </View>
      ))}
    </View>
  )
}

// Star / sparkle for recommend button
function IconRecommend({ size = 16, color = Colors.primary }: { size?: number; color?: string }) {
  const t = Math.max(1.5, size * 0.11)
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Vertical bar */}
      <View style={{ position: 'absolute', width: t, height: size, backgroundColor: color, borderRadius: t }} />
      {/* Horizontal bar */}
      <View style={{ position: 'absolute', height: t, width: size, backgroundColor: color, borderRadius: t }} />
      {/* Diagonal 1 */}
      <View style={{
        position: 'absolute', width: t, height: size * 0.65,
        backgroundColor: color, borderRadius: t,
        transform: [{ rotate: '45deg' }],
      }} />
      {/* Diagonal 2 */}
      <View style={{
        position: 'absolute', width: t, height: size * 0.65,
        backgroundColor: color, borderRadius: t,
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  )
}

// Lock icon — body + shackle
function IconLock({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  const t     = Math.max(1.5, size * 0.14)
  const body  = size * 0.55
  const shack = size * 0.44
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      {/* Shackle */}
      <View style={{
        width: shack, height: shack * 0.75,
        borderLeftWidth: t, borderRightWidth: t, borderTopWidth: t,
        borderColor: color, borderTopLeftRadius: shack / 2, borderTopRightRadius: shack / 2,
        marginBottom: -t * 0.5,
      }} />
      {/* Body */}
      <View style={{
        width: body, height: body * 0.72,
        backgroundColor: color, borderRadius: 3,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          width: t * 1.5, height: body * 0.35,
          backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 2,
        }} />
      </View>
    </View>
  )
}

// Category dot — colored circle used in search results and markers
function CategoryDot({ color }: { color: string }) {
  return (
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
  )
}

// History / trail icon — clock with arrow
function IconHistory({ size = 18, color = Colors.textSecondary }: { size?: number; color?: string }) {
  const t = Math.max(1.5, size * 0.1)
  const r = size * 0.42
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Clock face */}
      <View style={{
        width: r * 2, height: r * 2, borderRadius: r,
        borderWidth: t, borderColor: color,
        alignItems: 'center', justifyContent: 'center',
        position: 'absolute',
      }} />
      {/* Hour hand */}
      <View style={{
        position: 'absolute',
        width: t, height: r * 0.52,
        backgroundColor: color, borderRadius: t,
        bottom: '50%', left: '50%',
        marginLeft: -t / 2,
        transformOrigin: 'bottom center',
        transform: [{ rotate: '-30deg' }],
      }} />
      {/* Minute hand */}
      <View style={{
        position: 'absolute',
        width: t, height: r * 0.72,
        backgroundColor: color, borderRadius: t,
        bottom: '50%', left: '50%',
        marginLeft: -t / 2,
        transformOrigin: 'bottom center',
        transform: [{ rotate: '60deg' }],
      }} />
      {/* Counter-clockwise dot accent (top-left) */}
      <View style={{
        position: 'absolute', top: -t * 0.5, left: size * 0.08,
        width: t * 2, height: t * 2, borderRadius: t,
        backgroundColor: color,
      }} />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Pulsing user location marker (Pokémon GO style)
// ---------------------------------------------------------------------------
function PulsingUserMarker({ coordinate }: { coordinate: [number, number] }) {
  const pulse1 = useRef(new Animated.Value(0)).current
  const pulse2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse1, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    )
    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(pulse2, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse2, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    )
    anim1.start()
    anim2.start()
    return () => { anim1.stop(); anim2.stop() }
  }, [])

  const pulseStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.55, 0.3, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] }) }],
  })

  return (
    <MapboxGL.MarkerView coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={pulseStyle(pulse1)} />
        <Animated.View style={pulseStyle(pulse2)} />
        {/* Accuracy halo */}
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: Colors.primary + '22',
          borderWidth: 1.5, borderColor: Colors.primary + '55',
          position: 'absolute',
        }} />
        {/* Core dot */}
        <View style={{
          width: 14, height: 14, borderRadius: 7,
          backgroundColor: Colors.primary,
          borderWidth: 2.5, borderColor: '#ffffff',
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
          elevation: 8,
        }} />
      </View>
    </MapboxGL.MarkerView>
  )
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
                  <IconLock size={13} color="#fff" />
                </View>
              )}
            </>
          ) : (
            // Category initial letter — clean typographic marker
            <Text style={[styles.markerLetter, !isUnlocked && { opacity: 0.5 }]}>
              {site.category.charAt(0).toUpperCase()}
            </Text>
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
  // Derive a category color from tint or fall back to primary
  const dotColor = (config as any).color ?? Colors.primary

  return (
    <TouchableOpacity style={styles.searchResult} onPress={onPress} activeOpacity={0.7}>
      {/* Category initial in a small badge */}
      <View style={[styles.searchResultBadge, { backgroundColor: dotColor + '18', borderColor: dotColor + '40' }]}>
        <Text style={[styles.searchResultBadgeTxt, { color: dotColor }]}>
          {site.category.charAt(0).toUpperCase()}
        </Text>
      </View>
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
    { key: 'walking', label: 'Walk' },
    { key: 'driving', label: 'Drive' },
    { key: 'cycling', label: 'Cycle' },
  ]

  return (
    <View style={styles.routePill}>
      {/* Distance + duration */}
      <View style={styles.routeInfo}>
        <Text style={styles.routeDistance}>{formatRouteDistance(route.distanceMeters)}</Text>
        <Text style={styles.routeDot}>·</Text>
        <Text style={styles.routeDuration}>{formatDuration(route.durationSeconds)}</Text>
      </View>

      {/* Profile switcher — text labels */}
      <View style={styles.profileRow}>
        {profiles.map(({ key, label }) => {
          const isActive = route.profile === key
          return (
            <TouchableOpacity
              key={key}
              style={[styles.profileBtn, isActive && styles.profileBtnActive]}
              onPress={() => onChangeProfile(key)}
            >
              <Text style={[styles.profileBtnTxt, isActive && styles.profileBtnTxtActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Clear button */}
      <TouchableOpacity style={styles.routeClearBtn} onPress={onClear}>
        <IconClose size={10} color={Colors.textMuted} />
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
  const [questExpanded, setQuestExpanded] = useState(true)

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

  // Pulse animation for route line
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
    }, 32)
    return () => clearInterval(interval)
  }, [activeRoute])

  const pulseOpacity = 0.15 + pulsePhase * 0.4
  const pulseWidth   = 10  + pulsePhase * 8

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
  // Directions
  // ---------------------------------------------------------------------------
  async function handleGetDirections(site: TourismSite, profile: RouteProfile = 'walking') {
    if (!userLocation) {
      setRouteError('Your location is not available yet.')
      return
    }

    activeRouteSite.current = site
    setRouteError(null)

    if (!routeCache.current[profile] || activeRouteSite.current?.id !== site.id) {
      routeCache.current = {}
    }

    if (routeCache.current[profile]) {
      setActiveRoute(routeCache.current[profile]!)
      fitCameraToRoute(site)
      prefetchMissingProfiles(site)
      return
    }

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
    if (routeCache.current[profile]) {
      setActiveRoute(routeCache.current[profile]!)
      fitCameraToRoute(site)
      return
    }
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
          if (state.gestures?.isGestureActive) setFollowUserLocation(false)
        }}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
        compassPosition={{ top: Platform.OS === 'android' ? 116 : 124, right: Spacing.md }}
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

        {/* Custom pulsing user location marker */}
        {userLocation && (
          <PulsingUserMarker
            coordinate={[userLocation.longitude, userLocation.latitude]}
          />
        )}

        {/* ── Route line ── */}
        {activeRoute && (
          <MapboxGL.ShapeSource id="route-source" shape={routeGeoJSON}>
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
            <MapboxGL.LineLayer
              id="route-casing"
              style={{
                lineColor: '#ffffff',
                lineWidth: 8,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
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
              <Text style={styles.destinationPinLetter}>
                {selectedSite.category.charAt(0).toUpperCase()}
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
          <TouchableOpacity onPress={() => setRouteError(null)} style={{ paddingLeft: 8 }}>
            <IconClose size={11} color={Colors.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom-left: recommend button ── */}
      <TouchableOpacity
        style={styles.recommendBtn}
        onPress={() => router.push('/(tabs)/recommend')}
        activeOpacity={0.85}
      >
        <IconRecommend size={16} color={Colors.primary} />
      </TouchableOpacity>

      {/* ── Right-side cluster: recenter + history + info + settings ── */}
      {/* Shifts down when route pill is visible to avoid overlap */}
      <View style={[styles.rightCluster, activeRoute && styles.rightClusterWithRoute]}>
        {userLocation && (
          <TouchableOpacity
            style={[styles.clusterBtn, followUserLocation && styles.clusterBtnActive]}
            onPress={flyToUser}
            activeOpacity={0.85}
          >
            <IconLocation size={18} color={Colors.primary} active={followUserLocation} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.clusterBtn}
          onPress={() => router.push('/(tabs)/history')}
          activeOpacity={0.85}
        >
          <IconHistory size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.clusterBtn}
          onPress={() => setInfoVisible(true)}
          activeOpacity={0.85}
        >
          <IconInfo size={18} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.clusterBtn}
          onPress={() => router.push('/(tabs)/settings')}
          activeOpacity={0.85}
        >
          <IconSettings size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <IconSearch size={16} color={Colors.textMuted} />
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
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <IconClose size={10} color={Colors.textMuted} />
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

      {/* ── Route info pill — sits below search bar ── */}
      {activeRoute && (
        <View style={styles.routePillContainer}>
          <RouteInfoPill
            route={activeRoute}
            onClear={handleClearRoute}
            onChangeProfile={handleChangeProfile}
          />
        </View>
      )}

      {/* ── Quest / exploration tracker — left side, collapsible ── */}
      {sites.length > 0 && (
        <View style={[styles.questPanel, activeRoute && styles.questPanelWithRoute]}>
          {/* Tab / handle — always visible, tap to toggle */}
          <TouchableOpacity
            style={styles.questTab}
            onPress={() => setQuestExpanded((v) => !v)}
            activeOpacity={0.8}
          >
            {/* Vertical progress bar strip */}
            <View style={styles.questTabTrack}>
              <View style={[
                styles.questTabFill,
                { height: `${Math.round((unlockedSiteIds.size / sites.length) * 100)}%` },
              ]} />
            </View>
            {/* Count badge */}
            <View style={styles.questTabBadge}>
              <Text style={styles.questTabCount}>{unlockedSiteIds.size}</Text>
            </View>
            {/* Collapse/expand arrow */}
            <Text style={styles.questTabArrow}>{questExpanded ? '‹' : '›'}</Text>
          </TouchableOpacity>

          {/* Expanded body */}
          {questExpanded && (
            <TouchableOpacity
              style={styles.questBody}
              onPress={() => router.push('/(tabs)/history')}
              activeOpacity={0.85}
            >
              <Text style={styles.questTitle}>Exploration Trail</Text>
              {/* Fraction */}
              <View style={styles.questFractionRow}>
                <Text style={styles.questCountBig}>{unlockedSiteIds.size}</Text>
                <Text style={styles.questSlash}>/{sites.length}</Text>
              </View>
              {/* Horizontal progress bar */}
              <View style={styles.questBarTrack}>
                <View style={[
                  styles.questBarFill,
                  { width: `${Math.round((unlockedSiteIds.size / sites.length) * 100)}%` },
                ]} />
              </View>
              <Text style={styles.questSub}>
                {unlockedSiteIds.size === 0
                  ? 'Start exploring!'
                  : unlockedSiteIds.size === sites.length
                  ? '🎉 All discovered!'
                  : `${sites.length - unlockedSiteIds.size} left`}
              </Text>
            </TouchableOpacity>
          )}
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

  // ── Markers ──
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
  // Category initial letter replacing emoji
  markerLetter: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 16,
    color: Colors.primary,
    letterSpacing: 0,
  },
  markerImage: { width: 40, height: 40, borderRadius: 20 },
  markerImageLocked: { opacity: 0.55 },
  markerLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
  },
  markerTail: {
    width: 8, height: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: -2,
  },
  markerTailSelected: { backgroundColor: Colors.accent },

  // Destination pin
  destinationPin: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.bgCard,
    borderWidth: 3, borderColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  destinationPinLetter: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 20, color: Colors.accent,
  },

  // ── Route pill ──
  routePillContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 116 : 124,
    left: Spacing.lg, right: Spacing.lg,
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
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
    borderWidth: 1.5, borderColor: Colors.primary + '30',
  },
  routeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  routeDistance: { fontFamily: Typography.bodySemiBold, fontSize: 15, color: Colors.textPrimary },
  routeDot:      { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.textMuted },
  routeDuration: { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.textSecondary },
  profileRow: { flexDirection: 'row', gap: 4 },
  profileBtn: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  profileBtnActive: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  profileBtnTxt: {
    fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textMuted,
  },
  profileBtnTxtActive: {
    color: Colors.primary, fontFamily: Typography.bodySemiBold,
  },
  routeClearBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Route loading / error ──
  routeLoadingOverlay: {
    position: 'absolute', bottom: 200, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderRadius: Radius.full,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  routeLoadingTxt: { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.textSecondary },
  routeErrorBanner: {
    position: 'absolute', bottom: 200, left: Spacing.lg, right: Spacing.lg,
    backgroundColor: Colors.errorLight, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: '#F5C6C1',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  routeErrorTxt: { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.error, flex: 1 },

  // ── Right cluster ──
  rightCluster: {
    position: 'absolute', bottom: 260, right: Spacing.md,
    flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 15,
  },
  // Shift up when route pill occupies the top area — avoids no conflict needed
  // (route pill is at top, cluster is at bottom, so no shift needed for cluster)
  rightClusterWithRoute: {
    bottom: 260,
  },
  recommendBtn: {
    position: 'absolute', bottom: 100, left: Spacing.md,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
    borderWidth: 1.5, borderColor: Colors.border, zIndex: 10,
  },
  clusterBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)',
  },
  clusterBtnActive: { backgroundColor: '#E8F4FD', borderColor: Colors.primary },

  // ── Search ──
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 52 : 60,
    left: Spacing.lg, right: Spacing.lg, zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md, height: 52, gap: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 6,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  searchBarFocused: { borderColor: Colors.borderFocus },
  searchInput: {
    flex: 1, fontFamily: Typography.bodyFont, fontSize: 15,
    color: Colors.textPrimary, height: '100%',
  },
  searchDropdown: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    marginTop: 6, maxHeight: 220,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 6, overflow: 'hidden',
  },
  searchResult: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12, gap: 10,
  },
  // Category badge replacing emoji in search results
  searchResultBadge: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  searchResultBadgeTxt: {
    fontFamily: Typography.bodySemiBold, fontSize: 13,
  },
  searchResultText: { flex: 1 },
  searchResultName: { fontFamily: Typography.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  searchResultSub:  { fontFamily: Typography.bodyFont,   fontSize: 12, color: Colors.textMuted },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: 52 },

  // ── Loading / error badges ──
  locationLoadingBadge: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: Radius.full,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  locationLoadingTxt: { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.textSecondary },
  errorBanner: {
    position: 'absolute', bottom: 100, left: Spacing.lg, right: Spacing.lg,
    backgroundColor: Colors.errorLight, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: '#F5C6C1',
  },
  errorBannerTxt: { fontFamily: Typography.bodyFont, fontSize: 13, color: Colors.error, textAlign: 'center' },

  // ── Quest / exploration panel (left side, collapsible) ──
  questPanel: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 172 : 180,
    left: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 12,
  },
  // When route pill is active, push the quest panel further down to avoid overlap
  questPanelWithRoute: {
    top: Platform.OS === 'android' ? 232 : 240,
  },
  // The always-visible tab/handle on the left edge
  questTab: {
    width: 28,
    paddingVertical: 10,
    paddingLeft: 4,
    paddingRight: 2,
    backgroundColor: Colors.bgCard,
    borderTopRightRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: Colors.border,
  },
  questTabTrack: {
    width: 4, height: 52, borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  questTabFill: {
    width: '100%', borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  questTabBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  questTabCount: {
    fontFamily: Typography.bodySemiBold, fontSize: 10,
    color: Colors.textInverse, lineHeight: 12,
  },
  questTabArrow: {
    fontFamily: Typography.bodySemiBold, fontSize: 13,
    color: Colors.textMuted, lineHeight: 14,
  },
  // Expanded body panel
  questBody: {
    backgroundColor: Colors.bgCard,
    borderTopRightRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingLeft: Spacing.sm,
    gap: 5,
    minWidth: 130,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: Colors.border,
  },
  questTitle: {
    fontFamily: Typography.bodySemiBold, fontSize: 11,
    color: Colors.textPrimary, letterSpacing: 0.1,
  },
  questFractionRow: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  questCountBig: {
    fontFamily: Typography.displayFont, fontSize: 26,
    color: Colors.primary, lineHeight: 30,
  },
  questSlash: {
    fontFamily: Typography.bodyFont, fontSize: 13,
    color: Colors.textMuted,
  },
  questBarTrack: {
    height: 5, borderRadius: 3,
    backgroundColor: Colors.border, overflow: 'hidden',
  },
  questBarFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  questSub: {
    fontFamily: Typography.bodyFont, fontSize: 10,
    color: Colors.textMuted, lineHeight: 13,
  },

  // ── Dev sign-out ──
  devSignOut: {
    position: 'absolute', top: Platform.OS === 'android' ? 52 : 60,
    right: Spacing.lg + 200, display: 'none',
  },
  devSignOutTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.error },
})
