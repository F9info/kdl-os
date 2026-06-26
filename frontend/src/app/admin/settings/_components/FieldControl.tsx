'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { FormField } from '@/components/shared/FormField'
import { RichTextEditor } from '@/components/shared/RichTextEditor'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { parseOptions } from '@/lib/inputTypes'
import type { SettingField } from '@/types/models.types'

export interface FieldState {
  value: string
  alt_text: string
  preview?: string // single-file display URL
  gallery?: { path: string; url: string }[] // multiple-files
}

interface FieldControlProps {
  field: SettingField
  state: FieldState
  onChange: (patch: Partial<FieldState>) => void
}

const NONE = '__none__'

async function uploadFile(file: File): Promise<{ path: string; url: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const r = await api.post('/setting-fields/upload', fd)
  return r.data.data as { path: string; url: string }
}

export function FieldControl({ field, state, onChange }: FieldControlProps) {
  const { input_type, field_name } = field
  const options = parseOptions(field.options)

  // Headings are purely presentational section separators.
  if (input_type === 'heading') {
    return (
      <div className="border-b pb-2 pt-2 first:pt-0">
        <h3 className="text-base font-semibold">{field_name}</h3>
      </div>
    )
  }

  const hint = field.category ? `Category: ${field.category.name}` : undefined

  const control = () => {
    switch (input_type) {
      case 'textbox':
        return (
          <Input
            value={state.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={field_name}
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            value={state.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={field_name}
          />
        )

      case 'textarea-normal':
        return (
          <Textarea
            value={state.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={field_name}
          />
        )

      case 'textarea':
        return (
          <RichTextEditor value={state.value} onChange={(html) => onChange({ value: html })} />
        )

      case 'select':
        return (
          <Select
            value={state.value || NONE}
            onValueChange={(v) => onChange({ value: v === NONE ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— none —</SelectItem>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'radio':
        return (
          <div className="flex flex-wrap gap-4">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={field.id}
                  value={o}
                  checked={state.value === o}
                  onChange={() => onChange({ value: o })}
                  className="h-4 w-4"
                />
                {o}
              </label>
            ))}
          </div>
        )

      case 'checkbox': {
        const selected = state.value ? state.value.split(',').map((s) => s.trim()) : []
        const toggle = (o: string) => {
          const next = selected.includes(o)
            ? selected.filter((s) => s !== o)
            : [...selected, o]
          onChange({ value: next.join(',') })
        }
        return (
          <div className="flex flex-wrap gap-4">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(o)}
                  onChange={() => toggle(o)}
                  className="h-4 w-4"
                />
                {o}
              </label>
            ))}
          </div>
        )
      }

      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={state.value || '#000000'}
              onChange={(e) => onChange({ value: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1"
            />
            <Input
              value={state.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="#000000"
              className="max-w-[140px] font-mono"
            />
          </div>
        )

      case 'switch':
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={state.value === '1'}
              onCheckedChange={(v) => onChange({ value: v ? '1' : '0' })}
            />
            <span className="text-sm text-muted-foreground">
              {state.value === '1' ? 'On' : 'Off'}
            </span>
          </div>
        )

      case 'file':
        return <SingleFileControl field={field} state={state} onChange={onChange} />

      case 'multiple-files':
        return <GalleryControl field={field} state={state} onChange={onChange} />

      default:
        return (
          <Input value={state.value} onChange={(e) => onChange({ value: e.target.value })} />
        )
    }
  }

  return (
    <FormField label={field_name} hint={hint}>
      {control()}
    </FormField>
  )
}

function SingleFileControl({ field, state, onChange }: FieldControlProps) {
  void field
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handle(file: File) {
    setUploading(true)
    try {
      const { path, url } = await uploadFile(file)
      onChange({ value: path, preview: url })
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {state.preview && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.preview}
            alt={state.alt_text || 'preview'}
            className="h-28 w-28 rounded-md border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange({ value: '', preview: undefined })}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {state.preview ? 'Replace' : 'Upload'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handle(f)
          }}
        />
      </div>

      <Input
        value={state.alt_text}
        onChange={(e) => onChange({ alt_text: e.target.value })}
        placeholder="Alt text (optional)"
        className="max-w-sm"
      />
    </div>
  )
}

function GalleryControl({ state, onChange }: FieldControlProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const gallery = state.gallery ?? []

  async function handle(files: FileList) {
    setUploading(true)
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => uploadFile(f)))
      onChange({ gallery: [...gallery, ...uploaded] })
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function remove(index: number) {
    onChange({ gallery: gallery.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3">
      {gallery.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {gallery.map((g, i) => (
            <div key={g.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url} alt="" className="h-24 w-24 rounded-md border object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(uploading && 'opacity-70')}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        Add images
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handle(e.target.files)
        }}
      />
    </div>
  )
}
