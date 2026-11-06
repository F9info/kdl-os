import { describe, it, expect } from 'vitest'
import { resolveNavPages } from '@/app/admin/template-engine/_components/stages/NavPagesGrid'

const page = (id: string, slug: string) => ({ id, slug, title: slug }) as never
const item = (o: Record<string, unknown>) =>
  ({
    id: 'i' + o.label,
    parent_id: null,
    page_id: null,
    url: null,
    open_in_new_tab: false,
    is_active: true,
    no_page: false,
    order: 0,
    children: [],
    link_type: 'custom',
    ...o,
  }) as never

describe('resolveNavPages', () => {
  const pages = [
    page('h', 'demo-home'),
    page('a', 'demo-about'),
    page('s', 'svc-detail'),
    page('x', 'orphan'),
  ]

  it('lists Home plus every nav item, resolved by url slug or page_id', () => {
    const cards = resolveNavPages(
      [
        item({ label: 'About', url: '/p/demo-about' }),
        item({ label: 'Service Detail', link_type: 'page', page_id: 's', url: '/service/page1' }),
        item({ label: 'Blog', url: '/p/demo-blog' }),
      ],
      pages
    )
    expect(cards.map((c) => [c.label, c.page?.id ?? null])).toEqual([
      ['Home', 'h'],
      ['About', 'a'],
      ['Service Detail', 's'],
      ['Blog', null],
    ])
  })

  it('skips external, hidden and no-page items; includes children; pages outside nav are not listed', () => {
    const cards = resolveNavPages(
      [
        item({ label: 'Ext', link_type: 'external', url: 'https://x.com' }),
        item({ label: 'Off', is_active: false, url: '/p/demo-about' }),
        item({
          label: 'Group',
          no_page: true,
          children: [item({ label: 'About', url: '/p/demo-about' })],
        }),
      ],
      pages
    )
    expect(cards.map((c) => c.label)).toEqual(['Home', 'About'])
  })
})
