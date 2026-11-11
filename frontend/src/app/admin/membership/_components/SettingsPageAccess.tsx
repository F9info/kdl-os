'use client'

import Link from 'next/link'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { useAdminAction, usePlans, type Plan } from '@/admin/hooks/useMembership'
import { groupRules, planUpdates, VIEW_LABEL, type PlanRule } from './AccessRulesParts'
import { ToggleRow } from './BillingBits'
import { NativeSelect } from './ui'

/**
 * Page Builder > Page settings > Access: lock one page for members, using the same access rules as
 * Membership > Access rules. `slug` is the page path (/p/resources/annual-report-2026).
 */
export function PageAccessPanel({ slug, title }: { slug: string; title?: string }) {
  const { data, isLoading } = usePlans()
  const action = useAdminAction()
  const plans: Plan[] = data?.items ?? []
  const rule = groupRules(plans).find((r) => r.target === 'PAGE' && r.value === slug)
  const locked = Boolean(rule)
  const onPlans = new Set(rule?.plans.map((p) => p.id) ?? [])

  async function save(next: PlanRule | null, ids: Set<string>, ok: string) {
    try {
      for (const u of planUpdates(plans, rule ?? null, next, ids))
        await action.mutateAsync({
          method: 'put',
          path: `plans/${u.planId}/access-rules`,
          data: u.rules,
        })
      toast({ title: ok })
    } catch {
      /* shown below */
    }
  }
  const base = (): PlanRule => ({
    target: 'PAGE',
    value: slug,
    label: title ?? rule?.label ?? undefined,
    non_member_view: rule?.non_member_view ?? 'BLUR',
    enabled: true,
  })

  if (isLoading) return <Skeleton className="h-24 w-full" />
  return (
    <div className="space-y-3 text-sm">
      <ToggleRow
        label="Members only"
        hint="Uses Membership access rules"
        checked={locked}
        disabled={action.isPending}
        onChange={(on) =>
          void (on
            ? save(base(), new Set(plans.filter((p) => !p.is_free).map((p) => p.id)), 'Page locked')
            : save(null, new Set(), 'Page unlocked'))
        }
      />
      {locked && (
        <>
          <div>
            <p className="mb-1 font-medium">Who can view</p>
            <div className="flex flex-wrap gap-2">
              {plans.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-full border px-3 py-1">
                  <input
                    type="checkbox"
                    checked={onPlans.has(p.id)}
                    disabled={action.isPending || (onPlans.has(p.id) && onPlans.size === 1)}
                    onChange={(e) => {
                      const ids = new Set(onPlans)
                      if (e.target.checked) ids.add(p.id)
                      else ids.delete(p.id)
                      void save({ ...rule, ...base() }, ids, 'Access saved')
                    }}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-medium">Non-members see</p>
            <NativeSelect
              aria-label="Non-members see"
              value={rule?.non_member_view ?? 'BLUR'}
              disabled={action.isPending}
              onChange={(e) =>
                void save(
                  {
                    ...rule,
                    ...base(),
                    non_member_view: e.target.value as PlanRule['non_member_view'],
                  },
                  onPlans,
                  'Access saved'
                )
              }
              options={Object.entries(VIEW_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <Link
            className="text-primary underline"
            href={`/admin/membership/access-rules/${rule!.key}`}
          >
            Open in Access rules →
          </Link>
        </>
      )}
      {action.error ? <ErrorAlert error={action.error} /> : null}
    </div>
  )
}
