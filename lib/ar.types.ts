// ---------------------------------------------------------------------------
// AR Object — mirrors the ar_objects Supabase table
// ---------------------------------------------------------------------------
export interface ARObject {
  id: string
  landmarkId: number
  name: string
  description: string | null
  modelUrl: string        // full public URL to .glb in Supabase Storage
  imageUrl?: string       // optional: if set, renders as a flat ViroImage card instead of a 3D model
  scale: number
  // Scene-relative placement offsets (metres).
  // x = left(−)/right(+), y = down(−)/up(+), z = behind(−)/in-front(+, use negative)
  // Defaults applied in ARView: x=0, y=1.5, z=-3
  offset_x: number
  offset_y: number
  offset_z: number
  isActive: boolean
}
