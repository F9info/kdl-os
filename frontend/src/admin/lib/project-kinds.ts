// Project kinds and status, in plain words. The values match the backend enums
// (ProjectKind, ProjectStatus in backend/prisma/schema/projects.prisma).
// A project holds a SET of kinds. ADMIN is always on, so the UI never offers it as a choice.

export const PROJECT_KINDS = ['ADMIN', 'WEBSITE', 'LANDING', 'STATIC'] as const
export type ProjectKind = (typeof PROJECT_KINDS)[number]

export const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const KIND_LABELS: Record<ProjectKind, string> = {
  ADMIN: 'Admin',
  WEBSITE: 'Website',
  LANDING: 'Landing pages',
  STATIC: 'Static export',
}

export const KIND_HINTS: Record<Exclude<ProjectKind, 'ADMIN'>, string> = {
  WEBSITE: 'A manageable website with pages, menus, themes and forms.',
  LANDING: 'One or more independent landing pages.',
  STATIC: 'Export the site as plain files you can host anywhere.',
}

/** Kinds a person can switch on or off. ADMIN is always included. */
export const OPTIONAL_KINDS = ['WEBSITE', 'LANDING', 'STATIC'] as const

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
}

/** "Admin + Website + Landing pages", in a fixed order whatever order the kinds arrive in. */
export function kindsLabel(kinds: readonly string[] | undefined): string {
  const set = new Set(kinds ?? [])
  const parts = PROJECT_KINDS.filter((k) => k === 'ADMIN' || set.has(k)).map((k) => KIND_LABELS[k])
  return parts.join(' + ')
}
