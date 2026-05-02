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
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroNode,
  ViroText,
  ViroFlexView,
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
        <ViroNode key={obj.id} position={position}>
          <Viro3DObject
            source={{ uri: obj.modelUrl }}
            type="GLB"
            scale={[obj.scale, obj.scale, obj.scale]}
            onClick={() => onSelectObject(obj)}
            animation={{ name: 'idle', run: true, loop: true }}
          />
          <ViroFlexView
            style={styles.labelContainer}
            position={[0, obj.scale * 1.5 + 0.3, 0]}
            width={1.2}
            height={0.35}
            onClick={() => onSelectObject(obj)}
          >
            <ViroText
              text={obj.name}
              style={styles.labelText}
              width={1.2}
              height={0.35}
              textClipMode="None"
            />
          </ViroFlexView>
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

  // Called by the native TouchableOpacity overlay on every tap.
  // We fire a hit-test from screen centre; Viro maps it to world space.
  const handleARTap = useCallback(async () => {
    console.log('[ARView] 👆 handleARTap — queueLength:', queueIndexRef.current, 'sceneRef:', !!arSceneRef.current)

    if (queueIndexRef.current >= arObjectsRef.current.length) {
      console.log('[ARView] ⚠️ tap ignored — nothing left to place')
      return
    }

    if (!arSceneRef.current) {
      console.log('[ARView] ⚠️ tap ignored — scene ref not ready yet')
      return
    }

    try {
      // Screen centre [0,0] in Viro's normalised coords
      const results = await arSceneRef.current.performARHitTestWithRay([0, 0, -1])
      console.log('[ARView] 🎯 hit test results:', JSON.stringify(results))

      if (!results || results.length === 0) {
        console.log('[ARView] ⚠️ no surface found — point camera at a textured flat surface')
        return
      }

      const hit =
        results.find((r: any) =>
          r.type === 'ExistingPlaneUsingExtent' || r.type === 'ExistingPlane'
        ) ?? results[0]

      const position: [number, number, number] = hit.transform.position
      console.log('[ARView] ✅ placing at', position, 'type:', hit.type)
      handlePlaceObject(position)
    } catch (err) {
      console.error('[ARView] ❌ hit test failed', err)
    }
  }, [handlePlaceObject])

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

      {/* Native tap overlay — sits above the AR view so taps are always
          captured even when there are no 3D objects to click on yet.
          Hidden once all objects are placed. */}
      {!error && queueLength > 0 && (
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
  labelContainer: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    textAlignVertical: 'center',
  } as any,
})
