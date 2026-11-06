import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { FormField } from '@/types/forms.types'

interface PublicForm {
  name: string
  fields: FormField[]
  submit_label: string
  success_message: string
}

const INPUT_TYPE = { text: 'text', email: 'email', tel: 'tel' } as const

// "Convert to Static Website" builds the site with NEXT_PUBLIC_STATIC_SITE=1. A static site has no server
// to receive a form's messages, unless a backend address was given (NEXT_PUBLIC_API_BASE). Without one,
// the form is replaced by the company's contact details (from Application Identity, passed in at build
// time) rather than a form that cannot send. The admin app never sets these, so it is unaffected.
const STATIC_NO_SERVER =
  process.env.NEXT_PUBLIC_STATIC_SITE === '1' && !process.env.NEXT_PUBLIC_API_BASE
const STATIC_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? ''
const STATIC_PHONE = process.env.NEXT_PUBLIC_CONTACT_PHONE ?? ''

/**
 * Public form block. Reads the form definition from /api/forms/public/<slug> and posts the answers
 * to its /submit route. `readOnly` (page editor) keeps the editor from creating real submissions.
 * Plain fetch, not the admin axios client: visitors are not logged in.
 */
export function ContactFormBlock({
  formSlug,
  anchor,
  title,
  readOnly,
}: {
  formSlug: string
  anchor: string
  title: string
  readOnly: boolean
}) {
  const { data: form, isError } = useQuery({
    queryKey: ['public-form', formSlug],
    queryFn: async () => {
      const r = await fetch(`/api/forms/public/${encodeURIComponent(formSlug)}`)
      if (!r.ok) throw new Error('not found')
      return (await r.json()).data.form as PublicForm
    },
    enabled: Boolean(formSlug) && !(STATIC_NO_SERVER && !readOnly),
    retry: false,
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (readOnly || !form) return
    setStatus('sending')
    setErrors({})
    const answers = Object.fromEntries(new FormData(e.currentTarget).entries())
    try {
      const r = await fetch(`/api/forms/public/${encodeURIComponent(formSlug)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      const json = await r.json()
      if (r.ok) {
        setMessage(json.data.message)
        setStatus('done')
        return
      }
      setErrors(json.errors ?? {})
      setMessage(r.status === 429 ? 'Too many attempts. Please try again later.' : json.message)
    } catch {
      setMessage('Could not send. Please try again.')
    }
    setStatus('idle')
  }

  if (STATIC_NO_SERVER && !readOnly) {
    const phone = STATIC_PHONE.replace(/[^+\d]/g, '')
    return (
      <section id={anchor || undefined} className="mx-auto max-w-xl px-6 py-12">
        {title && <h2 className="mb-6 text-center text-3xl font-bold text-title">{title}</h2>}
        <div
          data-testid="static-contact"
          className="space-y-3 rounded-xl border border-divider bg-card p-6 text-center"
        >
          <p className="text-body">
            {STATIC_EMAIL || STATIC_PHONE
              ? 'Please get in touch with us directly:'
              : 'Please use the contact details on this page to get in touch.'}
          </p>
          {STATIC_EMAIL && (
            <p>
              <a className="font-medium text-primary underline" href={`mailto:${STATIC_EMAIL}`}>
                {STATIC_EMAIL}
              </a>
            </p>
          )}
          {STATIC_PHONE && (
            <p>
              <a className="font-medium text-primary underline" href={`tel:${phone}`}>
                {STATIC_PHONE}
              </a>
            </p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section id={anchor || undefined} className="mx-auto max-w-xl px-6 py-12">
      {title && <h2 className="mb-6 text-center text-3xl font-bold text-title">{title}</h2>}
      {isError || (!form && !formSlug) ? (
        <p className="text-center text-sm text-body">
          {readOnly ? `Form "${formSlug}" not found. Create it in Admin > Forms.` : ''}
        </p>
      ) : !form ? null : status === 'done' ? (
        <p role="status" className="rounded-xl border border-divider bg-card p-6 text-center">
          {message}
        </p>
      ) : (
        <form
          onSubmit={submit}
          noValidate
          className="space-y-4 rounded-xl border border-divider bg-card p-6"
        >
          {form.fields.map((f) => (
            <div key={f.key}>
              <label
                htmlFor={`${formSlug}-${f.key}`}
                className="mb-1 block text-sm font-medium text-title"
              >
                {f.label}
                {f.required && ' *'}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  id={`${formSlug}-${f.key}`}
                  name={f.key}
                  rows={4}
                  required={f.required}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              ) : (
                <input
                  id={`${formSlug}-${f.key}`}
                  name={f.key}
                  type={INPUT_TYPE[f.type]}
                  required={f.required}
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                />
              )}
              {errors[f.key] && <p className="mt-1 text-sm text-destructive">{errors[f.key]}</p>}
            </div>
          ))}
          {/* Honeypot: hidden from people, bots fill it and are ignored by the server. */}
          <input
            name="_hp"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
          {message && Object.keys(errors).length === 0 && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'sending' || readOnly}
            className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : form.submit_label}
          </button>
        </form>
      )}
    </section>
  )
}
