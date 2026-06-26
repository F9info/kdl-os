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
