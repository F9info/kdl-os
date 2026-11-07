'use client'

import Link from 'next/link'
import { Check, ChevronsUpDown, FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { useProjects } from '@/admin/hooks/useProjects'
import { resolveActiveProject, useProjectStore } from '@/stores/project.store'
import { kindsLabel } from '@/admin/lib/project-kinds'

/** Shows the project you are working in and lets you switch. Hidden without `projects:view`. */
export function ProjectSwitcher() {
  const { can } = usePermissions()
  const allowed = can('projects:view')
  const { data: projects } = useProjects({ enabled: allowed })
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId)

  if (!allowed || !projects || projects.length === 0) return null

  const active = resolveActiveProject(projects, activeProjectId)
  const choices = projects.filter((p) => p.status !== 'ARCHIVED')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="max-w-[14rem] gap-2"
          aria-label={`Active project: ${active?.name ?? 'none'}. Switch project`}
          data-testid="project-switcher"
        >
          <FolderKanban className="h-4 w-4 shrink-0" />
          <span className="truncate">{active?.name ?? 'Select project'}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch project</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {choices.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => setActiveProjectId(p.id)}
            data-testid={`switch-to-${p.slug}`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{kindsLabel(p.kinds)}</div>
            </div>
            {active?.id === p.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/projects">Manage projects</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
