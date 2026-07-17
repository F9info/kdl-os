'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({ resolver: zodResolver(forgotPasswordSchema) })

  const {
    mutate: requestReset,
    isPending,
    error,
  } = useMutation({
    mutationFn: (data: ForgotPasswordFormData) =>
      api.post('/auth/forgot-password', data).then((r) => r.data),
    onSuccess: () => setSubmitted(true),
  })

  if (submitted) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <MailCheck className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            If an account exists for that address, we have sent a password reset link.
          </p>
        </div>
        <Link href="/login" className="block text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold">Forgot password?</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and we will send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit((data) => requestReset(data))} className="space-y-4" noValidate>
        <FormField label="Email" error={errors.email?.message} required>
          <Input
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register('email')}
          />
        </FormField>

        {error && <ErrorAlert error={error} />}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <LoadingSpinner size="sm" />}
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm">
        Remember your password?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
