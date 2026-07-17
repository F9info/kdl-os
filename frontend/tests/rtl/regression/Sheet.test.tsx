import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'
import userEvent from '@testing-library/user-event'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet'

function TestSheet({
  side,
  onOpenChange,
}: {
  side?: 'left' | 'right'
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <Sheet onOpenChange={onOpenChange}>
      <SheetTrigger>Open</SheetTrigger>
      <SheetContent side={side}>
        <SheetTitle>Sheet Title</SheetTitle>
        <SheetDescription>Sheet description</SheetDescription>
        <SheetClose>Dismiss</SheetClose>
      </SheetContent>
    </Sheet>
  )
}

describe('Sheet smoke', () => {
  it('does not render content before open', () => {
    render(<TestSheet />)
    expect(screen.queryByText('Sheet Title')).not.toBeInTheDocument()
  })

  it('renders title when open', async () => {
    const user = userEvent.setup()
    render(<TestSheet />)

    await user.click(screen.getByText('Open'))
    expect(screen.getByText('Sheet Title')).toBeInTheDocument()
  })

  it('has accessible close button', async () => {
    const user = userEvent.setup()
    render(<TestSheet />)

    await user.click(screen.getByText('Open'))
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('closes via close button', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<TestSheet onOpenChange={onOpenChange} />)

    await user.click(screen.getByText('Open'))
    onOpenChange.mockClear()
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes via Escape key (Radix focus trap)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<TestSheet onOpenChange={onOpenChange} />)

    await user.click(screen.getByText('Open'))
    onOpenChange.mockClear()
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('traps focus inside open sheet (close button is focusable)', async () => {
    const user = userEvent.setup()
    render(<TestSheet />)

    await user.click(screen.getByText('Open'))
    // Radix Dialog manages the focus trap in a real browser.
    // In jsdom we verify the close button is present and focusable.
    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn).toBeInTheDocument()
    closeBtn.focus()
    expect(document.activeElement).toBe(closeBtn)
  })

  it('renders left-side variant', async () => {
    const user = userEvent.setup()
    render(<TestSheet side="left" />)

    await user.click(screen.getByText('Open'))
    expect(screen.getByText('Sheet Title')).toBeInTheDocument()
  })
})
