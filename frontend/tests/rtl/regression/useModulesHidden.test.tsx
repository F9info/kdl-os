import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../utils'
import { useModules } from '@/hooks/useModules'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }))
import api from '@/lib/axios'

const item = (label: string) => ({ label, path: `/admin/${label}`, icon: 'Package' })
const modules = [
  { slug: 'integrations', name: 'Integrations', core: false, nav: [item('Integrations')] },
  {
    slug: 'theme-engine-ui',
    name: 'Themes',
    core: false,
    hidden_by_products: true,
    nav: [item('Themes')],
  },
  { slug: 'cms', name: 'CMS', core: false, hidden_by_products: true, nav: [] },
  {
    slug: 'menus',
    name: 'Website',
    core: false,
    parent: 'cms',
    hidden_by_products: true,
    nav: [item('Navigation')],
  },
]

function Probe() {
  const { nonCoreNav, bundles, isEnabled } = useModules()
  return (
    <p data-testid="out">
      {nonCoreNav.map((n) => n.label).join(',')}|{bundles.length}|
      {String(isEnabled('theme-engine-ui'))}
    </p>
  )
}

describe('useModules hides modules the chosen products do not need', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true } as never)
    vi.mocked(api.get).mockImplementation(
      () => Promise.resolve({ data: { data: { modules } } }) as ReturnType<typeof api.get>
    )
  })

  it('drops hidden entries and bundles from the menus but still reports them enabled', async () => {
    render(<Probe />)
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('Integrations'))
    // Themes and the CMS bundle are gone from the menus; the module is still enabled.
    expect(screen.getByTestId('out').textContent).toBe('Integrations|0|true')
  })
})
