import type { Meta, StoryObj } from '@storybook/react'
import { Textarea } from './textarea'

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = { args: { placeholder: 'Type your message here…' } }

export const WithValue: Story = { args: { defaultValue: 'Pre-filled textarea content.' } }

export const Disabled: Story = { args: { disabled: true, placeholder: 'Disabled' } }

export const Rows: Story = { args: { rows: 8, placeholder: 'Taller textarea' } }
