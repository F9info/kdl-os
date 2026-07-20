'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapLink from '@tiptap/extension-link'
import TiptapUnderline from '@tiptap/extension-underline'
import DOMPurify from 'dompurify'
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'strike',
    'a',
    'ul',
    'ol',
    'li',
    'p',
    'br',
  ] as string[],
  ALLOWED_ATTR: ['href', 'rel', 'target'] as string[],
  FORCE_BODY: true,
}

function sanitize(html: string): string {
  // TrustedHTML is a union type in DOMPurify's typings; string is always returned with FORCE_BODY
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as unknown as string
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable heading/code/blockquote — not needed for admin content fields
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
      }),
      TiptapUnderline,
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
    ],
    content: sanitize(value || ''),
    onUpdate({ editor: ed }: { editor: Editor }) {
      onChange(sanitize(ed.getHTML()))
    },
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
        class: cn(
          'min-h-[140px] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm',
          'prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
          placeholder
            ? 'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]'
            : ''
        ),
      },
    },
  })

  // Sync external value when it diverges from editor state (e.g. form reset).
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const incoming = sanitize(value || '')
    // Avoid disrupting an active edit session — only sync when truly diverged.
    if (current !== incoming && !editor.isFocused) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
  }, [editor, value])

  function setLink() {
    if (!editor) return
    const url = window.prompt('Enter URL')
    if (!url) return
    editor.chain().focus().setLink({ href: url }).run()
  }

  function clearFormatting() {
    editor?.chain().focus().clearNodes().unsetAllMarks().run()
  }

  return (
    <div className="rounded-md border border-input">
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1">
        <ToolBtn
          label="Bold"
          active={editor?.isActive('bold')}
          onMouseDown={(e) => {
            e.preventDefault()
            editor?.chain().focus().toggleBold().run()
          }}
        >
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          label="Italic"
          active={editor?.isActive('italic')}
          onMouseDown={(e) => {
            e.preventDefault()
            editor?.chain().focus().toggleItalic().run()
          }}
        >
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          label="Underline"
          active={editor?.isActive('underline')}
          onMouseDown={(e) => {
            e.preventDefault()
            editor?.chain().focus().toggleUnderline().run()
          }}
        >
          <Underline className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          label="Bulleted list"
          active={editor?.isActive('bulletList')}
          onMouseDown={(e) => {
            e.preventDefault()
            editor?.chain().focus().toggleBulletList().run()
          }}
        >
          <List className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          label="Numbered list"
          active={editor?.isActive('orderedList')}
          onMouseDown={(e) => {
            e.preventDefault()
            editor?.chain().focus().toggleOrderedList().run()
          }}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          label="Insert link"
          active={editor?.isActive('link')}
          onMouseDown={(e) => {
            e.preventDefault()
            setLink()
          }}
        >
          <Link2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          label="Clear formatting"
          onMouseDown={(e) => {
            e.preventDefault()
            clearFormatting()
          }}
        >
          <Eraser className="h-4 w-4" />
        </ToolBtn>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolBtn({
  label,
  active,
  onMouseDown,
  children,
}: {
  label: string
  active?: boolean
  onMouseDown: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={onMouseDown}
      className={cn(
        'rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent text-accent-foreground'
      )}
    >
      {children}
    </button>
  )
}
