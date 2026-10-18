/**
 * Regression tests for useAutosave (Puck editor autosave — Issue 5):
 * debounce, no-op on unchanged data, no overlapping saves, retry after a
 * failure, flush on unmount, and the tab-close guard.
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAutosave } from '@/hooks/useAutosave'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const flushTimers = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe('useAutosave', () => {
  it('debounces rapid edits into one save of the latest value', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<{ n: number }>(save, { n: 0 }))

    act(() => result.current.schedule({ n: 1 }))
    await flushTimers(1000)
    act(() => result.current.schedule({ n: 2 }))
    expect(result.current.status).toBe('saving')
    await flushTimers(1499)
    expect(save).not.toHaveBeenCalled()
    await flushTimers(1)

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ n: 2 })
    expect(result.current.status).toBe('saved')
  })

  it('does not save a value equal to the loaded baseline', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<{ n: number }>(save, { n: 0 }))

    act(() => result.current.schedule({ n: 0 }))
    await flushTimers(2000)
    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('never overlaps saves — an edit during an in-flight save waits for it', async () => {
    let release!: () => void
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((r) => {
            release = r
          })
      )
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<{ n: number }>(save, { n: 0 }))

    act(() => result.current.schedule({ n: 1 }))
    await flushTimers(1500) // save #1 starts, hangs
    act(() => result.current.schedule({ n: 2 }))
    await flushTimers(1500) // #2's timer fires but must wait
    expect(save).toHaveBeenCalledTimes(1)

    await act(async () => {
      release()
    })
    await flushTimers(0)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith({ n: 2 })
    expect(result.current.status).toBe('saved')
  })

  it('reports an error and retries with the next edit', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<{ n: number }>(save, { n: 0 }))

    act(() => result.current.schedule({ n: 1 }))
    await flushTimers(1500)
    expect(result.current.status).toBe('error')

    act(() => result.current.schedule({ n: 2 }))
    await flushTimers(1500)
    expect(save).toHaveBeenLastCalledWith({ n: 2 })
    expect(result.current.status).toBe('saved')
  })

  it('markSaved cancels a pending autosave (manual Save wins)', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<{ n: number }>(save, { n: 0 }))

    act(() => result.current.schedule({ n: 1 }))
    act(() => result.current.markSaved({ n: 1 }))
    await flushTimers(3000)
    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe('saved')
  })

  it('flushes a pending edit on unmount', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() => useAutosave<{ n: number }>(save, { n: 0 }))

    act(() => result.current.schedule({ n: 5 }))
    unmount()
    expect(save).toHaveBeenCalledWith({ n: 5 })
  })

  it('asks before closing the tab only while a save is pending or failed', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<{ n: number }>(save, { n: 0 }))
    const fire = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }

    expect(fire()).toBe(false)
    act(() => result.current.schedule({ n: 1 }))
    expect(fire()).toBe(true)
    await flushTimers(1500)
    expect(fire()).toBe(false)
  })
})
