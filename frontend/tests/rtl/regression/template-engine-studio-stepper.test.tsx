/**
 * RTL regression tests for KDL-558 — Studio nav trimmed to the three stages
 * with a real built-out screen so far (Overview / Color Palette / Brands),
 * renamed from their DAG labels (Intake / Palette / Website Assembly). The
 * other six DAG stages still exist and run — just no longer shown as tabs.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StudioStepper } from '@/app/admin/template-engine/_components/StudioStepper'
import type { TemplateEngineRun } from '@/types/template-engine.types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn() }),
}))

function makeRun(): TemplateEngineRun {
  return {
    id: 'run-1',
    projectId: 'proj-1',
    status: 'IN_PROGRESS',
    brandKitVersion: null,
    createdBy: 'user-1',
    createdAt: '2026-08-25T00:00:00Z',
    updatedAt: '2026-08-25T00:00:00Z',
    stages: [
      {
        id: 's1',
        runId: 'run-1',
        stage: 'INTAKE',
        status: 'DONE',
        errorCode: null,
        outputRef: null,
        startedAt: null,
        completedAt: null,
      },
      {
        id: 's2',
        runId: 'run-1',
        stage: 'PALETTE',
        status: 'DONE',
        errorCode: null,
        outputRef: null,
        startedAt: null,
        completedAt: null,
      },
      {
        id: 's3',
        runId: 'run-1',
        stage: 'INFERENCE',
        status: 'DONE',
        errorCode: null,
        outputRef: null,
        startedAt: null,
        completedAt: null,
      },
      {
        id: 's4',
        runId: 'run-1',
        stage: 'APPROVAL',
        status: 'DONE',
        errorCode: null,
        outputRef: null,
        startedAt: null,
        completedAt: null,
      },
      {
        id: 's5',
        runId: 'run-1',
        stage: 'GUIDELINES',
        status: 'DONE',
        errorCode: null,
        outputRef: null,
        startedAt: null,
        completedAt: null,
      },
      {
        id: 's6',
        runId: 'run-1',
        stage: 'COLLATERAL',
        status: 'DONE',
        errorCode: null,
        outputRef: null,
        startedAt: null,
        completedAt: null,
      },
      {
        id: 's7',
        runId: 'run-1',
        stage: 'WEBSITE',
        status: 'PENDING',
        errorCode: null,
        outputRef: null,
        startedAt: null,
        completedAt: null,
      },
      {
        id: 's8',
        runId: 'run-1',
        stage: 'PREFLIGHT',
        status: 'PENDING',
        errorCode: null,
        outputRef: null,
        startedAt: null,
        completedAt: null,
      },
      {
        id: 's9',
        runId: 'run-1',
        stage: 'EXPORT',
        status: 'PENDING',
        errorCode: null,
        outputRef: null,
        startedAt: null,
        completedAt: null,
      },
    ],
  }
}

describe('StudioStepper — trimmed to 3 tabs (KDL-558)', () => {
  it('renders only Overview, Color Palette, and Brands — nothing else', () => {
    render(<StudioStepper run={makeRun()} projectId="proj-1" activeSlug="website" />)

    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Color Palette')).toBeInTheDocument()
    expect(screen.getByText('Brands')).toBeInTheDocument()

    for (const hidden of [
      'Brand Inference',
      'Brand Approval',
      'Brand Guidelines',
      'Collateral',
      'Preflight',
      'Export',
    ]) {
      expect(screen.queryByText(hidden)).not.toBeInTheDocument()
    }
  })

  it('numbers the visible tabs 1-3 based on the filtered list, not the full 9-stage DAG', () => {
    render(<StudioStepper run={makeRun()} projectId="proj-1" activeSlug="intake" />)

    const nav = screen.getByRole('navigation', { name: /studio stages/i })
    const buttons = nav.querySelectorAll('button')
    expect(buttons).toHaveLength(3)
  })
})
