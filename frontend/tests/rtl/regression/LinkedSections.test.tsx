import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { LinkedSectionStatus } from '@/app/admin/page-builder/LinkedSection'
import { SectionUsageDialog } from '@/app/admin/page-builder/section-builder/SectionUsage'
import type { ComposedBlockConfig } from '@/frontend/blocks/packs/composer/render-composed-block'
import {
  sectionLinkProps,
  sectionLinkState,
  type CustomBlockRecord,
} from '@/frontend/blocks/packs/composer/custom-blocks-store'

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: h }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const CFG = { category: 'hero', atoms: [], settings: {} } as unknown as ComposedBlockConfig
const raw = (over = {}) => ({
  id: 't1',
  project_id: 'p1',
  category_key: 'hero',
  name: 'Big hero',
  description: null,
  status: 'PUBLISHED',
  is_default: false,
  config: { ...CFG, settings: { v: 3 } },
  version: 3,
  updated_at: '',
  ...over,
})
const sections = (over = {}) => h.get.mockResolvedValue({ data: { data: { items: [raw(over)] } } })

beforeEach(() => vi.clearAllMocks())

describe('store helpers (T7.1)', () => {
  const latest = { version: 3 }
  it('sectionLinkProps carries the section id and version', () => {
    expect(sectionLinkProps({ id: 't1', version: 3 } as CustomBlockRecord)).toEqual({
      templateId: 't1',
      templateVersion: 3,
    })
  })
  it('sectionLinkState: not linked / current / outdated / detached / missing', () => {
    expect(sectionLinkState({}, latest)).toBe('not-linked')
    expect(sectionLinkState({ templateId: 't1', templateVersion: 3 }, latest)).toBe('current')
    expect(sectionLinkState({ templateId: 't1', templateVersion: 2 }, latest)).toBe('outdated')
    expect(sectionLinkState({ templateId: 't1' }, latest)).toBe('outdated') // no version yet = oldest
    expect(
      sectionLinkState({ templateId: 't1', templateVersion: 1, templateDetached: true }, latest)
    ).toBe('detached')
    expect(sectionLinkState({ templateId: 't1', templateVersion: 3 }, undefined)).toBe('missing')
  })
})

describe('LinkedSectionStatus: the editor note for a block made from a saved section', () => {
  const show = (props: object, onApply = vi.fn()) => {
    render(
      <LinkedSectionStatus props={{ config: CFG, ...props }} projectId="p1" onApply={onApply} />
    )
    return onApply
  }

  it('says nothing for a block that was never linked', async () => {
    show({})
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByTestId('linked-section')).toBeNull()
    // and does not even look the section up (the app shell may fetch its own things)
    expect(h.get.mock.calls.filter((c) => String(c[0]).includes('custom-blocks'))).toEqual([])
  })

  it('current: just states the link', async () => {
    sections()
    show({ templateId: 't1', templateVersion: 3 })
    const note = await screen.findByTestId('linked-section')
    expect(note.getAttribute('data-state')).toBe('current')
    expect(note.textContent).toMatch(/Linked to the saved section “Big hero” \(version 3\)/)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('outdated: offers "Update this block", which hands the latest config and version back', async () => {
    sections()
    const onApply = show({ templateId: 't1', templateVersion: 1 })
    expect((await screen.findByTestId('linked-section')).textContent).toMatch(
      /newer version \(3\).*version 1/
    )
    fireEvent.click(screen.getByRole('button', { name: 'Update this block' }))
    expect(onApply).toHaveBeenCalledWith({
      config: { ...CFG, settings: { v: 3 } },
      templateVersion: 3,
      templateDetached: false,
    })
  })

  it('customised on the page: explains it, and "Reset" re-links it to the section', async () => {
    sections()
    const onApply = show({ templateId: 't1', templateVersion: 1, templateDetached: true })
    expect((await screen.findByTestId('linked-section')).textContent).toMatch(
      /Customised on this page/
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reset to the saved section' }))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ templateVersion: 3, templateDetached: false })
    )
  })

  it('the section was deleted: tells the author, offers nothing destructive', async () => {
    sections({ id: 'someone-else' })
    show({ templateId: 't1', templateVersion: 3 })
    const note = await screen.findByTestId('linked-section')
    expect(note.getAttribute('data-state')).toBe('missing')
    expect(note.textContent).toMatch(/was deleted/)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('SectionUsageDialog: where a saved section is used', () => {
  const block = { id: 't1', name: 'Big hero', version: 3 } as CustomBlockRecord
  const usage = (pages: object[]) => ({ data: { data: { version: 3, pages } } })
  const page = (over = {}) => ({
    id: 'a',
    title: 'Home',
    slug: 'home',
    status: 'PUBLISHED',
    blocks: 2,
    outdated: 1,
    detached: 0,
    ...over,
  })

  it('lists the pages with their state and links to each page editor', async () => {
    h.get.mockResolvedValue(
      usage([
        page(),
        page({ id: 'b', title: 'About', status: 'DRAFT', blocks: 1, outdated: 0, detached: 1 }),
      ])
    )
    render(<SectionUsageDialog block={block} projectId="p1" onClose={() => {}} />)
    expect(await screen.findByText('Home')).toBeTruthy()
    expect(h.get).toHaveBeenCalledWith('/custom-blocks/t1/instances', {
      headers: { 'X-Project-Id': 'p1' },
    })
    expect(screen.getByText('1 behind')).toBeTruthy()
    expect(screen.getByText('Up to date')).toBeTruthy()
    expect(screen.getByText(/1 customised on the page/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe(
      '/admin/template-engine/edit/a'
    )
  })

  it('"Update 1 use" brings the pages up to date through the API', async () => {
    h.get.mockResolvedValue(usage([page()]))
    h.post.mockResolvedValue({
      data: {
        data: {
          version: 3,
          updated: [{ id: 'a', title: 'Home', status: 'PUBLISHED', blocks: 1 }],
          needsPublish: 1,
        },
      },
    })
    render(<SectionUsageDialog block={block} projectId="p1" onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Update 1 use' }))
    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith(
        '/custom-blocks/t1/update-instances',
        {},
        { headers: { 'X-Project-Id': 'p1' } }
      )
    )
  })

  it('nothing is behind: the button says so and is disabled; an unused section says that', async () => {
    h.get.mockResolvedValue(usage([page({ outdated: 0 })]))
    const { unmount } = render(
      <SectionUsageDialog block={block} projectId="p1" onClose={() => {}} />
    )
    const btn = (await screen.findByRole('button', {
      name: 'Everything is up to date',
    })) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    unmount()
    h.get.mockResolvedValue(usage([]))
    render(<SectionUsageDialog block={block} projectId="p1" onClose={() => {}} />)
    expect(await screen.findByText('No page uses this section yet.')).toBeTruthy()
  })
})
