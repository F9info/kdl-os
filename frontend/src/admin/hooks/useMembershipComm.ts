import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import api from '@/lib/axios'

/**
 * Membership Communication + Social-login admin hooks. API names: brief Addendum
 * (/membership/admin/communication/*, /membership/admin/auth/providers/*). A 404 (backend not there yet)
 * is treated as "empty" so the screens render their empty state instead of an error.
 */
const COMM = '/membership/admin/communication'
const AUTH = '/membership/admin/auth/providers'
const KEY = 'membership-comm'

export type Channel = 'IN_APP' | 'WHATSAPP' | 'EMAIL' | 'SMS'
export const CHANNELS: Channel[] = ['IN_APP', 'WHATSAPP', 'EMAIL']
export const CHANNEL_LABEL: Record<Channel, string> = {
  IN_APP: 'In-App',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  SMS: 'SMS',
}
export const channelSlug = (c: Channel) => c.toLowerCase().replace('_', '-')
export const slugChannel = (s: string) => s.toUpperCase().replace('-', '_') as Channel
export const LANGS = [
  { key: 'en', label: 'English' },
  { key: 'te', label: 'Telugu' },
  { key: 'hi', label: 'Hindi' },
]

export interface CommEvent {
  key: string
  label: string
  group?: string
  group_label?: string
  category?: string
  mandatory?: boolean
  channels: Partial<Record<Channel, boolean>>
}
export interface CommTemplateRow {
  event: string
  label?: string
  group?: string
  channels?: Channel[]
  languages?: string[]
  updated_at?: string | null
}
export type TemplateBody = Record<
  string,
  string | boolean | number | null | undefined | Record<string, string>
>
export interface CommVariable {
  key: string
  label?: string
  sample?: string
}
export interface CommLog {
  id: string
  created_at: string
  member_name?: string | null
  event: string
  event_label?: string
  channel: Channel
  recipient?: string | null
  status: string
  provider_response?: string | null
  error?: string | null
  subject?: string | null
  body?: string | null
  attempts?: number
  provider_id?: string | null
  payload?: unknown
}
export interface ListResult<T> {
  items: T[]
  total: number
  stats?: Record<string, number>
}

const isMissing = (e: unknown) => axios.isAxiosError(e) && e.response?.status === 404
async function get<T>(url: string, params?: object, fallback?: T): Promise<T> {
  try {
    return (await api.get(url, { params })).data.data as T
  } catch (e) {
    if (isMissing(e) && fallback !== undefined) return fallback
    throw e
  }
}
const asList = <T>(d: unknown): ListResult<T> => {
  if (Array.isArray(d)) return { items: d as T[], total: d.length }
  const o = (d ?? {}) as Partial<ListResult<T>>
  return { items: o.items ?? [], total: o.total ?? o.items?.length ?? 0, stats: o.stats }
}

const useQ = <T>(key: unknown[], fn: () => Promise<T>, enabled = true) =>
  useQuery({ queryKey: [KEY, ...key], queryFn: fn, enabled, retry: false })

export const useCommEvents = () =>
  useQ(['events'], async () => asList<CommEvent>(await get(`${COMM}/events`, undefined, [])))
export const useCommTemplates = () =>
  useQ(['templates'], async () =>
    asList<CommTemplateRow>(await get(`${COMM}/templates`, undefined, []))
  )
export const useCommTemplate = (event: string, channel: Channel, lang: string) =>
  useQ(
    ['template', event, channel, lang],
    () =>
      get<TemplateBody | null>(`${COMM}/templates/${event}/${channel}/${lang}`, undefined, null),
    Boolean(event)
  )
export const useCommVariables = (event?: string) =>
  useQ(
    ['variables', event],
    async () => asList<CommVariable>(await get(`${COMM}/variables`, { event }, [])).items
  )
export const useCommLogs = (params: Record<string, string | number | undefined>) =>
  useQ(['logs', params], async () =>
    asList<CommLog>(
      await get(
        `${COMM}/logs`,
        Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined)),
        []
      )
    )
  )
export const useCommLog = (id: string) =>
  useQ(['log', id], () => get<CommLog | null>(`${COMM}/logs/${id}`, undefined, null))
export const useCommReminders = () =>
  useQ(['reminders'], () =>
    get<Record<string, unknown> | null>(`${COMM}/reminders`, undefined, null)
  )
export const useCommSettings = () =>
  useQ(['settings'], () => get<Record<string, unknown> | null>(`${COMM}/settings`, undefined, null))

export interface CommAction {
  method?: 'post' | 'put' | 'patch' | 'delete'
  path: string
  data?: unknown
}
/** One write mutation for communication AND auth-provider paths (path is relative to /membership/admin). */
export function useCommAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ method = 'post', path, data }: CommAction) =>
      api.request({ method, url: `/membership/admin/${path}`, data }).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
export const commPath = (p: string) => `communication/${p}`

// ---- Social login ----
export interface AuthProvider {
  key: string
  label: string
  type?: string
  preset?: string
  icon?: string | null
  color?: string | null
  button_text?: string | null
  enabled: boolean
  status?: string
  members?: number | null
  sort?: number
  trust_email?: boolean
  has_secret?: boolean
  config?: Record<string, string>
}
export const useAuthProviders = () =>
  useQ(['auth-providers'], async () => asList<AuthProvider>(await get(AUTH, undefined, [])))
export const useAuthProvider = (key: string | null) =>
  useQ(
    ['auth-provider', key],
    () => get<AuthProvider | null>(`${AUTH}/${key}`, undefined, null),
    Boolean(key)
  )

export const errorMessage = (e: unknown) =>
  axios.isAxiosError(e)
    ? ((e.response?.data as { message?: string } | undefined)?.message ?? e.message)
    : e instanceof Error
      ? e.message
      : 'Something went wrong'
