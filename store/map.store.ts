import { create } from 'zustand'
import { TourismSite } from '@/lib/tourism-sites'

interface UserLocation {
  latitude: number
  longitude: number
  accuracy?: number
}

interface MapState {
  // User location
  userLocation: UserLocation | null
  locationError: string | null
  locationLoading: boolean

  // Site interaction
  selectedSite: TourismSite | null
  unlockedSiteIds: Set<string>         // sites the user has physically visited

  // Map camera
  followUserLocation: boolean

  // Actions
  setUserLocation: (loc: UserLocation) => void
  setLocationError: (err: string | null) => void
  setLocationLoading: (v: boolean) => void
  setSelectedSite: (site: TourismSite | null) => void
  unlockSite: (siteId: string) => void
  setFollowUserLocation: (v: boolean) => void
}

export const useMapStore = create<MapState>((set) => ({
  userLocation: null,
  locationError: null,
  locationLoading: true,
  selectedSite: null,
  unlockedSiteIds: new Set(),
  followUserLocation: true,

  setUserLocation: (loc) => set({ userLocation: loc, locationLoading: false, locationError: null }),
  setLocationError: (err) => set({ locationError: err, locationLoading: false }),
  setLocationLoading: (v) => set({ locationLoading: v }),
  setSelectedSite: (site) => set({ selectedSite: site }),
  unlockSite: (siteId) =>
    set((state) => ({
      unlockedSiteIds: new Set([...state.unlockedSiteIds, siteId]),
    })),
  setFollowUserLocation: (v) => set({ followUserLocation: v }),
}))
