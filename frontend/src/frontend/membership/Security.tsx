'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { useAuthStore } from '@/stores/auth.store'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(12, 'Password must be at least 12 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
type Data = z.infer<typeof schema>

/** Same endpoint as the admin change-password screen. */
export function Security() {
  const { user, setAuth } = useAuthStore()
  const f = useForm<Data>({ resolver: zodResolver(schema) })
  const m = useMutation({
    mutationFn: (d: Data) =>
      api
        .post<{ data: { accessToken: string } }>('/auth/change-password', {
          currentPassword: d.currentPassword,
          newPassword: d.newPassword,
        })
        .then((r) => r.data.data),
    onSuccess: (r) => {
      if (user) setAuth({ ...user, must_change_password: false }, r.accessToken)
      f.reset()
    },
  })
  const e = f.formState.errors
  return (
    <form
      className="max-w-md space-y-3 rounded-xl border bg-card p-6"
      noValidate
      onSubmit={f.handleSubmit((d) => m.mutate(d))}
    >
      <h2 className="text-lg font-semibold">Change password</h2>
      <FormField label="Current password" required error={e.currentPassword?.message}>
        <Input type="password" autoComplete="current-password" {...f.register('currentPassword')} />
      </FormField>
      <FormField label="New password" required error={e.newPassword?.message}>
        <Input type="password" autoComplete="new-password" {...f.register('newPassword')} />
      </FormField>
      <FormField label="Confirm new password" required error={e.confirmPassword?.message}>
        <Input type="password" autoComplete="new-password" {...f.register('confirmPassword')} />
      </FormField>
      {m.error && <ErrorAlert error={m.error} />}
      {m.isSuccess && (
        <p role="status" className="text-sm text-primary">
          Password changed.
        </p>
      )}
      <Button type="submit" disabled={m.isPending}>
        Update password
      </Button>
    </form>
  )
}
