import { supabase } from './supabase'
import { ARObject } from './ar.types'

// ---------------------------------------------------------------------------
// Supabase row shape — mirrors ar_objects table columns
// ---------------------------------------------------------------------------
type ARObjectRow = {
  id: string
  landmark_id: number
  name: string
  description: string | null
  model_url: string
  scale: number
  offset_x: number
  offset_y: number
  offset_z: number
  is_active: boolean
}

// ---------------------------------------------------------------------------
// Supabase Storage public base URL for ar-models bucket
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const AR_BUCKET_BASE = `${SUPABASE_URL}/storage/v1/object/public/ar-models/`

// ---------------------------------------------------------------------------
// Maps a flat Supabase row → ARObject
// ---------------------------------------------------------------------------
function mapToARObject(row: ARObjectRow): ARObject {
  return {
    id:          row.id,
    landmarkId:  row.landmark_id,
    name:        row.name,
    description: row.description,
    // model_url stored as just the filename, e.g. "cagsawa.glb"
    // If it's already a full URL, use as-is
    modelUrl: row.model_url.startsWith('http')
      ? row.model_url
      : `${AR_BUCKET_BASE}${row.model_url}`,
    scale:    row.scale,
    offset_x: row.offset_x ?? 0,
    offset_y: row.offset_y ?? 1.5,
    offset_z: row.offset_z ?? -3,
    isActive: row.is_active,
  }
}

// ---------------------------------------------------------------------------
// Fetch all active AR objects for a given landmark
// ---------------------------------------------------------------------------
export async function fetchARObjects(landmarkId: number): Promise<ARObject[]> {
  const { data, error } = await supabase
    .from('ar_objects')
    .select('id, landmark_id, name, description, model_url, scale, offset_x, offset_y, offset_z, is_active')
    .eq('landmark_id', landmarkId)
    .eq('is_active', true)

  if (error) throw new Error(error.message)

  return (data as ARObjectRow[]).map(mapToARObject)
}
