// KDL Phase D8 — RTL gate: CloudImportDialog (cloud imports).
// Mocks mirror the backend contract (see backend/src/modules/media/import/controller.js):
//   GET  /media/import/providers               → { items: [{ provider, auth, configured }] }
//   GET  /media/import/connections             → { items: [{ id, provider, label, created_at, updated_at }] }
//   POST /media/import/connections             → { item: connection } (s3/ftp credentials)
//   GET  /media/import/connections/:id/browse  → { entries, cursor }
//   POST /media/import/connections/:id/import  → { imported, skipped }
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'
import { CloudImportDialog } from '@/components/media/CloudImportDialog'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))

import api from '@/lib/axios'

const PROVIDERS = [
  { provider: 'gdrive', auth: 'oauth', configured: true },
  { provider: 'dropbox', auth: 'oauth', configured: false },
  { provider: 'onedrive', auth: 'oauth', configured: false },
  { provider: 's3', auth: 'credentials', configured: true },
  { provider: 'ftp', auth: 'credentials', configured: true },
]

const CONNECTIONS = [
  {
    id: 'c1', provider: 's3', label: 'My bucket',
    created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
  },
]

const BROWSE_ROOT = {
  entries: [
    { id: 'folder-1', name: 'Photos', size: 0, mime: null, is_folder: true },
    { id: 'file-1', name: 'sky.jpg', size: 1024, mime: 'image/jpeg', is_folder: false },
    { id: 'file-2', name: 'notes.exe', size: 2048, mime: 'application/octet-stream', is_folder: false },
  ],
  cursor: null,
}

const IMPORT_RESULT = {
  imported: [{ id: 'm1', name: 'sky.jpg' }],
  skipped: [{ file: 'notes.exe', reason: 'File type not allowed' }],
}

function setupApi({ connections = CONNECTIONS } = {}) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/media/import/providers')
      return Promise.resolve({ data: { data: { items: PROVIDERS } } }) as ReturnType<typeof api.get>
    if (url === '/media/import/connections')
      return Promise.resolve({ data: { data: { items: connections } } }) as ReturnType<typeof api.get>
    if (url === '/media/import/connections/c1/browse')
      return Promise.resolve({ data: { data: BROWSE_ROOT } }) as ReturnType<typeof api.get>
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
  })
  vi.mocked(api.post).mockImplementation((url: string) => {
    if (url === '/media/import/connections')
      return Promise.resolve({
        data: { data: { item: { id: 'c2', provider: 's3', label: 'New bucket', created_at: '', updated_at: '' } } },
      }) as ReturnType<typeof api.post>
    if (url === '/media/import/connections/c1/import')
      return Promise.resolve({ data: { data: IMPORT_RESULT } }) as ReturnType<typeof api.post>
    return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.post>
  })
  vi.mocked(api.delete).mockResolvedValue({ data: { data: {} } } as never)
}

async function openBrowser() {
  render(<CloudImportDialog folderId={null} onClose={vi.fn()} onImported={vi.fn()} />)
  const browseBtn = await screen.findByRole('button', { name: 'Browse' })
  fireEvent.click(browseBtn)
  await waitFor(() => expect(screen.getByText('sky.jpg')).toBeInTheDocument())
}

describe('CloudImportDialog (Phase D8) — connections step', () => {
  beforeEach(() => { vi.clearAllMocks(); setupApi() })

  it('renders providers and existing connections', async () => {
    render(<CloudImportDialog folderId={null} onClose={vi.fn()} onImported={vi.fn()} />)
    expect(await screen.findByText('My bucket')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Google Drive/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Amazon S3/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /FTP/ })).toBeInTheDocument()
  })

  it('disables unconfigured oauth providers with a hint', async () => {
    render(<CloudImportDialog folderId={null} onClose={vi.fn()} onImported={vi.fn()} />)
    await screen.findByText('My bucket')
    expect(screen.getByRole('button', { name: /Dropbox/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Google Drive/ })).not.toBeDisabled()
    expect(screen.getAllByText('Not configured').length).toBe(2) // dropbox + onedrive
  })

  it('requests an oauth url with the callback redirect_uri and opens a popup', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { url: 'https://accounts.example/auth', state: 'st1' } } } as never)
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<CloudImportDialog folderId={null} onClose={vi.fn()} onImported={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Google Drive/ }))
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/media/import/oauth/gdrive/url', {
        redirect_uri: window.location.origin + '/admin/media/import/callback',
      })
      expect(openSpy).toHaveBeenCalledWith('https://accounts.example/auth', 'media-import-oauth', expect.any(String))
    })
    openSpy.mockRestore()
  })

  it('submits s3 credential form with typed values', async () => {
    render(<CloudImportDialog folderId={null} onClose={vi.fn()} onImported={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Amazon S3/ }))

    fireEvent.change(screen.getByPlaceholderText('Connection label'), { target: { value: 'Prod bucket' } })
    fireEvent.change(screen.getByPlaceholderText('Access key ID'), { target: { value: 'AKIA123' } })
    fireEvent.change(screen.getByPlaceholderText('Secret access key'), { target: { value: 'secret!' } })
    fireEvent.change(screen.getByPlaceholderText('Bucket'), { target: { value: 'assets' } })
    fireEvent.change(screen.getByPlaceholderText('Region (optional)'), { target: { value: 'us-east-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save connection' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/media/import/connections', {
        provider: 's3',
        label: 'Prod bucket',
        credentials: {
          access_key_id: 'AKIA123',
          secret_access_key: 'secret!',
          bucket: 'assets',
          region: 'us-east-1',
        },
      })
    })
  })

  it('deletes a connection', async () => {
    render(<CloudImportDialog folderId={null} onClose={vi.fn()} onImported={vi.fn()} />)
    fireEvent.click(await screen.findByTitle('Delete connection My bucket'))
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/media/import/connections/c1')
    })
  })
})

describe('CloudImportDialog (Phase D8) — browser step', () => {
  beforeEach(() => { vi.clearAllMocks(); setupApi() })

  it('browses a connection: renders folders and files with sizes', async () => {
    await openBrowser()
    expect(api.get).toHaveBeenCalledWith('/media/import/connections/c1/browse', { params: {} })
    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText('notes.exe')).toBeInTheDocument()
    expect(screen.getByLabelText('Select sky.jpg')).toBeInTheDocument()
  })

  it('descends into a folder with path param and updates the breadcrumb', async () => {
    await openBrowser()
    vi.mocked(api.get).mockClear()
    fireEvent.click(screen.getByText('Photos'))
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/media/import/connections/c1/browse', { params: { path: 'folder-1' } })
    })
    // breadcrumb: connection label + folder name
    expect(screen.getAllByText('Photos').length).toBeGreaterThan(0)
    expect(screen.getByText('My bucket')).toBeInTheDocument()
  })

  it('shows Load more when cursor is non-null and passes it back', async () => {
    vi.mocked(api.get).mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
      if (url === '/media/import/providers')
        return Promise.resolve({ data: { data: { items: PROVIDERS } } }) as ReturnType<typeof api.get>
      if (url === '/media/import/connections')
        return Promise.resolve({ data: { data: { items: CONNECTIONS } } }) as ReturnType<typeof api.get>
      if (url === '/media/import/connections/c1/browse') {
        if (config?.params?.cursor === 'cur1')
          return Promise.resolve({
            data: { data: { entries: [{ id: 'file-9', name: 'more.png', size: 10, mime: 'image/png', is_folder: false }], cursor: null } },
          }) as ReturnType<typeof api.get>
        return Promise.resolve({ data: { data: { ...BROWSE_ROOT, cursor: 'cur1' } } }) as ReturnType<typeof api.get>
      }
      return Promise.resolve({ data: { data: {} } }) as ReturnType<typeof api.get>
    })
    await openBrowser()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/media/import/connections/c1/browse', { params: { cursor: 'cur1' } })
      expect(screen.getByText('more.png')).toBeInTheDocument()
    })
    // first page entries kept
    expect(screen.getByText('sky.jpg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('imports selected files and shows a summary with skipped reasons', async () => {
    const onImported = vi.fn()
    render(<CloudImportDialog folderId="folder-lib" onClose={vi.fn()} onImported={onImported} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Browse' }))
    await waitFor(() => expect(screen.getByText('sky.jpg')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('Select sky.jpg'))
    fireEvent.click(screen.getByLabelText('Select notes.exe'))
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 files' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/media/import/connections/c1/import', {
        files: ['file-1', 'file-2'],
        folder_id: 'folder-lib',
      })
      expect(screen.getByText(/1 file imported, 1 skipped/)).toBeInTheDocument()
      expect(screen.getByText(/notes\.exe: File type not allowed/)).toBeInTheDocument()
    })
    expect(onImported).toHaveBeenCalledWith(IMPORT_RESULT)
  })

  it('disables Import when nothing is selected', async () => {
    await openBrowser()
    expect(screen.getByRole('button', { name: 'Import 0 files' })).toBeDisabled()
  })
})
