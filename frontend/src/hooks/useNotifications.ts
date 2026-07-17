'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type {
  Notification,
  PreferenceMatrix,
  NotificationPreference,
} from '@/types/notifications.types'
import { useAuthStore } from '@/stores/auth.store'

export function useUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data.data.count as number),
    refetchInterval: 30_000,
    enabled: isAuthenticated,
  })
}

export function useNotifications({ unreadOnly = false } = {}) {
  return useQuery({
    queryKey: ['notifications', 'list', unreadOnly],
    queryFn: () =>
      api
        .get('/notifications', { params: unreadOnly ? { unread: true } : {} })
        .then((r) => r.data.data.items as Notification[]),
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () =>
      api.get('/notifications/preferences').then((r) => r.data.data as PreferenceMatrix),
  })
}

export function useSavePreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (preferences: Omit<NotificationPreference, never>[]) =>
      api.put('/notifications/preferences', { preferences }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'preferences'] })
    },
  })
}
