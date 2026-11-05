import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { isValidRevalidateToken, revalidateToken } from '@/frontend/lib/revalidate'

describe('revalidate token (T6.2)', () => {
  it('matches the backend: sha256("revalidate:" + secret) as hex', () => {
    const expected = createHash('sha256').update('revalidate:s3cret').digest('hex')
    expect(revalidateToken('s3cret')).toBe(expected)
  })

  it('accepts only the right token for the secret', () => {
    const token = revalidateToken('s3cret')
    expect(isValidRevalidateToken(token, 's3cret')).toBe(true)
    expect(isValidRevalidateToken(token, 'other')).toBe(false)
    expect(isValidRevalidateToken('nope', 's3cret')).toBe(false)
    expect(isValidRevalidateToken(null, 's3cret')).toBe(false)
    expect(isValidRevalidateToken('', 's3cret')).toBe(false)
    expect(isValidRevalidateToken(token.slice(0, -1), 's3cret')).toBe(false)
  })

  it('never contains the secret', () => {
    expect(revalidateToken('s3cret')).not.toContain('s3cret')
  })
})
