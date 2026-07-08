'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import type { Notification } from '@/types/notifications.types'

interface StreamOptions {
  onNew?: (notification: Notification) => void
}

export function useNotificationStream({ onNew }: StreamOptions = {}) {
  const qc = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) return
    if (esRef.current) return

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
    const url = `${base}/notifications/stream?token=${encodeURIComponent(accessToken)}`

    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('notification', (event) => {
      try {
        const data = JSON.parse(event.data) as Notification
        qc.setQueryData<number>(['notifications', 'unread-count'], (prev = 0) => prev + 1)
        qc.invalidateQueries({ queryKey: ['notifications', 'list'] })
        onNew?.(data)
      } catch {
        // malformed event — ignore
      }
    })

    es.onerror = () => {
      es.close()
      esRef.current = null
      // fallback polling already on; retry SSE after 30s
      retryRef.current = setTimeout(connect, 30_000)
    }
  }, [isAuthenticated, accessToken, qc, onNew])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      esRef.current = null
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [connect])
}
