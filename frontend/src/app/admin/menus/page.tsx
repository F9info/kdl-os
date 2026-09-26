'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GripVertical, ChevronDown, ChevronRight, Pencil, Trash2, ExternalLink } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { listPages } from '@/app/admin/page-builder/store'
import { cn } from '@/lib/utils'
import { MAX_DEPTH, moveNode, flattenForApi, type MenuItemNode, type DropZone } from './_tree'

const MENU_KEY = 'header'
const MENU_NAME = 'Header Navigation'

interface Menu {
  id: string
  project_id: string | null
  key: string
  name: string
  items: MenuItemNode[]
}

function MenusPageContent() {
  const projectId = useSearchParams().get('projectId')
  const queryClient = useQueryClient()

  const { data: menu, isLoading } = useQuery({
    queryKey: ['menu', projectId, MENU_KEY],
    queryFn: () =>
      api
        .post('/menus/ensure', { project_id: projectId, key: MENU_KEY, name: MENU_NAME })
        .then((r) => r.data.data.menu as Menu),
    enabled: Boolean(projectId),
  })

  // Local, editable copy of the tree — drag-and-drop mutates this instantly
  // for a responsive feel; "Save changes" is what actually persists it.
  const [tree, setTree] = useState<MenuItemNode[] | null>(null)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (menu && !dirty) setTree(menu.items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu])

  const { data: pagesData } = useQuery({
    queryKey: ['pages-for-menu', projectId],
    queryFn: () => listPages(),
    enabled: Boolean(projectId),
  })
  // Most existing BuilderPage rows have no project_id at all yet (a
  // pre-existing template-engine gap, not this feature's to fix) — fall
  // back to the full page list rather than showing an always-empty picker
  // when nothing matches the current project.
  const allPages = pagesData ?? []
  const projectMatchedPages = allPages.filter((p) => p.projectId === projectId)
  const projectPages = projectMatchedPages.length > 0 ? projectMatchedPages : allPages

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['menu', projectId, MENU_KEY] })

  const createItemMutation = useMutation({
    mutationFn: (body: Partial<MenuItemNode> & { label: string }) =>
      api.post(`/menus/${menu!.id}/items`, body),
    onSuccess: () => {
      invalidate()
      setDirty(false)
      toast({ title: 'Menu item added' })
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not add menu item'
      toast({ title: message, variant: 'destructive' })
    },
  })

  const updateItemMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<MenuItemNode> }) =>
      api.patch(`/menus/items/${id}`, body),
    onSuccess: () => {
      invalidate()
      setDirty(false)
      toast({ title: 'Menu item updated' })
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menus/items/${id}`),
    onSuccess: () => {
      invalidate()
      setDirty(false)
      toast({ title: 'Menu item deleted' })
    },
  })

  const saveOrderMutation = useMutation({
    mutationFn: (nodes: MenuItemNode[]) =>
      api.patch(`/menus/${menu!.id}/items/reorder`, { items: flattenForApi(nodes) }),
    onSuccess: () => {
      invalidate()
      setDirty(false)
      toast({ title: 'Menu order saved' })
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not save menu order'
      toast({ title: message, variant: 'destructive' })
    },
  })

  // Drag-and-drop state.
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: DropZone } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<MenuItemNode | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [customLabel, setCustomLabel] = useState('')
  const [customUrl, setCustomUrl] = useState('')

  function handleDrop(targetId: string, zone: DropZone) {
    if (!dragId || !tree) return
    const next = moveNode(tree, dragId, targetId, zone)
    setDragId(null)
    setDropTarget(null)
    if (!next) {
      toast({ title: `Can't nest more than ${MAX_DEPTH} levels deep`, variant: 'destructive' })
      return
    }
    setTree(next)
    setDirty(true)
  }

  function rowDragOver(e: React.DragEvent<HTMLDivElement>, id: string) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientY - rect.top) / rect.height
    const zone: DropZone = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside'
    setDropTarget({ id, zone })
  }

  function addExistingPage(page: { id: string; title: string; slug: string }) {
    createItemMutation.mutate({
      label: page.title,
      link_type: 'page',
      page_id: page.id,
      url: `/p/${page.slug}`,
      parent_id: null,
      order: tree?.length ?? 0,
    } as never)
  }

  function addCustomLink() {
    const label = customLabel.trim()
    const url = customUrl.trim()
    if (!label || !url) return
    createItemMutation.mutate({
      label,
      link_type: url.startsWith('http') ? 'external' : 'custom',
      url,
      parent_id: null,
      order: tree?.length ?? 0,
    } as never)
    setCustomLabel('')
    setCustomUrl('')
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderRow(node: MenuItemNode, depth: number) {
    const hasChildren = node.children.length > 0
    const isCollapsed = collapsed.has(node.id)
    const isDropBefore = dropTarget?.id === node.id && dropTarget.zone === 'before'
    const isDropAfter = dropTarget?.id === node.id && dropTarget.zone === 'after'
    const isDropInside = dropTarget?.id === node.id && dropTarget.zone === 'inside'
    return (
      <div key={node.id}>
        {isDropBefore && <div className="mx-2 h-0.5 rounded bg-primary" />}
        <div
          draggable
          onDragStart={() => setDragId(node.id)}
          onDragOver={(e) => rowDragOver(e, node.id)}
          onDragLeave={() => setDropTarget((t) => (t?.id === node.id ? null : t))}
          onDrop={() => handleDrop(node.id, dropTarget?.zone ?? 'after')}
          onDragEnd={() => {
            setDragId(null)
            setDropTarget(null)
          }}
          style={{ marginLeft: (depth - 1) * 28 }}
          className={cn(
            'flex items-center gap-2 rounded-md border bg-card px-2 py-2 text-sm',
            isDropInside && 'border-primary bg-primary/5',
            !node.is_active && 'opacity-50',
            dragId === node.id && 'opacity-40'
          )}
        >
          <button
            type="button"
            onClick={() => toggleCollapse(node.id)}
            className={cn('shrink-0 text-muted-foreground', !hasChildren && 'invisible')}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
          <span className="flex-1 truncate font-medium">{node.label}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
            {node.link_type}
          </span>
          {node.open_in_new_tab && (
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <Switch
            checked={node.is_active}
            onCheckedChange={(v) =>
              updateItemMutation.mutate({ id: node.id, body: { is_active: v } })
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditing(node)}
            aria-label={`Edit ${node.label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteId(node.id)}
            aria-label={`Delete ${node.label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {isDropAfter && <div className="mx-2 h-0.5 rounded bg-primary" />}
        {hasChildren && !isCollapsed && (
          <div className="mt-1 space-y-1">
            {node.children.map((child) => renderRow(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!projectId) {
    return (
      <div>
        <PageHeader title="Menus" />
        <p className="mt-4 text-sm text-muted-foreground">
          Add <code>?projectId=&lt;id&gt;</code> to the URL to manage that project&apos;s navigation
          — scoped per project, same as Team and FAQ.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Menus"
        breadcrumbs={[{ label: 'Menus' }]}
        action={
          dirty ? (
            <Button
              onClick={() => tree && saveOrderMutation.mutate(tree)}
              disabled={saveOrderMutation.isPending}
            >
              Save changes
            </Button>
          ) : undefined
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Drag a row onto another to nest it as a sub-item (up to {MAX_DEPTH} levels); drag to the top
        or bottom edge of a row to reorder as a sibling instead.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">Pages</h3>
            <div className="max-h-64 space-y-1 overflow-auto">
              {projectPages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addExistingPage(p)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate">{p.title}</span>
                  <span className="text-xs text-primary">+ Add</span>
                </button>
              ))}
              {projectPages.length === 0 && (
                <p className="text-xs text-muted-foreground">No pages found for this project.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Custom Link</h3>
            <FormField label="Label">
              <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            </FormField>
            <FormField label="URL" hint="A relative path (/contact) or a full https:// URL.">
              <Input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} />
            </FormField>
            <Button type="button" className="w-full" onClick={addCustomLink}>
              Add to menu
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Header Navigation</h3>
          </div>
          {isLoading || !tree ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tree.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No items yet — add a page or a custom link from the left.
            </p>
          ) : (
            <div className="space-y-1">{tree.map((node) => renderRow(node, 1))}</div>
          )}
        </div>
      </div>

      <EditItemModal
        item={editing}
        onClose={() => setEditing(null)}
        onSave={updateItemMutation.mutate}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteItemMutation.mutate(deleteId)
          setDeleteId(null)
        }}
        title="Delete menu item?"
        description="Any of its own sub-items are deleted too. This action cannot be undone."
        isLoading={deleteItemMutation.isPending}
      />
    </div>
  )
}

function EditItemModal({
  item,
  onClose,
  onSave,
}: {
  item: MenuItemNode | null
  onClose: () => void
  onSave: (args: { id: string; body: Partial<MenuItemNode> }) => void
}) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [openInNewTab, setOpenInNewTab] = useState(false)
  useEffect(() => {
    if (item) {
      setLabel(item.label)
      setUrl(item.url ?? '')
      setOpenInNewTab(item.open_in_new_tab)
    }
  }, [item])

  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title="Edit Menu Item"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (item) onSave({ id: item.id, body: { label, url, open_in_new_tab: openInNewTab } })
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Label" required>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FormField>
        {item?.link_type !== 'page' && (
          <FormField label="URL">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} />
          </FormField>
        )}
        <FormField label="Open in new tab">
          <Switch checked={openInNewTab} onCheckedChange={setOpenInNewTab} />
        </FormField>
      </div>
    </Modal>
  )
}

export default function MenusPage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <MenusPageContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
