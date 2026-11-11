import type { AccessRule, Plan } from '@/admin/hooks/useMembership'

/** An access rule as the admin sees it: one resource, locked for a set of plans. */
export type RuleExtras = {
  enabled?: boolean
  allow_grace?: boolean
  lock_title?: string | null
  lock_message?: string | null
  cta_label?: string | null
  cta_url?: string | null
  hits_30d?: number | null
}
export type PlanRule = AccessRule & RuleExtras
export interface Rule extends PlanRule {
  key: string
  plans: Plan[]
}

export const ruleKey = (r: Pick<AccessRule, 'target' | 'value'>) =>
  encodeURIComponent(`${r.target}::${r.value}`)
export const parseKey = (key: string) => {
  const [target, ...rest] = decodeURIComponent(key).split('::')
  return { target: target as AccessRule['target'], value: rest.join('::') }
}

export const TARGET_LABEL: Record<string, string> = {
  PAGE: 'Page',
  SECTION: 'Section',
  MEDIA: 'Media collection',
  URL_PATTERN: 'URL pattern',
}
export const VIEW_LABEL: Record<string, string> = {
  EXCERPT_CTA: 'Excerpt + CTA',
  BLUR: 'Blur',
  HIDDEN: 'Hidden',
}

/** One row per resource, merging the per-plan rows the API stores. */
export function groupRules(plans: Plan[]): Rule[] {
  const map = new Map<string, Rule>()
  for (const plan of plans)
    for (const r of (plan.access_rules ?? []) as PlanRule[]) {
      const key = ruleKey(r)
      const have = map.get(key)
      if (have) have.plans.push(plan)
      else map.set(key, { ...r, key, plans: [plan] })
    }
  return [...map.values()]
}

/** "Any active member", "Tier ≥ 2 (Silver, Gold)" or the plan names. */
export function whoCan(rule: Rule, all: Plan[]) {
  const ids = new Set(rule.plans.map((p) => p.id))
  if (all.length > 0 && all.every((p) => ids.has(p.id))) return 'Any active member'
  const sorted = [...rule.plans].sort((a, b) => a.tier - b.tier)
  const min = sorted[0]?.tier ?? 0
  const top = all.filter((p) => p.tier >= min)
  const names = sorted.map((p) => p.name).join(', ')
  return sorted.length > 1 && top.length === sorted.length ? `Tier ≥ ${min} (${names})` : names
}

/** Replace the rows of `original` (if any) in every plan with `next` for the plans in `planIds`. */
export function planUpdates(
  plans: Plan[],
  original: { target: string; value: string } | null,
  next: PlanRule | null,
  planIds: Set<string>
) {
  const out: Array<{ planId: string; rules: PlanRule[] }> = []
  for (const plan of plans) {
    const cur = (plan.access_rules ?? []) as PlanRule[]
    const kept = cur.filter(
      (r) => !(original && r.target === original.target && r.value === original.value)
    )
    const rules = next && planIds.has(plan.id) ? [...kept, next] : kept
    const changed = rules.length !== cur.length || (next && planIds.has(plan.id)) || false
    if (changed) out.push({ planId: plan.id, rules })
  }
  return out
}
