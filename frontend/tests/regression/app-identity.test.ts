import { describe, it, expect } from 'vitest'
import { buildIdentityMetadata } from '@/lib/app-identity'

describe('buildIdentityMetadata', () => {
  it('uses defaults when identity is empty', () => {
    expect(buildIdentityMetadata({})).toEqual({
      title: 'KDL Admin',
      description: 'KDL Starter Kit Admin Panel',
    })
  })

  it('prefers app_title, then app_name, and adds the favicon', () => {
    expect(
      buildIdentityMetadata({ app_title: 'T', app_name: 'N', favicon: 'https://x/f.png' })
    ).toMatchObject({
      title: 'T',
      icons: { icon: 'https://x/f.png' },
    })
    expect(buildIdentityMetadata({ app_title: '', app_name: 'N' }).title).toBe('N')
  })
})
