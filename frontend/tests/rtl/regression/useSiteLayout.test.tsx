import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AllTheProvider } from '../utils'
import { fetchSiteLayout, saveSiteLayout, useSiteLayout } from '@/hooks/useSiteLayout'
import { websiteLayoutStorageKey } from '@/lib/website-layout-overrides'

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get: h.get, put: h.put } }))

const slot = (variant: string, enabled = true) => ({ enabled, variant })
const server = (layout: unknown) => h.get.mockResolvedValue({ data: { data: { layout } } })
const KEY = websiteLayoutStorageKey('p1')

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  h.put.mockResolvedValue({ data: { data: { layout: {} } } })
})

describe('fetchSiteLayout', () => {
  it('returns the server layout and never touches the old browser value', async () => {
    server({ header: slot('3') })
    window.localStorage.setItem(KEY, JSON.stringify({ header: slot('1') }))
    expect(await fetchSiteLayout('p1')).toEqual({ header: slot('3') })
    expect(h.put).not.toHaveBeenCalled()
  })

  it('adopts the old browser value once when the server has nothing (copies it up)', async () => {
    server(null)
    window.localStorage.setItem(KEY, JSON.stringify({ footer: slot('2', false) }))
    expect(await fetchSiteLayout('p1')).toEqual({ footer: slot('2', false) })
    expect(h.put).toHaveBeenCalledTimes(1)
    const [url, body] = h.put.mock.calls[0]!
    expect(url).toBe('/projects/p1/layout')
    // the whole selection is sent, with defaults filled for the slots the old value lacked
    expect(body).toMatchObject({
      footer: slot('2', false),
      header: expect.any(Object),
      topHeader: expect.any(Object),
    })
  })

  it('still returns the old value when copying it up is not allowed', async () => {
    server(null)
    h.put.mockRejectedValue(new Error('403'))
    window.localStorage.setItem(KEY, JSON.stringify({ header: slot('4') }))
    expect(await fetchSiteLayout('p1')).toEqual({ header: slot('4') })
  })

  it('returns an empty selection (defaults apply) when neither side has one', async () => {
    server(null)
    expect(await fetchSiteLayout('p1')).toEqual({})
    expect(h.put).not.toHaveBeenCalled()
  })
})

describe('saveSiteLayout', () => {
  it('PUTs the whole selection to the project and returns what the server stored', async () => {
    const sel = { topHeader: slot('5'), header: slot('5'), footer: slot('custom:abc') }
    h.put.mockResolvedValue({ data: { data: { layout: sel } } })
    expect(await saveSiteLayout('p1', sel as never)).toEqual(sel)
    expect(h.put).toHaveBeenCalledWith('/projects/p1/layout', sel)
  })
})

describe('useSiteLayout', () => {
  it('stays loading while only the old browser value is shown, then returns the server layout', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ header: slot('1') }))
    let release: (v: unknown) => void = () => {}
    h.get.mockReturnValue(new Promise((r) => (release = r)))
    const { result } = renderHook(() => useSiteLayout('p1'), { wrapper: AllTheProvider })
    // placeholder from localStorage is visible instantly, but callers must not seed from it
    expect(result.current.selection.header).toEqual(slot('1'))
    expect(result.current.isLoading).toBe(true)
    release({ data: { data: { layout: { header: slot('3'), footer: slot('2', false) } } } })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.selection.header).toEqual(slot('3'))
    expect(result.current.selection.footer).toEqual(slot('2', false))
  })
})
