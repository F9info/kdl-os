import { useQuery } from '@tanstack/react-query'
import type { CustomField } from '@puckeditor/core'
import api from '@/lib/axios'

/**
 * Picks a Team module member by id, instead of typing name/role/bio/photo
 * directly into the block — that content then lives in one place (the Team
 * admin CRUD at /admin/team) and updates everywhere it's referenced.
 *
 * Global list, not scoped to the current project: a Puck custom field has no
 * access to `puck.metadata` (only `{ value, onChange }`), so there's no
 * project id to filter by here. Fine at this scale (a handful of team
 * members per install) — narrow if that changes.
 */
function TeamMemberFieldInner({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const { data } = useQuery({
    queryKey: ['team-members-picker'],
    queryFn: () =>
      api.get('/team').then(
        (r) =>
          r.data.data.items as {
            id: string
            name: string
            role: string
          }[]
      ),
  })

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      >
        <option value="">— Use this block&apos;s own text below —</option>
        {(data ?? []).map((member) => (
          <option key={member.id} value={member.id}>
            {member.name} — {member.role}
          </option>
        ))}
      </select>
    </div>
  )
}

export function teamMemberField(label = 'Team member'): CustomField<string> {
  return {
    type: 'custom',
    render: ({ value, onChange }) => (
      <TeamMemberFieldInner label={label} value={value} onChange={onChange} />
    ),
  }
}
