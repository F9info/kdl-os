import type { User } from '@/types/models.types'

/** A member signs in with the `member` role only: no admin access, so /admin is not for them. */
export const isMemberOnly = (user: User | null | undefined) =>
  !!user?.roles?.length && user.roles.every((r) => r.slug === 'member')

export const homeFor = (user: User | null | undefined) =>
  isMemberOnly(user) ? '/membership/account' : '/admin/dashboard'
