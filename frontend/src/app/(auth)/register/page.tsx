'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email address'),
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

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) })

  const { mutate: registerUser, isPending, error } = useMutation({
    mutationFn: (data: Omit<RegisterFormData, 'confirmPassword'>) =>
      api.post('/auth/register', data),
    onSuccess: () => {
      toast({ title: 'Account created. Please sign in.' })
      router.push('/login')
    },
  })

  function onSubmit({ confirmPassword: _cp, ...data }: RegisterFormData) {
    registerUser(data)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold">Create account</h2>
        <p className="text-sm text-muted-foreground">Fill in the details below</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Name" error={errors.name?.message} required>
          <Input type="text" placeholder="Your name" autoComplete="name" {...register('name')} />
        </FormField>

        <FormField label="Email" error={errors.email?.message} required>
          <Input type="email" placeholder="you@example.com" autoComplete="email" {...register('email')} />
        </FormField>

        <FormField label="Password" error={errors.password?.message} required>
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
          Create account
        </Button>
      </form>

      <p className="text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
