import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { RichTextEditor } from './RichTextEditor'

const meta: Meta<typeof RichTextEditor> = {
  title: 'Shared/RichTextEditor',
  component: RichTextEditor,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof RichTextEditor>

function Controlled({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <div className="space-y-4">
      <RichTextEditor value={value} onChange={setValue} placeholder="Start writing…" />
      <pre className="rounded bg-muted p-2 text-xs overflow-auto">{value || '(empty)'}</pre>
    </div>
  )
}

export const Default: Story = { render: () => <Controlled /> }

export const WithContent: Story = {
  render: () => (
    <Controlled initial="<p>Hello <strong>world</strong>! This is <em>rich</em> text.</p>" />
  ),
}
