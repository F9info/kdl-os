// KDL-122 D8 — RTL gate: webcam / screen-capture / voice-recorder upload widgets.
// All three are pure frontend (MediaRecorder + getUserMedia/getDisplayMedia) —
// mocked here so tests never touch a real camera/mic/screen.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../rtl/utils'
import {
  WebcamCaptureButton,
  ScreenCaptureButton,
  VoiceRecorderButton,
} from '@/components/media/CaptureWidgets'

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(
    public stream: MediaStream,
    public opts?: MediaRecorderOptions
  ) {
    instances.push(this)
  }
  start() {
    /* no-op */
  }
  stop() {
    this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'video/webm' }) })
    this.onstop?.()
  }
}
let instances: FakeMediaRecorder[] = []

const getUserMediaMock = vi.fn()
const getDisplayMediaMock = vi.fn()

beforeEach(() => {
  instances = []
  getUserMediaMock.mockReset()
  getDisplayMediaMock.mockReset()
  const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream
  getUserMediaMock.mockResolvedValue(fakeStream)
  getDisplayMediaMock.mockResolvedValue(fakeStream)

  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: getUserMediaMock, getDisplayMedia: getDisplayMediaMock },
    configurable: true,
  })
  // @ts-expect-error -- test stub, not the real MediaRecorder constructor
  global.MediaRecorder = FakeMediaRecorder
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  global.URL.revokeObjectURL = vi.fn()
  // jsdom's HTMLMediaElement.play() throws "not implemented" — component already
  // swallows the rejection, but stub it so the console stays quiet in tests.
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
})

describe('WebcamCaptureButton', () => {
  it('renders a toolbar button', () => {
    render(<WebcamCaptureButton onCapture={vi.fn()} />)
    expect(screen.getByTitle('Record from webcam')).toBeTruthy()
  })

  it('records video via getUserMedia and hands the file to onCapture on "Use recording"', async () => {
    const onCapture = vi.fn()
    render(<WebcamCaptureButton onCapture={onCapture} />)

    fireEvent.click(screen.getByTitle('Record from webcam'))
    fireEvent.click(screen.getByRole('button', { name: /start/i }))

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledWith({ video: true, audio: true }))
    await waitFor(() => expect(screen.getByRole('button', { name: /stop/i })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    await waitFor(() => expect(screen.getByTestId('capture-preview')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /use recording/i }))
    expect(onCapture).toHaveBeenCalledTimes(1)
    const file = onCapture.mock.calls[0]![0] as File
    expect(file).toBeInstanceOf(File)
    expect(file.name).toMatch(/^webcam-\d+\.webm$/)
  })

  it('shows an error message when getUserMedia is denied', async () => {
    getUserMediaMock.mockRejectedValueOnce(new Error('Permission denied'))
    render(<WebcamCaptureButton onCapture={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Record from webcam'))
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Permission denied'))
    expect(screen.queryByRole('button', { name: /stop/i })).toBeNull()
  })

  it('"Retake" discards the recording without calling onCapture', async () => {
    const onCapture = vi.fn()
    render(<WebcamCaptureButton onCapture={onCapture} />)
    fireEvent.click(screen.getByTitle('Record from webcam'))
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => screen.getByRole('button', { name: /stop/i }))
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    await waitFor(() => screen.getByRole('button', { name: /retake/i }))

    fireEvent.click(screen.getByRole('button', { name: /retake/i }))
    expect(onCapture).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy()
  })
})

describe('ScreenCaptureButton', () => {
  it('records via getDisplayMedia', async () => {
    const onCapture = vi.fn()
    render(<ScreenCaptureButton onCapture={onCapture} />)
    fireEvent.click(screen.getByTitle('Record screen'))
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() =>
      expect(getDisplayMediaMock).toHaveBeenCalledWith({ video: true, audio: true })
    )
    await waitFor(() => screen.getByRole('button', { name: /stop/i }))
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    await waitFor(() => screen.getByRole('button', { name: /use recording/i }))
    fireEvent.click(screen.getByRole('button', { name: /use recording/i }))
    expect((onCapture.mock.calls[0]![0] as File).name).toMatch(/^screen-capture-\d+\.webm$/)
  })
})

describe('VoiceRecorderButton', () => {
  it('records audio-only via getUserMedia and shows a recording indicator, not a video preview', async () => {
    const onCapture = vi.fn()
    render(<VoiceRecorderButton onCapture={onCapture} />)
    fireEvent.click(screen.getByTitle('Record voice'))
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true }))
    await waitFor(() => expect(screen.getByTestId('recording-indicator')).toBeTruthy())
    expect(screen.queryByRole('video' as never)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    await waitFor(() => screen.getByTestId('capture-preview'))
    fireEvent.click(screen.getByRole('button', { name: /use recording/i }))
    expect((onCapture.mock.calls[0]![0] as File).name).toMatch(/^voice-recording-\d+\.webm$/)
  })
})
