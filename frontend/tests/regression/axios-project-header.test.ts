import { describe, it, expect, beforeEach } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { AxiosHeaders } from 'axios'
import api from '@/lib/axios'
import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'

// The request interceptor that adds Authorization and, for admin calls, X-Project-Id.
type Handler = { fulfilled: (c: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }
const requestHandler = () =>
  (api.interceptors.request as unknown as { handlers: Handler[] }).handlers[0]!.fulfilled

const cfg = (headers: Record<string, string> = {}) =>
  ({ headers: new AxiosHeaders(headers) }) as InternalAxiosRequestConfig

describe('X-Project-Id on admin requests', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'token' })
    useProjectStore.setState({ activeProjectId: 'p-2' })
  })

  it('sends the project chosen in the switcher', () => {
    expect(requestHandler()(cfg()).headers.get('X-Project-Id')).toBe('p-2')
  })

  it('lets a call set its own project', () => {
    expect(requestHandler()(cfg({ 'X-Project-Id': 'explicit' })).headers.get('X-Project-Id')).toBe(
      'explicit'
    )
  })

  it('sends nothing when no project is chosen', () => {
    useProjectStore.setState({ activeProjectId: null })
    expect(requestHandler()(cfg()).headers.get('X-Project-Id')).toBeFalsy()
  })

  it('sends nothing when signed out (public requests)', () => {
    useAuthStore.setState({ accessToken: null })
    expect(requestHandler()(cfg()).headers.get('X-Project-Id')).toBeFalsy()
  })
})
