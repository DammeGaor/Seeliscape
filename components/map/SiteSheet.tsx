import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
} from 'react-native'
import { TourismSite, CATEGORY_CONFIG, formatDistance, getDistanceMeters } from '@/lib/tourism-sites'
import { useMapStore } from '@/store/map.store'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

const { height: SCREEN_H } = Dimensions.get('window')
const SHEET_HEIGHT = SCREEN_H * 0.45

interface SiteSheetProps {
  site: TourismSite
  onClose: () => void
}

export function SiteSheet({ site, onClose }: SiteSheetProps) {
  const { userLocation, unlockedSiteIds, unlockSite } = useMapStore()
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current

  const config = CATEGORY_CONFIG[site.category]

  const distanceMeters = userLocation
    ? getDistanceMeters(
        userLocation.latitude, userLocation.longitude,
        site.coordinates.latitude, site.coordinates.longitude,
      )
    : null

  const isUnlocked = unlockedSiteIds.has(site.id)
  const isInRange = distanceMeters !== null && distanceMeters <= site.unlockRadiusMeters

  // Auto-unlock when in range
  useEffect(() => {
    if (isInRange && !isUnlocked) {
      unlockSite(site.id)
    }
  }, [isInRange, isUnlocked, site.id])

  // Slide up animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start()
  }, [])

  function handleClose() {
    Animated.timing(slideAnim, {
      toValue: SHEET_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose)
  }

  // Swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 60) handleClose()
      },
    })
  ).current

  return (
    <Animated.View
      style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
    >
      {/* Drag handle */}
      <View {...panResponder.panHandlers} style={styles.dragArea}>
        <View style={styles.handle} />
      </View>

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
        <Text style={styles.closeTxt}>✕</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Category badge */}
        <View style={styles.topRow}>
          <View style={[styles.categoryBadge, { backgroundColor: config.color + '18' }]}>
            <Text style={styles.categoryEmoji}>{config.emoji}</Text>
            <Text style={[styles.categoryLabel, { color: config.color }]}>
              {site.category.charAt(0).toUpperCase() + site.category.slice(1)}
            </Text>
          </View>

          {distanceMeters !== null && (
            <View style={[styles.distanceBadge, isInRange && styles.distanceBadgeClose]}>
              <Text style={[styles.distanceTxt, isInRange && styles.distanceTxtClose]}>
                {isInRange ? '📍 You\'re here!' : `${formatDistance(distanceMeters)} away`}
              </Text>
            </View>
          )}
        </View>

        {/* Site name */}
        <Text style={styles.siteName}>{site.name}</Text>
        <Text style={styles.siteLocation}>{site.barangay}, {site.municipality}</Text>

        {/* Unlock state */}
        {isUnlocked ? (
          <>
            {/* Unlocked — show full description */}
            <View style={styles.unlockedBanner}>
              <Text style={styles.unlockedIcon}>🔓</Text>
              <Text style={styles.unlockedTxt}>Site unlocked! You visited this location.</Text>
            </View>
            <Text style={styles.description}>{site.description}</Text>
          </>
        ) : (
          <>
            {/* Locked — show teaser */}
            <Text style={styles.description}>{site.shortDescription}</Text>
            <View style={styles.lockedBanner}>
              <Text style={styles.lockedIcon}>🔒</Text>
              <View>
                <Text style={styles.lockedTitle}>Visit to unlock</Text>
                <Text style={styles.lockedSub}>
                  Get within {site.unlockRadiusMeters >= 1000
                    ? `${(site.unlockRadiusMeters / 1000).toFixed(1)}km`
                    : `${site.unlockRadiusMeters}m`} to unlock full details
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  dragArea: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  categoryEmoji: { fontSize: 13 },
  categoryLabel: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  distanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  distanceBadgeClose: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  distanceTxt: {
    fontFamily: Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textMuted,
  },
  distanceTxtClose: { color: Colors.success },

  siteName: {
    fontFamily: Typography.displayFont,
    fontSize: 26,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 4,
  },
  siteLocation: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },

  // Unlocked
  unlockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  unlockedIcon: { fontSize: 16 },
  unlockedTxt: {
    fontFamily: Typography.bodyMedium,
    fontSize: 13,
    color: Colors.success,
    flex: 1,
  },

  description: {
    fontFamily: Typography.bodyFont,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 23,
  },

  // Locked
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  lockedIcon: { fontSize: 22 },
  lockedTitle: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  lockedSub: {
    fontFamily: Typography.bodyFont,
    fontSize: 12,
    color: Colors.textMuted,
  },
})
