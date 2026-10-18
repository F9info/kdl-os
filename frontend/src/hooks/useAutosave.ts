import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Debounced autosave. `schedule(value)` is called on every edit; the latest
 * value is saved `delay` ms after the last edit. Saves never overlap (a new
 * one waits for the in-flight one), unchanged values are skipped, a pending
 * edit is flushed on unmount, and the tab-close prompt is shown while unsaved.
 *
 * `baseline` is the value as loaded — edits equal to it don't trigger a save.
 * `markSaved(value)` is for a manual save: cancels the pending autosave.
 */
export function useAutosave<T>(
  save: (value: T) => Promise<void>,
  baseline: T | null,
  delay = 1500
) {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const saveRef = useRef(save)
  saveRef.current = save
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<T | null>(null)
  const lastJson = useRef<string | null>(null)
  const inFlight = useRef<Promise<void> | null>(null)

  if (lastJson.current === null && baseline !== null) lastJson.current = JSON.stringify(baseline)

  const flush = useCallback(async () => {
    timer.current = null
    if (inFlight.current) await inFlight.current
    const value = pending.current
    if (value === null) return
    pending.current = null
    const run = saveRef
      .current(value)
      .then(() => {
        lastJson.current = JSON.stringify(value)
        setStatus(pending.current === null ? 'saved' : 'saving')
      })
      .catch(() => {
        pending.current ??= value // retry with the next edit instead of dropping it
        setStatus('error')
      })
      .finally(() => {
        inFlight.current = null
      })
    inFlight.current = run
    await run
  }, [])

  const schedule = useCallback(
    (value: T) => {
      if (JSON.stringify(value) === lastJson.current && pending.current === null) return
      pending.current = value
      setStatus('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), delay)
    },
    [delay, flush]
  )

  const markSaved = useCallback((value: T) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    pending.current = null
    lastJson.current = JSON.stringify(value)
    setStatus('saved')
  }, [])

  // Leaving the editor (Back link, route change) must not drop the last edit.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      const value = pending.current
      if (value !== null) void saveRef.current(value).catch(() => {})
    },
    []
  )

  const unsaved = status === 'saving' || status === 'error'
  useEffect(() => {
    if (!unsaved) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [unsaved])

  return { status, schedule, markSaved }
}
