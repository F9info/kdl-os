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
  // A2 additions
  tags?: MediaTag[]
  meta_values?: MediaMetaValue[]
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
  slug: string
  color: string | null
}

export interface MediaMetaField {
  id: string
  name: string
  slug: string
  field_type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'URL'
  required: boolean
}

export interface MediaMetaValue {
  field_id: string
  value: string
  field?: MediaMetaField
}

// A4: Collections
export interface MediaCollection {
  id: string
  name: string
  description: string | null
  is_smart: boolean
  rules: SmartCollectionRule[] | null
  cover_media_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  _count?: { items: number }
}

export interface SmartCollectionRule {
  field: string
  op: 'eq' | 'contains' | 'gt' | 'lt' | 'in'
  value: unknown
}

// A3: MeiliSearch faceted search results
export interface MediaSearchResult {
  media: Media[]
  facets: {
    type?: Record<string, number>
    tags?: Record<string, number>
  }
  pagination: { total: number; page: number; limit: number; pages: number }
}
