import type { Meta, StoryObj } from '@storybook/react'
import { LoadingState } from './loading-state'

/**
 * `LoadingState` — an in-flight request. See `components/ui/STATE_KIT.md`:
 * `variant="spinner"` for short/unknown-shape waits (the default first-mount
 * choice), `variant="skeleton"` once you know the eventual layout — it reduces
 * perceived latency and avoids a layout jump when data lands. Uses
 * `role="status"` / `aria-live="polite"`.
 */
const meta: Meta<typeof LoadingState> = {
  title: 'UI/State/LoadingState',
  component: LoadingState,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'inline-radio', options: ['spinner', 'skeleton'] },
    rows: { control: { type: 'number', min: 1, max: 12 } },
  },
}

export default meta
type Story = StoryObj<typeof LoadingState>

/** Default: centered spinner for a short or unknown-shape wait. */
export const Spinner: Story = {
  args: { variant: 'spinner' },
}

/** Custom label on the spinner variant. */
export const SpinnerWithLabel: Story = {
  args: { variant: 'spinner', label: 'Loading users…' },
}

/** Skeleton lines — use when the eventual content shape is known. */
export const Skeleton: Story = {
  args: { variant: 'skeleton', rows: 5 },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
}

/** Same content forced into dark mode for side-by-side visual verification. */
export const Dark: Story = {
  args: { variant: 'skeleton', rows: 5 },
  parameters: { backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div className="dark" style={{ width: 360, background: '#0f172a', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
}
