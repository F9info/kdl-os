'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import api from '@/lib/axios'

interface Props {
  mediaId: string
  onJobStarted: (jobId: string) => void
}

interface PdfInfo {
  page_count?: number
  title?: string
  author?: string
}

type PasswordMode = 'protect' | 'remove'

export function PdfToolsPanel({ mediaId, onJobStarted }: Props) {
  const [info, setInfo] = useState<PdfInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)

  const [wmText, setWmText] = useState('')
  const [wmOpacity, setWmOpacity] = useState(0.3)

  const [passwordMode, setPasswordMode] = useState<PasswordMode>('protect')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)

  const callOp = async (payload: Record<string, unknown>) => {
    setLoading(true)
    try {
      const res = await api.post<{ data: { job_id: string } }>(`/media/${mediaId}/pdf-op`, payload)
      const jobId = res.data.data.job_id
      onJobStarted(jobId)
      toast({ title: `Job started`, description: jobId })
    } catch {
      toast({ title: 'Operation failed', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleGetInfo = async () => {
    setInfoLoading(true)
    try {
      const res = await api.post<{ data: PdfInfo }>(`/media/${mediaId}/pdf-op`, { op: 'info' })
      setInfo(res.data.data)
    } catch {
      toast({ title: 'Failed to get PDF info', variant: 'destructive' })
    } finally {
      setInfoLoading(false)
    }
  }

  return (
    <div className="space-y-5 p-4">
      {/* Info */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Info</h3>
        <Button size="sm" onClick={handleGetInfo} disabled={infoLoading}>
          {infoLoading ? 'Loading…' : 'Get info'}
        </Button>
        {info !== null && (
          <div className="rounded border bg-muted/30 p-2 text-xs space-y-1 text-muted-foreground">
            {info.page_count !== undefined && (
              <p>
                Pages: <span className="text-foreground font-medium">{info.page_count}</span>
              </p>
            )}
            {info.title && (
              <p>
                Title: <span className="text-foreground">{info.title}</span>
              </p>
            )}
            {info.author && (
              <p>
                Author: <span className="text-foreground">{info.author}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Compress */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold">Compress</h3>
        <Button size="sm" onClick={() => callOp({ op: 'compress' })} disabled={loading}>
          Compress PDF
        </Button>
      </div>

      {/* Watermark */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Watermark</h3>
        <Input
          placeholder="Watermark text"
          value={wmText}
          onChange={(e) => setWmText(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <Label>Opacity</Label>
            <span className="text-muted-foreground">{wmOpacity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={wmOpacity}
            onChange={(e) => setWmOpacity(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        <Button
          size="sm"
          onClick={() => callOp({ op: 'watermark', text: wmText, opacity: wmOpacity })}
          disabled={loading || !wmText.trim()}
        >
          Add Watermark
        </Button>
      </div>

      {/* Password */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Password</h3>
        <div className="flex gap-2">
          {(['protect', 'remove'] as PasswordMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPasswordMode(mode)}
              className={[
                'text-xs px-3 py-1 rounded border capitalize transition-colors',
                passwordMode === mode
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent',
              ].join(' ')}
            >
              {mode}
            </button>
          ))}
        </div>
        <Input
          type="password"
          placeholder={passwordMode === 'protect' ? 'Set password' : 'Current password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          onClick={() =>
            callOp({
              op: passwordMode === 'protect' ? 'password_protect' : 'password_remove',
              password,
            })
          }
          disabled={loading || !password.trim()}
        >
          {passwordMode === 'protect' ? 'Protect with Password' : 'Remove Password'}
        </Button>
      </div>

      {/* Thumbnail */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold">Thumbnail</h3>
        <Button size="sm" onClick={() => callOp({ op: 'thumbnail' })} disabled={loading}>
          Generate Thumbnail
        </Button>
      </div>
    </div>
  )
}
