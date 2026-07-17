export type IntegrationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP'
export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'

export interface IntegrationProvider {
  id: string
  channel: IntegrationChannel
  driver: string
  name: string
  config: Record<string, unknown> | null
  is_active: boolean
  is_default: boolean
  is_fallback: boolean
  credentials_set: boolean
  created_at: string
  updated_at: string
}

export interface IntegrationLog {
  id: string
  provider_id: string | null
  channel: IntegrationChannel
  recipient: string
  subject: string | null
  body_preview: string | null
  status: MessageStatus
  provider_ref: string | null
  error: string | null
  source: string | null
  attempts: number
  sent_at: string | null
  delivered_at: string | null
  created_at: string
  provider: { id: string; name: string; driver: string } | null
}

// Per-driver credential field definitions (used to render add/edit forms)
export interface DriverFieldDef {
  key: string
  label: string
  type: 'text' | 'password' | 'number'
  required: boolean
  section: 'credentials' | 'config'
}

export type DriverKey = 'smtp' | 'msg91' | 'twilio' | 'meta-cloud' | 'gupshup'

export const DRIVER_FIELDS: Record<DriverKey, DriverFieldDef[]> = {
  smtp: [
    { key: 'host', label: 'SMTP Host', type: 'text', required: true, section: 'credentials' },
    { key: 'port', label: 'SMTP Port', type: 'number', required: true, section: 'credentials' },
    { key: 'user', label: 'Username', type: 'text', required: true, section: 'credentials' },
    { key: 'pass', label: 'Password', type: 'password', required: true, section: 'credentials' },
    { key: 'from', label: 'From Address', type: 'text', required: true, section: 'config' },
  ],
  msg91: [
    { key: 'authKey', label: 'Auth Key', type: 'password', required: true, section: 'credentials' },
    {
      key: 'webhookToken',
      label: 'Webhook Token',
      type: 'password',
      required: false,
      section: 'credentials',
    },
    { key: 'senderId', label: 'Sender ID', type: 'text', required: true, section: 'config' },
  ],
  twilio: [
    {
      key: 'accountSid',
      label: 'Account SID',
      type: 'text',
      required: true,
      section: 'credentials',
    },
    {
      key: 'authToken',
      label: 'Auth Token',
      type: 'password',
      required: true,
      section: 'credentials',
    },
    { key: 'fromNumber', label: 'From Number', type: 'text', required: true, section: 'config' },
  ],
  'meta-cloud': [
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'password',
      required: true,
      section: 'credentials',
    },
    {
      key: 'appSecret',
      label: 'App Secret',
      type: 'password',
      required: true,
      section: 'credentials',
    },
    { key: 'wabaNumber', label: 'WABA Number', type: 'text', required: true, section: 'config' },
    {
      key: 'phoneNumberId',
      label: 'Phone Number ID',
      type: 'text',
      required: true,
      section: 'config',
    },
    {
      key: 'verifyToken',
      label: 'Webhook Verify Token',
      type: 'text',
      required: false,
      section: 'config',
    },
  ],
  gupshup: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true, section: 'credentials' },
    {
      key: 'webhookToken',
      label: 'Webhook Token',
      type: 'password',
      required: false,
      section: 'credentials',
    },
    { key: 'appName', label: 'App Name', type: 'text', required: true, section: 'config' },
    { key: 'srcName', label: 'Source Name', type: 'text', required: true, section: 'config' },
  ],
}

export const CHANNEL_DRIVERS: Record<IntegrationChannel, DriverKey[]> = {
  EMAIL: ['smtp'],
  SMS: ['msg91', 'twilio'],
  WHATSAPP: ['meta-cloud', 'gupshup'],
}
