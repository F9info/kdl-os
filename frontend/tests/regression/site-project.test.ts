import { describe, it, expect, afterEach, vi } from 'vitest'
import { siteProjectId } from '@/lib/site-project'

describe('siteProjectId (friendly public URLs — no ?projectId= needed)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('uses the legacy ?projectId= query when present', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_PROJECT_ID', 'from-env')
    expect(siteProjectId('from-query')).toBe('from-query')
  })

  it('falls back to the site project id written by the generator', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_PROJECT_ID', 'from-env')
    expect(siteProjectId(null)).toBe('from-env')
  })

  it('is unscoped (null) when neither is set', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_PROJECT_ID', '')
    expect(siteProjectId(null)).toBeNull()
  })
})
