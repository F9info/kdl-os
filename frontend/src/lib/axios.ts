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
    const axiosError = error as { config: AxiosRequestConfig & { _retry?: boolean }; response?: { status: number } }
    const original = axiosError.config

    if (axiosError.response?.status === 401 && !original._retry) {
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
