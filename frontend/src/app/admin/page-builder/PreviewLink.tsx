'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Copy, ExternalLink, Eye } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createPreviewLink } from './store'

const DURATIONS = [
  { hours: 1, label: '1 hour' },
  { hours: 24, label: '24 hours' },
  { hours: 168, label: '7 days' },
]

/** Where a preview token is opened. Built from the current origin, so it works on any host. */
export const previewUrl = (origin: string, token: string) => `${origin}/preview/${token}`

/**
 * Preview button. By default it opens a dialog to create a signed link to the latest draft and copy or open it.
 * With `direct` (the landing page editor) there is no dialog: one click opens the whole page, header to
 * footer, in a new tab (a link that works for 1 hour is made behind the scenes).
 */
export function PreviewLinkButton({
  pageId,
  direct = false,
}: {
  pageId: string
  direct?: boolean
}) {
  const [open, setOpen] = useState(false)

  async function openNow() {
    // The tab is opened on the click itself, so the browser does not block it as a pop-up; the address follows.
    const tab = window.open('', '_blank')
    try {
      const link = await createPreviewLink(pageId, 1)
      const url = previewUrl(window.location.origin, link.token)
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch {
      tab?.close()
      toast({
        title: 'Preview failed',
        description: 'Could not open the preview. Try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={direct ? openNow : () => setOpen(true)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
      >
        <Eye size={15} /> Preview
      </button>
      {open && <PreviewLinkDialog pageId={pageId} onClose={() => setOpen(false)} />}
    </>
  )
}

function PreviewLinkDialog({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const [hours, setHours] = useState(24)
  const create = useMutation({ mutationFn: () => createPreviewLink(pageId, hours) })
  const url = create.data ? previewUrl(window.location.origin, create.data.token) : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Link copied' })
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Select the link and copy it.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Preview link"
      description="Share your latest draft with someone who has no login. They see the page as it would look once published."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Link works for</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            >
              {DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.data ? 'Create a new link' : 'Create link'}
          </Button>
        </div>

        {create.data && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                readOnly
                value={url}
                aria-label="Preview link"
                onFocus={(e) => e.target.select()}
              />
              <Button type="button" variant="outline" onClick={copy}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button type="button" variant="outline" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires {new Date(create.data.expires_at).toLocaleString()}.
            </p>
          </div>
        )}

        {create.error ? <ErrorAlert error={create.error} /> : null}
        <p className="text-xs text-muted-foreground">
          Anyone with the link can see the page until it expires, and it cannot be switched off
          earlier. Shows your latest autosaved draft; the link is not shown in search results.
        </p>
      </div>
    </Modal>
  )
}
