import { describe, it, expect } from 'vitest'
import { render, screen, AllTheProvider } from '../utils'

describe('RTL test harness', () => {
  it('renders a component with the global providers', () => {
    render(<div data-testid="harness-sample">hello harness</div>)
    expect(screen.getByTestId('harness-sample')).toHaveTextContent('hello harness')
  })

  it('exports the provider wrapper for custom render calls', () => {
    expect(AllTheProvider).toBeDefined()
  })
})
