import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../utils'
import { ContactFormBlock } from '@/app/admin/page-builder/packs/general/contact-form'

const form = {
  name: 'Enquiry',
  submit_label: 'Send it',
  success_message: 'Thanks, got it!',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'message', label: 'Message', type: 'textarea', required: false },
  ],
}

const fetchMock = vi.fn()
const reply = (ok: boolean, status: number, body: unknown) => ({
  ok,
  status,
  json: async () => body,
})

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const mount = (readOnly = false) =>
  render(
    <ContactFormBlock
      formSlug="spring-enquiry"
      anchor="contact"
      title="Talk to us"
      readOnly={readOnly}
    />
  )

describe('ContactFormBlock (T5.4)', () => {
  it('draws the fields from the form and uses the anchor id', async () => {
    fetchMock.mockResolvedValue(reply(true, 200, { data: { form } }))
    const { container } = mount()
    expect(await screen.findByLabelText(/^Name/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send it' })).toBeTruthy()
    expect(container.querySelector('section')?.id).toBe('contact')
    expect(fetchMock).toHaveBeenCalledWith('/api/forms/public/spring-enquiry')
  })

  it('posts the answers (with the honeypot field) and shows the thank-you message', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/submit')
        ? reply(true, 201, { data: { message: 'Thanks, got it!' } })
        : reply(true, 200, { data: { form } })
    )
    mount()
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Ann' } })
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'a@b.co' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send it' }))
    expect(await screen.findByText('Thanks, got it!')).toBeTruthy()
    const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/submit'))!
    expect(JSON.parse(call[1].body)).toEqual({ name: 'Ann', email: 'a@b.co', message: '', _hp: '' })
  })

  it('shows per-field server errors and keeps the form', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/submit')
        ? reply(false, 422, {
            message: 'Please check the form',
            errors: { email: 'Email must be a valid email' },
          })
        : reply(true, 200, { data: { form } })
    )
    mount()
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Ann' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send it' }))
    expect(await screen.findByText('Email must be a valid email')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send it' })).toBeTruthy()
  })

  it('in the editor (readOnly) it never submits', async () => {
    fetchMock.mockResolvedValue(reply(true, 200, { data: { form } }))
    mount(true)
    const button = (await screen.findByRole('button', { name: 'Send it' })) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.submit(button.closest('form')!)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)) // only the form lookup
  })

  it('shows nothing to visitors when the form is missing, a hint in the editor', async () => {
    fetchMock.mockResolvedValue(reply(false, 404, {}))
    const visitor = mount()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(visitor.queryByText(/not found/i)).toBeNull()
    visitor.unmount()
    mount(true)
    expect(await screen.findByText(/not found/i)).toBeTruthy()
  })
})
