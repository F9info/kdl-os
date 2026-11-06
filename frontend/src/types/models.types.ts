export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING'
export type OverrideMode = 'GRANT' | 'DENY'

export type ModuleStatus = 'AVAILABLE' | 'INSTALLED' | 'ENABLED' | 'DISABLED'

export interface ModuleNavItem {
  label: string
  path: string
  icon?: string
  permission?: string
  /** Collapsible sidebar group this entry belongs to (with its icon and position). */
  group?: string
  groupIcon?: string
  groupOrder?: number
  /** Position among siblings (default 100). */
  order?: number
  /** Highlight this entry on another URL than `path` (screens that open as a stage of another page). */
  activeWhen?: {
    pathStartsWith?: string
    pathEndsWith?: string
    view?: string
    viewNotIn?: string[]
  }
}

export interface ModuleConflict {
  slug: string
  name: string
  status: ModuleStatus
}

export interface Module {
  slug: string
  name: string
  description: string | null
  version: string
  core: boolean
  /** False when the manifest explicitly marks this as an internal-only dependency (e.g. projects, brand-kit, collateral, credits). Absent/undefined is treated as true. */
  visibleInCatalog?: boolean
  apiPrefix: string
  icon: string | null
  status: ModuleStatus
  installed_at: string | null
  enabled_at: string | null
  settings: Record<string, unknown> | null
  conflictsWith?: string[]
  conflicts?: ModuleConflict[]
}

export interface EnabledModule {
  slug: string
  name: string
  core: boolean
  /** Icon name of this module's own sidebar entry (used by bundles such as Content). */
  icon?: string | null
  /** Slug of the enabled bundle (e.g. 'cms') this module is a hidden part of. */
  parent?: string | null
  /** Nav-only: the chosen products do not need this module, so the sidebar hides it (T2.4). */
  hidden_by_products?: boolean
  nav: ModuleNavItem[]
}

export interface User {
  id: string
  name: string
  email: string
  is_active: boolean
  status: UserStatus
  must_change_password: boolean
  avatar_media_id: string | null
  last_login_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  roles: { id: string; name: string; slug: string }[]
}

export interface RbacRole {
  id: string
  name: string
  slug: string
  description: string | null
  is_system: boolean
  created_at: string
  updated_at: string
  user_count?: number
  permission_count?: number
  permission_matrix?: Record<string, string>
}

export interface PermissionModuleMatrix {
  id: string
  name: string
  label: string
  is_system: boolean
  sort_order: number
  created_at: string
  actions: Record<string, string | null>
}

export interface ActivityLog {
  id: string
  module: string
  action: string
  subject_type: string | null
  subject_id: string | null
  description: string | null
  properties: Record<string, unknown>
  ip_address: string | null
  created_at: string
  actor: { id: string; name: string; email: string } | null
}

export interface UserPermissionOverride {
  permission_id: string
  module_id: string
  action: string
  mode: OverrideMode
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
