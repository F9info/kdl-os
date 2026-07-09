export type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'OTHER'

export interface MediaVariants {
  thumb?: string | null
  small?: string | null
  medium?: string | null
  large?: string | null
}

export interface Media {
  id: string
  user_id: string
  folder_id: string | null
  filename: string
  original_name: string
  mime_type: string
  size: number
  bucket: string
  path: string
  url: string | null
  title: string | null
  alt_text: string | null
  caption: string | null
  width: number | null
  height: number | null
  duration: number | null
  variants: MediaVariants | null
  type: MediaType
  deleted_at: string | null
  created_at: string
  updated_at: string
  // A1 additions
  checksum: string | null
  scan_result: string | null
  scanned_at: string | null
  exif: Record<string, unknown> | null
  is_archived: boolean
  // A2 additions — API flattens pivots: tag names + {slug: value} map
  tags?: string[]
  meta?: Record<string, string>
}

export interface MediaFolder {
  id: string
  name: string
  parent_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  _count?: { media: number; children: number }
}

export interface MediaUsage {
  id: string
  media_id: string
  entity: string
  entity_id: string
  created_at: string
}

export interface MediaListResponse {
  media: Media[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// A2: Tags + custom meta fields
export interface MediaTag {
  id: string
  name: string
  created_at: string
  _count?: { media: number }
}

export interface MediaMetaField {
  id: string
  slug: string
  label: string
  field_type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT'
  options: string[] | null
  is_system: boolean
}

// A4: Collections
export interface MediaCollection {
  id: string
  name: string
  created_by: string | null
  is_smart: boolean
  rules: Record<string, unknown> | null
  created_at: string
  updated_at: string
  _count?: { items: number }
}

// A3: MeiliSearch hit — flat index doc, NOT a full Media row (no url/variants)
export interface MediaSearchDoc {
  id: string
  name: string
  title: string | null
  alt: string | null
  caption: string | null
  tags: string[]
  meta: Record<string, string>
  folder_id: string | null
  folder_path: string | null
  type: MediaType
  mime_type: string
  size: number
  width: number | null
  height: number | null
  owner_id: string
  owner_name: string | null
  is_archived: boolean
  created_at: string
}

export interface MediaSearchResult {
  hits: MediaSearchDoc[]
  facets: Record<string, Record<string, number>>
  pagination: { total: number; page: number; limit: number; pages: number }
}

// A5: chunked upload session
export interface ChunkedUploadStatus {
  upload_id: string
  filename: string
  size: number
  total_parts: number
  received_parts: number[]
  complete: boolean
}
