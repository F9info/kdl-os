import { describe, it, expect } from 'vitest'
import { safeNext } from '@/frontend/membership/safeNext'

describe('safeNext (post-login redirect)', () => {
  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/\t/evil.com',
    '',
    null,
  ])('rejects %s', (v) => expect(safeNext(v as string | null)).toBeNull())
  it('keeps same-origin paths with query and hash', () => {
    expect(safeNext('/membership/account?x=1#top')).toBe('/membership/account?x=1#top')
  })
})
