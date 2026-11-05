export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP'

export interface NotificationCategory {
  id: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
  created_at: string
}

export interface NotificationTemplate {
  id: string
  slug: string
  category_id: string
  name: string
  variables: string[]
  in_app_body: string | null
  email_subject: string | null
  email_body: string | null
  sms_body: string | null
  whatsapp_body: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  category?: NotificationCategory
}

export interface Notification {
  id: string
  user_id: string
  category_slug: string
  title: string
  body: string
  data: { url?: string; [key: string]: unknown } | null
  read_at: string | null
  created_at: string
}

export interface NotificationPreference {
  category_id: string
  channel: NotificationChannel
  enabled: boolean
}

export interface CategoryPreferenceRow {
  category_id: string
  category_slug: string
  category_name: string
  channels: { channel: NotificationChannel; enabled: boolean }[]
}

export interface PreferenceMatrix {
  preferences: CategoryPreferenceRow[]
}
