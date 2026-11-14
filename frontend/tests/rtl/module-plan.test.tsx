import { describe, it, expect } from 'vitest'
import { render, screen } from './utils'
import { ModulePlanSummary } from '@/app/admin/modules/ModulePlanSummary'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import type { ModulePlan } from '@/types/models.types'

const plan = (o: Partial<ModulePlan> = {}): ModulePlan => ({
  slug: 'shop',
  name: 'Shop',
  group: 'cms',
  core: false,
  description: null,
  action: 'enable',
  status: 'INSTALLED',
  dependsOn: [{ slug: 'lib', name: 'Library', group: 'cms', status: 'AVAILABLE' }],
  requiredBy: [],
  steps: [
    { slug: 'lib', name: 'Library', group: 'cms', do: 'install and enable', dependency: true },
    { slug: 'shop', name: 'Shop', group: 'cms', do: 'enable', dependency: false },
  ],
  conflicts: [],
  blockers: [],
  canProceed: true,
  ...o,
})

describe('ModulePlanSummary', () => {
  it('lists what it needs and what runs first', () => {
    render(<ModulePlanSummary plan={plan()} isLoading={false} isError={false} />)
    expect(screen.getByText('Needs')).toBeTruthy()
    expect(screen.getByText('This will also, first:')).toBeTruthy()
    expect(screen.getByText(/install and enable/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows blockers as an alert and names the conflicts it switches off', () => {
    render(
      <ModulePlanSummary
        plan={plan({
          blockers: [{ type: 'dependents', message: 'Cannot disable "Shop": Orders depend on it' }],
          conflicts: [{ slug: 'old', name: 'Old Shop' }],
          canProceed: false,
        })}
        isLoading={false}
        isError={false}
      />
    )
    expect(screen.getByRole('alert').textContent).toContain('Orders depend on it')
    expect(screen.getByText('Old Shop')).toBeTruthy()
  })

  it('says it is checking, and falls back gracefully on error', () => {
    const { rerender } = render(<ModulePlanSummary plan={undefined} isLoading isError={false} />)
    expect(screen.getByRole('status').textContent).toContain('Checking')
    rerender(<ModulePlanSummary plan={undefined} isLoading={false} isError />)
    expect(screen.getByRole('status').textContent).toContain('Could not check')
  })

  it('on disable it shows who uses the module', () => {
    render(
      <ModulePlanSummary
        plan={plan({
          action: 'disable',
          requiredBy: [{ slug: 'o', name: 'Orders', group: 'cms' }],
          steps: [],
        })}
        isLoading={false}
        isError={false}
      />
    )
    expect(screen.getByText(/Used by/)).toBeTruthy()
    expect(screen.queryByText('Needs')).toBeNull()
  })
})

describe('ConfirmDialog with a preview', () => {
  it('renders children and keeps confirm off while blocked', () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Disable"
        description="d"
        confirmLabel="Disable"
        confirmDisabled
      >
        <p>preview body</p>
      </ConfirmDialog>
    )
    expect(screen.getByText('preview body')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Disable' }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })
})
