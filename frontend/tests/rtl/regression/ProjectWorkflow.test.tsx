import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { readWorkflow, workflowProgress, WORKFLOW_STEPS } from '@/admin/lib/project-workflow'

const mutate = vi.fn()
const project = {
  id: 'p1',
  name: 'Acme',
  slug: 'acme',
  config: { workflow: { setup: { at: 'x' } } },
}
vi.mock('@/admin/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, isLoading: false }),
}))
vi.mock('@/admin/hooks/useProjects', () => ({
  useProjects: () => ({ data: [project], isLoading: false, error: null }),
  useSetWorkflowStep: () => ({ mutate, isPending: false, error: null }),
}))
vi.mock('@/stores/project.store', () => ({
  useProjectStore: (sel: (s: { activeProjectId: string }) => unknown) =>
    sel({ activeProjectId: 'p1' }),
  resolveActiveProject: (list: (typeof project)[], id: string) => list.find((p) => p.id === id),
}))
vi.mock('@/admin/components/layout/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

import WorkflowPage from '@/app/admin/projects/workflow/page'

describe('project workflow (T12)', () => {
  it('has eleven steps and counts progress, tolerating a bad saved value', () => {
    expect(WORKFLOW_STEPS).toHaveLength(11)
    expect(readWorkflow({ workflow: 'oops' })).toEqual({})
    expect(readWorkflow(null)).toEqual({})
    const p = workflowProgress({ setup: {}, theme: {} })
    expect(p).toMatchObject({ done: 2, total: 11 })
    expect(p.next?.key).toBe('homepage')
  })

  it('shows progress, links each step, and ticks a step for this project', async () => {
    render(<WorkflowPage />)
    expect(await screen.findByTestId('workflow-progress')).toHaveTextContent(
      '1 of 11 steps done · next: Theme'
    )
    expect(screen.getAllByRole('link')).toHaveLength(11)
    expect(screen.getByTestId('workflow-step-footer').querySelector('a')).toHaveAttribute(
      'href',
      '/admin/template-engine/projects/p1/website/layout'
    )
    fireEvent.click(
      screen.getByText('Mark done', { selector: '[data-testid="workflow-step-theme"] button' })
    )
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({ id: 'p1', step: 'theme', done: true })
    )
    fireEvent.click(screen.getByText('Mark not done'))
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({ id: 'p1', step: 'setup', done: false })
    )
  })
})
