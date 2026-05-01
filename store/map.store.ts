import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as SecureStore from 'expo-secure-store'
import { TourismSite } from '@/lib/tourism-sites'

interface UserLocation {
  latitude: number
  longitude: number
  accuracy?: number
}

// ---------------------------------------------------------------------------
// Landmark IDs that have AR features enabled.
// landmark_id values from the ar_objects table: Cagsawa Ruins, Albay Park & Wildlife, Farmplate
// ---------------------------------------------------------------------------
const AR_ENABLED_LANDMARK_IDS = new Set(['577', '387', '457'])

interface MapState {
  // User location — never persisted (always re-acquired on open)
  userLocation: UserLocation | null
  locationError: string | null
  locationLoading: boolean

  // Site interaction
  selectedSite: TourismSite | null
  unlockedSiteIds: Set<string>

  // AR — which sites have AR features (constant, not persisted)
  arEnabledSiteIds: Set<string>

  // Map camera
  followUserLocation: boolean

  // Settings — persisted
  proximityAlerts: boolean
  highAccuracy: boolean
  showUnlocked: boolean

  // Pending directions — set by recommend screen, consumed by map screen
  pendingDirectionsSiteId: string | null

  // Actions
  setUserLocation: (loc: UserLocation) => void
  setLocationError: (err: string | null) => void
  setLocationLoading: (v: boolean) => void
  setSelectedSite: (site: TourismSite | null) => void
  unlockSite: (siteId: string) => void
  clearUnlockedSites: () => void
  setFollowUserLocation: (v: boolean) => void
  setProximityAlerts: (v: boolean) => void
  setHighAccuracy: (v: boolean) => void
  setShowUnlocked: (v: boolean) => void
  setPendingDirectionsSiteId: (id: string | null) => void
}

// expo-secure-store adapter for zustand persist
// Splits unlocked site IDs into a separate key to stay under the 2KB per-key limit
const secureStoreAdapter = createJSONStorage(() => ({
  getItem: async (name: string) => {
    const value = await SecureStore.getItemAsync(name)
    return value ?? null
  },
  setItem: async (name: string, value: string) => {
    // expo-secure-store has a ~2048 byte limit per key.
    // The settings fields are tiny; only unlockedSiteIds can grow.
    // We store them in a separate key to keep each entry well under the limit.
    const parsed = JSON.parse(value)
    const { unlockedSiteIds, ...rest } = parsed.state ?? {}

    await SecureStore.setItemAsync(
      name,
      JSON.stringify({ ...parsed, state: rest })
    )
    await SecureStore.setItemAsync(
      `${name}_unlocked`,
      JSON.stringify(unlockedSiteIds ?? [])
    )
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name)
    await SecureStore.deleteItemAsync(`${name}_unlocked`)
  },
}), {
  replacer: (_key, value) => {
    if (value instanceof Set) return { __type: 'Set', values: [...value] }
    return value
  },
  reviver: (_key, value: unknown) => {
    if (value && typeof value === 'object' && (value as Record<string, unknown>).__type === 'Set') {
      return new Set((value as Record<string, unknown[]>).values)
    }
    return value
  },
})

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      // ── Non-persisted (runtime only) ────────────────────────────────────
      userLocation: null,
      locationError: null,
      locationLoading: true,
      selectedSite: null,
      followUserLocation: true,
      pendingDirectionsSiteId: null,

      // AR-enabled site IDs — constant, never persisted
      arEnabledSiteIds: AR_ENABLED_LANDMARK_IDS,

      // ── Persisted ───────────────────────────────────────────────────────
      unlockedSiteIds: new Set(),
      proximityAlerts: true,
      highAccuracy: true,
      showUnlocked: true,

      // ── Actions ─────────────────────────────────────────────────────────
      setUserLocation:   (loc)  => set({ userLocation: loc, locationLoading: false, locationError: null }),
      setLocationError:  (err)  => set({ locationError: err, locationLoading: false }),
      setLocationLoading:(v)    => set({ locationLoading: v }),
      setSelectedSite:   (site) => set({ selectedSite: site }),
      unlockSite: (siteId) =>
        set((state) => ({
          unlockedSiteIds: new Set([...state.unlockedSiteIds, siteId]),
        })),
      clearUnlockedSites:         ()   => set({ unlockedSiteIds: new Set() }),
      setFollowUserLocation:      (v)  => set({ followUserLocation: v }),
      setProximityAlerts:         (v)  => set({ proximityAlerts: v }),
      setHighAccuracy:            (v)  => set({ highAccuracy: v }),
      setShowUnlocked:            (v)  => set({ showUnlocked: v }),
      setPendingDirectionsSiteId: (id) => set({ pendingDirectionsSiteId: id }),
    }),
    {
      name: 'seeliscape-map-store',
      storage: secureStoreAdapter,

      // Only persist settings + unlocked sites — not runtime state
      // arEnabledSiteIds is intentionally excluded (it's a constant)
      partialize: (state) => ({
        unlockedSiteIds: state.unlockedSiteIds,
        proximityAlerts: state.proximityAlerts,
        highAccuracy:    state.highAccuracy,
        showUnlocked:    state.showUnlocked,
      }),
    }
  )
)