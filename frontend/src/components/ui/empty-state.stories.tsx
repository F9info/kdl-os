import type { Meta, StoryObj } from '@storybook/react'
import { FileX, Search } from 'lucide-react'
import { EmptyState } from './empty-state'
import { Button } from './button'

/**
 * `EmptyState` — the query succeeded and returned zero items. See
 * `components/ui/STATE_KIT.md`: always pair a view-specific `title` with an
 * `action` when the user can immediately fix the emptiness. Token-driven, so
 * dark mode is correct for free (toggle the toolbar background, or see the
 * `Dark` story below).
 */
const meta: Meta<typeof EmptyState> = {
  title: 'UI/State/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    title: 'No files here',
    description: 'Upload a file or drag one onto this window to get started.',
  },
}

export default meta
type Story = StoryObj<typeof EmptyState>

/** Default empty: specific title + guidance, no action. */
export const Default: Story = {}

/** With a primary action the user can take to resolve the emptiness. */
export const WithAction: Story = {
  args: {
    action: <Button>Upload</Button>,
  },
}

/** A "no search matches" flavour with a custom icon and no action. */
export const NoResults: Story = {
  args: {
    icon: Search,
    title: 'No results found',
    description: 'Try a different search term or clear your filters.',
  },
}

/** Title only — the description and action are both optional. */
export const TitleOnly: Story = {
  args: {
    title: 'No roles found',
    description: undefined,
  },
}

/** Same content forced into dark mode for side-by-side visual verification. */
export const Dark: Story = {
  args: {
    icon: FileX,
    action: <Button>Upload</Button>,
  },
  parameters: { backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="dark" style={{ background: '#0f172a', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
}
