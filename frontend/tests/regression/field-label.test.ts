import { describe, it, expect } from 'vitest'
import type { Field } from '@puckeditor/core'
import { fieldDisplayLabel } from '@/app/admin/page-builder/field-label'
import { DEVICE_FIELDS } from '@/frontend/blocks/packs/device-visibility'

describe('fieldDisplayLabel', () => {
  it('uses the block-defined label when there is one', () => {
    expect(fieldDisplayLabel('menuLink', { type: 'text', label: 'Header menu' } as Field)).toBe(
      'Header menu'
    )
  })
  it('falls back to the field key, so fields without a label look exactly as before', () => {
    expect(fieldDisplayLabel('align', { type: 'radio', options: [] } as Field)).toBe('align')
    expect(fieldDisplayLabel('align', { type: 'text', label: '  ' } as Field)).toBe('align')
  })
  it('the per-device fields read as plain sentences in the editor', () => {
    expect(fieldDisplayLabel('hideOnMobile', DEVICE_FIELDS.hideOnMobile!)).toBe(
      'Hide on mobile (under 768px)'
    )
    expect(fieldDisplayLabel('hideOnTablet', DEVICE_FIELDS.hideOnTablet!)).toBe(
      'Hide on tablet (768px to 1023px)'
    )
    expect(fieldDisplayLabel('hideOnDesktop', DEVICE_FIELDS.hideOnDesktop!)).toBe(
      'Hide on desktop (1024px and wider)'
    )
  })
})
