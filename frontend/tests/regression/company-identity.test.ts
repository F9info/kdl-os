import { describe, it, expect } from 'vitest'
import { buildIdentityPatch } from '@/lib/company-identity'

const base = {
  'brand-profile-company-name': 'Acme',
  'brand-profile-primary-email': 'a@acme.co',
  'brand-profile-primary-phone': '111',
  'brand-profile-address-1': '1 Main St',
  'brand-profile-address-2': '',
}

describe('buildIdentityPatch', () => {
  it('sends nothing when nothing changed', () => {
    expect(buildIdentityPatch(base, { ...base })).toEqual({ patch: {}, contactChanged: false })
  })

  it('name change maps to app_name and is not a contact change', () => {
    expect(buildIdentityPatch(base, { ...base, 'brand-profile-company-name': ' Zed ' })).toEqual({
      patch: { app_name: 'Zed' },
      contactChanged: false,
    })
  })

  it('email, phone and address changes map to contact fields and flag contactChanged', () => {
    const r = buildIdentityPatch(base, {
      ...base,
      'brand-profile-primary-email': 'z@z.co',
      'brand-profile-primary-phone': '222',
      'brand-profile-address-2': '2 Side St',
    })
    expect(r.patch).toEqual({
      contact_email: 'z@z.co',
      contact_phone: '222',
      contact_address: '1 Main St, 2 Side St',
    })
    expect(r.contactChanged).toBe(true)
  })

  it('only sends changed fields (untouched fields never overwrite Identity)', () => {
    const r = buildIdentityPatch(base, { ...base, 'brand-profile-primary-phone': '' })
    expect(Object.keys(r.patch)).toEqual(['contact_phone'])
    expect(r.patch.contact_phone).toBe('')
  })

  it('treats missing slugs as empty and ignores unmapped fields', () => {
    expect(buildIdentityPatch({}, { 'brand-profile-secondary-email': 'x@y.z' }).patch).toEqual({})
  })
})
