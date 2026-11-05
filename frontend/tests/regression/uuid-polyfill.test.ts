import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { UUID_POLYFILL } from '@/lib/uuid-polyfill'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// A browser-like global with crypto but WITHOUT randomUUID, as on a non-secure HTTP origin.
function insecureContext() {
  const crypto = { getRandomValues: (a: Uint8Array) => webcrypto.getRandomValues(a) } as {
    getRandomValues: (a: Uint8Array) => Uint8Array
    randomUUID?: () => string
  }
  const self = { crypto }
  return { self, crypto, Uint8Array }
}

describe('UUID polyfill', () => {
  it('adds a valid, unique version 4 randomUUID where it is missing', () => {
    const ctx = insecureContext()
    expect(ctx.crypto.randomUUID).toBeUndefined()
    runInNewContext(UUID_POLYFILL, ctx)
    const ids = Array.from({ length: 200 }, () => ctx.crypto.randomUUID!())
    for (const id of ids) expect(id).toMatch(V4)
    expect(new Set(ids).size).toBe(200)
  })

  it('leaves a native randomUUID untouched', () => {
    const ctx = insecureContext()
    const native = () => 'native'
    ctx.crypto.randomUUID = native
    runInNewContext(UUID_POLYFILL, ctx)
    expect(ctx.crypto.randomUUID).toBe(native)
  })

  it('does nothing (and does not throw) when crypto itself is unavailable', () => {
    expect(() => runInNewContext(UUID_POLYFILL, { self: {} })).not.toThrow()
  })
})
