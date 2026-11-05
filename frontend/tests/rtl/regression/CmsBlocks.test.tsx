import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { general } from '@/frontend/blocks/packs/general'

const comp = general.components as any
const Faq = comp.FaqList.render
const Gallery = comp.GalleryGrid.render
const Grid = comp.ContentGrid.render
const puck = { metadata: { projectId: 'p1' } }

const reply = (items: unknown[], ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => ({ data: { items } }) })

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('FaqList block', () => {
  it('shows the module rows when the FAQ module returns some', async () => {
    const f = reply([{ question: 'From module?', answer: 'Yes' }])
    vi.stubGlobal('fetch', f)
    render(<Faq sectionTitle="" source="module" items="Fallback?|Yes" puck={puck} />)
    await screen.findByText('From module?')
    expect(f).toHaveBeenCalledWith('/api/faq/public?project_id=p1')
    expect(screen.queryByText('Fallback?')).toBeNull()
  })

  it('falls back to its own lines when the module is off or empty', async () => {
    vi.stubGlobal('fetch', reply([], false))
    render(<Faq source="module" items={'One?|A1\nTwo?|A2'} puck={puck} />)
    expect(await screen.findByText('One?')).toBeTruthy()
    expect(screen.getByText('Two?')).toBeTruthy()
  })

  it('uses only its own lines when source is "block"', () => {
    const f = reply([{ question: 'Module', answer: 'x' }])
    vi.stubGlobal('fetch', f)
    render(<Faq source="block" items="Own?|A" puck={puck} />)
    expect(screen.getByText('Own?')).toBeTruthy()
    expect(f).not.toHaveBeenCalled()
  })
})

describe('GalleryGrid block', () => {
  it('shows module images and opens/closes the viewer', async () => {
    vi.stubGlobal('fetch', reply([{ title: 'Office', image_url: '/o.png', caption: 'Our office' }]))
    render(<Gallery source="module" columns="3" images="" puck={puck} />)
    fireEvent.click(await screen.findByLabelText('Open Office'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('falls back to its own "url|caption" lines', async () => {
    vi.stubGlobal('fetch', reply([]))
    render(<Gallery source="module" columns="2" images="/a.png|First" puck={puck} />)
    expect(await screen.findByLabelText('Open First')).toBeTruthy()
  })
})

describe('ContentGrid block', () => {
  it.each([
    ['team', '/api/team/public', { name: 'Alex', role: 'Founder', bio: 'Leads' }, 'Alex'],
    [
      'testimonials',
      '/api/testimonials/public',
      { name: 'Priya', role: 'Customer', quote: 'Great work' },
      'Priya',
    ],
    [
      'catalog',
      '/api/catalog/public',
      { name: 'Cables', category: 'Products', description: 'x' },
      'Cables',
    ],
    ['work', '/api/work/public', { name: 'Villa', eyebrow: 'Our work', subtitle: 'x' }, 'Villa'],
    [
      'sectors',
      '/api/sectors/public',
      { name: 'Hotels', category: 'Sectors', description: 'x' },
      'Hotels',
    ],
    [
      'cases',
      '/api/projects-content/public',
      { title: 'Tower', eyebrow: 'Case', description: 'x' },
      'Tower',
    ],
  ])('%s reads its module and shows the card', async (kind, url, row, label) => {
    const f = reply([row])
    vi.stubGlobal('fetch', f)
    render(<Grid kind={kind} source="module" columns="3" items="" puck={puck} />)
    await screen.findByText(label)
    expect(f).toHaveBeenCalledWith(`${url}?project_id=p1`)
  })

  it('shows a testimonial as a quote', async () => {
    vi.stubGlobal('fetch', reply([{ name: 'Priya', role: 'Customer', quote: 'Great work' }]))
    render(<Grid kind="testimonials" source="module" columns="3" items="" puck={puck} />)
    expect(await screen.findByText('“Great work”')).toBeTruthy()
  })

  it('falls back to its own lines when the module is empty', async () => {
    vi.stubGlobal('fetch', reply([]))
    render(<Grid kind="team" source="module" columns="3" items="Own Person|Role|Bio" puck={puck} />)
    expect(await screen.findByText('Own Person')).toBeTruthy()
  })
})
