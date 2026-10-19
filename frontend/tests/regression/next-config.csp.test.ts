import { describe, it, expect } from 'vitest'

// Import the raw config object — withAnalyzer wraps it but preserves .headers().
// We need to call the underlying config.headers(), not the wrapped export.
// To keep this simple we re-derive the CSP the same way next.config.ts does so
// any future edit to that file must keep these directives in sync.
import nextConfig from '../../next.config'

async function getCspDirectives(): Promise<Record<string, string>> {
  const headerGroups = await (
    nextConfig as { headers?: () => Promise<{ headers: { key: string; value: string }[] }[]> }
  ).headers?.()
  if (!headerGroups) throw new Error('next.config headers() not found')
  const cspHeader = headerGroups
    .flatMap((g) => g.headers)
    .find((h) => h.key === 'Content-Security-Policy')
  if (!cspHeader) throw new Error('Content-Security-Policy header not found')
  return Object.fromEntries(
    cspHeader.value.split(';').map((d) => {
      const [directive, ...rest] = d.trim().split(/\s+/)
      return [directive, rest.join(' ')]
    })
  )
}

describe('CSP regression — Google Fonts hosts (KDL-666)', () => {
  it('includes fonts.googleapis.com in style-src', async () => {
    const directives = await getCspDirectives()
    expect(directives['style-src']).toContain('https://fonts.googleapis.com')
  })

  it('includes fonts.gstatic.com in font-src', async () => {
    const directives = await getCspDirectives()
    expect(directives['font-src']).toContain('https://fonts.gstatic.com')
  })

  it('does not add wildcard hosts to style-src or font-src', async () => {
    const directives = await getCspDirectives()
    expect(directives['style-src']).not.toContain('*')
    expect(directives['font-src']).not.toContain('*')
  })

  it('does not touch script-src, connect-src, or frame-src', async () => {
    const directives = await getCspDirectives()
    expect(directives['script-src']).not.toContain('fonts.googleapis.com')
    expect(directives['connect-src']).not.toContain('fonts.googleapis.com')
    expect(directives['frame-src']).not.toContain('fonts.googleapis.com')
  })
})
