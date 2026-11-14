import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from './utils'

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), token: '' }))
vi.mock('@/components/install/install-api', async () => {
  const actual = await vi.importActual<typeof import('@/components/install/install-api')>(
    '@/components/install/install-api'
  )
  return {
    ...actual,
    installApi: { get: h.get, post: h.post, put: h.put },
    setSetupToken: (t: string) => {
      h.token = t
    },
    getSetupToken: () => h.token,
  }
})

import { resumeStep, type InstallState } from '@/components/install/install-api'
import { SetupTokenGate } from '@/components/install/SetupTokenGate'
import { DatabaseStep } from '@/components/install/DatabaseStep'
import { AdminStep, adminErrors } from '@/components/install/AdminStep'
import { ModulesStep } from '@/components/install/ModulesStep'
import { CompleteScreen } from '@/components/install/CompleteScreen'
import { CoreStep } from '@/components/install/CoreStep'

beforeEach(() => {
  vi.clearAllMocks()
  h.token = ''
})

describe('resumeStep', () => {
  const done = (...keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, { status: 'done' }])) as InstallState['steps']
  it('opens on the first step that is not done', () => {
    expect(resumeStep({ installed: false })).toBe(1)
    expect(resumeStep({ installed: false, steps: done('database') })).toBe(2)
    expect(resumeStep({ installed: false, steps: done('database', 'company') })).toBe(3)
    expect(
      resumeStep({
        installed: false,
        steps: done('database', 'company'),
        admin: { name: 'A', email: 'a@b.co' },
      })
    ).toBe(4)
    expect(
      resumeStep({
        installed: false,
        steps: done('database', 'company'),
        admin: { name: 'A', email: 'a@b.co' },
        core: 'done',
      })
    ).toBe(5)
    expect(
      resumeStep({ installed: false, steps: done('database', 'company', 'type'), core: 'done' })
    ).toBe(6)
    expect(
      resumeStep({
        installed: false,
        steps: done('database', 'company', 'type', 'modules'),
        core: 'done',
      })
    ).toBe(7)
  })
  it('understands an install that was started before the new steps existed', () => {
    // company (step>=1) and type (step>=2) were recorded only in the old counter
    expect(resumeStep({ installed: false, step: 2, steps: done('database'), core: 'done' })).toBe(6)
  })
})

describe('adminErrors', () => {
  const ok = {
    name: 'Asha Rao',
    email: 'asha@acme.test',
    password: 'correct horse battery',
    confirm: 'correct horse battery',
  }
  it('accepts a good form', () => {
    expect(Object.values(adminErrors(ok)).every((e) => e === '')).toBe(true)
  })
  it('flags each problem', () => {
    expect(adminErrors({ ...ok, name: 'A' }).name).not.toBe('')
    expect(adminErrors({ ...ok, email: 'nope' }).email).not.toBe('')
    expect(adminErrors({ ...ok, password: 'short', confirm: 'short' }).password).toMatch(/12/)
    expect(
      adminErrors({ ...ok, password: 'é'.repeat(40), confirm: 'é'.repeat(40) }).password
    ).toMatch(/72 bytes/)
    expect(adminErrors({ ...ok, confirm: 'different password!' }).confirm).toMatch(/match/)
  })
})

describe('SetupTokenGate', () => {
  it('keeps the token only when the server accepts it', async () => {
    const onAccepted = vi.fn()
    h.post.mockResolvedValueOnce({ data: { data: { ok: true } } })
    render(<SetupTokenGate onAccepted={onAccepted} />)
    const button = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Setup token'), { target: { value: 'abc-123-def-456' } })
    fireEvent.click(button)
    await waitFor(() => expect(onAccepted).toHaveBeenCalled())
    expect(h.post).toHaveBeenCalledWith('/token')
    expect(h.token).toBe('abc-123-def-456')
  })

  it('forgets a wrong token and shows the error', async () => {
    h.post.mockRejectedValueOnce({
      response: { data: { message: 'That setup token is not right.' } },
      message: 'x',
    })
    render(<SetupTokenGate onAccepted={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Setup token'), {
      target: { value: 'wrong-wrong-wrong' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(h.token).toBe(''))
    expect(await screen.findByText(/not right/)).toBeTruthy()
  })
})

describe('DatabaseStep', () => {
  const info = {
    connected: true,
    ready: true,
    host: 'db',
    port: '5432',
    database: 'kdl',
    user: 'kdl',
    server: 'PostgreSQL 15.4',
    migrations: { total: 78, applied: 78, pending: 0, failed: 0 },
  }
  it('shows the connection and lets you continue when ready', async () => {
    h.get.mockResolvedValue({ data: { data: info } })
    const onNext = vi.fn()
    render(<DatabaseStep onNext={onNext} />)
    expect(await screen.findByText(/every migration is applied/)).toBeTruthy()
    expect(screen.getByText('db:5432')).toBeTruthy()
    expect(screen.getByText('78 of 78 applied')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalled()
  })
  it('blocks Next and explains the fix when the database is not ready', async () => {
    h.get.mockResolvedValue({
      data: {
        data: {
          ...info,
          ready: false,
          migrations: { total: 78, applied: 70, pending: 8, failed: 0 },
        },
      },
    })
    render(<DatabaseStep onNext={vi.fn()} />)
    expect(await screen.findByText(/migrations are not all applied/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/prisma migrate deploy/)).toBeTruthy()
  })
})

describe('AdminStep', () => {
  it('shows errors and sends nothing until the form is valid, then sends the password once', async () => {
    h.put.mockResolvedValue({ data: { data: {} } })
    const onNext = vi.fn()
    render(<AdminStep onBack={vi.fn()} onNext={onNext} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Enter the admin name.')).toBeTruthy()
    expect(h.put).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Asha Rao' } })
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'asha@acme.test' } })
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: 'correct horse battery' },
    })
    fireEvent.change(screen.getByLabelText(/^Confirm password/), {
      target: { value: 'correct horse battery' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(onNext).toHaveBeenCalled())
    expect(h.put).toHaveBeenCalledWith('/admin', {
      name: 'Asha Rao',
      email: 'asha@acme.test',
      password: 'correct horse battery',
      confirm_password: 'correct horse battery',
    })
  })
})

describe('CoreStep', () => {
  beforeEach(() => h.get.mockResolvedValue({ data: { data: { steps: {}, log: [] } } }))

  it('runs the core install, then offers Next', async () => {
    h.post.mockResolvedValue({ data: { data: { status: 'done' } } })
    const onNext = vi.fn()
    render(<CoreStep core="none" onBack={vi.fn()} onNext={onNext} />)
    fireEvent.click(screen.getByRole('button', { name: /Run core installation/ }))
    expect(await screen.findByText('Core installation is complete')).toBeTruthy()
    expect(h.post).toHaveBeenCalledWith('/core', undefined, { timeout: 300_000 })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalled()
  })

  it('already done: no second run is offered', () => {
    render(<CoreStep core="done" onBack={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText('Core installation is complete')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Run core installation/ })).toBeNull()
  })

  it('after a failed run it says so and offers to try again', () => {
    render(<CoreStep core="failed" onBack={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByRole('alert').textContent).toMatch(/stopped/)
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy()
  })
})

const mod = (slug: string, name: string, extra: Record<string, unknown> = {}) => ({
  slug,
  name,
  description: `${name} module`,
  group: 'cms',
  core: false,
  dependsOn: [],
  status: 'AVAILABLE',
  ...extra,
})
const choices = (over: Record<string, unknown> = {}) => ({
  data: {
    data: {
      type: 'landing',
      core: [mod('auth', 'Authentication', { core: true, group: 'core' })],
      included: [mod('cms', 'Frontend', { dependsOn: [{ slug: 'faq', name: 'FAQ' }] })],
      optional: [
        mod('forms', 'Forms', { includes: [{ slug: 'x', name: 'Extras' }], blocked: null }),
        mod('pay', 'Payments', { includes: [], blocked: 'Needs PAY_KEY on the server' }),
      ],
      selected: [],
      demo: { available: true, value: true },
      ...over,
    },
  },
})

describe('ModulesStep', () => {
  it('shows core first, the type modules with dependencies, extras, and the sample-content choice', async () => {
    h.get.mockResolvedValue(choices())
    render(<ModulesStep onBack={vi.fn()} onNext={vi.fn()} />)
    expect(await screen.findByText('Authentication')).toBeTruthy()
    expect(screen.getByText('Frontend')).toBeTruthy()
    expect(screen.getByText(/Needs: FAQ/)).toBeTruthy()
    expect(screen.getByText(/adds Extras/)).toBeTruthy()
    expect((screen.getByLabelText(/Payments/) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText(/Needs PAY_KEY/)).toBeTruthy()
    expect((screen.getByLabelText(/Start with a sample website/) as HTMLInputElement).checked).toBe(
      true
    )
  })

  it('saves the picked extras and an explicit no for sample content', async () => {
    h.get.mockResolvedValue(choices())
    h.put.mockResolvedValue({ data: { data: {} } })
    const onNext = vi.fn()
    render(<ModulesStep onBack={vi.fn()} onNext={onNext} />)
    fireEvent.click(await screen.findByLabelText(/Forms/))
    fireEvent.click(screen.getByLabelText(/Start with a sample website/))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(onNext).toHaveBeenCalled())
    expect(h.put).toHaveBeenCalledWith('/modules', { modules: ['forms'], demo: false })
  })

  it('hides the sample-content question when no website is created', async () => {
    h.get.mockResolvedValue(choices({ demo: { available: false, value: true } }))
    render(<ModulesStep onBack={vi.fn()} onNext={vi.fn()} />)
    await screen.findByText('Authentication')
    expect(screen.queryByLabelText(/Start with a sample website/)).toBeNull()
  })
})

describe('CompleteScreen', () => {
  const result = {
    installed: true,
    app_type: 'landing',
    modules: ['cms'],
    frontend: true,
    summary: {
      app_type: 'landing',
      modules: [{ slug: 'cms', name: 'Frontend', status: 'ENABLED' }],
      database: 'done',
      core: 'done',
      seeded: ['roles', 'default-users'],
      demo: { requested: true, pages: 9 },
      urls: { admin: '/admin/dashboard', login: '/login', site: '/' },
    },
  }
  it('reports what was set up and links to the site and sign-in', () => {
    const onContinue = vi.fn()
    render(<CompleteScreen result={result} onContinue={onContinue} />)
    expect(screen.getByText('Your workspace is ready')).toBeTruthy()
    expect(screen.getByText('Frontend')).toBeTruthy()
    expect(screen.getByText(/roles, default users/)).toBeTruthy()
    expect(screen.getByText(/9 pages/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /View website/ }).getAttribute('href')).toBe('/')
    fireEvent.click(screen.getByRole('button', { name: /Sign in to admin/ }))
    expect(onContinue).toHaveBeenCalled()
  })
  it('no website link and no sample-content line for an admin-only install', () => {
    const r = {
      ...result,
      summary: { ...result.summary, urls: { ...result.summary.urls, site: null } },
    }
    render(<CompleteScreen result={r} onContinue={vi.fn()} />)
    expect(screen.queryByRole('link', { name: /View website/ })).toBeNull()
    expect(screen.queryByText('Your website')).toBeNull()
  })
})
