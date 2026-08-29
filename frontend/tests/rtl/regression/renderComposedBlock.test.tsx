import { describe, it, expect } from 'vitest'
import { render, screen } from '../utils'
import {
  renderComposedBlock,
  DEFAULT_SETTINGS,
  type ComposedBlockConfig,
} from '@/app/admin/page-builder/packs/composer/render-composed-block'

function configWith(atoms: ComposedBlockConfig['atoms']): ComposedBlockConfig {
  return { category: 'general', atoms, settings: DEFAULT_SETTINGS }
}

describe('renderComposedBlock', () => {
  const atomTypes: { type: string; defaultProps: Record<string, unknown> }[] = [
    { type: 'heading', defaultProps: { text: 'Heading text' } },
    { type: 'text', defaultProps: { text: 'Body text' } },
    { type: 'button', defaultProps: { label: 'Click me' } },
    { type: 'image', defaultProps: { alt: 'An image' } },
    { type: 'spacer', defaultProps: {} },
    { type: 'icon', defaultProps: {} },
  ]

  it.each(atomTypes)('renders $type without throwing', ({ type, defaultProps }) => {
    const config = configWith([{ id: `${type}-1`, type, ...defaultProps }])
    expect(() => render(<>{renderComposedBlock(config)}</>)).not.toThrow()
  })

  it('skips an atom of an unknown type instead of throwing', () => {
    const config = configWith([{ id: 'x-1', type: 'not-a-real-atom' }])
    expect(() => render(<>{renderComposedBlock(config)}</>)).not.toThrow()
  })

  it('applies a mobile-hidden class when an atom sets hideMobile', () => {
    const config = configWith([
      { id: 'heading-1', type: 'heading', text: 'Hidden on mobile', hideMobile: true },
    ])
    render(<>{renderComposedBlock(config)}</>)
    const node = screen.getByText('Hidden on mobile')
    expect(node.closest('.hidden')).not.toBeNull()
  })

  it('does not hide an atom that leaves hideMobile unset', () => {
    const config = configWith([{ id: 'heading-1', type: 'heading', text: 'Always visible' }])
    render(<>{renderComposedBlock(config)}</>)
    const node = screen.getByText('Always visible')
    expect(node.closest('.hidden')).toBeNull()
  })
})
