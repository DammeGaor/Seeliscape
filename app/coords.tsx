import * as Location from 'expo-location'
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'

export default function CoordsScreen() {
  const [coords, setCoords] = useState<any>(null)

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      })
      setCoords(location.coords)
    })()
  }, [])

  return (
    <View style={styles.container}>
      {coords ? (
        <>
          <Text style={styles.label}>Latitude</Text>
          <Text style={styles.value}>{coords.latitude}</Text>

          <Text style={styles.label}>Longitude</Text>
          <Text style={styles.value}>{coords.longitude}</Text>

          <Text style={styles.label}>Altitude</Text>
          <Text style={styles.value}>{coords.altitude ?? 'N/A'}</Text>

          <Text style={styles.label}>Accuracy (m)</Text>
          <Text style={styles.value}>{coords.accuracy}</Text>
        </>
      ) : (
        <Text style={styles.value}>Getting location...</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, color: '#888' },
  value: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
})