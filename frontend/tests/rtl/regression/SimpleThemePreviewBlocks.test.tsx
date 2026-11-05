import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'
import PreviewBlocks from '@/app/admin/theme-engine/simple/PreviewBlocks'
import { PREVIEW_PACKS } from '@/app/admin/theme-engine/simple/preview-packs'

// Unlike SimpleThemeView.test.tsx (which mocks the block bundle), this loads the
// REAL page-builder config once and renders the blocks the preview uses, so a
// block that cannot render with the preview's minimal Puck context, or a block
// renamed out from under the preview, fails here instead of in the browser.

// By test id, not by the `inert` attribute: the tests below must not all fail for the wrong
// reason if `inert` is ever dropped (it has its own assertion).
const canvas = () => screen.getByTestId('simple-theme-preview-canvas')

describe('PreviewBlocks (real page-builder blocks)', () => {
  it.each(PREVIEW_PACKS)(
    'renders every $label preview block with content and no "could not preview" note',
    (pack) => {
      render(<PreviewBlocks blocks={pack.blocks} scale={0.5} />)

      expect(screen.queryByText(/could not preview/i)).not.toBeInTheDocument()
      expect(canvas().children.length).toBeGreaterThanOrEqual(pack.blocks.length)
      for (const child of Array.from(canvas().children)) {
        expect(child.textContent?.trim(), 'a block rendered nothing').toBeTruthy()
      }
    }
  )

  it('lays the blocks out on a fixed desktop-wide canvas, scaled to the card, and keeps them inert', () => {
    render(<PreviewBlocks blocks={PREVIEW_PACKS[1].blocks} scale={0.5} />)

    expect(canvas().style.width).toBe('1024px')
    expect(canvas().style.zoom).toBe('0.5')
    // links in a preview must not navigate away from unpublished changes
    expect(canvas()).toHaveAttribute('inert')
    expect(canvas()).toHaveClass('pointer-events-none')
  })

  it('shows a small note for a block it does not know, and still renders the others', () => {
    render(<PreviewBlocks blocks={['NotARealBlock', PREVIEW_PACKS[1].blocks[2]]} scale={1} />)
    const [note, block] = Array.from(canvas().children)

    expect(note).toHaveTextContent('Could not preview NotARealBlock.')
    expect(block?.textContent?.trim()).toBeTruthy()
    expect(block).not.toHaveTextContent(/could not preview/i)
  })

  it('shows the note, not a crash, for a block that throws while rendering', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const expected = (e: ErrorEvent) => e.preventDefault()
    window.addEventListener('error', expected)
    const { config } = await import('@/frontend/blocks/puck.config')
    const [broken, fine] = PREVIEW_PACKS[1].blocks
    const original = config.components![broken]!.render
    config.components![broken]!.render = () => {
      throw new Error('block exploded')
    }
    try {
      render(<PreviewBlocks blocks={[broken, fine]} scale={1} />)
      const [note, block] = Array.from(canvas().children)

      expect(note).toHaveTextContent(/could not preview/i)
      // the next block is unaffected
      expect(block?.textContent?.trim()).toBeTruthy()
      expect(block).not.toHaveTextContent(/could not preview/i)
    } finally {
      config.components![broken]!.render = original
      window.removeEventListener('error', expected)
      error.mockRestore()
    }
  })
})
