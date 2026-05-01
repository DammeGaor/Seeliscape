// ---------------------------------------------------------------------------
// app/(admin)/destinations/index.tsx
// Lists all destinations with search, edit, and delete
// ---------------------------------------------------------------------------
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, TextInput, ActivityIndicator,
  Alert, Image, Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors, Spacing, Radius, Typography } from '@/constants/theme'
import { SiteCategory, CATEGORY_CONFIG } from '@/lib/tourism-sites'

// ---------------------------------------------------------------------------
// Row type — flat DB shape
// ---------------------------------------------------------------------------
interface DestRow {
  id: number
  name: string
  description: string | null
  latitude: number | null
  longitude: number | null
  img_url: string | null
  category: SiteCategory | null
  municipality: string | null
  barangay: string | null
  attraction: number
  accessibility: number
  amenities: number
  availablePackages: number
  activities: number
  ancillaryServices: number
  avg_review_score: number | null
  review_count: number
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function DestinationsListScreen() {
  const [rows,    setRows]    = useState<DestRow[]>([])
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('landmarkData')
      .select(`
        id, name, description, latitude, longitude, img_url,
        attraction, accessibility, amenities,
        "availablePackages", activities, "ancillaryServices",
        avg_review_score, review_count
      `)
      .order('name', { ascending: true })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setRows((data ?? []) as DestRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase())
  )

  async function handleDelete(row: DestRow) {
    Alert.alert(
      'Delete Destination',
      `Are you sure you want to delete "${row.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(row.id)
            const { error } = await supabase
              .from('landmarkData')
              .delete()
              .eq('id', row.id)

            if (error) {
              Alert.alert('Error', error.message)
            } else {
              setRows((prev) => prev.filter((r) => r.id !== row.id))
            }
            setDeleting(null)
          },
        },
      ]
    )
  }

  function renderItem({ item }: { item: DestRow }) {
    const isDeleting = deleting === item.id
    return (
      <View style={s.card}>
        {item.img_url ? (
          <Image source={{ uri: item.img_url }} style={s.cardImg} resizeMode="cover" />
        ) : (
          <View style={[s.cardImg, s.cardImgPlaceholder]}>
            <Text style={{ fontSize: 28, opacity: 0.3 }}>🏔️</Text>
          </View>
        )}

        <View style={s.cardBody}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>

          {/* 6A score pills */}
          <View style={s.scorePills}>
            {(['attraction','accessibility','amenities','availablePackages','activities','ancillaryServices'] as const).map((k) => (
              <View key={k} style={s.scorePill}>
                <Text style={s.scorePillTxt}>{item[k]}</Text>
              </View>
            ))}
          </View>

          <View style={s.metaRow}>
            {item.avg_review_score ? (
              <Text style={s.meta}>⭐ {item.avg_review_score.toFixed(1)} · {item.review_count} reviews</Text>
            ) : (
              <Text style={s.meta}>No reviews yet</Text>
            )}
          </View>

          <View style={s.cardActions}>
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => router.push(`/(admin)/destinations/${item.id}` as any)}
              activeOpacity={0.8}
            >
              <Text style={s.editBtnTxt}>✏️  Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.deleteBtn}
              onPress={() => handleDelete(item)}
              disabled={isDeleting}
              activeOpacity={0.8}
            >
              {isDeleting
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <Text style={s.deleteBtnTxt}>🗑️  Delete</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Destinations</Text>
          <Text style={s.headerSub}>{rows.length} total</Text>
        </View>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => router.push('/(admin)/destinations/new' as any)}
          activeOpacity={0.85}
        >
          <Text style={s.addBtnTxt}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          placeholder="Search destinations…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={s.centred}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.centred}>
              <Text style={s.emptyTxt}>No destinations found.</Text>
            </View>
          }
          onRefresh={load}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

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
  backArrow: { fontSize: 18, color: Colors.primary, fontFamily: Typography.bodySemiBold },
  headerCenter: { flex: 1 },
  headerTitle: { fontFamily: Typography.displayFont, fontSize: 20, color: Colors.textPrimary, letterSpacing: -0.4 },
  headerSub: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },
  addBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  addBtnTxt: { fontFamily: Typography.bodySemiBold, fontSize: 13, color: Colors.textInverse },

  searchRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    height: 42,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    fontFamily: Typography.bodyFont,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTxt: { fontFamily: Typography.bodyFont, fontSize: 14, color: Colors.textMuted },

  list: { padding: Spacing.lg, gap: Spacing.md },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardImg: { width: '100%', height: 100 },
  cardImgPlaceholder: { backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: Spacing.md, gap: Spacing.xs },
  cardName: { fontFamily: Typography.bodySemiBold, fontSize: 15, color: Colors.textPrimary },

  scorePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  scorePill: {
    backgroundColor: Colors.primary + '15',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scorePillTxt: { fontFamily: Typography.bodyMedium, fontSize: 11, color: Colors.primary },

  metaRow: { flexDirection: 'row', gap: 8 },
  meta: { fontFamily: Typography.bodyFont, fontSize: 12, color: Colors.textMuted },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: Spacing.xs },
  editBtn: {
    flex: 1, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1, borderColor: Colors.primary + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  editBtnTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.primary },
  deleteBtn: {
    flex: 1, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.errorLight,
    borderWidth: 1, borderColor: '#F5C6C1',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnTxt: { fontFamily: Typography.bodyMedium, fontSize: 13, color: Colors.error },
})
