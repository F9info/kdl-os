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
