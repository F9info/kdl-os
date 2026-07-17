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

  it('injects aria-invalid on child when error is present', () => {
    render(
      <FormField label="Email" error="Invalid email">
        <Input placeholder="email" />
      </FormField>
    )

    expect(screen.getByPlaceholderText('email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('omits aria-invalid when no error', () => {
    render(
      <FormField label="Email">
        <Input placeholder="email" />
      </FormField>
    )

    expect(screen.getByPlaceholderText('email')).not.toHaveAttribute('aria-invalid')
  })

  it('respects an explicit aria-invalid on the child', () => {
    render(
      <FormField label="Name" error="Name is required">
        <Input placeholder="Your name" aria-invalid={false} />
      </FormField>
    )

    expect(screen.getByPlaceholderText('Your name')).toHaveAttribute('aria-invalid', 'false')
  })

  it('sets aria-describedby pointing at error node when error present', () => {
    render(
      <FormField label="Email" error="Invalid email">
        <Input placeholder="email" />
      </FormField>
    )

    const input = screen.getByPlaceholderText('email')
    const ariaDescribedBy = input.getAttribute('aria-describedby')
    expect(ariaDescribedBy).toBeTruthy()

    const errorEl = screen.getByRole('alert')
    expect(errorEl).toHaveTextContent('Invalid email')
    expect(errorEl.id).toBe(ariaDescribedBy)
  })

  it('sets aria-describedby pointing at hint node when hint present and no error', () => {
    render(
      <FormField label="Name" hint="Keep it short">
        <Input placeholder="name" />
      </FormField>
    )

    const input = screen.getByPlaceholderText('name')
    const ariaDescribedBy = input.getAttribute('aria-describedby')
    expect(ariaDescribedBy).toBeTruthy()

    const hintEl = screen.getByText('Keep it short')
    expect(hintEl.id).toBe(ariaDescribedBy)
  })

  it('omits aria-describedby when no error and no hint', () => {
    render(
      <FormField label="Name">
        <Input placeholder="name" />
      </FormField>
    )

    expect(screen.getByPlaceholderText('name')).not.toHaveAttribute('aria-describedby')
  })

  it('associates label with input via htmlFor', () => {
    render(
      <FormField label="Username">
        <Input placeholder="username" />
      </FormField>
    )

    const input = screen.getByPlaceholderText('username')
    const label = screen.getByText('Username')
    expect(label.closest('label')).toHaveAttribute('for', input.id)
  })
})
