import type { Metadata } from 'next'
import { SiteShell } from '@/frontend/membership/SiteShell'

export const metadata: Metadata = { title: 'Membership' }

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>
}
