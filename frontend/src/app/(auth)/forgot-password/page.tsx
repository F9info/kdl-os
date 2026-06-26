'use client'

import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <MailCheck className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Password reset coming soon</h2>
        <p className="text-sm text-muted-foreground">
          This feature is not yet available. Contact your administrator to reset your password.
        </p>
      </div>
      <Link href="/login" className="block text-sm text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  )
}
