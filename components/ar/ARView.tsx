import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
  StatusBar,
} from 'react-native'
import {
  ViroARScene,
  ViroARSceneNavigator,
  Viro3DObject,
  ViroImage,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroNode,
  ViroSphere,
} from '@reactvision/react-viro'
import { ARObject } from '@/lib/ar.types'
import { fetchARObjects } from '@/lib/ar.service'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlacedObject {
  obj: ARObject
  position: [number, number, number]
}

// ---------------------------------------------------------------------------
// Inner AR scene
// ---------------------------------------------------------------------------

interface SceneProps {
  placedObjects: PlacedObject[]
  queueLength: number
  onPlaceObject: (position: [number, number, number]) => void
  onSelectObject: (obj: ARObject) => void
  onSceneRef: (ref: any) => void
}

function ARScene({ sceneNavigator }: { sceneNavigator: { viroAppProps: SceneProps } }) {
  const { placedObjects, queueLength, onPlaceObject, onSelectObject, onSceneRef } =
    sceneNavigator.viroAppProps

  // Expose the ViroARScene ref up to ARView so the native tap overlay
  // can call performARHitTestWithRay without needing Viro onClick.
  const arSceneRef = useRef<any>(null)
  const setRef = useCallback((ref: any) => {
    arSceneRef.current = ref
    onSceneRef(ref)
  }, [onSceneRef])

  console.log('[ARScene] 🔄 render', {
    queueLength,
    placedCount: placedObjects.length,
  })

  return (
    <ViroARScene ref={setRef}>
      <ViroAmbientLight color="#ffffff" intensity={200} />
      <ViroDirectionalLight
        color="#ffffff"
        direction={[0, -1, -0.5]}
        intensity={300}
        castsShadow
      />

      {/* Render every placed object at its locked world position */}
      {placedObjects.map(({ obj, position }) => (
        <ViroNode key={obj.id} position={position} transformBehaviors={['billboardY']}>
          {/* Invisible sphere — generous tap hitbox so the user doesn't
              have to precisely tap the model geometry.
              onClick is always registered; the overlay only intercepts taps
              when queueLength > 0, but we also handle selection from the
              overlay itself via performARHitTestWithPoint so both paths work. */}
          <ViroSphere
            radius={obj.scale * 200}
            onClick={() => onSelectObject(obj)}
            materials={[]}
            opacity={0}
          />
          {obj.imageUrl ? (
            // Flat image card — rendered as a billboard plane.
            // Width/height ratio derived from the image; scale controls real-world size in metres.
            <ViroImage
              source={{ uri: obj.imageUrl }}
              width={obj.scale * 2}
              height={obj.scale * 2.8}
              onClick={() => onSelectObject(obj)}
              resizeMode="ScaleToFit"
            />
          ) : (
            <Viro3DObject
              source={{ uri: obj.modelUrl }}
              type="GLB"
              scale={[obj.scale, obj.scale, obj.scale]}
              onClick={() => onSelectObject(obj)}
            />
          )}
        </ViroNode>
      ))}
    </ViroARScene>
  )
}

// ---------------------------------------------------------------------------
// Info panel — slides up when a placed AR object is tapped
// ---------------------------------------------------------------------------

function ObjectInfoPanel({ obj, onClose }: { obj: ARObject; onClose: () => void }) {
  const slideAnim = useRef(new Animated.Value(200)).current

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
      toValue: 200,
      duration: 200,
      useNativeDriver: true,
    }).start(onClose)
  }

  return (
    <Animated.View style={[styles.infoPanel, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.infoPanelHandle} />
      <TouchableOpacity style={styles.infoPanelClose} onPress={handleClose}>
        <Text style={styles.infoPanelCloseTxt}>✕</Text>
      </TouchableOpacity>
      <Text style={styles.infoPanelEmoji}></Text>
      <Text style={styles.infoPanelName}>{obj.name}</Text>
      {obj.description ? (
        <Text style={styles.infoPanelDesc}>{obj.description}</Text>
      ) : null}
    </Animated.View>
  )
}


// ---------------------------------------------------------------------------
// Placed toast — brief confirmation pill when an object is locked into the scene
// ---------------------------------------------------------------------------

function PlacedToast({ obj, onDone }: { obj: ARObject; onDone: () => void }) {
  const scale   = useRef(new Animated.Value(0.6)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      // Pop in
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1,   useNativeDriver: true, tension: 180, friction: 12 }),
        Animated.timing(opacity, { toValue: 1,   duration: 150, useNativeDriver: true }),
      ]),
      // Hold
      Animated.delay(1400),
      // Fade out
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(onDone)
  }, [])

  return (
    <Animated.View style={[styles.placedToast, { opacity, transform: [{ scale }] }]}>
      <Text style={styles.placedToastCheck}>✓</Text>
      <Text style={styles.placedToastTxt} numberOfLines={1}>{obj.name} placed</Text>
    </Animated.View>
  )
}

// ---------------------------------------------------------------------------
// Scan hint — context-aware message at the bottom of the screen
// ---------------------------------------------------------------------------

function ScanHint({
  loading,
  error,
  totalObjects,
  placedCount,
  queueLength,
}: {
  loading: boolean
  error: boolean
  totalObjects: number
  placedCount: number
  queueLength: number
}) {
  let message: string

  if (loading) {
    message = 'Loading AR objects…'
  } else if (error) {
    return null
  } else if (totalObjects === 0) {
    message = 'No AR objects found for this landmark'
  } else if (queueLength > 0) {
    message =
      placedCount === 0
        ? 'Point at a flat surface and tap to place the first object'
        : `${queueLength} object${queueLength !== 1 ? 's' : ''} remaining — tap a surface to place the next`
  } else {
    message = `All ${totalObjects} object${totalObjects !== 1 ? 's' : ''} placed — tap any to learn more`
  }

  return (
    <View style={styles.scanHint}>
      <Text style={styles.scanHintTxt}>{message}</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Main ARView component
// ---------------------------------------------------------------------------

interface ARViewProps {
  landmarkId: number
  onClose: () => void
}

export function ARView({ landmarkId, onClose }: ARViewProps) {
  const [arObjects, setARObjects]           = useState<ARObject[]>([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [selectedObject, setSelectedObject] = useState<ARObject | null>(null)
  const [placedToast, setPlacedToast]       = useState<ARObject | null>(null)

  // Queue of objects waiting to be placed (index into arObjects array)
  const [queueIndex, setQueueIndex]         = useState(0)
  // Objects that have been tapped into the scene with a locked position
  const [placedObjects, setPlacedObjects]   = useState<PlacedObject[]>([])

  useEffect(() => {
    console.log('[ARView] 🌐 Fetching AR objects for landmarkId:', landmarkId)
    fetchARObjects(landmarkId)
      .then((objects) => {
        console.log('[ARView] ✅ Fetched AR objects:', objects.length, objects.map(o => o.name))
        setARObjects(objects)
      })
      .catch((err) => {
        console.error('[ARView] ❌ Failed to fetch AR objects:', err)
        setError('Failed to load AR content.')
      })
      .finally(() => setLoading(false))
  }, [landmarkId])

  // Derived queue length — how many objects are still waiting to be placed
  const queueLength = arObjects.length - queueIndex

  // Use a ref so handlePlaceObject always sees the latest arObjects and
  // queueIndex without needing them as dependencies (which would cause
  // viroAppProps to change identity and re-mount the scene).
  const arObjectsRef = useRef<ARObject[]>(arObjects)
  const queueIndexRef = useRef(queueIndex)
  useEffect(() => { arObjectsRef.current = arObjects }, [arObjects])
  // (arObjects is set via setARObjects — the ref just mirrors it for stable callbacks)
  useEffect(() => { queueIndexRef.current = queueIndex }, [queueIndex])

  // Called by the scene when the user taps a detected surface.
  // Dequeues the next object and locks it at the tapped world position.
  const handlePlaceObject = useCallback(
    (position: [number, number, number]) => {
      const idx = queueIndexRef.current
      const objects = arObjectsRef.current
      console.log('[ARView] 📦 handlePlaceObject called', {
        position,
        idx,
        totalObjects: objects.length,
        nextObject: objects[idx] ?? null,
      })
      if (idx >= objects.length) {
        console.log('[ARView] ⚠️  handlePlaceObject: idx out of bounds, nothing to place')
        return
      }
      const obj = objects[idx]
      console.log('[ARView] ✅ handlePlaceObject: placing', obj.name, 'at', position)
      setPlacedObjects((prev) => [...prev, { obj, position }])
      setQueueIndex(idx + 1)
      setPlacedToast(obj)
    },
    [], // stable — reads latest values via refs
  )

  const handleSelectObject = useCallback((obj: ARObject) => {
    setSelectedObject(obj)
  }, [])

  // Ref to the ViroARScene instance — set from inside ARScene via onSceneRef
  const arSceneRef = useRef<any>(null)
  const handleSceneRef = useCallback((ref: any) => {
    console.log('[ARView] 📷 scene ref received', !!ref)
    arSceneRef.current = ref
  }, [])

  // Ref mirrors placedObjects so handleARTap can read them without
  // needing placedObjects as a dep (which would re-create the callback).
  const placedObjectsRef = useRef<PlacedObject[]>(placedObjects)
  useEffect(() => { placedObjectsRef.current = placedObjects }, [placedObjects])

  // Called by the native TouchableOpacity overlay on every tap.
  // The overlay is ALWAYS rendered (full-screen, behind HUD) so it catches
  // every tap regardless of queue state. We first check whether the tap
  // lands near an already-placed object and select it if so. Otherwise,
  // if there are objects still queued, we attempt a surface hit-test and place.
  const handleARTap = useCallback(async (event: any) => {
    const touchX = event?.nativeEvent?.locationX ?? 0
    const touchY = event?.nativeEvent?.locationY ?? 0
    console.log('[ARView] 👆 handleARTap — touch:', touchX, touchY, 'queueIndex:', queueIndexRef.current)

    if (!arSceneRef.current) {
      console.log('[ARView] ⚠️ tap ignored — scene ref not ready yet')
      return
    }

    try {
      // --- Step 1: object selection via camera ray -------------------------
      // performARHitTestWithPoint only detects real-world *surfaces*, so it
      // returns nothing when the user taps a floating object in mid-air.
      // Use getCameraOrientationAsync to cast a ray in the camera's forward
      // direction and find the closest placed object in that cone — this works
      // regardless of whether any surface is present behind the object.
      const placed = placedObjectsRef.current
      if (placed.length > 0) {
        try {
          const cameraInfo = await arSceneRef.current.getCameraOrientationAsync()
          console.log('[ARView] 📷 camera orientation:', JSON.stringify(cameraInfo))

          const camPos: [number, number, number] = cameraInfo.position
          const fwd: [number, number, number]    = cameraInfo.forward

          let closestObj: ARObject | null = null
          let smallestAngle = Infinity

          for (const { obj, position: objPos } of placed) {
            const dx = objPos[0] - camPos[0]
            const dy = objPos[1] - camPos[1]
            const dz = objPos[2] - camPos[2]
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
            if (dist === 0) continue

            const dot   = (dx * fwd[0] + dy * fwd[1] + dz * fwd[2]) / dist
            const angle = Math.acos(Math.min(1, Math.max(-1, dot)))

            console.log(`[ARView] 📐 object "${obj.name}" angle=${(angle * 180 / Math.PI).toFixed(1)}° dist=${dist.toFixed(2)}m`)

            // ~15° cone — wide enough to be usable, tight enough to avoid false hits
            if (angle < 0.26 && angle < smallestAngle) {
              smallestAngle = angle
              closestObj = obj
            }
          }

          if (closestObj) {
            console.log('[ARView] ✅ selected object via ray:', closestObj.name)
            handleSelectObject(closestObj)
            return
          }
        } catch (rayErr) {
          console.warn('[ARView] ⚠️ getCameraOrientationAsync failed, falling through to surface hit-test:', rayErr)
        }
      }

      // --- Step 2: place on surface if queue is not empty ------------------
      if (queueIndexRef.current >= arObjectsRef.current.length) {
        console.log('[ARView] ℹ️ tap ignored — no object in crosshair and nothing left to place')
        return
      }

      const hitResults = await arSceneRef.current.performARHitTestWithPoint(touchX, touchY)
      console.log('[ARView] 🎯 surface hit test results:', JSON.stringify(hitResults))

      if (!hitResults || hitResults.length === 0) {
        console.log('[ARView] ⚠️ no surface found — point camera at a textured flat surface')
        return
      }

      // Prefer a confirmed plane; fall back to any intersection
      const hit =
        hitResults.find((r: any) =>
          r.type === 'ExistingPlaneUsingExtent' || r.type === 'ExistingPlane'
        ) ?? hitResults[0]

      const position: [number, number, number] = hit.transform.position
      console.log('[ARView] ✅ placing at', position, 'type:', hit.type)
      handlePlaceObject(position)
    } catch (err) {
      console.error('[ARView] ❌ tap handling failed', err)
    }
  }, [handlePlaceObject, handleSelectObject])

  const viroAppProps = useMemo<SceneProps>(
    () => ({
      placedObjects,
      queueLength,
      onPlaceObject: handlePlaceObject,
      onSelectObject: handleSelectObject,
      onSceneRef: handleSceneRef,
    }),
    [placedObjects, queueLength, handlePlaceObject, handleSelectObject, handleSceneRef],
  )

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* AR camera boots immediately; objects are placed on demand */}
      {!error && (
        <ViroARSceneNavigator
          style={styles.arView}
          autofocus
          initialScene={{ scene: ARScene }}
          viroAppProps={viroAppProps}
        />
      )}

      {/* Native tap overlay — always rendered so both placement taps and
          object-selection taps are routed through handleARTap. The handler
          itself decides whether to place or select based on hit-test results. */}
      {!error && (
        <TouchableOpacity
          style={styles.tapOverlay}
          activeOpacity={1}
          onPress={handleARTap}
        />
      )}

      {error && (
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      )}

      {/* HUD */}
      <View style={styles.hud}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.closeBtnTxt}>✕</Text>
        </TouchableOpacity>
        <View style={styles.hudLabel}>
          <Text style={styles.hudEmoji}></Text>
          <Text style={styles.hudTxt}>AR View</Text>
        </View>
        <View style={styles.hudRight}>
          {loading ? (
            <View style={styles.objectCount}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
            </View>
          ) : !error ? (
            <View style={styles.objectCount}>
              <Text style={styles.objectCountTxt}>
                {placedObjects.length}/{arObjects.length} placed
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Context-aware hint — hidden while info panel is open */}
      {!selectedObject && (
        <ScanHint
          loading={loading}
          error={!!error}
          totalObjects={arObjects.length}
          placedCount={placedObjects.length}
          queueLength={queueLength}
        />
      )}

      {placedToast && (
        <PlacedToast obj={placedToast} onDone={() => setPlacedToast(null)} />
      )}

      {selectedObject && (
        <ObjectInfoPanel obj={selectedObject} onClose={() => setSelectedObject(null)} />
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000',
    zIndex: 100,
  },
  arView: { flex: 1 },
  tapOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorEmoji: { fontSize: 40, marginBottom: 8 },
  errorTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 15,
    color: '#FF6B6B',
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  hud: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 52,
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  closeBtnTxt: { fontSize: 14, color: '#fff' },
  hudLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hudEmoji: { fontSize: 14 },
  hudTxt: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.3,
  },
  hudRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  objectCount: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  objectCountTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  scanHint: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.xl, right: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  scanHintTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    paddingTop: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    alignItems: 'center',
  },
  infoPanelHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  infoPanelClose: {
    position: 'absolute',
    top: Spacing.md, right: Spacing.lg,
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoPanelCloseTxt: { fontSize: 13, color: Colors.textMuted },
  infoPanelEmoji: { fontSize: 36, marginBottom: 8 },
  infoPanelName: {
    fontFamily: Typography.displayFont,
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  infoPanelDesc: {
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  placedToast: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: Radius.full,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  placedToastCheck: {
    fontSize: 15,
    color: '#4ADE80',
    fontWeight: '700',
  },
  placedToastTxt: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 14,
    color: '#fff',
    maxWidth: 200,
  },

})
