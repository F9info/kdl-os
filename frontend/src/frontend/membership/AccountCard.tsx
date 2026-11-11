'use client'

import { Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMe } from './api'
import { dateText } from './format'

/** Digital member card. The print stylesheet shows only the card (see print:hidden on the rest). */
export function AccountCard() {
  const { data } = useMe()
  if (!data) return null
  const { member, subscription: sub, plan } = data
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div
        aria-label="Member card"
        className="flex aspect-[1.586/1] max-w-md flex-col justify-between rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-6 text-primary-foreground shadow-xl"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold">{member.legal_name ?? 'Membership'}</span>
          {plan && (
            <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold uppercase text-amber-950">
              {plan.name}
            </span>
          )}
        </div>
        <div>
          <p className="text-2xl font-bold">{member.full_name}</p>
          <p className="text-sm opacity-90">{member.member_no ?? '-'}</p>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <p className="opacity-80">Member since</p>
            <p className="font-semibold">{dateText(member.member_since)}</p>
          </div>
          <div>
            <p className="opacity-80">Valid till</p>
            <p className="font-semibold">{sub?.ends_at ? dateText(sub.ends_at) : 'Lifetime'}</p>
          </div>
        </div>
      </div>
      <div className="h-fit space-y-3 rounded-xl border bg-card p-5 print:hidden">
        <h2 className="font-semibold">Use your card</h2>
        <ul className="space-y-1.5 text-sm">
          {[
            'Show your member number at events for quick check-in',
            'Get partner discounts in-store',
            'Works offline once downloaded',
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden /> {t}
            </li>
          ))}
        </ul>
        <Button onClick={() => window.print()}>
          <Download className="mr-2 h-4 w-4" aria-hidden /> Download PDF
        </Button>
      </div>
    </div>
  )
}
