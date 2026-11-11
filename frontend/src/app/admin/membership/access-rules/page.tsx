'use client'

import Link from 'next/link'
import { Eye, Lock, Plus } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { useAdminAction, usePlans, type Plan } from '@/admin/hooks/useMembership'
import {
  TARGET_LABEL,
  VIEW_LABEL,
  groupRules,
  planUpdates,
  whoCan,
  type Rule,
} from '../_components/AccessRulesParts'
import { Card } from '../_components/ui'

function AccessRulesContent() {
  const { data, isLoading, error } = usePlans()
  const action = useAdminAction()
  const plans: Plan[] = data?.items ?? []
  const rules = groupRules(plans)

  async function toggle(rule: Rule, enabled: boolean) {
    const next = {
      target: rule.target,
      value: rule.value,
      label: rule.label,
      non_member_view: rule.non_member_view,
      enabled,
    }
    try {
      for (const u of planUpdates(
        plans,
        rule,
        { ...rule, ...next },
        new Set(rule.plans.map((p) => p.id))
      ))
        await action.mutateAsync({
          method: 'put',
          path: `plans/${u.planId}/access-rules`,
          data: u.rules,
        })
      toast({ title: enabled ? 'Rule switched on' : 'Rule switched off' })
    } catch {
      /* the error is shown below via action.error */
    }
  }

  return (
    <div>
      <PageHeader
        title="Access rules"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Who can see what on the website' },
        ]}
        action={
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/membership" target="_blank">
                <Eye className="h-4 w-4" /> Test as a visitor
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/pages">
                <Lock className="h-4 w-4" /> Lock a page in Page Builder
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/membership/access-rules/new">
                <Plus className="h-4 w-4" /> New rule
              </Link>
            </Button>
          </div>
        }
      />
      {error ? <ErrorAlert error={error} /> : null}
      {action.error ? <ErrorAlert error={action.error} /> : null}
      <Card>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No access rules yet. Add one to keep a page, section or file for members only.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Resource</th>
                  <th>Type</th>
                  <th>Who can access</th>
                  <th>Non-members see</th>
                  <th>Hits (30d)</th>
                  <th>On</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.key} className="border-b last:border-0">
                    <td className="py-3">
                      <Link
                        className="font-medium hover:underline"
                        href={`/admin/membership/access-rules/${r.key}`}
                      >
                        {r.label || r.value}
                      </Link>
                      {r.label && <p className="text-xs text-muted-foreground">{r.value}</p>}
                    </td>
                    <td>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {TARGET_LABEL[r.target]}
                      </span>
                    </td>
                    <td>{whoCan(r, plans)}</td>
                    <td>{VIEW_LABEL[r.non_member_view ?? 'EXCERPT_CTA']}</td>
                    <td>{r.hits_30d != null ? r.hits_30d.toLocaleString('en-IN') : '—'}</td>
                    <td>
                      <Switch
                        aria-label={`Rule ${r.label || r.value} on`}
                        checked={r.enabled !== false}
                        disabled={action.isPending}
                        onCheckedChange={(v) => void toggle(r, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export default function AccessRulesPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <AccessRulesContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
