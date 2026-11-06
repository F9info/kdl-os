'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useSaveSiteStyles, useSiteStyles, type StyleOption } from '@/admin/hooks/useSiteStyles'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { cn } from '@/lib/utils'

// Web app flow, after Font settings: pick ONE button style and ONE form-field style for the whole
// website. The cards show each style live (the same CSS the server adds to the theme), in the theme's
// colours. Pick one per group; the choice is applied to every button and form on the website, and
// the admin screens are not affected.

/** Scoped CSS for the live samples: the same declarations the website gets, limited to one card. */
function sampleCss(kind: 'btn' | 'form', o: StyleOption): string {
  const s = `.kdl-sp-${kind}-${o.key} .pv`
  return [
    `${s}{${o.base}}`,
    o.hover ? `${s}:hover{${o.hover}}` : '',
    o.textarea ? `.kdl-sp-${kind}-${o.key} textarea.pv{${o.textarea}}` : '',
    o.focus ? `${s}:focus{${o.focus}}` : '',
  ].join('')
}

function StyleGroup({
  title,
  help,
  kind,
  options,
  selected,
  onSelect,
}: {
  title: string
  help: string
  kind: 'btn' | 'form'
  options: StyleOption[]
  selected: string
  onSelect: (key: string) => void
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label={title}>
      <style>{options.map((o) => sampleCss(kind, o)).join('')}</style>
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {options.map((o) => {
          const on = selected === o.key
          return (
            <label
              key={o.key}
              className={cn(
                'flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors',
                on ? 'border-2 border-primary bg-primary/5' : 'hover:bg-muted/60'
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onSelect(o.key)}
                  data-testid={`${kind === 'btn' ? 'button' : 'form'}-style-${o.key}`}
                  aria-label={`${o.label} ${kind === 'btn' ? 'button' : 'form field'} style`}
                />
                {o.label}
              </span>
              <span className={`kdl-sp-${kind}-${o.key} block`}>
                {kind === 'btn' ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    className="pv bg-primary text-primary-foreground inline-flex px-5 py-2.5 text-sm font-medium"
                  >
                    Get started
                  </button>
                ) : (
                  <input
                    readOnly
                    placeholder="Your name"
                    aria-hidden
                    tabIndex={-1}
                    className="pv w-full bg-background px-3 py-2 text-sm"
                  />
                )}
              </span>
              <span className="text-xs text-muted-foreground">{o.description}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

export function SiteStylesStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { data, isLoading, error } = useSiteStyles()
  const save = useSaveSiteStyles()
  const [button, setButton] = useState<string | null>(null)
  const [form, setForm] = useState<string | null>(null)

  // Start from what is saved; after that the page owns the selection until it is saved.
  useEffect(() => {
    if (data && button === null) setButton(data.button)
    if (data && form === null) setForm(data.form)
  }, [data, button, form])

  // Back is always there, also while loading or when loading failed, so this step is never a dead end.
  const back = (
    <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5 px-2">
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to Font settings
    </Button>
  )
  if (isLoading)
    return (
      <div className="space-y-4">
        {back}
        <LoadingState />
      </div>
    )
  if (error || !data)
    return (
      <div className="space-y-4">
        {back}
        <ErrorAlert error={error ?? new Error('Could not load the styles')} />
      </div>
    )

  const pickedButton = button ?? data.button
  const pickedForm = form ?? data.form
  const changed = pickedButton !== data.button || pickedForm !== data.form

  // Saves what changed (nothing is sent when nothing did), then says what to do next.
  const saveThen = (then?: () => void) => {
    if (!changed) {
      toast({ title: 'Styles saved' })
      then?.()
      return
    }
    save.mutate(
      { button: pickedButton, form: pickedForm },
      {
        onSuccess: () => {
          toast({ title: 'Styles saved. Your whole website now uses them.' })
          then?.()
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      {back}
      <div>
        <h3 className="text-base font-semibold">Website · Buttons and form fields</h3>
        <p className="text-sm text-muted-foreground">
          Pick one button style and one form-field style. Every button and every form on your
          website uses them, in your theme&apos;s colours, so the whole site looks the same. Your
          admin screens are not changed.
        </p>
      </div>

      <StyleGroup
        title="Button style"
        help="Used for every main button on the website."
        kind="btn"
        options={data.options.buttons}
        selected={pickedButton}
        onSelect={setButton}
      />
      <StyleGroup
        title="Form field style"
        help="Used for every text box, text area and drop-down on the website."
        kind="form"
        options={data.options.forms}
        selected={pickedForm}
        onSelect={setForm}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => saveThen()}
          disabled={save.isPending}
          data-testid="site-styles-save"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          onClick={() => saveThen(onNext)}
          disabled={save.isPending}
          data-testid="site-styles-next"
        >
          Next: Navigation
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
