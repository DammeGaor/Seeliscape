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
// Scene-relative placement
//
// Objects are positioned using authored offsets (offset_x, offset_y, offset_z)
// stored in Supabase — not GPS coordinates. Viro world origin [0,0,0] is
// wherever the device is when the scene initialises, with -Z pointing in the
// direction the camera faces on launch.
//
// Authoring convention:
//   offset_x  — metres left (−) / right (+) of camera opening direction
//   offset_y  — metres below (−) / above (+) eye level (1.5 ≈ eye level)
//   offset_z  — negative = in front of user  e.g. -3 places object 3 m ahead
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Inner AR scene (passed to ViroARSceneNavigator)
// ---------------------------------------------------------------------------
interface SceneProps {
  arObjects: ARObject[]
  onSelectObject: (obj: ARObject) => void
}

function ARScene({ sceneNavigator }: { sceneNavigator: { viroAppProps: SceneProps } }) {
  const { arObjects, onSelectObject } = sceneNavigator.viroAppProps

  return (
    <ViroARScene>
      <ViroAmbientLight color="#ffffff" intensity={200} />
      <ViroDirectionalLight
        color="#ffffff"
        direction={[0, -1, -0.5]}
        intensity={300}
        castsShadow
      />
      {arObjects.map((obj) => {
        // Place each object at its authored scene-relative offset.
        // All three fields default to 0 if not set, landing the object at the
        // camera origin — authors should always set at least offset_z to a
        // negative value so the object appears in front of the user.
        const position: [number, number, number] = [
          obj.offset_x ?? 0,
          obj.offset_y ?? 1.5,
          obj.offset_z ?? -3,
        ]
        return (
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
                textClipMode="none"
              />
            </ViroFlexView>
          </ViroNode>
        )
      })}
    </ViroARScene>
  )
}

// ---------------------------------------------------------------------------
// Info panel — slides up when an AR object is tapped
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

  useEffect(() => {
    fetchARObjects(landmarkId)
      .then(setARObjects)
      .catch(() => setError('Failed to load AR content.'))
      .finally(() => setLoading(false))
  }, [landmarkId])

  // Stable callback — prevents viroAppProps changing identity on every render,
  // which causes ViroReact to re-mount the scene and duplicate objects.
  const handleSelectObject = useCallback((obj: ARObject) => {
    setSelectedObject(obj)
  }, [])

  // Memoize the entire props object so ViroARSceneNavigator receives the same
  // reference between renders unless arObjects actually changes.
  const viroAppProps = useMemo(() => ({
    arObjects,
    onSelectObject: handleSelectObject,
  }), [arObjects, handleSelectObject])

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* AR camera starts immediately — no waiting for Supabase fetch.
          Objects are passed in via viroAppProps once the fetch resolves,
          so the camera is already initialised by the time models arrive. */}
      {!error && (
        <ViroARSceneNavigator
          style={styles.arView}
          autofocus
          initialScene={{ scene: ARScene }}
          viroAppProps={viroAppProps}
        />
      )}

      {error && (
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTxt}>{error}</Text>
        </View>
      )}

      {/* HUD — always rendered so close button is always accessible */}
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
          ) : !error && (
            <View style={styles.objectCount}>
              <Text style={styles.objectCountTxt}>
                {arObjects.length} object{arObjects.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      {!error && !selectedObject && (
        <View style={styles.scanHint}>
          <Text style={styles.scanHintTxt}>
            {loading
              ? 'Loading AR objects…'
              : arObjects.length === 0
                ? 'No AR objects found for this landmark'
                : 'Point your camera ahead — objects are placed in front of you'}
          </Text>
        </View>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingTxt: {
    fontFamily: Typography.bodyFont,
    fontSize: 15,
    color: Colors.textInverse,
    marginTop: 8,
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
