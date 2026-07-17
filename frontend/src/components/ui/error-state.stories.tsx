import type { Meta, StoryObj } from '@storybook/react'
import { ErrorState } from './error-state'

/**
 * `ErrorState` — a block-level query/mutation the user is blocked by failed
 * (list fetch, detail fetch). See `components/ui/STATE_KIT.md`: pass `error`
 * (axios error, `Error`, or string) and it extracts the message the same way
 * `ErrorAlert` does; pass `onRetry` to show a retry button. Uses
 * `role="alert"` / `aria-live="assertive"`. Not for inline form validation.
 */
const meta: Meta<typeof ErrorState> = {
  title: 'UI/State/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof ErrorState>

/** No `error` passed — falls back to the default title + generic message. */
export const Default: Story = {}

/** Message extracted from a thrown `Error`. */
export const FromError: Story = {
  args: {
    error: new Error('Failed to load users. Please try again.'),
  },
}

/** Message extracted from an axios-shaped API error (`response.data.message`). */
export const FromApiError: Story = {
  args: {
    error: { response: { data: { message: 'You do not have access to this resource.' } } },
  },
}

/** With a retry affordance — the common list-fetch-failed composition. */
export const WithRetry: Story = {
  args: {
    error: new Error('Network request failed.'),
    onRetry: () => {},
  },
}

/** Explicit `description` overrides the message derived from `error`. */
export const CustomCopy: Story = {
  args: {
    title: "Couldn't load the media library",
    description: 'The storage service is temporarily unavailable. Retry in a moment.',
    onRetry: () => {},
    retryLabel: 'Retry',
  },
}

/** No retry affordance — read-only non-actionable errors. */
export const NoRetry: Story = {
  args: {
    title: 'Not found',
    description: 'The resource you are looking for does not exist.',
  },
}

/** Same content forced into dark mode for side-by-side visual verification. */
export const Dark: Story = {
  args: {
    error: new Error('Failed to load users. Please try again.'),
    onRetry: () => {},
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
