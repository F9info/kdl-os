import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = new Date(date)
  return isNaN(d.getTime()) ? '—' : format(d, fmt)
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

/**
 * Mirror of the backend slug generator (backend/src/shared/utils/slug.js).
 * Used for the read-only live preview in forms — the backend remains the
 * authoritative source for the persisted, uniqueness-checked slug.
 * "New Clients" -> "new-clients"
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i] ?? 'B'}`
}

/**
 * Shared across ErrorAlert (inline/form errors) and ErrorState (block-level
 * errors) so both surfaces extract API error messages the same way.
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (!error) return 'An unexpected error occurred'
  const e = error as { response?: { data?: { message?: string } }; message?: string }
  return e.response?.data?.message ?? e.message ?? 'An unexpected error occurred'
}
