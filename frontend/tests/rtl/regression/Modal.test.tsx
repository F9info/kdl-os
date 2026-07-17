import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../utils'
import userEvent from '@testing-library/user-event'
import { Modal } from '@/components/shared/Modal'

describe('Modal regression', () => {
  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Confirm">
        Body
      </Modal>
    )
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })

  it('renders title, description, children, and footer when open', () => {
    render(
      <Modal
        open={true}
        onClose={vi.fn()}
        title="Confirm"
        description="Are you sure?"
        footer={<button>Save</button>}
      >
        Body content
      </Modal>
    )

    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('closes on Escape key press', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open={true} onClose={onClose} title="Confirm">
        Body
      </Modal>
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
