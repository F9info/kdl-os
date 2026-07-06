'use client'

import { ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface PermissionDeniedProps {
  message?: string
}

export function PermissionDenied({ message }: PermissionDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <ShieldAlert className="h-16 w-16 text-destructive opacity-80" />
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p className="text-muted-foreground max-w-sm">
        {message ?? "You don't have permission to access this page. Contact your administrator if you believe this is an error."}
      </p>
      <Button asChild variant="outline">
        <Link href="/admin/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  )
}
