// KDL Phase D8 — RTL gate: capture widgets (webcam / screen / voice).
// getUserMedia/getDisplayMedia and MediaRecorder are stubbed; captured files
// must upload via POST /media/upload as FormData with the expected filename.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../utils'
import { WebcamCapture } from '@/components/media/capture/WebcamCapture'
import { ScreenCapture } from '@/components/media/capture/ScreenCapture'
import { VoiceRecorder } from '@/components/media/capture/VoiceRecorder'
import { CaptureDialog } from '@/components/media/capture/CaptureDialog'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))

import api from '@/lib/axios'

// ─── Browser API stubs ────────────────────────────────────────────────────────

function makeFakeStream() {
  const track = { stop: vi.fn(), kind: 'video' }
  return {
    stream: { getTracks: () => [track] } as unknown as MediaStream,
    track,
  }
}

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  stream: MediaStream
  mimeType = 'video/webm'
  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  constructor(stream: MediaStream) {
    this.stream = stream
    FakeMediaRecorder.instances.push(this)
  }
  static isTypeSupported() { return true }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['chunk'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

let getUserMedia: ReturnType<typeof vi.fn>
let getDisplayMedia: ReturnType<typeof vi.fn>
let fakeTrack: { stop: ReturnType<typeof vi.fn> }

function stubMediaDevices({ reject = false } = {}) {
  const { stream, track } = makeFakeStream()
  fakeTrack = track
  const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
  getUserMedia = reject ? vi.fn().mockRejectedValue(denied) : vi.fn().mockResolvedValue(stream)
  getDisplayMedia = reject ? vi.fn().mockRejectedValue(denied) : vi.fn().mockResolvedValue(stream)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia, getDisplayMedia },
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  FakeMediaRecorder.instances = []
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  stubMediaDevices()
  // jsdom lacks real media/canvas implementations
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as never
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }))
  }
  vi.mocked(api.post).mockResolvedValue({
    data: { data: { media: [{ id: 'm1', original_name: 'x' }] } },
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function lastUploadedFile(): File {
  const calls = vi.mocked(api.post).mock.calls
  const call = calls[calls.length - 1]!
  expect(call[0]).toBe('/media/upload')
  const fd = call[1] as FormData
  expect(fd).toBeInstanceOf(FormData)
  return fd.get('files') as File
}

// ─── WebcamCapture ────────────────────────────────────────────────────────────

describe('WebcamCapture (Phase D8)', () => {
  it('requests camera+mic and renders a live preview', async () => {
    render(<WebcamCapture folderId={null} />)
    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: true })
    })
    expect(screen.getByTestId('webcam-preview')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Take photo/ })).not.toBeDisabled()
    })
  })

  it('snaps a photo and uploads a webcam-<ts>.jpg through /media/upload', async () => {
    const onUploaded = vi.fn()
    render(<WebcamCapture folderId="fold-1" onUploaded={onUploaded} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Take photo/ })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /Take photo/ }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const file = lastUploadedFile()
    expect(file.name).toMatch(/^webcam-\d+\.jpg$/)
    expect(file.type).toBe('image/jpeg')
    const fd = vi.mocked(api.post).mock.calls[0]![1] as FormData
    expect(fd.get('folder_id')).toBe('fold-1')
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' })))
  })

  it('records video: start/stop uploads a webcam-<ts>.webm', async () => {
    render(<WebcamCapture folderId={null} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Start recording/ })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /Start recording/ }))
    expect(FakeMediaRecorder.instances.length).toBe(1)
    expect(FakeMediaRecorder.instances[0]!.state).toBe('recording')
    expect(screen.getByTestId('webcam-timer')).toHaveTextContent('0:00')

    fireEvent.click(screen.getByRole('button', { name: /Stop recording/ }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const file = lastUploadedFile()
    expect(file.name).toMatch(/^webcam-\d+\.webm$/)
    expect(file.type).toBe('video/webm')
  })

  it('shows a friendly message when camera permission is denied', async () => {
    stubMediaDevices({ reject: true })
    render(<WebcamCapture folderId={null} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Permission denied/)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('stops all tracks on unmount', async () => {
    const { unmount } = render(<WebcamCapture folderId={null} />)
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    // wait until the stream is attached (ready state)
    await waitFor(() => expect(screen.getByRole('button', { name: /Take photo/ })).not.toBeDisabled())
    unmount()
    expect(fakeTrack.stop).toHaveBeenCalled()
  })
})

// ─── ScreenCapture ────────────────────────────────────────────────────────────

describe('ScreenCapture (Phase D8)', () => {
  it('records the screen: start/stop uploads a screen-<ts>.webm and stops tracks', async () => {
    render(<ScreenCapture folderId={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Start screen recording/ }))
    await waitFor(() => expect(getDisplayMedia).toHaveBeenCalledWith({ video: true }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Stop recording/ })).toBeInTheDocument())
    expect(screen.getByTestId('screen-timer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Stop recording/ }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const file = lastUploadedFile()
    expect(file.name).toMatch(/^screen-\d+\.webm$/)
    expect(fakeTrack.stop).toHaveBeenCalled()
  })

  it('shows a friendly message when screen permission is denied', async () => {
    stubMediaDevices({ reject: true })
    render(<ScreenCapture folderId={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Start screen recording/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Permission denied/)
    expect(api.post).not.toHaveBeenCalled()
  })
})

// ─── VoiceRecorder ────────────────────────────────────────────────────────────

describe('VoiceRecorder (Phase D8)', () => {
  it('records audio: start/stop uploads a voice-<ts>.webm', async () => {
    render(<VoiceRecorder folderId={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Start voice recording/ }))
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }))
    await waitFor(() => expect(screen.getByTestId('voice-timer')).toBeInTheDocument())
    expect(screen.getByTestId('voice-level')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Stop recording/ }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const file = lastUploadedFile()
    expect(file.name).toMatch(/^voice-\d+\.webm$/)
    expect(fakeTrack.stop).toHaveBeenCalled()
  })

  it('shows a friendly message when microphone permission is denied', async () => {
    stubMediaDevices({ reject: true })
    render(<VoiceRecorder folderId={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Start voice recording/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Permission denied/)
    expect(api.post).not.toHaveBeenCalled()
  })
})

// ─── CaptureDialog ────────────────────────────────────────────────────────────

describe('CaptureDialog (Phase D8)', () => {
  it('renders webcam tab by default and switches between capture modes', async () => {
    render(<CaptureDialog folderId={null} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Capture media' })).toBeInTheDocument()
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: true }))

    fireEvent.click(screen.getByRole('button', { name: /Screen/ }))
    expect(screen.getByRole('button', { name: /Start screen recording/ })).toBeInTheDocument()
    // switching away from webcam stops its tracks
    expect(fakeTrack.stop).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Voice/ }))
    expect(screen.getByRole('button', { name: /Start voice recording/ })).toBeInTheDocument()
  })

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn()
    render(<CaptureDialog folderId={null} onClose={onClose} />)
    // let the webcam stream attach so no state update lands after the test
    await waitFor(() => expect(screen.getByRole('button', { name: /Take photo/ })).not.toBeDisabled())
    fireEvent.click(screen.getByTitle('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
