import React from 'react'
import { render, screen } from '@testing-library/react'
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

describe('Themes: the admin app only', () => {
  beforeEach(() => localStorage.clear())

  it('themes the admin app and offers no website, TV or native switch', () => {
    render(<ThemeEnginePage />)
    expect(screen.getByTestId('simple').textContent).toBe('webapp_admin')
    expect(screen.queryByTestId('surface-webapp')).toBeNull()
    expect(screen.queryByTestId('surface-webapp_admin')).toBeNull()
  })

  it('ignores a website surface remembered from before the screen became admin-only', () => {
    localStorage.setItem('th_platform', 'webapp')
    render(<ThemeEnginePage />)
    expect(screen.getByTestId('simple').textContent).toBe('webapp_admin')
  })
})
