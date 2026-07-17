import type { Meta, StoryObj } from '@storybook/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option-1">Option 1</SelectItem>
        <SelectItem value="option-2">Option 2</SelectItem>
        <SelectItem value="option-3">Option 3</SelectItem>
      </SelectContent>
    </Select>
  ),
}

export const WithDefault: Story = {
  render: () => (
    <Select defaultValue="option-2">
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option-1">Apple</SelectItem>
        <SelectItem value="option-2">Banana</SelectItem>
        <SelectItem value="option-3">Cherry</SelectItem>
      </SelectContent>
    </Select>
  ),
}
