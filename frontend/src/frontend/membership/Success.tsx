import Link from 'next/link'
import { CheckCircle2, Clock } from 'lucide-react'

const COPY: Record<string, { title: string; body: string; waiting: boolean }> = {
  active: {
    title: 'Welcome, you are a member!',
    body: 'Your membership is active.',
    waiting: false,
  },
  approval: {
    title: 'Waiting for approval',
    body: 'Your payment is received. An admin will review your membership shortly; you will be notified. If it is not approved you get a full refund.',
    waiting: true,
  },
  verifying: {
    title: 'Payment details received',
    body: 'We are verifying your bank transfer. Your membership starts as soon as it is confirmed.',
    waiting: true,
  },
}

export function Success({ state }: { state?: string }) {
  const c = COPY[state ?? 'active'] ?? COPY.active!
  const Icon = c.waiting ? Clock : CheckCircle2
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border bg-card p-8 text-center">
      <Icon className="mx-auto h-12 w-12 text-primary" aria-hidden />
      <h1 className="text-2xl font-bold">{c.title}</h1>
      <p className="text-muted-foreground">{c.body}</p>
      <Link
        href="/membership/account"
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Go to my account
      </Link>
    </div>
  )
}
