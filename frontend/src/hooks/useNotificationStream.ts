'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/lib/axios'
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
  const cancelledRef = useRef(false)

  const connect = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return
    if (esRef.current) return

    // JWTs must never ride in the query string (they end up in access logs and
    // proxies — KDL-270 M5). Exchange the Bearer token for a single-use,
    // short-lived ticket and open the stream with that instead.
    let ticket: string
    try {
      const { data } = await api.post('/notifications/stream/ticket')
      ticket = data?.data?.ticket
      if (!ticket) throw new Error('no ticket in response')
    } catch {
      retryRef.current = setTimeout(connect, 30_000)
      return
    }
    if (cancelledRef.current || esRef.current) return

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
    const url = `${base}/notifications/stream?ticket=${encodeURIComponent(ticket)}`

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
      // fallback polling already on; retry SSE (with a fresh ticket) after 30s
      retryRef.current = setTimeout(connect, 30_000)
    }
  }, [isAuthenticated, accessToken, qc, onNew])

  useEffect(() => {
    cancelledRef.current = false
    void connect()
    return () => {
      cancelledRef.current = true
      esRef.current?.close()
      esRef.current = null
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [connect])
}
