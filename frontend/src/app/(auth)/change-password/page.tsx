'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import api from '@/lib/axios'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import type { ApiResponse } from '@/types/api.types'

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  })

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

interface ChangePasswordResponseData {
  message: string
  accessToken: string
}

export default function ChangePasswordPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({ resolver: zodResolver(changePasswordSchema) })

  const {
    mutate: changePassword,
    isPending,
    error,
  } = useMutation({
    mutationFn: (data: ChangePasswordFormData) =>
      api
        .post<ApiResponse<ChangePasswordResponseData>>('/auth/change-password', {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        })
        .then((r) => r.data),
    onSuccess: (res) => {
      // Flag cleared server-side; mirror it locally so the auth layout
      // stops pinning the user to this screen.
      setAuth({ ...user!, must_change_password: false }, res.data.accessToken)
      router.push('/admin/dashboard')
    },
  })

  if (isLoading || !isAuthenticated) {
    return <LoadingSpinner fullPage />
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold">Set a new password</h2>
        <p className="text-sm text-muted-foreground">
          You must change your password before you can continue.
        </p>
      </div>

      <form
        onSubmit={handleSubmit((data) => changePassword(data))}
        className="space-y-4"
        noValidate
      >
        <FormField label="Current password" error={errors.currentPassword?.message} required>
          <Input
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register('currentPassword')}
          />
        </FormField>

        <FormField label="New password" error={errors.newPassword?.message} required>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('newPassword')}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>

        <FormField label="Confirm new password" error={errors.confirmPassword?.message} required>
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        </FormField>

        {error && <ErrorAlert error={error} />}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <LoadingSpinner size="sm" />}
          Change password
        </Button>
      </form>
    </div>
  )
}
