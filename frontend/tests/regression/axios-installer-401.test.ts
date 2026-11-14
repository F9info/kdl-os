import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosAdapter, AxiosError, InternalAxiosRequestConfig } from 'axios'
import api from '@/lib/axios'

// A wrong or missing setup token comes back as 401. The installer has no session, so the shared "session
// expired, refresh and go to /login" handler must leave it alone (it used to throw the wizard away).
const respond401 = (): AxiosAdapter => async (config: InternalAxiosRequestConfig) => {
  const error = Object.assign(new Error('Request failed with status code 401'), {
    isAxiosError: true,
    config,
    response: {
      status: 401,
      data: { code: 'SETUP_TOKEN_REQUIRED' },
      headers: {},
      config,
      statusText: 'Unauthorized',
    },
  })
  throw error
}

describe('installer 401s', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('reject to the caller and never try a refresh or a redirect', async () => {
    const post = vi.spyOn((await import('axios')).default, 'post') // the refresh call goes through axios.post
    api.defaults.adapter = respond401()
    await expect(api.post('/install/token')).rejects.toMatchObject({ response: { status: 401 } })
    await expect(api.get('/install/database')).rejects.toMatchObject({ response: { status: 401 } })
    expect(post).not.toHaveBeenCalled()
  })

  it('other 401s still go through the refresh path', async () => {
    const axios = (await import('axios')).default
    const post = vi.spyOn(axios, 'post').mockRejectedValue(new Error('no session'))
    api.defaults.adapter = respond401()
    await api.get('/users').catch(() => undefined)
    expect(post).toHaveBeenCalledTimes(1)
    expect(String(post.mock.calls[0]![0])).toContain('/auth/refresh')
  })

  it('error is a normal AxiosError the wizard can show', async () => {
    api.defaults.adapter = respond401()
    const err = (await api.post('/install/token').catch((e) => e)) as AxiosError<{ code: string }>
    expect(err.response?.data.code).toBe('SETUP_TOKEN_REQUIRED')
  })
})
