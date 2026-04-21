import React, { useEffect, useRef, useState, useCallback } from 'react'
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
} from 'react-native'
import MapboxGL from '@rnmapbox/maps'
import * as Location from 'expo-location'
import { useMapStore } from '@/store/map.store'
import { SiteSheet } from '@/components/map/SiteSheet'
import { signOut } from '@/lib/auth.service'
import { router } from 'expo-router'
import {
  ALBAY_SITES,
  TourismSite,
  CATEGORY_CONFIG,
  getDistanceMeters,
  formatDistance,
} from '@/lib/tourism-sites'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

// ---------------------------------------------------------------------------
// Set your Mapbox public token here (from mapbox.com → Tokens)
// ---------------------------------------------------------------------------
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')

// Albay center coordinates
const ALBAY_CENTER: [number, number] = [123.7, 13.18]
const DEFAULT_ZOOM = 11

// ---------------------------------------------------------------------------
// Custom marker component for each tourism site
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
          <Text style={styles.markerEmoji}>{config.emoji}</Text>
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
    setUserLocation,
    setLocationError,
    setLocationLoading,
    setSelectedSite,
    setFollowUserLocation,
  } = useMapStore()

  const cameraRef = useRef<MapboxGL.Camera>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [proximityAlerts, setProximityAlerts] = useState<string[]>([])

  // Filtered search results
  const searchResults = searchQuery.trim().length > 0
    ? ALBAY_SITES.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.municipality.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  // ---------------------------------------------------------------------------
  // Location permission + watch
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null

    async function startTracking() {
      setLocationLoading(true)
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setLocationError('Location permission denied. Enable it in Settings to see nearby sites.')
        return
      }

      // Get initial position quickly
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      setUserLocation({
        latitude: initial.coords.latitude,
        longitude: initial.coords.longitude,
        accuracy: initial.coords.accuracy ?? undefined,
      })

      // Watch position for proximity detection
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
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
  }, [])

  // ---------------------------------------------------------------------------
  // Proximity check — alert when entering a site's unlock radius
  // ---------------------------------------------------------------------------
  function checkProximity(lat: number, lon: number) {
    ALBAY_SITES.forEach((site) => {
      const dist = getDistanceMeters(lat, lon, site.coordinates.latitude, site.coordinates.longitude)
      if (dist <= site.unlockRadiusMeters && !proximityAlerts.includes(site.id)) {
        setProximityAlerts((prev) => [...prev, site.id])
        // Auto-select the site so the sheet opens
        setSelectedSite(site)
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Fly camera to user location
  // ---------------------------------------------------------------------------
  function flyToUser() {
    if (!userLocation) return
    setFollowUserLocation(true)
    cameraRef.current?.flyTo(
      [userLocation.longitude, userLocation.latitude],
      600,
    )
  }

  // ---------------------------------------------------------------------------
  // Fly camera to a specific site
  // ---------------------------------------------------------------------------
  function flyToSite(site: TourismSite) {
    setFollowUserLocation(false)
    cameraRef.current?.flyTo(
      [site.coordinates.longitude, site.coordinates.latitude],
      600,
    )
  }

  // ---------------------------------------------------------------------------
  // Select a site from marker tap or search
  // ---------------------------------------------------------------------------
  function handleSelectSite(site: TourismSite) {
    setSelectedSite(site)
    flyToSite(site)
    setSearchQuery('')
    Keyboard.dismiss()
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* ── Mapbox Map ── */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Outdoors}
        onPress={() => {
          setFollowUserLocation(false)
          if (!searchFocused) setSelectedSite(null)
          Keyboard.dismiss()
        }}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
        compassPosition={{ top: 120, right: Spacing.lg }}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={
            userLocation
              ? [userLocation.longitude, userLocation.latitude]
              : ALBAY_CENTER
          }
          zoomLevel={DEFAULT_ZOOM}
          animationMode="flyTo"
          animationDuration={800}
        />

        {/* User location puck */}
        <MapboxGL.UserLocation
          visible
          showsUserHeadingIndicator
          renderMode={MapboxGL.UserLocationRenderMode.Native}
        />

        {/* Tourism site markers */}
        {ALBAY_SITES.map((site) => (
          <SiteMarker
            key={site.id}
            site={site}
            isUnlocked={unlockedSiteIds.has(site.id)}
            isSelected={selectedSite?.id === site.id}
            onPress={() => handleSelectSite(site)}
          />
        ))}
      </MapboxGL.MapView>

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

        {/* Search results dropdown */}
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

      {/* ── Location loading indicator ── */}
      {locationLoading && (
        <View style={styles.locationLoadingBadge}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.locationLoadingTxt}>Finding your location…</Text>
        </View>
      )}

      {/* ── Location error banner ── */}
      {locationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTxt}>{locationError}</Text>
        </View>
      )}

      {/* ── Re-centre button ── */}
      {!followUserLocation && userLocation && (
        <TouchableOpacity style={styles.recenterBtn} onPress={flyToUser}>
          <Text style={styles.recenterIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {/* ── Site counter pill ── */}
      <View style={styles.counterPill}>
        <Text style={styles.counterTxt}>
          {unlockedSiteIds.size}/{ALBAY_SITES.length} sites unlocked
        </Text>
      </View>

      {/* ── Dev sign-out (remove in production) ── */}
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

  // Markers
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
  markerLocked: {
    borderColor: Colors.border,
    opacity: 0.75,
  },
  markerEmoji: { fontSize: 20 },
  markerTail: {
    width: 8,
    height: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: -2,
  },
  markerTailSelected: { backgroundColor: Colors.accent },

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

  // Re-centre button
  recenterBtn: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 160,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  recenterIcon: { fontSize: 22, color: Colors.primary },

  // Counter pill
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

  // Dev sign-out
  devSignOut: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 52 : 60,
    right: Spacing.lg + 200,
    display: 'none', // hidden — use the sign out in the sheet or add a profile tab later
  },
  devSignOutTxt: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.error,
  },
})
