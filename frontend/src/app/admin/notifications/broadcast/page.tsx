'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NotificationTemplate, NotificationChannel } from '@/types/notifications.types'
import type { RbacRole } from '@/types/models.types'

const CHANNELS: NotificationChannel[] = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP']
const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: 'In-App',
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
}

type AudienceType = 'all' | 'role'
type MessageType = 'template' | 'inline'

interface BroadcastForm {
  audience: AudienceType
  role_slug: string
  message_type: MessageType
  template_id: string
  inline_title: string
  inline_body: string
  channels: Record<NotificationChannel, boolean>
}

function defaultForm(): BroadcastForm {
  return {
    audience: 'all',
    role_slug: '',
    message_type: 'template',
    template_id: '',
    inline_title: '',
    inline_body: '',
    channels: { IN_APP: true, EMAIL: false, SMS: false, WHATSAPP: false },
  }
}

export default function BroadcastPage() {
  const [form, setForm] = useState<BroadcastForm>(defaultForm())
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<{ batch_id: string; recipient_count?: number } | null>(null)

  const { data: templates = [] } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () =>
      api
        .get('/notifications/templates')
        .then((r) => r.data.data.templates as NotificationTemplate[]),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data.data.roles as RbacRole[]),
  })

  const broadcastMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/notifications/broadcast', payload),
    onSuccess: (resp) => {
      setResult(resp.data.data)
      setError(null)
      toast({ title: 'Broadcast queued', description: `Job ID: ${resp.data.data.batch_id}` })
    },
    onError: (err: unknown) => {
      setError(err)
      setResult(null)
    },
  })

  function handleSubmit() {
    const selectedChannels = Object.entries(form.channels)
      .filter(([, v]) => v)
      .map(([k]) => k)

    if (selectedChannels.length === 0) {
      setError('Select at least one channel')
      return
    }

    if (form.message_type === 'template' && !form.template_id) {
      setError('Select a template')
      return
    }
    if (form.message_type === 'inline' && (!form.inline_title.trim() || !form.inline_body.trim())) {
      setError('Title and body are required for inline messages')
      return
    }
    if (form.audience === 'role' && !form.role_slug) {
      setError('Select a role')
      return
    }

    const payload: Record<string, unknown> = {
      to: form.audience === 'all' ? { all: true } : { role_slug: form.role_slug },
      channels: selectedChannels,
    }

    if (form.message_type === 'template') {
      const tpl = templates.find((t) => t.id === form.template_id)
      payload.template = tpl?.slug
    } else {
      payload.inline = { title: form.inline_title, body: form.inline_body }
    }

    setError(null)
    broadcastMutation.mutate(payload)
  }

  return (
    <ModuleGuard slug="notifications">
      <PermissionGuard permission="notifications:publish">
        <div className="p-6 max-w-2xl mx-auto">
          <PageHeader title="Send Broadcast" />

          <div className="mt-6 space-y-6">
            <ErrorAlert error={error} />

            {result && (
              <div className="rounded-md border bg-green-50 dark:bg-green-950 p-4 space-y-1 text-sm">
                <div className="font-medium text-green-800 dark:text-green-300">
                  Broadcast queued
                </div>
                <div className="text-muted-foreground">
                  Job ID: <span className="font-mono">{result.batch_id}</span>
                </div>
                {result.recipient_count !== undefined && (
                  <div className="text-muted-foreground">Recipients: {result.recipient_count}</div>
                )}
              </div>
            )}

            {/* Audience */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="font-medium text-sm">Audience</div>
              <FormField label="Send to">
                <Select
                  value={form.audience}
                  onValueChange={(v) => setForm((f) => ({ ...f, audience: v as AudienceType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="role">Users in role</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {form.audience === 'role' && (
                <FormField label="Role">
                  <Select
                    value={form.role_slug}
                    onValueChange={(v) => setForm((f) => ({ ...f, role_slug: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.slug} value={r.slug}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </div>

            {/* Message */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="font-medium text-sm">Message</div>
              <FormField label="Message type">
                <Select
                  value={form.message_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, message_type: v as MessageType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template">Use template</SelectItem>
                    <SelectItem value="inline">Custom message</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {form.message_type === 'template' ? (
                <FormField label="Template">
                  <Select
                    value={form.template_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, template_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.slug})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              ) : (
                <>
                  <FormField label="Title" required>
                    <Input
                      value={form.inline_title}
                      onChange={(e) => setForm((f) => ({ ...f, inline_title: e.target.value }))}
                      placeholder="Important announcement"
                    />
                  </FormField>
                  <FormField label="Body" required>
                    <textarea
                      className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                      value={form.inline_body}
                      onChange={(e) => setForm((f) => ({ ...f, inline_body: e.target.value }))}
                      placeholder="Your message here…"
                    />
                  </FormField>
                </>
              )}
            </div>

            {/* Channels */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="font-medium text-sm">Channels</div>
              {CHANNELS.map((ch) => (
                <div key={ch} className="flex items-center gap-3">
                  <Switch
                    checked={form.channels[ch]}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, channels: { ...f.channels, [ch]: v } }))
                    }
                    id={`ch-${ch}`}
                  />
                  <Label htmlFor={`ch-${ch}`} className="cursor-pointer">
                    {CHANNEL_LABELS[ch]}
                  </Label>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={broadcastMutation.isPending}
            >
              {broadcastMutation.isPending ? 'Sending…' : 'Send broadcast'}
            </Button>
          </div>
        </div>
      </PermissionGuard>
    </ModuleGuard>
  )
}
