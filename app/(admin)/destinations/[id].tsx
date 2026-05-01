// ---------------------------------------------------------------------------
// app/(admin)/destinations/[id].tsx
// Add (id = "new") or Edit (id = numeric string) a destination
// Handles image upload to Supabase Storage → landmarkimages bucket
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Alert,
  Image, Platform, StatusBar,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'
import { SiteCategory, CATEGORY_CONFIG } from '@/lib/tourism-sites'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FormState {
  name: string
  description: string
  latitude: string
  longitude: string
  category: SiteCategory
  barangay: string
  municipality: string
  // Expert 6A scores (1–5)
  expert_attraction: string
  expert_accessibility: string
  expert_amenities: string
  expert_availablepackages: string
  expert_activities: string
  expert_ancillaryservices: string
}

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as SiteCategory[]

const EMPTY_FORM: FormState = {
  name: '', description: '', latitude: '', longitude: '',
  category: 'default', barangay: '', municipality: '',
  expert_attraction: '3', expert_accessibility: '3', expert_amenities: '3',
  expert_availablepackages: '3', expert_activities: '3', expert_ancillaryservices: '3',
}

const EXPERT_FIELDS: { key: keyof FormState; label: string; emoji: string }[] = [
  { key: 'expert_attraction',        label: 'Attraction',         emoji: '✨' },
  { key: 'expert_accessibility',     label: 'Accessibility',      emoji: '🛣️' },
  { key: 'expert_amenities',         label: 'Amenities',          emoji: '🏪' },
  { key: 'expert_availablepackages', label: 'Available Packages', emoji: '🎒' },
  { key: 'expert_activities',        label: 'Activities',         emoji: '🏄' },
  { key: 'expert_ancillaryservices', label: 'Ancillary Services', emoji: '🛎️' },
]

// ---------------------------------------------------------------------------
// Score picker (1–5 pips)
// ---------------------------------------------------------------------------
function ScorePicker({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const num = parseInt(value) || 0
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((pip) => (
        <TouchableOpacity
          key={pip}
          style={[
            fp.pip,
            pip <= num && { backgroundColor: Colors.primary, borderColor: Colors.primary },
          ]}
          onPress={() => onChange(String(pip))}
          activeOpacity={0.75}
        >
          <Text style={[fp.pipTxt, pip <= num && { color: '#fff', fontFamily: Typography.bodySemiBold }]}>
            {pip}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const fp = StyleSheet.create({
  pip: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pipTxt: { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.textMuted },
})

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function DestinationFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const isNew  = id === 'new'

  const [form,         setForm]         = useState<FormState>(EMPTY_FORM)
  const [imgUri,       setImgUri]       = useState<string | null>(null)   // local URI for preview
  const [existingImg,  setExistingImg]  = useState<string | null>(null)   // current DB img_url
  const [loadingData,  setLoadingData]  = useState(!isNew)
  const [saving,       setSaving]       = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)

  // ── Load existing data for edit mode ──────────────────────────────────────
  useEffect(() => {
    if (isNew) return
    setLoadingData(true)

    supabase
      .from('landmarkData')
      .select(`
        id, name, description, latitude, longitude, img_url,
        attraction, accessibility, amenities,
        "availablePackages", activities, "ancillaryServices",
        expert_attraction, expert_accessibility, expert_amenities,
        expert_availablepackages, expert_activities, expert_ancillaryservices
      `)
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          Alert.alert('Error', 'Could not load destination.')
          router.back()
          return
        }
        setExistingImg(data.img_url)
        setForm({
          name:                     data.name ?? '',
          description:              data.description ?? '',
          latitude:                 String(data.latitude ?? ''),
          longitude:                String(data.longitude ?? ''),
          category:                 'default',
          barangay:                 '',
          municipality:             '',
          expert_attraction:        String(data.expert_attraction ?? data.attraction ?? 3),
          expert_accessibility:     String(data.expert_accessibility ?? data.accessibility ?? 3),
          expert_amenities:         String(data.expert_amenities ?? data.amenities ?? 3),
          expert_availablepackages: String(data.expert_availablepackages ?? data.availablePackages ?? 3),
          expert_activities:        String(data.expert_activities ?? data.activities ?? 3),
          expert_ancillaryservices: String(data.expert_ancillaryservices ?? data.ancillaryServices ?? 3),
        })
        setLoadingData(false)
      })
  }, [id, isNew])

  // ── Field updater ─────────────────────────────────────────────────────────
  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // ── Pick image from library ───────────────────────────────────────────────
  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow photo library access.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setImgUri(result.assets[0].uri)
    }
  }

  // ── Upload image to Supabase Storage ──────────────────────────────────────
  async function uploadImage(localUri: string): Promise<string> {
    setUploadingImg(true)
    try {
      const ext      = localUri.split('.').pop() ?? 'jpg'
      const fileName = `dest_${Date.now()}.${ext}`
      const response = await fetch(localUri)
      const blob     = await response.blob()

      const { error } = await supabase.storage
        .from('landmarkimages')
        .upload(fileName, blob, { contentType: `image/${ext}`, upsert: false })

      if (error) throw new Error(error.message)

      const { data: urlData } = supabase.storage
        .from('landmarkimages')
        .getPublicUrl(fileName)

      return urlData.publicUrl
    } finally {
      setUploadingImg(false)
    }
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!form.name.trim())        return 'Name is required.'
    if (!form.description.trim()) return 'Description is required.'
    if (!form.latitude.trim() || isNaN(parseFloat(form.latitude)))
      return 'Valid latitude is required.'
    if (!form.longitude.trim() || isNaN(parseFloat(form.longitude)))
      return 'Valid longitude is required.'
    for (const f of EXPERT_FIELDS) {
      const v = parseInt(form[f.key] as string)
      if (isNaN(v) || v < 1 || v > 5)
        return `${f.label} score must be between 1 and 5.`
    }
    return null
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    const err = validate()
    if (err) { Alert.alert('Validation', err); return }

    setSaving(true)
    try {
      // Upload new image if selected
      let imgUrl: string | null = existingImg ?? null
      if (imgUri) imgUrl = await uploadImage(imgUri)

      const expertScores = {
        expert_attraction:        parseFloat(form.expert_attraction),
        expert_accessibility:     parseFloat(form.expert_accessibility),
        expert_amenities:         parseFloat(form.expert_amenities),
        expert_availablepackages: parseFloat(form.expert_availablepackages),
        expert_activities:        parseFloat(form.expert_activities),
        expert_ancillaryservices: parseFloat(form.expert_ancillaryservices),
      }

      // Live columns default to expert scores on creation (integers)
      const liveScores = {
        attraction:        Math.round(expertScores.expert_attraction),
        accessibility:     Math.round(expertScores.expert_accessibility),
        amenities:         Math.round(expertScores.expert_amenities),
        availablePackages: Math.round(expertScores.expert_availablepackages),
        activities:        Math.round(expertScores.expert_activities),
        ancillaryServices: Math.round(expertScores.expert_ancillaryservices),
      }

      const payload = {
        name:        form.name.trim(),
        description: form.description.trim(),
        latitude:    parseFloat(form.latitude),
        longitude:   parseFloat(form.longitude),
        img_url:     imgUrl,
        ...expertScores,
        ...(isNew ? liveScores : {}),  // only set live scores on creation
      }

      if (isNew) {
        const { error } = await supabase
          .from('landmarkData')
          .insert({ ...payload, review_count: 0 })
        if (error) throw new Error(error.message)
        Alert.alert('Success', 'Destination added successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ])
      } else {
        const { error } = await supabase
          .from('landmarkData')
          .update(payload)
          .eq('id', id)
        if (error) throw new Error(error.message)
        Alert.alert('Success', 'Destination updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ])
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save destination.')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centred}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const previewUri = imgUri ?? existingImg

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isNew ? 'Add Destination' : 'Edit Destination'}</Text>
        <TouchableOpacity
          style={[s.saveBtn, (saving || uploadingImg) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || uploadingImg}
          activeOpacity={0.85}
        >
          {saving || uploadingImg
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.saveBtnTxt}>{isNew ? 'Add' : 'Save'}</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Image ── */}
        <SectionLabel label="PHOTO" />
        <TouchableOpacity style={s.imagePicker} onPress={handlePickImage} activeOpacity={0.8}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={s.imagePreview} resizeMode="cover" />
          ) : (
            <View style={s.imagePlaceholder}>
              <Text style={s.imagePlaceholderEmoji}>📷</Text>
              <Text style={s.imagePlaceholderTxt}>Tap to select photo</Text>
            </View>
          )}
          {previewUri && (
            <View style={s.imageOverlay}>
              <Text style={s.imageOverlayTxt}>Tap to change</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Basic info ── */}
        <SectionLabel label="BASIC INFO" />

        <Field label="Site Name *">
          <TextInput
            style={s.input}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Cagsawa Ruins"
            placeholderTextColor={Colors.textMuted}
          />
        </Field>

        <Field label="Description *">
          <TextInput
            style={[s.input, s.inputMulti]}
            value={form.description}
            onChangeText={(v) => set('description', v)}
            placeholder="Full description of the site…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Field>

        <Field label="Municipality">
          <TextInput
            style={s.input}
            value={form.municipality}
            onChangeText={(v) => set('municipality', v)}
            placeholder="e.g. Camalig"
            placeholderTextColor={Colors.textMuted}
          />
        </Field>

        <Field label="Barangay">
          <TextInput
            style={s.input}
            value={form.barangay}
            onChangeText={(v) => set('barangay', v)}
            placeholder="e.g. Busay"
            placeholderTextColor={Colors.textMuted}
          />
        </Field>

        {/* ── Coordinates ── */}
        <SectionLabel label="COORDINATES" />

        <View style={s.coordRow}>
          <Field label="Latitude *" style={{ flex: 1 }}>
            <TextInput
              style={s.input}
              value={form.latitude}
              onChangeText={(v) => set('latitude', v)}
              placeholder="13.1416"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </Field>
          <Field label="Longitude *" style={{ flex: 1 }}>
            <TextInput
              style={s.input}
              value={form.longitude}
              onChangeText={(v) => set('longitude', v)}
              placeholder="123.7246"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </Field>
        </View>

        {/* ── Category ── */}
        <SectionLabel label="CATEGORY" />
        <View style={s.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat]
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  s.catChip,
                  form.category === cat && { backgroundColor: cfg.color + '20', borderColor: cfg.color },
                ]}
                onPress={() => set('category', cat)}
                activeOpacity={0.75}
              >
                <Text style={s.catEmoji}>{cfg.emoji}</Text>
                <Text style={[
                  s.catLabel,
                  form.category === cat && { color: cfg.color, fontFamily: Typography.bodySemiBold },
                ]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── Expert 6A scores ── */}
        <SectionLabel label="EXPERT 6A SCORES (1–5)" />
        <Text style={s.sectionNote}>
          These are your adviser's baseline scores. Tourist reviews will gradually blend into these over time.
        </Text>

        {EXPERT_FIELDS.map((f) => (
          <View key={f.key} style={s.scoreRow}>
            <View style={s.scoreLabelRow}>
              <Text style={s.scoreEmoji}>{f.emoji}</Text>
              <Text style={s.scoreLabel}>{f.label}</Text>
              <Text style={s.scoreValue}>{form[f.key]}/5</Text>
            </View>
            <ScorePicker
              value={form[f.key] as string}
              onChange={(v) => set(f.key, v)}
            />
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={s.sectionLabel}>{label}</Text>
  )
}

function Field({
  label, children, style,
}: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[s.field, style]}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centred:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'android'
      ? (StatusBar.currentHeight ?? 24) + Spacing.sm
      : Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border,
  },
  backArrow:  { fontSize: 18, color: Colors.primary, fontFamily: Typography.bodySemiBold },
  headerTitle: {
    flex: 1,
    fontFamily: Typography.displayFont, fontSize: 20,
    color: Colors.textPrimary, letterSpacing: -0.4,
  },
  saveBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: Radius.md, backgroundColor: Colors.primary,
    minWidth: 60, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.65 },
  saveBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.textInverse },

  body: { padding: Spacing.lg, gap: Spacing.md },

  sectionLabel: {
    fontFamily: Typography.bodySemiBold,
    fontSize: 10, color: Colors.textMuted, letterSpacing: 1.2,
    marginTop: Spacing.xs,
  },
  sectionNote: {
    fontFamily: Typography.bodyFont, fontSize: 12,
    color: Colors.textMuted, lineHeight: 17, marginTop: -Spacing.xs,
  },

  // Image picker
  imagePicker: {
    width: '100%', height: 180,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1.5, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard, gap: 8,
  },
  imagePlaceholderEmoji: { fontSize: 36, opacity: 0.4 },
  imagePlaceholderTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textMuted },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageOverlayTxt: { fontFamily: Typography.bodySemiBold, fontSize: 14, color: '#fff' },

  // Fields
  field: { gap: 6 },
  fieldLabel: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  inputMulti: { minHeight: 100, paddingTop: 12 },

  coordRow: { flexDirection: 'row', gap: Spacing.sm },

  // Category
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  catEmoji: { fontSize: 14 },
  catLabel: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textSecondary },

  // Expert scores
  scoreRow: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  scoreLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scoreEmoji:    { fontSize: 16 },
  scoreLabel:    { flex: 1, fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.textPrimary },
  scoreValue:    { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.primary },
})
