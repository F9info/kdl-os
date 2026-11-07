import { describe, it, expect } from 'vitest'
import { applyIdentity } from '@/frontend/lib/apply-identity'

const page = { content: [{ type: 'NavBar', props: { brand: 'baked', logoUrl: '/baked.png' } }] }

describe('applyIdentity: the website shows the company, not the admin application (T08)', () => {
  it('uses company name and logo when set', () => {
    const out = applyIdentity(page, {
      app_name: 'KDL Admin',
      logo_light: '/app.png',
      company_name: 'Acme',
      company_logo_light: '/acme.png',
    })
    expect(out.content[0]?.props).toMatchObject({ brand: 'Acme', logoUrl: '/acme.png' })
  })
  it('falls back to the application name and logo when the company ones are empty', () => {
    const out = applyIdentity(page, {
      app_name: 'KDL Admin',
      logo_light: '/app.png',
      company_name: '',
      company_logo_light: '',
    })
    expect(out.content[0]?.props).toMatchObject({ brand: 'KDL Admin', logoUrl: '/app.png' })
  })
})
