// ---------------------------------------------------------------------------
// app/onboarding.tsx  —  shown every time after login
//
// 5 slides:
//   0 — Welcome to Seeliscape
//   1 — Smart Recommender  (6A priority sliders → ranked results)
//   2 — Site Details & AR  (tap a result, explore in AR)
//   3 — GPS Navigation     (live map, proximity unlock)
//   4 — Rate & Evaluate    (post-visit 6-criteria perception rating)
// ---------------------------------------------------------------------------

import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Image,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Typography, Spacing, Radius } from '@/constants/theme'

const { width: W, height: H } = Dimensions.get('window')
const CARD_H = H * 0.44

// ---------------------------------------------------------------------------
// Slide metadata — accents use theme Colors
// ---------------------------------------------------------------------------
const SLIDES = [
  {
    key:    'welcome',
    tag:    'WELCOME',
    title:  'Discover\nAlbay Smarter',
    body:   'Seeliscape is your AI-powered travel companion for exploring the best of Albay — personalised to what matters to you.',
    accent: Colors.primary,
  },
  {
    key:    'recommend',
    tag:    'FEATURE 01',
    title:  'Set Your\nPriorities',
    body:   'Slide the 6A criteria sliders to tell us what you value most. Our TOPSIS-based engine ranks every destination to match your exact preferences.',
    accent: Colors.primaryMuted,
  },
  {
    key:    'details',
    tag:    'FEATURE 02',
    title:  'Explore in\nAugmented Reality',
    body:   'Tap any recommended site to see photos, ratings, and full details. When you arrive, unlock the AR View and see 3D landmarks through your camera.',
    accent: Colors.primary,
  },
  {
    key:    'map',
    tag:    'FEATURE 03',
    title:  'Navigate\nWith Live GPS',
    body:   'The interactive map shows all nearby sites. Your AR experience auto-unlocks the moment you step within range of a destination.',
    accent: Colors.accentLight,
  },
  {
    key:    'rate',
    tag:    'FEATURE 04',
    title:  'Rate Your\nExperience',
    body:   'After visiting, share how you perceive each destination across the 6A criteria. Your feedback helps the community and improves future picks.',
    accent: Colors.primaryMuted,
  },
]

// ===========================================================================
// VISUAL 0 — Welcome: logo with orbiting feature badges
// ===========================================================================
function WelcomeVisual() {
  const pulse = useRef(new Animated.Value(1)).current
  const glow  = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 2000, useNativeDriver: true }),
    ])).start()
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1,   duration: 1800, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.4, duration: 1800, useNativeDriver: true }),
    ])).start()
  }, [])

  const BADGES = [
    { emoji: '🗺️', label: 'Map',      angle: 0   },
    { emoji: '🤖', label: 'AI Picks', angle: 72  },
    { emoji: '🔭', label: 'AR View',  angle: 144 },
    { emoji: '⭐', label: 'Rate',     angle: 216 },
    { emoji: '📍', label: 'GPS',      angle: 288 },
  ]
  const R_ORBIT = 110

  return (
    <View style={wv.wrap}>
      <Animated.View style={[wv.glowRing, { opacity: glow }]} />
      <Animated.View style={[wv.midRing, { transform: [{ scale: pulse }] }]} />

      {BADGES.map((b) => {
        const rad = (b.angle * Math.PI) / 180
        const x   = Math.cos(rad) * R_ORBIT
        const y   = Math.sin(rad) * R_ORBIT
        return (
          <View
            key={b.label}
            style={[wv.badge, { transform: [{ translateX: x }, { translateY: y }] }]}
          >
            <Text style={wv.badgeEmoji}>{b.emoji}</Text>
            <Text style={wv.badgeLabel}>{b.label}</Text>
          </View>
        )
      })}

      <Animated.View style={[wv.logoRing, { transform: [{ scale: pulse }] }]}>
        <Image
          source={require('@/assets/splash-icon.png')}
          style={wv.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  )
} 

const wv = StyleSheet.create({
  wrap: {
    width: CARD_H, height: CARD_H,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(41,128,196,0.08)',
    borderWidth: 1, borderColor: 'rgba(41,128,196,0.2)',
  },
  midRing: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 1, borderColor: 'rgba(41,128,196,0.15)',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center', gap: 2,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  badgeEmoji: { fontSize: 16 },
  badgeLabel: { fontFamily: Typography.bodyMedium, fontSize: 8, color: Colors.textMuted },
  logoRing: {
    width: 90, height: 90, borderRadius: 22,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  logo: { width: 66, height: 66 },
})

// ===========================================================================
// VISUAL 1 — Recommender: 6A sliders + ranked result cards
// ===========================================================================
function RecommendVisual() {
  const CRITERIA = [
    { label: 'Attractions',   val: 0.9,  color: Colors.primary      },
    { label: 'Accessibility', val: 0.55, color: Colors.primaryMuted  },
    { label: 'Amenities',     val: 0.75, color: Colors.accentLight   },
    { label: 'Activities',    val: 0.85, color: Colors.primary       },
    { label: 'Packages',      val: 0.4,  color: Colors.primaryMuted  },
    { label: 'Ancillary',     val: 0.6,  color: Colors.accentLight   },
  ]
  const RESULTS = [
    { rank: 1, name: 'Cagsawa Ruins', pct: 94, tag: 'Heritage'  },
    { rank: 2, name: 'Sumlang Lake',  pct: 87, tag: 'Nature'    },
    { rank: 3, name: 'Lignon Hill',   pct: 81, tag: 'Adventure' },
  ]

  const barAnims  = CRITERIA.map(() => useRef(new Animated.Value(0)).current)
  const cardAnims = RESULTS.map(() => useRef(new Animated.Value(0)).current)
  const arrow     = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.stagger(80, barAnims.map((a, i) =>
      Animated.spring(a, { toValue: CRITERIA[i].val, useNativeDriver: false, tension: 70, friction: 12 })
    )).start()
    setTimeout(() => {
      Animated.stagger(100, cardAnims.map(a =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 80, friction: 14 })
      )).start()
    }, 500)
    Animated.loop(Animated.sequence([
      Animated.timing(arrow, { toValue: 4, duration: 600, useNativeDriver: true }),
      Animated.timing(arrow, { toValue: 0, duration: 600, useNativeDriver: true }),
    ])).start()
  }, [])

  return (
    <View style={rv.wrap}>
      {/* Left: priority sliders */}
      <View style={rv.panel}>
        <Text style={rv.panelTitle}>Your Priorities</Text>
        {CRITERIA.map((c, i) => (
          <View key={c.label} style={rv.sliderRow}>
            <Text style={rv.sliderLabel}>{c.label}</Text>
            <View style={rv.track}>
              <Animated.View style={[rv.fill, {
                backgroundColor: c.color,
                width: barAnims[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]} />
              {/*
                thumbWrapper is a plain View carrying the static vertical offset (top: -3).
                Only the animated 'left' lives on the inner Animated.View with useNativeDriver: false,
                which is compatible because barAnims also uses useNativeDriver: false.
              */}
              <View style={rv.thumbWrapper}>
                <Animated.View style={[rv.thumb, {
                  left: barAnims[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '88%'] }),
                  backgroundColor: c.color,
                }]} />
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Arrow */}
      <Animated.Text style={[rv.arrow, { transform: [{ translateX: arrow }] }]}>→</Animated.Text>

      {/* Right: result cards */}
      <View style={rv.results}>
        <Text style={rv.panelTitle}>Best Matches</Text>
        {RESULTS.map((r, i) => (
          <Animated.View key={r.name} style={[rv.resultCard, {
            opacity: cardAnims[i],
            transform: [{ translateX: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }]}>
            <View style={[rv.rankBadge, i === 0 && { backgroundColor: Colors.primary }]}>
              <Text style={[rv.rankTxt, i === 0 && { color: '#fff' }]}>#{r.rank}</Text>
            </View>
            <View style={rv.resultInfo}>
              <Text style={rv.resultName} numberOfLines={1}>{r.name}</Text>
              <Text style={rv.resultTag}>{r.tag}</Text>
            </View>
            <Text style={[rv.resultPct, { color: i === 0 ? Colors.primaryMuted : Colors.textMuted }]}>{r.pct}%</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  )
}

const rv = StyleSheet.create({
  wrap: {
    width: W * 0.9, flexDirection: 'row',
    alignItems: 'center', gap: 10,
  },
  panel: {
    flex: 1, backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, padding: 12, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
    borderWidth: 1, borderColor: Colors.border,
  },
  panelTitle: {
    fontFamily: Typography.bodySemiBold, fontSize: 10,
    color: Colors.textPrimary, letterSpacing: 0.3, marginBottom: 2,
  },
  sliderRow:   { gap: 3 },
  sliderLabel: { fontFamily: Typography.bodyFont, fontSize: 8, color: Colors.textMuted },
  track: {
    height: 6, backgroundColor: Colors.bgMuted,
    borderRadius: 3, overflow: 'visible', position: 'relative',
  },
  fill: { height: 6, borderRadius: 3 },
  // Plain View carries the static top offset so Animated.View only animates 'left'
  thumbWrapper: {
    position: 'absolute',
    top: -3, left: 0, right: 0, bottom: 0,
  },
  thumb: {
    position: 'absolute',
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
  arrow:      { fontSize: 18, color: Colors.textMuted },
  results:    { flex: 1, gap: 6 },
  resultCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.sm,
    padding: 10, flexDirection: 'row',
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  rankBadge: {
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: Colors.bgMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  rankTxt:    { fontFamily: Typography.bodySemiBold, fontSize: 10, color: Colors.textMuted },
  resultInfo: { flex: 1 },
  resultName: { fontFamily: Typography.bodySemiBold, fontSize: 10, color: Colors.textPrimary },
  resultTag:  { fontFamily: Typography.bodyFont, fontSize: 8, color: Colors.textMuted },
  resultPct:  { fontFamily: Typography.bodySemiBold, fontSize: 12 },
})

// ===========================================================================
// VISUAL 2 — Site Details + AR badge mockup
// FIX: scanLine previously used `top` with useNativeDriver:true — now uses
//      translateY only, which the native driver supports.
// ===========================================================================
function DetailsVisual() {
  const slideUp  = useRef(new Animated.Value(40)).current
  const fadeIn   = useRef(new Animated.Value(0)).current
  const arPulse  = useRef(new Animated.Value(1)).current
  // translateY replaces the old `top` interpolation — native driver safe
  const scanLine = useRef(new Animated.Value(-60)).current

  const IMG_H = 120

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideUp, { toValue: 0, tension: 70, friction: 13, useNativeDriver: true }),
      Animated.timing(fadeIn,  { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start()
    Animated.loop(Animated.sequence([
      Animated.timing(arPulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
      Animated.timing(arPulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ])).start()
    // Scan from -60 (above container) down to IMG_H (below), looping
    Animated.loop(
      Animated.timing(scanLine, { toValue: IMG_H, duration: 2000, useNativeDriver: true })
    ).start()
  }, [])

  const STARS = [1, 2, 3, 4, 5]
  const CHIPS = ['Heritage', 'Scenic', 'Photography']

  return (
    <Animated.View style={[dv.wrap, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
      <View style={dv.siteCard}>
        {/* Mock image header */}
        <View style={dv.imgHeader}>
          <View style={[dv.imgPlaceholder, { height: IMG_H }]}>
            <Text style={dv.imgEmoji}>🏔️</Text>
            {/* translateY only — no `top` on animated node */}
            <Animated.View style={[dv.scanLine, { transform: [{ translateY: scanLine }] }]} />
          </View>
          {/* AR unlock badge */}
          <Animated.View style={[dv.arBadge, { transform: [{ scale: arPulse }] }]}>
            <Text style={dv.arBadgeIcon}>🔭</Text>
            <View>
              <Text style={dv.arBadgeTitle}>AR View</Text>
              <Text style={dv.arBadgeSub}>Unlocked nearby</Text>
            </View>
          </Animated.View>
        </View>

        <View style={dv.cardBody}>
          <Text style={dv.siteName}>Cagsawa Ruins</Text>
          <View style={dv.starsRow}>
            {STARS.map(s => (
              <Text key={s} style={[dv.star, s <= 4 && { color: '#F5A623' }]}>★</Text>
            ))}
            <Text style={dv.ratingTxt}>4.8 · 124 reviews</Text>
          </View>
          <View style={dv.chipsRow}>
            {CHIPS.map(c => (
              <View key={c} style={dv.chip}>
                <Text style={dv.chipTxt}>{c}</Text>
              </View>
            ))}
          </View>
          <View style={dv.matchRow}>
            <Text style={dv.matchLabel}>Match Score</Text>
            <View style={dv.matchTrack}>
              <View style={[dv.matchFill, { width: '94%', backgroundColor: Colors.primaryMuted }]} />
            </View>
            <Text style={[dv.matchPct, { color: Colors.primaryMuted }]}>94%</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

const dv = StyleSheet.create({
  wrap:     { width: W * 0.82 },
  siteCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  imgHeader:      { position: 'relative' },
  imgPlaceholder: {
    backgroundColor: Colors.bgMuted,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  imgEmoji: { fontSize: 48, opacity: 0.6 },
  // No `top` — positioned at the very top of its parent; translateY animates it
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: 'rgba(41,128,196,0.5)',
  },
  arBadge: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.textPrimary, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  arBadgeIcon:  { fontSize: 16 },
  arBadgeTitle: { fontFamily: Typography.bodySemiBold, fontSize: 10, color: '#fff' },
  arBadgeSub:   { fontFamily: Typography.bodyFont, fontSize: 8, color: 'rgba(255,255,255,0.6)' },
  cardBody:     { padding: 14, gap: 8 },
  siteName:     { fontFamily: Typography.displayFont, fontSize: 18, color: Colors.textPrimary, letterSpacing: -0.3 },
  starsRow:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star:         { fontSize: 12, color: Colors.border },
  ratingTxt:    { fontFamily: Typography.bodyFont, fontSize: 10, color: Colors.textMuted, marginLeft: 4 },
  chipsRow:     { flexDirection: 'row', gap: 6 },
  chip: {
    backgroundColor: Colors.bgMuted, borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipTxt:    { fontFamily: Typography.bodyMedium, fontSize: 9, color: Colors.primary },
  matchRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchLabel: { fontFamily: Typography.bodyFont, fontSize: 9, color: Colors.textMuted },
  matchTrack: { flex: 1, height: 6, backgroundColor: Colors.bgMuted, borderRadius: 3, overflow: 'hidden' },
  matchFill:  { height: 6, borderRadius: 3 },
  matchPct:   { fontFamily: Typography.bodySemiBold, fontSize: 11 },
})

// ===========================================================================
// VISUAL 3 — Map: isometric-style map mockup
// ===========================================================================
function MapVisual() {
  const userPulse  = useRef(new Animated.Value(1)).current
  const rangePulse = useRef(new Animated.Value(0.8)).current
  const markerBob  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(userPulse,  { toValue: 1.5, duration: 1000, useNativeDriver: true }),
      Animated.timing(userPulse,  { toValue: 1,   duration: 1000, useNativeDriver: true }),
    ])).start()
    Animated.loop(Animated.sequence([
      Animated.timing(rangePulse, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
      Animated.timing(rangePulse, { toValue: 0.8, duration: 1500, useNativeDriver: true }),
    ])).start()
    Animated.loop(Animated.sequence([
      Animated.timing(markerBob,  { toValue: -6, duration: 700, useNativeDriver: true }),
      Animated.timing(markerBob,  { toValue: 0,  duration: 700, useNativeDriver: true }),
    ])).start()
  }, [])

  const SITES = [
    { x: 68,  y: 55,  name: 'Cagsawa', inRange: true,  pct: 94 },
    { x: 200, y: 90,  name: 'Sumlang', inRange: false, pct: 87 },
    { x: 130, y: 140, name: 'Lignon',  inRange: false, pct: 81 },
  ]
  const USER = { x: 88, y: 110 }

  return (
    <View style={mv.wrap}>
      <View style={mv.mapCard}>
        {/* Roads */}
        <View style={[mv.road, { top: 80,  left: 0, right: 0, height: 6 }]} />
        <View style={[mv.road, { top: 130, left: 0, right: 0, height: 4 }]} />
        <View style={[mv.road, { left: 100, top: 0, bottom: 0, width: 5 }]} />
        <View style={[mv.road, { left: 190, top: 0, bottom: 0, width: 4 }]} />

        {/* Green zones */}
        <View style={[mv.greenZone, { top: 10, left: 110, width: 70, height: 55, borderRadius: 10 }]} />
        <View style={[mv.greenZone, { top: 95, left: 10,  width: 40, height: 30, borderRadius: 6  }]} />
        <View style={[mv.greenZone, { top: 95, left: 205, width: 55, height: 50, borderRadius: 8  }]} />

        {/* Water */}
        <View style={[mv.water, { top: 145, left: 108, width: 72, height: 35, borderRadius: 8 }]} />

        {/* Route dots */}
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={[mv.routeDot, {
            left: USER.x + (SITES[0].x - USER.x) * i / 4 - 3,
            top:  USER.y + (SITES[0].y - USER.y) * i / 4 - 3,
          }]} />
        ))}

        {/* Range circle */}
        <Animated.View style={[mv.rangeCircle, {
          left: USER.x - 36,
          top:  USER.y - 36,
          transform: [{ scale: rangePulse }],
        }]} />

        {/* Site markers */}
        {SITES.map((site, i) => (
          <Animated.View
            key={site.name}
            style={[
              mv.markerWrap,
              { left: site.x - 20, top: site.y - 38 },
              i === 0 && { transform: [{ translateY: markerBob }] },
            ]}
          >
            <View style={[mv.markerBubble, site.inRange && mv.markerBubbleActive]}>
              <Text style={mv.markerEmoji}>{site.inRange ? '🔓' : '📍'}</Text>
            </View>
            <View style={[mv.markerLabel, site.inRange && mv.markerLabelActive]}>
              <Text style={[mv.markerName, site.inRange && { color: Colors.bgCard }]}>{site.name}</Text>
              <Text style={[mv.markerPct,  site.inRange && { color: Colors.bgCard }]}>{site.pct}%</Text>
            </View>
            <View style={mv.markerStem} />
          </Animated.View>
        ))}

        {/* User dot */}
        <View style={[mv.userOuter, { left: USER.x - 12, top: USER.y - 12 }]}>
          <Animated.View style={[mv.userRing, {
            transform: [{ scale: userPulse }],
            opacity: userPulse.interpolate({ inputRange: [1, 1.5], outputRange: [0.5, 0] }),
          }]} />
          <View style={mv.userDot} />
        </View>

        {/* Compass */}
        <View style={mv.compass}>
          <Text style={mv.compassN}>N</Text>
          <Text style={mv.compassArrow}>▲</Text>
        </View>

        {/* AR unlock toast */}
        <View style={mv.toast}>
          <Text style={mv.toastEmoji}>🔭</Text>
          <Text style={mv.toastTxt}>AR unlocked at Cagsawa!</Text>
        </View>
      </View>
    </View>
  )
}

const mv = StyleSheet.create({
  wrap: { width: W * 0.88, alignItems: 'center' },
  mapCard: {
    width: '100%', height: 210,
    backgroundColor: Colors.bgMuted,
    borderRadius: Radius.lg, overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  road:      { position: 'absolute', backgroundColor: '#fff', opacity: 0.7 },
  greenZone: {
    position: 'absolute',
    backgroundColor: 'rgba(30,180,100,0.15)',
    borderWidth: 1, borderColor: 'rgba(30,180,100,0.2)',
  },
  water: {
    position: 'absolute',
    backgroundColor: 'rgba(41,128,196,0.15)',
    borderWidth: 1, borderColor: 'rgba(41,128,196,0.25)',
  },
  routeDot: {
    position: 'absolute',
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.primaryMuted, opacity: 0.7,
  },
  rangeCircle: {
    position: 'absolute',
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: 'rgba(41,128,196,0.5)',
    backgroundColor: 'rgba(41,128,196,0.08)',
  },
  markerWrap:   { position: 'absolute', alignItems: 'center' },
  markerBubble: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  markerBubbleActive: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary, shadowOpacity: 0.4,
  },
  markerEmoji: { fontSize: 14 },
  markerLabel: {
    flexDirection: 'row', gap: 3,
    backgroundColor: Colors.bgCard,
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginTop: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  markerLabelActive: { backgroundColor: Colors.primary },
  markerName: { fontFamily: Typography.bodyMedium,  fontSize: 7, color: Colors.textPrimary },
  markerPct:  { fontFamily: Typography.bodySemiBold, fontSize: 7, color: Colors.textMuted  },
  markerStem: {
    width: 2, height: 6, backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 1, marginTop: 1,
  },
  userOuter: {
    position: 'absolute', width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  userRing: {
    position: 'absolute',
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(41,128,196,0.3)',
  },
  userDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 4,
  },
  compass: {
    position: 'absolute', top: 10, right: 12,
    alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  compassN:     { fontFamily: Typography.bodySemiBold, fontSize: 8, color: Colors.error },
  compassArrow: { fontSize: 8, color: Colors.error },
  toast: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
    borderWidth: 1, borderColor: Colors.border,
  },
  toastEmoji: { fontSize: 16 },
  toastTxt:   { fontFamily: Typography.bodySemiBold, fontSize: 11, color: Colors.textPrimary },
})

// ===========================================================================
// VISUAL 4 — Rate: 6-criteria perception rating grid
// Replaced the old NDCG metrics card — users rate their perception of each
// of the 6A criteria for a visited destination.
// ===========================================================================
function RateVisual() {
  const CRITERIA_RATINGS = [
    { label: 'Attractions',   rating: 5, icon: '🏛️' },
    { label: 'Accessibility', rating: 4, icon: '🚌' },
    { label: 'Amenities',     rating: 4, icon: '🏪' },
    { label: 'Activities',    rating: 5, icon: '🎯' },
    { label: 'Packages',      rating: 3, icon: '📦' },
    { label: 'Ancillary',     rating: 4, icon: '🤝' },
  ]

  const cardAnims  = CRITERIA_RATINGS.map(() => useRef(new Animated.Value(0)).current)
  const submitAnim = useRef(new Animated.Value(0)).current
  const checkAnim  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.stagger(100, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 80, friction: 13, useNativeDriver: true })
    )).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(submitAnim, { toValue: 1, tension: 60, friction: 12, useNativeDriver: true }),
          Animated.spring(checkAnim,  { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
        ]).start()
      }, 300)
    })
  }, [])

  const row1 = CRITERIA_RATINGS.slice(0, 3)
  const row2 = CRITERIA_RATINGS.slice(3, 6)

  return (
    <View style={ratv.wrap}>
      {/* Row 1 */}
      <View style={ratv.row}>
        {row1.map((c, i) => (
          <Animated.View key={c.label} style={[ratv.card, {
            opacity: cardAnims[i],
            transform: [{ scale: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          }]}>
            <Text style={ratv.cardIcon}>{c.icon}</Text>
            <Text style={ratv.cardLabel} numberOfLines={1}>{c.label}</Text>
            <View style={ratv.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <Text key={s} style={[ratv.star, s <= c.rating && { color: Colors.primary }]}>★</Text>
              ))}
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Row 2 */}
      <View style={ratv.row}>
        {row2.map((c, i) => (
          <Animated.View key={c.label} style={[ratv.card, {
            opacity: cardAnims[i + 3],
            transform: [{ scale: cardAnims[i + 3].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          }]}>
            <Text style={ratv.cardIcon}>{c.icon}</Text>
            <Text style={ratv.cardLabel} numberOfLines={1}>{c.label}</Text>
            <View style={ratv.starsRow}>
              {[1, 2, 3, 4, 5].map(s => (
                <Text key={s} style={[ratv.star, s <= c.rating && { color: Colors.primary }]}>★</Text>
              ))}
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Submitted confirmation */}
      <Animated.View style={[ratv.submitCard, {
        opacity: submitAnim,
        transform: [{ translateY: submitAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }]}>
        <Animated.View style={[ratv.checkCircle, { transform: [{ scale: checkAnim }] }]}>
          <Text style={ratv.checkMark}>✓</Text>
        </Animated.View>
        <View style={ratv.submitInfo}>
          <Text style={ratv.submitTitle}>Perception Submitted</Text>
          <Text style={ratv.submitSub}>Cagsawa Ruins · 6 criteria rated</Text>
        </View>
      </Animated.View>
    </View>
  )
}

const ratv = StyleSheet.create({
  wrap: { width: W * 0.88, gap: 8 },
  row:  { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1, backgroundColor: Colors.bgCard,
    borderRadius: Radius.md, padding: 10, gap: 3,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardIcon:  { fontSize: 16 },
  cardLabel: { fontFamily: Typography.bodySemiBold, fontSize: 7, color: Colors.textPrimary, textAlign: 'center' },
  starsRow:  { flexDirection: 'row', gap: 1 },
  star:      { fontSize: 11, color: Colors.border },
  submitCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: 14, flexDirection: 'row',
    alignItems: 'center', gap: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  checkCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
  },
  checkMark:   { fontSize: 18, color: '#fff', fontWeight: '700' },
  submitInfo:  { flex: 1, gap: 3 },
  submitTitle: { fontFamily: Typography.bodySemiBold, fontSize: 12, color: Colors.textPrimary },
  submitSub:   { fontFamily: Typography.bodyFont,     fontSize: 10, color: Colors.textSecondary },
})

// ===========================================================================
// VISUALS array
// ===========================================================================
const VISUALS = [WelcomeVisual, RecommendVisual, DetailsVisual, MapVisual, RateVisual]

// ===========================================================================
// Progress dots
// ===========================================================================
function Dots({ total, current, accent }: { total: number; current: number; accent: string }) {
  return (
    <View style={dot.row}>
      {Array.from({ length: total }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            dot.base,
            i === current
              ? [dot.active, { backgroundColor: accent }]
              : dot.inactive,
          ]}
        />
      ))}
    </View>
  )
}
const dot = StyleSheet.create({
  row:      { flexDirection: 'row', gap: 6, alignItems: 'center' },
  base:     { height: 5, borderRadius: 3 },
  active:   { width: 20 },
  inactive: { width: 5, backgroundColor: Colors.border },
})

// ===========================================================================
// Main screen
// ===========================================================================
export default function OnboardingScreen() {
  const [index, setIndex] = useState(0)
  const fadeAnim  = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const isLast    = index === SLIDES.length - 1
  const slide     = SLIDES[index]
  const Visual    = VISUALS[index]

  function animateToSlide(next: number) {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -24, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setIndex(next)
      slideAnim.setValue(24)
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 14, useNativeDriver: true }),
      ]).start()
    })
  }

  function handleNext() {
    if (isLast) router.replace('/(tabs)/')
    else animateToSlide(index + 1)
  }
  function handleSkip() { router.replace('/(tabs)/') }
  function handleBack() { if (index > 0) animateToSlide(index - 1) }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      {/* Top bar */}
      <View style={s.topBar}>
        {index > 0 ? (
          <TouchableOpacity style={s.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
        ) : <View style={s.backBtn} />}

        <Dots total={SLIDES.length} current={index} accent={slide.accent} />

        {!isLast ? (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
            <Text style={s.skipTxt}>Skip</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
      </View>

      {/* Visual */}
      <Animated.View style={[s.visualWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Visual />
      </Animated.View>

      {/* Content card */}
      <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={[s.accentBar, { backgroundColor: slide.accent }]} />
        <Text style={[s.tag, { color: slide.accent }]}>{slide.tag}</Text>
        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.body}>{slide.body}</Text>

        <TouchableOpacity
          style={[s.cta, { backgroundColor: slide.accent }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={s.ctaTxt}>{isLast ? 'Start Exploring' : 'Next'}</Text>
          <Text style={s.ctaIcon}>{isLast ? '✦' : '→'}</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  )
}

// ===========================================================================
// Screen styles
// ===========================================================================
const s = StyleSheet.create({
  safe: {
    flex: 1, backgroundColor: Colors.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  backArrow: { fontFamily: Typography.bodySemiBold, fontSize: 18, color: Colors.textPrimary },
  skipTxt:   { fontFamily: Typography.bodyMedium,  fontSize: 13,  color: Colors.textMuted  },

  visualWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },

  card: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: 24, paddingBottom: Platform.OS === 'android' ? 28 : 12,
    gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 6,
  },
  accentBar: {
    position: 'absolute', top: 0, left: 28, right: 28,
    height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
  },
  tag: {
    fontFamily: Typography.bodyMedium, fontSize: 10,
    letterSpacing: 2, marginTop: 8,
  },
  title: {
    fontFamily: Typography.displayFont, fontSize: 28,
    color: Colors.textPrimary, letterSpacing: -0.6, lineHeight: 34,
  },
  body: {
    fontFamily: Typography.bodyFont, fontSize: 13,
    color: Colors.textSecondary, lineHeight: 20,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 52, borderRadius: Radius.full,
    marginTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
  },
  ctaTxt:  { fontFamily: Typography.bodySemiBold, fontSize: 15, color: '#fff' },
  ctaIcon: { fontSize: 15, color: '#fff' },
})
