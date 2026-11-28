'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { f9tech } from '@/frontend/blocks/packs/f9tech'
import { landing } from '@/frontend/blocks/packs/landing'
import { listCustomBlocks } from '@/frontend/blocks/packs/composer/custom-blocks-store'
import {
  useLayoutActions,
  type LayoutKind,
  type LayoutPresetRecord,
} from '@/admin/hooks/useLayoutLibrary'
import { DevicePreview, layoutPreviewSrc } from './DevicePreview'

const KIND_LABEL: Record<LayoutKind, string> = {
  TOP_HEADER: 'top header',
  HEADER: 'header',
  FOOTER: 'footer',
}
const CATEGORY = { TOP_HEADER: 'top-bar', HEADER: 'header', FOOTER: 'footer' } as const
const BUILT_IN = ['1', '2', '3', '4', '5']

interface FieldDef {
  type: string
  label?: string
  options?: { label: string; value: string }[]
}

const isLanding = (variant: string) => /^landing:[1-4]$/.test(variant)
const LANDING_DESIGNS = ['1', '2', '3', '4']
// The design number is the `variant` itself and Identity supplies logo/name/contacts, so neither is a setting.
const LANDING_SKIP = new Set(['variant', 'anchor', 'id'])

/** What a design's field shows until the user changes it: the block's own default, so the form matches the preview. */
function designDefaults(kind: LayoutKind, variant: string): Record<string, unknown> {
  if (!isLanding(variant)) return {}
  const comp =
    kind === 'HEADER'
      ? landing.components.LandingHeader
      : kind === 'FOOTER'
        ? landing.components.LandingFooter
        : null
  return (comp?.defaultProps ?? {}) as Record<string, unknown>
}

/** The settings of the F9 Tech and Landing designs come from the block's own field list: nothing is repeated here. */
function designFields(kind: LayoutKind, variant: string): [string, FieldDef][] {
  const landingComp =
    kind === 'HEADER'
      ? landing.components.LandingHeader
      : kind === 'FOOTER'
        ? landing.components.LandingFooter
        : null
  const comp = isLanding(variant)
    ? landingComp
    : kind === 'HEADER'
      ? f9tech.components.F9Header
      : kind === 'FOOTER'
        ? f9tech.components.F9Footer
        : null
  const fields = (comp?.fields ?? {}) as unknown as Record<string, FieldDef>
  return Object.entries(fields).filter(([k]) => !isLanding(variant) || !LANDING_SKIP.has(k))
}

export function LayoutEditorDialog({
  projectId,
  kind,
  layout,
  open,
  onClose,
}: {
  projectId: string
  kind: LayoutKind
  /** The layout being edited; null/undefined creates a new one. */
  layout?: LayoutPresetRecord | null
  open: boolean
  onClose: () => void
}) {
  const actions = useLayoutActions(projectId)
  const [name, setName] = useState('')
  const [variant, setVariant] = useState('1')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [published, setPublished] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(layout?.name ?? '')
    setVariant(layout?.variant ?? (kind === 'TOP_HEADER' ? '1' : 'f9'))
    setConfig(layout?.config ?? {})
    setPublished(layout ? layout.status === 'PUBLISHED' : false)
  }, [open, layout, kind])

  const { data: customBlocks } = useQuery({
    queryKey: ['custom-blocks', projectId, CATEGORY[kind]],
    queryFn: () => listCustomBlocks(projectId, CATEGORY[kind]),
    enabled: open,
  })

  const f9 = kind !== 'TOP_HEADER'
  const hasSettings = variant === 'f9' || isLanding(variant)
  const fields = hasSettings ? designFields(kind, variant) : []
  const defaults = designDefaults(kind, variant)
  const shown = (key: string) => config[key] ?? (defaults[key] != null ? String(defaults[key]) : '')
  const nameOk = name.trim().length > 0
  const busy = actions.create.isPending || actions.update.isPending

  const save = () => {
    // A built-in or saved design has no settings of its own; only F9 Tech and Landing designs keep them.
    const cfg = hasSettings ? config : {}
    const done = { onSuccess: onClose }
    if (layout) {
      actions.update.mutate(
        {
          id: layout.id,
          name: name.trim(),
          variant,
          config: cfg,
          ...(layout.is_default ? {} : { status: published ? 'PUBLISHED' : 'DRAFT' }),
        },
        done
      )
    } else {
      actions.create.mutate(
        {
          kind,
          name: name.trim(),
          variant,
          config: cfg,
          status: published ? 'PUBLISHED' : 'DRAFT',
        },
        done
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {layout ? `Edit ${KIND_LABEL[kind]} layout` : `New ${KIND_LABEL[kind]} layout`}
          </DialogTitle>
          <DialogDescription>
            Pick a design and its settings. Links, contact details and logo come from Navigation and
            Identity.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="layout-name">Name</Label>
              <Input
                id="layout-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Corporate header"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="layout-design">Design</Label>
              <select
                id="layout-design"
                value={variant}
                onChange={(e) => {
                  const next = e.target.value
                  // Settings belong to one design family; carrying them across would save stray keys.
                  if (isLanding(next) !== isLanding(variant) || next === 'f9' || variant === 'f9') {
                    if (!(isLanding(next) && isLanding(variant))) setConfig({})
                  }
                  setVariant(next)
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <optgroup label="Built-in designs">
                  {BUILT_IN.map((v) => (
                    <option key={v} value={v}>{`Design ${v}`}</option>
                  ))}
                </optgroup>
                {f9 && (
                  <optgroup label="Landing">
                    {LANDING_DESIGNS.map((n) => (
                      <option key={n} value={`landing:${n}`}>{`Landing design ${n}`}</option>
                    ))}
                  </optgroup>
                )}
                {f9 && (
                  <optgroup label="F9 Tech">
                    <option value="f9">F9 Tech</option>
                  </optgroup>
                )}
                {(customBlocks ?? []).length > 0 && (
                  <optgroup label="Saved in Section Builder">
                    {(customBlocks ?? []).map((b) => (
                      <option key={b.id} value={`custom:${b.id}`}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {fields.map(([key, def]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`cfg-${key}`}>{def.label ?? key}</Label>
                {def.type === 'textarea' ? (
                  <Textarea
                    id={`cfg-${key}`}
                    rows={4}
                    value={shown(key)}
                    onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                  />
                ) : def.type === 'select' ? (
                  <select
                    id={`cfg-${key}`}
                    value={shown(key) || (def.options?.[0]?.value ?? '')}
                    onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {(def.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`cfg-${key}`}
                    value={shown(key)}
                    onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                  />
                )}
              </div>
            ))}

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-xs text-muted-foreground">
                  {layout?.is_default
                    ? 'The default layout is always published.'
                    : 'Only published layouts show on the live site.'}
                </p>
              </div>
              <Switch
                checked={layout?.is_default ? true : published}
                disabled={layout?.is_default}
                onCheckedChange={setPublished}
                aria-label="Published"
              />
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium">Preview</p>
            <DevicePreview
              src={layoutPreviewSrc({
                projectId,
                kind,
                variant,
                config: hasSettings ? config : undefined,
              })}
              height={kind === 'FOOTER' ? 640 : 220}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={!nameOk || busy}>
            {busy ? 'Saving…' : layout ? 'Save changes' : 'Create layout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
