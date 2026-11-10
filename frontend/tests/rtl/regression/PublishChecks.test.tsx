import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../utils'
import type { Data } from '@puckeditor/core'
import { PublishChecksDialog } from '@/app/admin/page-builder/PublishChecks'
import {
  checkPage,
  issuesFromPublishError,
  publishPage,
  type PageIssue,
} from '@/app/admin/page-builder/store'

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: h }))

const err = (message: string, block_type: string | null = 'Hero'): PageIssue => ({
  severity: 'error',
  code: 'LINK_BROKEN',
  message,
  block_id: 'b1',
  block_type,
})
const warn = (message: string): PageIssue => ({
  severity: 'warning',
  code: 'SEO_DESCRIPTION_MISSING',
  message,
  block_id: null,
  block_type: null,
})

const open = (issues: PageIssue[], busy = false) => {
  const onBack = vi.fn()
  const onPublish = vi.fn()
  render(<PublishChecksDialog issues={issues} busy={busy} onBack={onBack} onPublish={onPublish} />)
  return { onBack, onPublish }
}

beforeEach(() => vi.clearAllMocks())

describe('PublishChecksDialog (T6.4)', () => {
  it('errors: lists problems first, defaults to going back, "Save anyway" is the explicit override', () => {
    const { onBack, onPublish } = open([
      warn('Add a meta description.'),
      err('A link points nowhere.', 'Hero'),
    ])
    expect(screen.getByRole('heading', { name: 'Fix these before saving?' })).toBeTruthy()
    expect(screen.getByText('1 problem to fix')).toBeTruthy()
    expect(screen.getByText('1 suggestion')).toBeTruthy()
    expect(screen.getByText('A link points nowhere.')).toBeTruthy()
    expect(screen.getByText('in Hero')).toBeTruthy()
    const problems = screen.getByRole('region', { name: 'Problems' })
    expect(problems.textContent).toContain('A link points nowhere.')
    expect(problems.textContent).not.toContain('meta description')
    fireEvent.click(screen.getByRole('button', { name: 'Back to editing' }))
    expect(onBack).toHaveBeenCalled()
    expect(onPublish).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }))
    expect(onPublish).toHaveBeenCalledWith(true)
  })

  it('warnings only: nothing is broken, plain Save with no override', () => {
    const { onPublish } = open([warn('Add a meta description.'), warn('No SEO title set.')])
    expect(screen.getByRole('heading', { name: 'Ready to save?' })).toBeTruthy()
    expect(screen.getByText('2 suggestions')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Problems' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save anyway' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onPublish).toHaveBeenCalledWith(false)
  })

  it('names blocks in plain words and disables both buttons while publishing', () => {
    open([err('Broken.', 'ContactForm')], true)
    expect(screen.getByText('in Contact Form')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(
      (screen.getByRole('button', { name: 'Back to editing' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })
})

describe('page store: checks and publish (T6.4)', () => {
  const data = { root: { props: { title: 'Home' } }, content: [] } as unknown as Data

  it('checkPage posts the editor content (and its title) so unsaved edits are checked', async () => {
    h.post.mockResolvedValue({
      data: { data: { issues: [], errors: 0, warnings: 0, can_publish: true } },
    })
    expect((await checkPage('p1', data)).can_publish).toBe(true)
    expect(h.post).toHaveBeenCalledWith('/page-builder/p1/checks', { title: 'Home', data })
  })

  it('publishPage only sends force when it is "publish anyway"', async () => {
    h.post.mockResolvedValue({ data: { data: {} } })
    await publishPage('p1', data)
    expect(h.post).toHaveBeenLastCalledWith('/page-builder/p1/publish', { title: 'Home', data })
    await publishPage('p1', data, true)
    expect(h.post).toHaveBeenLastCalledWith('/page-builder/p1/publish', {
      title: 'Home',
      data,
      force: true,
    })
  })

  it('issuesFromPublishError reads the 422 check failure, and nothing else', () => {
    const issues = [err('x')]
    const failed = {
      response: { status: 422, data: { errors: { code: 'PUBLISH_VALIDATION_FAILED', issues } } },
    }
    expect(issuesFromPublishError(failed)).toEqual(issues)
    expect(
      issuesFromPublishError({ response: { status: 422, data: { errors: { fieldErrors: {} } } } })
    ).toBeNull()
    expect(issuesFromPublishError({ response: { status: 500, data: {} } })).toBeNull()
    expect(issuesFromPublishError(new Error('network'))).toBeNull()
    expect(issuesFromPublishError(undefined)).toBeNull()
  })
})
