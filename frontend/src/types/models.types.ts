export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  is_active: boolean
  created_at: string
}

export interface Setting {
  id: string
  key: string
  value: string
  type: 'string' | 'number' | 'boolean' | 'json'
  description: string | null
  is_public: boolean
}

export interface Type {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  type_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  type?: { id: string; name: string } | null
}

export type InputType =
  | 'heading'
  | 'textbox'
  | 'textarea-normal'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'color'
  | 'file'
  | 'multiple-files'
  | 'switch'

export interface SettingField {
  id: string
  field_name: string
  slug: string
  input_type: InputType
  value: string | null
  alt_text: string | null
  options: string | null
  type_id: string
  category_id: string | null
  sort: number
  created_at: string
  updated_at: string
  type?: { id: string; name: string; slug: string } | null
  category?: { id: string; name: string } | null
  // Renderer-only enrichments (presigned, never persisted):
  value_url?: string
  value_urls?: { path: string; url: string }[]
}

export interface Media {
  id: string
  user_id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  bucket: string
  path: string
  url: string | null
  created_at: string
}
