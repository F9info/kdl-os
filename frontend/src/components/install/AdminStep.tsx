'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { installApi } from './install-api'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const bytes = (v: string) => new TextEncoder().encode(v).length

/** Same rules as the server (12+ characters, 72 bytes at most), so mistakes show before the request. */
export function adminErrors(v: { name: string; email: string; password: string; confirm: string }) {
  return {
    name: v.name.trim().length < 2 ? 'Enter the admin name.' : '',
    email: !EMAIL.test(v.email.trim()) ? 'Enter a valid email address.' : '',
    password:
      v.password.length < 12
        ? 'Use at least 12 characters.'
        : bytes(v.password) > 72
          ? 'Use at most 72 bytes.'
          : '',
    confirm: v.confirm !== v.password ? 'Passwords do not match.' : '',
  }
}

/** Installer step 3: the Super Admin account. The password is sent once and only a hash is kept. */
export function AdminStep({
  initial,
  onBack,
  onNext,
}: {
  initial?: { name: string; email: string } | null
  onBack: () => void
  onNext: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const errors = adminErrors({ name, email, password, confirm })
  const valid = !errors.name && !errors.email && !errors.password && !errors.confirm

  const save = useMutation({
    mutationFn: () =>
      installApi.put('/admin', {
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: confirm,
      }),
    onSuccess: onNext,
  })

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-primary">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-foreground">Create the admin account</h1>
      </div>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        This is the Super Admin, the owner of the installation. You will sign in with it after the
        setup.
      </p>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (valid) save.mutate()
        }}
        noValidate
      >
        <FormField label="Name" required error={touched ? errors.name : undefined}>
          <Input
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </FormField>
        <FormField label="Email" required error={touched ? errors.email : undefined}>
          <Input
            type="email"
            value={email}
            maxLength={150}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Password"
            required
            hint="At least 12 characters."
            error={touched ? errors.password : undefined}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label="Confirm password" required error={touched ? errors.confirm : undefined}>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
        </div>
        {save.error && <ErrorAlert error={save.error} />}
        <div className="mt-8 flex justify-between">
          <Button type="button" variant="ghost" onClick={onBack} disabled={save.isPending}>
            Back
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Next'}
          </Button>
        </div>
      </form>
    </section>
  )
}
