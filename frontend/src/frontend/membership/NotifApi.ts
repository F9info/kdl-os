import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { patch, post, put } from './api'
import api from '@/lib/axios'
import { asList } from './format'

export interface Notif {
  id: string
  title: string
  body?: string | null
  link?: string | null
  category?: string | null
  read_at?: string | null
  created_at: string
}
export type Channel = 'IN_APP' | 'WHATSAPP' | 'EMAIL'
export interface PrefCategory {
  key: string
  label: string
  description?: string | null
  channels: Partial<Record<Channel, { enabled: boolean; locked?: boolean }>>
}
export interface Prefs {
  categories: PrefCategory[]
  whatsapp?: { opted_in: boolean; mobile?: string | null; consented_at?: string | null }
  email?: string | null
  language?: string | null
}

const get = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<{ data: T }>(url, { params }).then((r) => r.data.data)
const KEY = ['membership', 'notif'] as const

/** Unread count for the header bell. 404 (API not deployed yet) just means 0. */
export const useUnreadCount = (enabled: boolean) =>
  useQuery({
    queryKey: [...KEY, 'count'],
    enabled,
    retry: false,
    refetchInterval: 60_000,
    queryFn: () =>
      get<{ count?: number; unread?: number } | number>('/membership/me/notifications/unread-count')
        .then((d) => (typeof d === 'number' ? d : (d.count ?? d.unread ?? 0)))
        .catch(() => 0),
  })

export const useNotifications = (page: number, unread: boolean, enabled = true) =>
  useQuery({
    queryKey: [...KEY, 'list', page, unread],
    enabled,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: () =>
      get<unknown>('/membership/me/notifications', { page, unread: unread || undefined }).then(
        (d) => {
          const o = d as { total?: number; unread?: number; page_size?: number }
          return {
            items: asList<Notif>(d),
            total: o?.total,
            pageSize: o?.page_size ?? 6,
          }
        }
      ),
  })

export const useMarkRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { ids?: string[]; all?: boolean }) =>
      patch('/membership/me/notifications/read', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export const usePrefs = () =>
  useQuery({
    queryKey: [...KEY, 'prefs'],
    retry: false,
    queryFn: () => get<Prefs>('/membership/me/communication-preferences'),
  })

export const useSavePrefs = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: unknown) => put('/membership/me/communication-preferences', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, 'prefs'] }),
  })
}

export const useWhatsapp = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (optIn: boolean) =>
      post(optIn ? '/membership/me/whatsapp-opt-in' : '/membership/me/whatsapp-opt-out', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, 'prefs'] }),
  })
}

export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 90) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  if (s < 172800) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
