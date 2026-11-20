import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from './utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminStep } from '@/components/install/AdminStep'

const renderStep = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminStep onBack={() => {}} onNext={() => {}} />
    </QueryClientProvider>
  )

const passwordField = () => screen.getByLabelText(/^Password/) as HTMLInputElement
const confirmField = () => screen.getByLabelText(/^Confirm password/) as HTMLInputElement
/** The eye button sits right after its input, inside the same wrapper. */
const eyeOf = (input: HTMLInputElement) => {
  const button = input.parentElement?.querySelector('button')
  if (!button) throw new Error('no eye button next to the input')
  return button
}

describe('AdminStep show/hide password', () => {
  it('hides both passwords at first, each with a "Show password" button', () => {
    renderStep()
    expect(passwordField().type).toBe('password')
    expect(confirmField().type).toBe('password')
    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(2)
  })

  it('each eye button shows and hides only its own field', () => {
    renderStep()
    fireEvent.click(eyeOf(passwordField()))
    expect(passwordField().type).toBe('text')
    expect(confirmField().type).toBe('password')
    expect(eyeOf(passwordField()).getAttribute('aria-label')).toBe('Hide password')

    fireEvent.click(eyeOf(confirmField()))
    expect(confirmField().type).toBe('text')

    fireEvent.click(eyeOf(passwordField()))
    expect(passwordField().type).toBe('password')
    expect(confirmField().type).toBe('text')
  })

  it('the eye buttons do not submit the form', () => {
    const { container } = renderStep()
    fireEvent.click(eyeOf(passwordField()))
    // A submit would mark the form as touched and show the validation errors.
    expect(container.textContent).not.toContain('Enter the admin name.')
  })
})

describe('AdminStep password labels still belong to the inputs', () => {
  it('finds both fields by their label and keeps required + hint', () => {
    renderStep()
    expect(passwordField().tagName).toBe('INPUT')
    expect(confirmField().tagName).toBe('INPUT')
    expect(passwordField().required).toBe(true)
    expect(passwordField().getAttribute('aria-describedby')).toBeTruthy() // "At least 12 characters."
  })
})
