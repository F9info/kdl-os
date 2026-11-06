import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '../utils'
import {
  IdentityBrandColors,
  identityBrandCss,
} from '@/admin/components/layout/IdentityBrandColors'

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }))
import api from '@/lib/axios'

function mockIdentity(identity: Record<string, string>) {
  vi.mocked(api.get).mockResolvedValue({ data: { data: { identity } } } as never)
}

describe('identityBrandCss', () => {
  it('maps the identity colours onto the tokens the buttons read', () => {
    const css = identityBrandCss('#2c52a3', '#132b60')
    expect(css).toContain('--branding_brand_colors_primary_color:#2c52a3')
    expect(css).toContain('--branding_brand_colors_secondary_color:#132b60')
    expect(css.startsWith(':root[data-theme]{')).toBe(true)
  })

  it('picks a readable button label for the primary colour', () => {
    expect(identityBrandCss('#2c52a3')).toContain('--buttons_primary_button_text_color:#ffffff')
    expect(identityBrandCss('#ffe066')).toContain('--buttons_primary_button_text_color:#111111')
  })

  it('emits nothing for empty or invalid colours so the theme stays in force', () => {
    expect(identityBrandCss('', undefined)).toBe('')
    expect(identityBrandCss('red', '#fff')).toBe('')
  })
})

describe('IdentityBrandColors', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    document.getElementById('kdl-identity-brand')?.remove()
  })

  it('injects the identity colours into the page and removes them when cleared', async () => {
    mockIdentity({ brand_primary: '#2c52a3' })
    const { unmount } = render(<IdentityBrandColors />)
    await waitFor(() =>
      expect(document.getElementById('kdl-identity-brand')?.textContent).toContain('#2c52a3')
    )
    unmount()
  })

  it('adds no style tag when identity has no colours', async () => {
    mockIdentity({ app_name: 'Acme' })
    render(<IdentityBrandColors />)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(document.getElementById('kdl-identity-brand')).toBeNull()
  })
})
