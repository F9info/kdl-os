'use client'

import Link from 'next/link'
import { AlertCircle, Check, Clock, Download, User as UserIcon } from 'lucide-react'
import { useInvoices, useMe, usePayments } from './api'
import { cardCls } from './JoinUi'
import { primaryBtn, outlineBtn } from './AuthShell'
import { dateText, money } from './format'
import { useMemberSession } from './useMemberSession'
import type { SubscriptionStatus } from './types'

type State = 'active' | 'approval' | 'verifying' | 'free' | 'failed'
const STATES: State[] = ['active', 'approval', 'verifying', 'free', 'failed']

const Badge = ({ tone, children }: { tone: 'g' | 'p' | 'a' | 'r'; children: React.ReactNode }) => (
  <span
    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${{ g: 'bg-green-100 text-green-800', p: 'bg-purple-100 text-purple-800', a: 'bg-amber-100 text-amber-800', r: 'bg-red-100 text-red-800' }[tone]}`}
  >
    {children}
  </span>
)
const Fact = ({ k, v }: { k: string; v?: string | null }) => (
  <div className="rounded-lg border p-3 text-left">
    <div className="text-xs text-muted-foreground">{k}</div>
    <div className="text-sm font-semibold">{v || '-'}</div>
  </div>
)

/** Result page after joining / paying. The state comes from the URL; names and numbers from the API. */
export function Success({
  state,
  plan: planSlug,
  interval,
  reference,
}: {
  state?: string
  plan?: string
  interval?: string
  reference?: string
}) {
  const s: State = STATES.includes(state as State) ? (state as State) : 'active'
  const session = useMemberSession()
  const me = useMe(session.ready)
  const payments = usePayments()
  const invoices = useInvoices()
  const first = me.data?.member.full_name?.split(' ')[0]
  const plan = me.data?.plan?.name
  const pay = payments.data?.[0]
  const inv = invoices.data?.[0]
  const sub = me.data?.subscription
  const status = sub?.status as SubscriptionStatus | undefined
  const amount = pay ? money(pay.amount, pay.currency) : ''

  const wait = s === 'approval' || s === 'verifying'
  const failed = s === 'failed'
  const title = failed
    ? "Payment didn't go through"
    : s === 'free'
      ? `You're in${first ? `, ${first}` : ''}!`
      : s === 'verifying'
        ? 'Payment submitted'
        : s === 'approval'
          ? 'Payment successful'
          : `Welcome${plan ? ` to ${plan}` : ''}${first ? `, ${first}` : ''}!`
  const sentence = failed
    ? 'Your payment was not completed. No money was deducted.'
    : s === 'free'
      ? `Your ${plan ?? 'Free'} membership is active.${me.data?.member.member_no ? ` Member no. ${me.data.member.member_no}` : ''}`
      : s === 'verifying'
        ? `Thank you${first ? `, ${first}` : ''}. We're checking your bank transfer${amount ? ` of ${amount}` : ''} — usually within 1 working day.`
        : s === 'approval'
          ? `Thank you${first ? `, ${first}` : ''}.${amount ? ` ${amount} received` : ' Payment received'}${plan ? ` for ${plan}` : ''}.`
          : 'Plans with auto-approval activate instantly.'
  const Icon = failed ? AlertCircle : wait ? Clock : Check
  const tone = failed
    ? 'bg-red-100 text-red-600'
    : wait
      ? 'bg-amber-100 text-amber-600'
      : 'bg-green-100 text-green-600'

  return (
    <div className={`${cardCls} mx-auto max-w-2xl space-y-5 p-10 text-center`}>
      <span
        className={`mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full ${tone}`}
      >
        <Icon className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="text-muted-foreground">{sentence}</p>

      {!failed && s !== 'free' && (
        <div className="flex justify-center gap-2">
          <Badge tone={s === 'verifying' ? 'a' : 'g'}>
            {s === 'verifying' ? 'Under verification' : 'Paid'}
          </Badge>
          {s === 'approval' && <Badge tone="p">Awaiting approval</Badge>}
          {s === 'verifying' && <Badge tone="p">Then: approval</Badge>}
          {s === 'active' && (
            <Badge tone="g">{status === 'ACTIVE' || !status ? 'Active' : status}</Badge>
          )}
        </div>
      )}

      {failed && (
        <div className="space-y-2 rounded-xl border p-4 text-left text-sm">
          {[
            ['Plan', planSlug ? `${plan ?? planSlug} · ${interval ?? ''}` : plan],
            ['Reference', reference],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground">{k}</span>
              <b>{v || '-'}</b>
            </div>
          ))}
        </div>
      )}

      {(s === 'approval' || s === 'verifying') && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Fact k={s === 'verifying' ? 'Reference' : 'Payment ID'} v={pay?.reference} />
          <Fact
            k={s === 'verifying' ? 'UTR' : 'Invoice'}
            v={s === 'verifying' ? pay?.utr : inv?.number}
          />
          <Fact k="Method" v={pay?.provider?.label} />
        </div>
      )}
      {s === 'active' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Fact k="Member no." v={me.data?.member.member_no} />
          <Fact k="Valid till" v={sub?.ends_at ? dateText(sub.ends_at) : undefined} />
          <Fact k="Invoice" v={inv?.number} />
        </div>
      )}

      {(s === 'approval' || s === 'verifying') && (
        <div className="flex gap-3 rounded-xl border bg-muted/40 p-4 text-left text-sm">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <b>What happens next?</b>
            <p className="text-muted-foreground">
              {s === 'verifying'
                ? 'Our team matches your transfer with the bank statement, then emails your GST invoice. Your membership is approved after that.'
                : `${plan ?? 'Your'} membership is reviewed by our team — usually within 1 working day. We'll email you when it's active.`}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {failed ? (
          <>
            <Link
              href={`/membership/checkout?plan=${planSlug ?? ''}&interval=${interval ?? 'YEARLY'}`}
              className={`${primaryBtn} !w-auto px-6`}
            >
              Try again
            </Link>
            <Link href="/membership/account" className={`${outlineBtn} !w-auto px-6`}>
              Go to my account
            </Link>
          </>
        ) : (
          <>
            {inv && (
              <Link
                href={`/membership/account/invoices/${inv.id}`}
                className={`${outlineBtn} !w-auto px-5`}
              >
                <Download className="h-4 w-4" aria-hidden /> Download invoice
              </Link>
            )}
            <Link href="/membership/account" className={`${primaryBtn} !w-auto px-5`}>
              <UserIcon className="h-4 w-4" aria-hidden /> Go to my account
            </Link>
            {s === 'free' && (
              <Link href="/membership" className={`${outlineBtn} !w-auto px-5`}>
                See paid plans
              </Link>
            )}
          </>
        )}
      </div>
      {failed && (
        <p className="text-xs text-muted-foreground">
          Your details are saved — you won&apos;t need to fill the form again.
        </p>
      )}
    </div>
  )
}
