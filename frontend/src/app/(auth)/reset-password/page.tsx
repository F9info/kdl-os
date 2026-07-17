'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({ resolver: zodResolver(resetPasswordSchema) })

  useEffect(() => {
    if (!token) {
      toast({ variant: 'destructive', title: 'Invalid or missing reset token' })
      router.replace('/login')
    }
  }, [token, router])

  interface ResetPasswordPayload {
    token: string
    password: string
  }

  const {
    mutate: resetPassword,
    isPending,
    error,
    isSuccess,
  } = useMutation({
    mutationFn: (data: ResetPasswordPayload) =>
      api.post('/auth/reset-password', data).then((r) => r.data),
    onSuccess: () => {
      toast({ title: 'Password reset successfully. Please sign in.' })
    },
  })

  function onSubmit({ password }: ResetPasswordFormData) {
    if (!token) return
    resetPassword({ token, password })
  }

  if (!token) return null

  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Password updated</h2>
          <p className="text-sm text-muted-foreground">
            Your password has been reset. You can now sign in with the new password.
          </p>
        </div>
        <Link href="/login" className="block text-sm text-primary hover:underline">
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold">Reset password</h2>
        <p className="text-sm text-muted-foreground">Enter a new password for your account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="New password" error={errors.password?.message} required>
          <Input
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('password')}
          />
        </FormField>

        <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
          <Input
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        </FormField>

        {error && <ErrorAlert error={error} />}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <LoadingSpinner size="sm" />}
          Reset password
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
