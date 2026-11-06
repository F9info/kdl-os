import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../utils'
import MenusPage from '@/app/admin/menus/page'

const h = vi.hoisted(() => ({ search: '', props: null as null | Record<string, unknown> }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(h.search),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('@/admin/components/shared/ModuleGuard', () => ({
  ModuleGuard: ({ children }: any) => children,
}))
vi.mock('@/admin/components/shared/PermissionGuard', () => ({
  PermissionGuard: ({ children }: any) => children,
}))
vi.mock('@/admin/components/shared/StudioStageRedirect', () => ({
  StudioStageRedirect: (p: Record<string, unknown>) => {
    h.props = p
    return <div data-testid="redirect" />
  },
}))

beforeEach(() => {
  window.localStorage.clear()
  h.search = ''
  h.props = null
})

const open = () => {
  render(<MenusPage />)
  ;(h.props!.beforeOpen as (id: string) => void)('proj-1')
}
const state = () => JSON.parse(window.localStorage.getItem('te-website-ui:proj-1') ?? '{}')
const menu = () => JSON.parse(window.localStorage.getItem('te-website-ui:proj-1:navMenu') ?? '""')

describe('/admin/menus now opens the Web app Navigation editor', () => {
  it('goes to the Navigation step of the Web app, on the Header menu', () => {
    open()
    expect(screen.getByTestId('redirect')).toBeTruthy()
    expect(h.props).toMatchObject({ stageSlug: 'website', query: '?view=navigation' })
    expect(state()).toEqual({ openBrand: 'webapp', webAppStep: 'navigation' })
    expect(menu()).toBe('header')
  })

  it('?key=footer opens the Footer menu', () => {
    h.search = 'key=footer'
    open()
    expect(menu()).toBe('footer')
  })

  it('any other key falls back to the Header menu', () => {
    h.search = 'key=__proto__'
    open()
    expect(menu()).toBe('header')
  })
})
