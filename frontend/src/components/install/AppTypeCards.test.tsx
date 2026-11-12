import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppTypeCards, ModulePreview, type AppTypeInfo } from './AppTypeCards'

const types: AppTypeInfo[] = [
  {
    key: 'landing',
    name: 'Landing Page',
    description: 'One page',
    icon: 'Rocket',
    frontend: true,
    modules: [{ slug: 'cms', name: 'Frontend', status: 'AVAILABLE' }],
  },
  {
    key: 'admin-only',
    name: 'Admin Only',
    description: 'Just admin',
    icon: 'ShieldCheck',
    frontend: false,
    modules: [],
  },
]

describe('AppTypeCards', () => {
  it('marks the chosen card and reports a click', () => {
    const onChange = vi.fn()
    render(<AppTypeCards types={types} value="landing" onChange={onChange} />)
    expect(screen.getByRole('radio', { name: /Landing Page/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    fireEvent.click(screen.getByRole('radio', { name: /Admin Only/ }))
    expect(onChange).toHaveBeenCalledWith('admin-only')
  })
  it('lists the modules and the demo site for a frontend type, nothing for Admin Only', () => {
    const { rerender } = render(<ModulePreview type={types[0]!} />)
    expect(screen.getByText('Frontend')).toBeInTheDocument()
    expect(screen.getByText(/demo website and four landing pages/)).toBeInTheDocument()
    rerender(<ModulePreview type={types[1]!} />)
    expect(screen.getByText(/No extra modules/)).toBeInTheDocument()
  })
})
