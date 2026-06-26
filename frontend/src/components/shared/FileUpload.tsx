'use client'

import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/utils'

interface FileUploadProps {
  onFile: (file: File) => void
  accept?: string
  maxSizeMB?: number
  disabled?: boolean
}

export function FileUpload({
  onFile,
  accept = 'image/*,application/pdf',
  maxSizeMB = 10,
  disabled = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function validate(file: File): string | null {
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) return `File too large. Max size: ${maxSizeMB} MB`

    const acceptTypes = accept.split(',').map((t) => t.trim())
    const matched = acceptTypes.some((t) => {
      if (t.endsWith('/*')) return file.type.startsWith(t.replace('/*', '/'))
      return file.type === t
    })
    if (!matched) return `File type not allowed`

    return null
  }

  function handleFile(file: File) {
    const err = validate(file)
    if (err) {
      setError(err)
      setSelected(null)
      return
    }
    setError(null)
    setSelected(file)
    onFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function clear() {
    setSelected(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
          disabled && 'pointer-events-none opacity-50'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          Drag & drop or <span className="text-primary font-medium">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">Max {maxSizeMB} MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />

      {selected && (
        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span className="truncate max-w-[200px]">{selected.name}</span>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <span className="text-muted-foreground text-xs">{formatBytes(selected.size)}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clear} type="button">
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
