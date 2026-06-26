'use client'

import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

interface ToolButton {
  icon: React.ElementType
  label: string
  command: string
  prompt?: boolean
}

const BUTTONS: ToolButton[] = [
  { icon: Bold, label: 'Bold', command: 'bold' },
  { icon: Italic, label: 'Italic', command: 'italic' },
  { icon: Underline, label: 'Underline', command: 'underline' },
  { icon: List, label: 'Bulleted list', command: 'insertUnorderedList' },
  { icon: ListOrdered, label: 'Numbered list', command: 'insertOrderedList' },
  { icon: Link2, label: 'Insert link', command: 'createLink', prompt: true },
  { icon: Eraser, label: 'Clear formatting', command: 'removeFormat' },
]

/**
 * Minimal contentEditable rich-text editor backed by document.execCommand.
 * Emits HTML via onChange. Dependency-free — adequate for admin content fields.
 */
export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Sync external value into the DOM only when it diverges, so typing isn't disrupted.
  useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== value) {
      el.innerHTML = value || ''
    }
  }, [value])

  function exec(button: ToolButton) {
    if (button.prompt) {
      const url = window.prompt('Enter URL')
      if (!url) return
      document.execCommand(button.command, false, url)
    } else {
      document.execCommand(button.command, false)
    }
    ref.current?.focus()
    emit()
  }

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  return (
    <div className="rounded-md border border-input">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1">
        {BUTTONS.map((b) => {
          const Icon = b.icon
          return (
            <button
              key={b.command}
              type="button"
              title={b.label}
              aria-label={b.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(b)}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        className={cn(
          'min-h-[140px] px-3 py-2 text-sm focus:outline-none',
          'prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
          'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]'
        )}
        suppressContentEditableWarning
      />
    </div>
  )
}
