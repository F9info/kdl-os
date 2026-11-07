import { describe, it, expect } from 'vitest'
import { kindsLabel, OPTIONAL_KINDS, PROJECT_KINDS } from '@/admin/lib/project-kinds'
import { resolveActiveProject } from '@/stores/project.store'
import { projectFormSchema } from '@/app/admin/projects/_schemas'

describe('kindsLabel', () => {
  it('always starts with Admin, even when ADMIN is missing from the list', () => {
    expect(kindsLabel([])).toBe('Admin')
    expect(kindsLabel(undefined)).toBe('Admin')
    expect(kindsLabel(['WEBSITE'])).toBe('Admin + Website')
  })

  it('uses a fixed order whatever order the kinds arrive in', () => {
    expect(kindsLabel(['STATIC', 'LANDING', 'WEBSITE', 'ADMIN'])).toBe(
      'Admin + Website + Landing pages + Static export'
    )
  })

  it('ignores unknown kinds', () => {
    expect(kindsLabel(['WEBSITE', 'MOBILE'])).toBe('Admin + Website')
  })
})

describe('kinds stay in step with the backend enum', () => {
  it('has the four kinds the Prisma ProjectKind enum has, with ADMIN not optional', () => {
    expect([...PROJECT_KINDS]).toEqual(['ADMIN', 'WEBSITE', 'LANDING', 'STATIC'])
    expect([...OPTIONAL_KINDS]).toEqual(['WEBSITE', 'LANDING', 'STATIC'])
  })
})

describe('resolveActiveProject', () => {
  const projects = [
    { id: 'a', status: 'ACTIVE' },
    { id: 'b', status: 'DRAFT' },
    { id: 'c', status: 'ARCHIVED' },
  ]

  it('returns null for no projects', () => {
    expect(resolveActiveProject([], 'a')).toBeNull()
    expect(resolveActiveProject(undefined, 'a')).toBeNull()
  })

  it('keeps a valid stored project', () => {
    expect(resolveActiveProject(projects, 'b')?.id).toBe('b')
  })

  it('falls back to the first usable project when nothing is stored', () => {
    expect(resolveActiveProject(projects, null)?.id).toBe('a')
  })

  it('falls back when the stored project was deleted', () => {
    expect(resolveActiveProject(projects, 'gone')?.id).toBe('a')
  })

  it('never works in an archived project, even if it is stored', () => {
    expect(resolveActiveProject(projects, 'c')?.id).toBe('a')
  })

  it('prefers the project flagged default over list order when nothing is stored', () => {
    const list = [
      { id: 'a', status: 'ACTIVE', is_default: false },
      { id: 'd', status: 'ACTIVE', is_default: true },
    ]
    expect(resolveActiveProject(list, null)?.id).toBe('d')
  })

  it('does not fall back to an archived default project', () => {
    const list = [
      { id: 'd', status: 'ARCHIVED', is_default: true },
      { id: 'a', status: 'ACTIVE', is_default: false },
    ]
    expect(resolveActiveProject(list, null)?.id).toBe('a')
  })

  it('returns null when every project is archived', () => {
    expect(resolveActiveProject([{ id: 'c', status: 'ARCHIVED' }], 'c')).toBeNull()
  })
})

describe('projectFormSchema', () => {
  const ok = { name: 'Subhadra', slug: 'subhadra', kinds: ['WEBSITE'], status: 'DRAFT' }

  it('accepts a valid form', () => {
    expect(projectFormSchema.safeParse(ok).success).toBe(true)
  })

  it('accepts no optional kinds (an admin-only project)', () => {
    expect(projectFormSchema.safeParse({ ...ok, kinds: [] }).success).toBe(true)
  })

  it('rejects a bad slug, an empty name, ADMIN as a choice and an unknown status', () => {
    expect(projectFormSchema.safeParse({ ...ok, slug: 'Has Spaces' }).success).toBe(false)
    expect(projectFormSchema.safeParse({ ...ok, name: '  ' }).success).toBe(false)
    expect(projectFormSchema.safeParse({ ...ok, kinds: ['ADMIN'] }).success).toBe(false)
    expect(projectFormSchema.safeParse({ ...ok, status: 'LIVE' }).success).toBe(false)
  })
})
