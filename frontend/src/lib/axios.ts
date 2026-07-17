import axios, { type InternalAxiosRequestConfig, type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth.store'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  // For file uploads, drop the JSON default so the browser sets
  // multipart/form-data with the correct boundary — otherwise the server
  // receives application/json and parses no file.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type')
  }
  return config
})

let isRefreshing = false
let failQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const axiosError = error as {
      config: AxiosRequestConfig & { _retry?: boolean }
      response?: { status: number; data?: { errors?: { code?: string } } }
    }
    const original = axiosError.config

    // Forced password change (KDL-324): the backend 403s every route with
    // PASSWORD_CHANGE_REQUIRED until the flag is cleared. Covers stale sessions
    // where the flag flipped server-side after login — mirror it locally so the
    // layouts pin the user to /change-password.
    if (
      axiosError.response?.status === 403 &&
      axiosError.response.data?.errors?.code === 'PASSWORD_CHANGE_REQUIRED'
    ) {
      const { user, setUser } = useAuthStore.getState()
      if (user && !user.must_change_password) {
        setUser({ ...user, must_change_password: true })
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/change-password') {
        window.location.href = '/change-password'
      }
      return Promise.reject(error)
    }

    // A 401 from an auth endpoint means the credentials themselves failed
    // (wrong password) or the session cannot be refreshed — not an expired
    // access token that a silent refresh could renew. Let these reject so the
    // caller (e.g. the login form) can surface the error, instead of firing a
    // refresh-and-redirect that full-page-reloads and wipes the error state.
    const isAuthEndpoint = /\/auth\/(login|refresh)$/.test(original?.url ?? '')

    if (axiosError.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failQueue.push({ resolve, reject })
        }).then((token) => {
          if (!original.headers) original.headers = {}
          original.headers['Authorization'] = `Bearer ${token}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        // Refresh token is in an httpOnly cookie — browser sends it automatically with withCredentials
        const { data } = await axios.post<{ data: { accessToken: string } }>(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const newAccessToken = data.data.accessToken

        useAuthStore.getState().setAuth(useAuthStore.getState().user!, newAccessToken)

        failQueue.forEach(({ resolve }) => resolve(newAccessToken))
        failQueue = []

        if (!original.headers) original.headers = {}
        original.headers['Authorization'] = `Bearer ${newAccessToken}`
        return api(original)
      } catch {
        failQueue.forEach(({ reject }) => reject(error))
        failQueue = []
        useAuthStore.getState().clearAuth()
        if (typeof window !== 'undefined') window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
