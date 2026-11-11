export interface SocialField {
  name: string
  label: string
  secret?: boolean
  area?: boolean
  required?: boolean
  placeholder?: string
}
export interface SocialPreset {
  preset: string
  type: 'OIDC' | 'OAUTH2' | 'OTP'
  label: string
  icon: string
  color: string
  fields: SocialField[]
  hint?: string
  builtin?: boolean
}

const clientPair = (id = 'Client ID', secret = 'Client secret'): SocialField[] => [
  { name: 'client_id', label: id, required: true },
  { name: 'client_secret', label: secret, secret: true, required: true },
]
const map: SocialField[] = [
  { name: 'map_email', label: 'Email', placeholder: 'email' },
  { name: 'map_name', label: 'Name', placeholder: 'name' },
  { name: 'map_photo', label: 'Photo', placeholder: 'picture' },
]

/** One table drives the provider keys forms, the "add provider" picker and the website button defaults. */
export const SOCIAL_PRESETS: Record<string, SocialPreset> = {
  google: {
    preset: 'google',
    type: 'OIDC',
    label: 'Google',
    icon: 'G',
    color: '#4285F4',
    builtin: true,
    fields: clientPair(),
    hint: 'Paste this in Google Cloud Console › Credentials',
  },
  facebook: {
    preset: 'facebook',
    type: 'OAUTH2',
    label: 'Facebook',
    icon: 'f',
    color: '#1877F2',
    builtin: true,
    fields: clientPair('App ID', 'App secret'),
    hint: 'Valid OAuth redirect URI in the Facebook app',
  },
  apple: {
    preset: 'apple',
    type: 'OIDC',
    label: 'Sign in with Apple',
    icon: '',
    color: '#000000',
    builtin: true,
    fields: [
      { name: 'services_id', label: 'Services ID', required: true },
      { name: 'team_id', label: 'Team ID', placeholder: 'A1B2C3D4E5', required: true },
      { name: 'key_id', label: 'Key ID', placeholder: 'K9X8Y7', required: true },
      { name: 'private_key', label: 'Private key (.p8)', secret: true, area: true, required: true },
    ],
  },
  linkedin: {
    preset: 'linkedin',
    type: 'OIDC',
    label: 'LinkedIn',
    icon: 'in',
    color: '#0A66C2',
    fields: [
      ...clientPair(),
      { name: 'scopes', label: 'Scopes', placeholder: 'openid profile email' },
    ],
    hint: 'LinkedIn › My apps › Auth › Authorized redirect URLs',
  },
  oidc: {
    preset: 'oidc',
    type: 'OIDC',
    label: 'Custom OpenID Connect',
    icon: 'ID',
    color: '#334155',
    fields: [
      {
        name: 'discovery_url',
        label: 'Discovery URL',
        required: true,
        placeholder: 'https://sso.example/.well-known/openid-configuration',
      },
      ...clientPair(),
      { name: 'scopes', label: 'Scopes', placeholder: 'openid email profile' },
      ...map,
    ],
  },
  oauth2: {
    preset: 'oauth2',
    type: 'OAUTH2',
    label: 'Custom OAuth 2.0',
    icon: 'ID',
    color: '#334155',
    fields: [
      { name: 'authorize_url', label: 'Authorize URL', required: true },
      { name: 'token_url', label: 'Token URL', required: true },
      { name: 'userinfo_url', label: 'User-info URL', required: true },
      ...clientPair(),
      { name: 'scopes', label: 'Scopes' },
      ...map,
    ],
  },
  otp: {
    preset: 'otp',
    type: 'OTP',
    label: 'Mobile OTP (SMS / WhatsApp)',
    icon: '#',
    color: '#0F766E',
    builtin: true,
    fields: [
      { name: 'sms_provider', label: 'SMS provider', placeholder: 'MSG91' },
      { name: 'api_key', label: 'API key', secret: true },
      {
        name: 'dlt_template_id',
        label: 'DLT template ID',
        placeholder: 'Required for SMS in India',
      },
    ],
  },
}
export const ADD_PRESETS = ['google', 'facebook', 'apple', 'linkedin', 'oidc', 'oauth2']
export const presetOf = (p: { preset?: string; key: string }) => SOCIAL_PRESETS[p.preset ?? p.key]
