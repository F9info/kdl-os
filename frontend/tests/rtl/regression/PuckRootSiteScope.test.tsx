import { describe, it, expect } from 'vitest'
import { render } from '../utils'
import { config } from '@/frontend/blocks/puck.config'

// The website button and form-field style (backend theme-engine/site-styles.js) is scoped to `.kdl-site`.
// Every rendered page, in the editor, on the public site and in the static export, comes through
// this root, so it must carry the class; admin screens never use this root.
describe('page root', () => {
  it('marks website content with kdl-site', () => {
    const Root = config.root!.render as (p: { children: React.ReactNode }) => JSX.Element
    const { container } = render(<Root>content</Root>)
    const main = container.querySelector('main')!
    expect(main.className.split(' ')).toContain('kdl-site')
    expect(main.textContent).toBe('content')
  })
})
