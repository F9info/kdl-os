import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/admin/components/shared/ModuleGuard', () => ({
  ModuleGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/app/admin/theme-engine/SimpleThemeView', () => ({
  SimpleThemeView: ({ platform }: { platform?: string }) => (
    <div data-testid="simple">{platform}</div>
  ),
}))
vi.mock('@/app/admin/theme-engine/advanced/AdvancedThemeEditor', () => ({
  AdvancedThemeEditor: () => <div data-testid="advanced" />,
}))

import ThemeEnginePage from '@/app/admin/theme-engine/page'

describe('Themes: one screen for the website and the admin app', () => {
  beforeEach(() => localStorage.clear())

  it('edits the website theme first and switches to the admin theme', () => {
    render(<ThemeEnginePage />)
    expect(screen.getByTestId('simple').textContent).toBe('webapp')
    fireEvent.click(screen.getByTestId('surface-webapp_admin'))
    expect(screen.getByTestId('simple').textContent).toBe('webapp_admin')
    expect(screen.getByTestId('surface-webapp_admin')).toHaveAttribute('aria-pressed', 'true')
  })

  it('remembers the chosen surface', () => {
    const { unmount } = render(<ThemeEnginePage />)
    fireEvent.click(screen.getByTestId('surface-webapp_admin'))
    unmount()
    render(<ThemeEnginePage />)
    expect(screen.getByTestId('simple').textContent).toBe('webapp_admin')
  })
})
