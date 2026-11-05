export type ImportProvider = 'google-drive' | 'dropbox' | 'onedrive' | 's3' | 'ftp'

export interface ImportProviderStatus {
  provider: ImportProvider
  oauth: boolean
  configured: boolean
}

export interface ImportConnection {
  id: string
  provider: ImportProvider
  label: string
  created_at: string
  updated_at: string
}

export interface RemoteFile {
  id: string
  name: string
  mimeType: string | null
  size: number | null
  isFolder: boolean
}

export interface RemoteFileList {
  items: RemoteFile[]
  nextCursor: string | null
}

export interface ImportResult {
  imported: { id: string; name: string }[]
  skipped: { file_id: string; reason: string }[]
}

export const OAUTH_PROVIDERS: ImportProvider[] = ['google-drive', 'dropbox', 'onedrive']
export const MANUAL_PROVIDERS: ImportProvider[] = ['s3', 'ftp']

export const PROVIDER_LABELS: Record<ImportProvider, string> = {
  'google-drive': 'Google Drive',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
  s3: 'S3 Bucket',
  ftp: 'FTP Server',
}

export interface ManualFieldDef {
  key: string
  label: string
  required: boolean
  type?: 'password' | 'text' | 'checkbox'
}

// Mirrors each manual driver's credentialsSchema (backend/src/modules/media/import/drivers/{s3,ftp}.js).
export const MANUAL_PROVIDER_FIELDS: Record<'s3' | 'ftp', ManualFieldDef[]> = {
  s3: [
    { key: 'access_key_id', label: 'Access Key ID', required: true, type: 'password' },
    { key: 'secret_access_key', label: 'Secret Access Key', required: true, type: 'password' },
    { key: 'bucket', label: 'Bucket', required: true },
    { key: 'region', label: 'Region (default us-east-1)', required: false },
    { key: 'endpoint', label: 'Custom Endpoint (optional)', required: false },
  ],
  ftp: [
    { key: 'host', label: 'Host', required: true },
    { key: 'port', label: 'Port (default 21)', required: false },
    { key: 'user', label: 'Username', required: true },
    { key: 'password', label: 'Password', required: true, type: 'password' },
    { key: 'secure', label: 'Use FTPS', required: false, type: 'checkbox' },
  ],
}
