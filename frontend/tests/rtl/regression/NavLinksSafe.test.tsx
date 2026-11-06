import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useNavItems } from '@/frontend/blocks/packs/general/nav-items'

// The header and footer blocks' own "Label|link" lines go through the one shared link check, the
// same one the Landing blocks use. These lines are what a visitor sees when the Menus module has
// no items yet, so a bad link here would reach them.
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)
const hrefs = (links: string) =>
  renderHook(() => useNavItems('header', links, undefined), { wrapper }).result.current.map(
    (i) => i.href
  )

describe('header/footer link lines', () => {
  it('turn every kind of script address into a harmless "#"', () => {
    const bad = [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      ' data:text/html,<script>1</script>',
      'vbscript:msgbox(1)',
    ]
    // a newline cannot be inside one line of the list, so use the other cases there
    const lines = bad.filter((b) => !b.includes('\n')).map((b, i) => `Link ${i}|${b}`)
    expect(hrefs(lines.join('\n'))).toEqual(lines.map(() => '#'))
  })

  it('keep normal links as typed', () => {
    expect(
      hrefs('Home|/\nAbout|/p/about\nSite|https://example.com\nMail|mailto:hi@example.com')
    ).toEqual(['/', '/p/about', 'https://example.com', 'mailto:hi@example.com'])
  })
})
