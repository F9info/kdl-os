import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '../utils'

// The module reads its build-time flags once when it loads, so each case loads a fresh copy.
async function load(env: Record<string, string>) {
  vi.resetModules()
  for (const k of [
    'NEXT_PUBLIC_STATIC_SITE',
    'NEXT_PUBLIC_API_BASE',
    'NEXT_PUBLIC_CONTACT_EMAIL',
    'NEXT_PUBLIC_CONTACT_PHONE',
  ])
    vi.stubEnv(k, env[k] ?? '')
  return (await import('@/frontend/blocks/packs/general/contact-form')).ContactFormBlock
}

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllEnvs())

const props = { formSlug: 'enquiry', anchor: 'contact', title: 'Get in touch', readOnly: false }

describe('ContactFormBlock on a static site (Convert to Static Website)', () => {
  it('with no backend, shows the company contact details instead of a form that cannot send', async () => {
    const Block = await load({
      NEXT_PUBLIC_STATIC_SITE: '1',
      NEXT_PUBLIC_CONTACT_EMAIL: 'info@kdl.com',
      NEXT_PUBLIC_CONTACT_PHONE: '+91 73373 37778',
    })
    render(<Block {...props} />)
    expect(screen.getByTestId('static-contact')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'info@kdl.com' }).getAttribute('href')).toBe(
      'mailto:info@kdl.com'
    )
    expect(screen.getByRole('link', { name: '+91 73373 37778' }).getAttribute('href')).toBe(
      'tel:+917337337778'
    )
    expect(screen.getByText('Get in touch')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled() // never asks a server that is not there
    expect(document.querySelector('form')).toBeNull()
  })

  it('with no contact details at all, still says what to do (never an empty box)', async () => {
    const Block = await load({ NEXT_PUBLIC_STATIC_SITE: '1' })
    render(<Block {...props} />)
    expect(screen.getByText(/contact details on this page/i)).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('with a backend address given, the real form is used', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          form: { name: 'Enquiry', fields: [], submit_label: 'Send', success_message: 'Thanks' },
        },
      }),
    })
    const Block = await load({
      NEXT_PUBLIC_STATIC_SITE: '1',
      NEXT_PUBLIC_API_BASE: 'https://api.example.com',
    })
    render(<Block {...props} />)
    expect(await screen.findByRole('button', { name: 'Send' })).toBeTruthy()
    expect(screen.queryByTestId('static-contact')).toBeNull()
    expect(fetchMock).toHaveBeenCalled()
  })

  it('in the admin app and on normal pages nothing changes', async () => {
    const Block = await load({})
    render(<Block {...props} />)
    expect(screen.queryByTestId('static-contact')).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/forms/public/enquiry')
  })

  it('the page editor keeps showing the real form block even in a static build', async () => {
    const Block = await load({ NEXT_PUBLIC_STATIC_SITE: '1' })
    render(<Block {...props} readOnly />)
    expect(screen.queryByTestId('static-contact')).toBeNull()
  })
})
