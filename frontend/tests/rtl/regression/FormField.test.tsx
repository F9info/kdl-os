import { describe, it, expect } from 'vitest'
import { render, screen } from '../utils'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/input'

describe('FormField regression', () => {
  it('renders label and children', () => {
    render(
      <FormField label="Email">
        <Input placeholder="name@example.com" />
      </FormField>
    )

    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument()
  })

  it('shows required indicator', () => {
    render(
      <FormField label="Password" required>
        <Input />
      </FormField>
    )

    const label = screen.getByText('Password')
    expect(label).toHaveTextContent('Password*')
  })

  it('displays hint when no error is present', () => {
    render(
      <FormField label="Name" hint="Keep it short">
        <Input />
      </FormField>
    )

    expect(screen.getByText('Keep it short')).toBeInTheDocument()
  })

  it('displays error over hint', () => {
    render(
      <FormField label="Name" hint="Keep it short" error="Name is required">
        <Input />
      </FormField>
    )

    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.queryByText('Keep it short')).not.toBeInTheDocument()
  })

  it('marks the wrapped control invalid and links it to the error text', () => {
    render(
      <FormField label="Name" error="Name is required">
        <Input placeholder="Your name" />
      </FormField>
    )

    const input = screen.getByPlaceholderText('Your name')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const errorText = screen.getByText('Name is required')
    expect(input).toHaveAttribute('aria-describedby', errorText.getAttribute('id'))
  })

  it('does not mark the control invalid without an error', () => {
    render(
      <FormField label="Name">
        <Input placeholder="Your name" />
      </FormField>
    )

    expect(screen.getByPlaceholderText('Your name')).not.toHaveAttribute('aria-invalid')
  })

  it('respects an explicit aria-invalid on the child', () => {
    render(
      <FormField label="Name" error="Name is required">
        <Input placeholder="Your name" aria-invalid={false} />
      </FormField>
    )

    expect(screen.getByPlaceholderText('Your name')).toHaveAttribute('aria-invalid', 'false')
  })
})
