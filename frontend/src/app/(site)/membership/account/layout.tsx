import { AccountShell } from '@/frontend/membership/AccountShell'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AccountShell>{children}</AccountShell>
}
