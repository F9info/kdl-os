import api from '@/lib/axios'
import type { AxiosRequestConfig } from 'axios'

// The installer has no login. Every call carries the setup token (printed in the server log, or
// KDL_SETUP_TOKEN). It is kept in sessionStorage only, so closing the tab forgets it.
const KEY = 'kdl-setup-token'

export const getSetupToken = (): string => {
  try {
    return sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
export const setSetupToken = (token: string) => {
  try {
    if (token) sessionStorage.setItem(KEY, token)
    else sessionStorage.removeItem(KEY)
  } catch {
    // storage blocked: the token then has to be typed again on reload
  }
}

const withToken = (config: AxiosRequestConfig = {}): AxiosRequestConfig => ({
  ...config,
  headers: { ...config.headers, 'x-setup-token': getSetupToken() },
})

export const installApi = {
  get: (url: string, config?: AxiosRequestConfig) => api.get(`/install${url}`, withToken(config)),
  post: (url: string, body?: unknown, config?: AxiosRequestConfig) =>
    api.post(`/install${url}`, body, withToken(config)),
  put: (url: string, body?: unknown, config?: AxiosRequestConfig) =>
    api.put(`/install${url}`, body, withToken(config)),
}

/** Server-side record of the installer, as returned by GET /install/status with a valid token. */
export interface InstallState {
  installed: boolean
  status?: 'pending' | 'running'
  token_required?: boolean
  token_ok?: boolean
  step?: number
  app_type?: string | null
  steps?: Record<string, { status?: string; error?: string | null; at?: string }>
  admin?: { name: string; email: string } | null
  core?: 'none' | 'running' | 'done' | 'failed'
  company?: { name: string; phone: string; email: string; logo_path: string; logo_url: string }
}

export interface DatabaseInfo {
  connected: boolean
  ready: boolean
  host: string
  port: string
  database: string
  user: string
  server?: string
  error?: string
  migrations?: { total: number; applied: number; pending: number; failed: number }
}

export interface InstallProgress {
  steps: InstallState['steps']
  log: Array<{ at: string; step: string; level: string; message: string }>
}

export interface ModuleInfo {
  slug: string
  name: string
  description: string
  group: string
  core: boolean
  dependsOn: Array<{ slug: string; name: string }>
  status: string
}
export interface ModuleChoices {
  type: string
  core: ModuleInfo[]
  included: ModuleInfo[]
  optional: Array<
    ModuleInfo & { includes: Array<{ slug: string; name: string }>; blocked: string | null }
  >
  selected: string[]
  demo: { available: boolean; value: boolean }
}
export interface LaunchResult {
  installed: boolean
  app_type: string
  modules: string[]
  frontend: boolean
  summary?: {
    app_type: string
    modules: Array<{ slug: string; name: string; status: string }>
    database: string
    core: string
    seeded: string[]
    demo: { requested: boolean; pages: number }
    urls: { admin: string; login: string; site: string | null }
  }
}

/** The step the wizard should open on, from what the server already recorded (1-based, 7 = launch). */
export function resumeStep(state: InstallState): number {
  const done = (key: string) => state.steps?.[key]?.status === 'done'
  if (!done('database')) return 1
  if (!(done('company') || (state.step ?? 0) >= 1)) return 2
  if (!state.admin && state.core !== 'done') return 3
  if (state.core !== 'done') return 4
  if (!(done('type') || (state.step ?? 0) >= 2)) return 5
  if (!done('modules')) return 6
  return 7
}
