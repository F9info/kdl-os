'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  GripVertical,
  Link2Off,
  Pencil,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MAX_DEPTH as NAV_MAX_DEPTH,
  moveNode as moveNavNode,
  flattenForApi as flattenNavForApi,
  type DropZone as NavDropZone,
  type MenuItemNode as NavNode,
} from '@/app/admin/menus/_tree'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { listPages } from '@/app/admin/page-builder/store'
import { readLocal, writeLocal } from '../../website-ui-state'
import { EditMenuItemModal, type MenuItemPatch } from './EditMenuItemModal'

// One entry per module registered with backend/src/shared/detail-pages/registry.js
// (GET /detail-page-types) — Sectors, Work, and any future type, with zero
// per-type code in this file.
export interface DetailPageType {
  typeKey: string
  label: string
  navParentLabel: string
  deletable?: boolean
  count: number
  sectionHref: string
  listHref: string
  entities: { id: string; name: string; detail_page_id: string; publicPath: string }[]
}

// Mirrors the design prototype's Navigation step page suggestions.
const SUGGESTED_PAGES = [
  'Home',
  'About',
  'Services',
  'Service detail',
  'Products',
  'Product detail',
  'Pricing',
  'Portfolio',
  'Portfolio detail',
  'Blog',
  'Blog detail',
  'Team',
  'Team member',
  'Careers',
  'Job detail',
  'Gallery',
  'Testimonials',
  'Contact',
  'FAQ',
  'Privacy Policy',
  'Terms',
  'Admin panel',
  'Settings',
]

// Content types with a real per-item module (registered via
// backend/src/shared/detail-pages/registry.js — Sectors, Work, ...) already
// generate their own real detail page per entry, reachable from the
// "Layout <type> (N)" button in Layout settings above — typing one of
// these labels into the custom-page box below would instead create ONE
// unrelated generic scaffold page with the same name, which is confusing
// (two different things sharing a label) and was the repeated source of a
// stray/empty page bug. See `addCustomPage`'s `reservedType` lookup and the
// `detailPageTypeStates` chip row below — both keyed off the same
// `detailPageTypes` query, not a hardcoded list.

// The two menus this editor changes, the same ones `ConstructionHeader` and the footer read at render
// time: editing here IS editing the live site's real navigation, not a separate local draft.
const NAV_MENU_NAME = 'Header Navigation'
const FOOTER_MENU_KEY = 'footer'
const FOOTER_MENU_NAME = 'Footer Navigation'

interface WizardMenu {
  id: string
  project_id: string | null
  key: string
  name: string
  items: NavNode[]
}

function navFindByLabel(nodes: NavNode[], label: string): NavNode | null {
  for (const n of nodes) {
    if (n.label === label) return n
    const found = navFindByLabel(n.children, label)
    if (found) return found
  }
  return null
}

function navContainsLabel(nodes: NavNode[], label: string): boolean {
  return navFindByLabel(nodes, label) !== null
}

/** Depth-first labels, for the flat `navigationPages: string[]` the backend scaffolding contract expects — nesting here is real-Menu-only. */
function navFlattenLabels(nodes: NavNode[]): string[] {
  return nodes.flatMap((n) => [n.label, ...navFlattenLabels(n.children)])
}

/** Depth-first node ids — used to cascade a visibility change onto every descendant. */
function navFlattenIds(nodes: NavNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...navFlattenIds(n.children)])
}

/** Depth-first nodes (not just labels) — used to search the footer tree for a mirrored item. */
function navFlattenNodes(nodes: NavNode[]): NavNode[] {
  return nodes.flatMap((n) => [n, ...navFlattenNodes(n.children)])
}

// Mirrors backend/src/shared/utils/slug.js's `slugify` exactly — the
// website driver derives every assembled page's slug this way
// (`te-{runId}-{key}`), so a menu item created here for a page name needs
// the identical algorithm to link to the real page instead of a dead `#`.
function slugifyLikeBackend(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function NavigationStep({
  projectId,
  runId,
  onBack,
  onNext,
  onLayouts,
}: {
  projectId: string
  runId: string
  onBack: () => void
  onNext: () => void
  /** Skip the page grid and open the Layouts view. */
  onLayouts: () => void
}) {
  const storageKey = `te-website-ui:${projectId}:navigation`
  const queryClient = useQueryClient()
  // The one navigation editor: the Header menu and the Footer menu are two separate menus, switched here.
  // The choice is remembered so old links (`/admin/menus?key=footer`) can open the Footer menu.
  const menuKeyStorage = `te-website-ui:${projectId}:navMenu`
  const [menuKey, setMenuKeyState] = useState<'header' | 'footer'>(() =>
    readLocal<string>(menuKeyStorage, 'header') === 'footer' ? 'footer' : 'header'
  )
  const isHeader = menuKey === 'header'
  const menuQueryKey = ['menu', projectId, menuKey]

  const { data: menu } = useQuery({
    queryKey: menuQueryKey,
    queryFn: () =>
      api
        .post('/menus/ensure', {
          project_id: projectId,
          key: menuKey,
          name: isHeader ? NAV_MENU_NAME : FOOTER_MENU_NAME,
        })
        .then((r) => r.data.data.menu as WizardMenu),
    enabled: Boolean(projectId),
  })

  // Footer is a genuinely separate Menu (the Footer tab above) —
  // fetched here too only so each header row can show/toggle whether a
  // mirrored copy of itself already exists in the footer, without making
  // the admin rebuild the footer tree by hand for the common "same link in
  // both" case.
  const footerMenuQueryKey = ['menu', projectId, FOOTER_MENU_KEY]
  const { data: footerMenu } = useQuery({
    queryKey: footerMenuQueryKey,
    queryFn: () =>
      api
        .post('/menus/ensure', {
          project_id: projectId,
          key: FOOTER_MENU_KEY,
          name: FOOTER_MENU_NAME,
        })
        .then((r) => r.data.data.menu as WizardMenu),
    enabled: Boolean(projectId) && isHeader,
  })
  const footerNodes = footerMenu && isHeader ? navFlattenNodes(footerMenu.items) : []
  function findFooterMirror(node: NavNode): NavNode | null {
    return (
      footerNodes.find(
        (f) =>
          f.label === node.label && (node.page_id ? f.page_id === node.page_id : f.url === node.url)
      ) ?? null
    )
  }

  // Footer can show the header menu instead of its own list (a site-wide option, off by default).
  const { data: options } = useQuery({
    queryKey: ['menu-options'],
    queryFn: () =>
      api.get('/menus/options').then((r) => r.data.data as { footer_same_as_header: boolean }),
    enabled: !isHeader,
  })
  const optionsMutation = useMutation({
    mutationFn: (footer_same_as_header: boolean) =>
      api.put('/menus/options', { footer_same_as_header }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-options'] })
      queryClient.invalidateQueries({ queryKey: ['menu-public'] })
    },
  })
  const mirroredFooter = !isHeader && options?.footer_same_as_header === true

  // Pages that already exist (builder pages), to link from the menu without retyping a name.
  const { data: existingPagesData } = useQuery({
    queryKey: ['pages-for-menu', projectId],
    queryFn: () => listPages(),
    enabled: Boolean(projectId),
  })

  // Same query/key WebsiteStage's Layout pill row uses — shared cache. One
  // entry per registered Details Page type (Sectors, Work, ...); adding a
  // new type never touches this component.
  const { data: detailPageTypes } = useQuery({
    queryKey: ['detail-page-types', projectId],
    queryFn: () =>
      api
        .get('/detail-page-types', { params: { project_id: projectId } })
        .then((r) => r.data.data.items as DetailPageType[]),
    enabled: Boolean(projectId),
  })

  // Local, editable copy of the tree — drag-and-drop mutates this
  // instantly for a responsive feel, `dirty` stops a background refetch
  // from clobbering an in-flight edit before its own mutation resolves.
  const [tree, setTree] = useState<NavNode[]>([])
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (menu && !dirty) setTree(menu.items)
  }, [menu, dirty])

  const invalidate = () => {
    setDirty(false)
    queryClient.invalidateQueries({ queryKey: menuQueryKey })
    // `useHeaderMenuTree` (ConstructionHeader, WebsiteLayoutPreview,
    // useLayoutChrome) reads this same Menu under its own cache key —
    // without invalidating it too, those previews keep showing whatever
    // they last fetched until an unrelated remount happens to refire it.
    // Broad prefix match — invalidates every key's public cache
    // (header/footer/...), not just NAV_MENU_KEY.
    queryClient.invalidateQueries({ queryKey: ['menu-public'] })
  }

  const createItemMutation = useMutation({
    mutationFn: (body: {
      label: string
      order: number
      parent_id?: string
      // Sector/Work detail links are real page links (link_type 'page', a
      // real page_id + entity's own route) — a plain custom label stays the
      // synthetic te-{runId}-{slug} scaffold-page link — 'external' is a
      // third-party URL with no page behind it at all.
      link_type?: 'custom' | 'page' | 'external'
      page_id?: string
      url?: string
      open_in_new_tab?: boolean
    }) =>
      api.post(`/menus/${menu!.id}/items`, {
        label: body.label,
        order: body.order,
        parent_id: body.parent_id ?? null,
        link_type: body.link_type ?? 'custom',
        page_id: body.page_id ?? null,
        open_in_new_tab: body.open_in_new_tab ?? false,
        // Doesn't account for the resolveSeedPages dedup suffix
        // (`-2`, `-3`, ...) the backend applies when the same label
        // appears twice in one run — rare, and worth a wrong link over
        // the complexity of replicating that counter here.
        url: body.url ?? `/p/te-${runId}-${slugifyLikeBackend(body.label) || 'page'}`,
      }),
    onSuccess: invalidate,
  })
  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menus/items/${id}`),
    onSuccess: invalidate,
  })
  const saveOrderMutation = useMutation({
    mutationFn: (nodes: NavNode[]) =>
      api.patch(`/menus/${menu!.id}/items/reorder`, { items: flattenNavForApi(nodes) }),
    onSuccess: invalidate,
  })
  // Visibility toggle — the page/link stays real and reachable by URL, it
  // just stops appearing in the rendered header/footer nav (`getPublicMenu`
  // already filters `is_active: false` out server-side).
  const updateItemMutation = useMutation({
    mutationFn: ({
      id,
      ...patch
    }: { id: string } & Partial<MenuItemPatch> & { is_active?: boolean; no_page?: boolean }) =>
      api.patch(`/menus/items/${id}`, patch),
    onSuccess: invalidate,
  })

  // "No page" — item (and its dropdown, if any) stays in the nav, but its
  // own label stops being a clickable link. For a parent that only exists
  // to group children (e.g. "About Us" over "About"/"Leadership").
  function toggleNoPage(node: NavNode) {
    updateItemMutation.mutate({ id: node.id, no_page: !node.no_page })
  }

  // Hiding a parent hides every descendant too — a child left "visible"
  // under a hidden parent just confused (it's still gone from the rendered
  // nav, but its own row looked unaffected). One-way: showing the parent
  // again does NOT auto-restore children, in case one was hidden on
  // purpose for its own reason before the parent was.
  function toggleVisibility(node: NavNode) {
    const nextActive = !node.is_active
    updateItemMutation.mutate({ id: node.id, is_active: nextActive })
    if (!nextActive) {
      for (const childId of navFlattenIds(node.children)) {
        updateItemMutation.mutate({ id: childId, is_active: false })
      }
    }
  }

  const invalidateFooter = () => {
    queryClient.invalidateQueries({ queryKey: footerMenuQueryKey })
    queryClient.invalidateQueries({ queryKey: ['menu-public'] })
  }
  // Mirrors (or un-mirrors) one header item into the Footer menu — same
  // label/link_type/target, flat (no nesting) since the footer rarely needs
  // the header's exact hierarchy. Only ever touches the mirror; the header
  // original is never modified by this.
  const footerAddMutation = useMutation({
    mutationFn: (node: NavNode) =>
      api.post(`/menus/${footerMenu!.id}/items`, {
        label: node.label,
        order: footerMenu?.items.length ?? 0,
        parent_id: null,
        link_type: node.link_type,
        page_id: node.page_id,
        url: node.url,
        open_in_new_tab: node.open_in_new_tab,
      }),
    onSuccess: invalidateFooter,
  })
  const footerRemoveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menus/items/${id}`),
    onSuccess: invalidateFooter,
  })
  function toggleFooterMirror(node: NavNode) {
    if (!footerMenu) return
    const mirror = findFooterMirror(node)
    if (mirror) footerRemoveMutation.mutate(mirror.id)
    else footerAddMutation.mutate(node)
  }

  const [editing, setEditing] = useState<NavNode | null>(null)
  const [customName, setCustomName] = useState('')
  const [customNameError, setCustomNameError] = useState<string | null>(null)
  const [showExternalForm, setShowExternalForm] = useState(false)
  const [externalLabel, setExternalLabel] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [externalNewTab, setExternalNewTab] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: NavDropZone } | null>(null)
  const selectedLabels = navFlattenLabels(tree)
  // Entity names already nested under a synced type (e.g. every Sector/Work
  // entry) are managed via that type's own chip + count badge above — they
  // shouldn't ALSO show up as 44 individually-togglable duplicates here.
  const registryEntityLabels = new Set(
    (detailPageTypes ?? []).flatMap((t) => t.entities.map((e) => e.name))
  )
  const extras = selectedLabels.filter(
    (n) => !SUGGESTED_PAGES.includes(n) && !registryEntityLabels.has(n)
  )
  // One reserved chip per registered Details Page type — "synced" reflects
  // whether every real entity page is already nested under that type's nav
  // parent (e.g. "Sectors", "Work"), not just whether any entity exists —
  // so a chip un-checks itself again once a new entity gets added after the
  // last sync. `sync` nests one real link per entity (link_type 'page',
  // pointing at its own real detail-page route) under that parent, creating
  // the parent nav item first if it isn't selected yet. Only adds what's
  // missing — safe to click again later.
  const detailPageTypeStates = (detailPageTypes ?? []).map((type) => {
    const navNode = navFindByLabel(tree, type.navParentLabel)
    const syncedLabels = new Set((navNode?.children ?? []).map((c) => c.label))
    const hasPages = type.entities.length > 0
    const synced = hasPages && type.entities.every((e) => syncedLabels.has(e.name))
    async function sync() {
      if (!menu || type.entities.length === 0) return
      setDirty(true)
      try {
        let parentId = navNode?.id
        let order = navNode?.children.length ?? 0
        if (!parentId) {
          const res = await createItemMutation.mutateAsync({
            label: type.navParentLabel,
            order: tree.length,
          })
          parentId = res.data.data.item.id as string
          order = 0
        }
        for (const e of type.entities) {
          if (syncedLabels.has(e.name)) continue
          await createItemMutation.mutateAsync({
            label: e.name,
            order: order++,
            parent_id: parentId,
            link_type: 'page',
            page_id: e.detail_page_id,
            url: e.publicPath,
          })
        }
      } finally {
        setDirty(false)
      }
    }
    return { label: type.label, parentLabel: type.navParentLabel, hasPages, synced, sync }
  })
  // No optimistic local update on add/remove/reorder below — every change
  // only ever reflects in `tree` once the server round-trip actually
  // completes and refetches. Without this, clicking a pill then reloading
  // (or clicking Next) before that request finishes silently drops the
  // change — it was never saved, but nothing on screen said so. This is
  // the one thing to actually watch/disable against, not a cosmetic spinner.
  const isSavingNav =
    createItemMutation.isPending || deleteItemMutation.isPending || saveOrderMutation.isPending

  // Disabling the in-app Back/Next/pill buttons stops navigating away
  // mid-save, but not an actual browser refresh/tab-close — that's a real
  // way to lose an add/remove/reorder that hasn't finished its round trip
  // yet, and is exactly what was reported ("added a page, refreshed, it
  // was gone"). The native confirm dialog is the only way to warn against
  // that specific case.
  useEffect(() => {
    if (!isSavingNav) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isSavingNav])

  // navigationPages still has to be a flat string[] for the site-scaffolding
  // driver's existing contract (which page rows get created) — that's
  // separate from, and unaffected by, the real Menu's nesting above.
  useEffect(() => {
    if (!isHeader) return // the footer menu is not the list of pages to scaffold
    writeLocal(storageKey, selectedLabels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, tree, isHeader])

  function setMenuKey(key: 'header' | 'footer') {
    if (key === menuKey) return
    setDirty(false)
    setMenuKeyState(key)
    writeLocal(menuKeyStorage, key)
  }

  // Existing pages not yet in this menu (most pages have no project id yet, so fall back to all of them).
  const allExisting = existingPagesData ?? []
  const projectExisting = allExisting.filter((pg) => pg.projectId === projectId)
  const linkedPageIds = new Set(navFlattenNodes(tree).map((n) => n.page_id))
  const existingPages = (projectExisting.length > 0 ? projectExisting : allExisting).filter(
    (pg) => !linkedPageIds.has(pg.id)
  )
  function addExistingPage(pg: { id: string; title: string; slug: string }) {
    if (!menu) return
    setDirty(true)
    createItemMutation.mutate({
      label: pg.title,
      order: tree.length,
      link_type: 'page',
      page_id: pg.id,
      url: `/p/${pg.slug}`,
    })
  }

  function togglePage(name: string) {
    if (!menu) return
    const existing = navFindByLabel(tree, name)
    setDirty(true)
    if (existing) deleteItemMutation.mutate(existing.id)
    else createItemMutation.mutate({ label: name, order: tree.length })
  }

  function addCustomPage() {
    const name = customName.trim()
    if (!name || !menu || navContainsLabel(tree, name)) return
    // A registered type's own label (e.g. "Sector detail") is reserved —
    // typing it here would create ONE unrelated generic scaffold page with
    // the same name, which is confusing (two different things sharing a
    // name) and was the repeated source of a stray/empty page bug. The
    // type's own chip (above) is the real way to get these pages into nav.
    const reservedType = (detailPageTypes ?? []).find(
      (t) => t.label.toLowerCase() === name.toLowerCase()
    )
    if (reservedType) {
      setCustomNameError(
        `${reservedType.label} pages are managed per entry, not as a single custom page — use the "${reservedType.label}" chip above to nest each entry's real page under "${reservedType.navParentLabel}" in the nav.`
      )
      return
    }
    setCustomNameError(null)
    setDirty(true)
    createItemMutation.mutate({ label: name, order: tree.length })
    setCustomName('')
  }

  function addExternalLink() {
    const label = externalLabel.trim()
    const url = externalUrl.trim()
    if (!label || !url || !menu) return
    setDirty(true)
    createItemMutation.mutate({
      label,
      order: tree.length,
      link_type: 'external',
      url,
      open_in_new_tab: externalNewTab,
    })
    setExternalLabel('')
    setExternalUrl('')
    setShowExternalForm(false)
  }

  function removeNavNode(id: string) {
    setDirty(true)
    deleteItemMutation.mutate(id)
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function rowDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientY - rect.top) / rect.height
    const zone: NavDropZone = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside'
    setDropTarget({ id, zone })
  }

  function handleDrop(targetId: string, zone: NavDropZone) {
    if (!dragId) return
    const moved = moveNavNode(tree, dragId, targetId, zone)
    if (moved) {
      setTree(moved)
      setDirty(true)
      saveOrderMutation.mutate(moved)
    }
    setDragId(null)
    setDropTarget(null)
  }

  function renderNavRow(node: NavNode, depth: number) {
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
          style={{ marginLeft: (depth - 1) * 24 }}
          className={cn(
            'flex items-center gap-1.5 rounded-md bg-primary py-1.5 pl-2 pr-1.5 text-xs font-semibold text-primary-foreground',
            isDropInside && 'ring-2 ring-primary ring-offset-1',
            dragId === node.id && 'opacity-40',
            !node.is_active && 'opacity-50'
          )}
        >
          <button
            type="button"
            onClick={() => toggleCollapse(node.id)}
            className={cn('shrink-0', !hasChildren && 'invisible')}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab opacity-70" />
          <span className="flex-1 truncate">{node.label}</span>
          {node.link_type === 'external' && (
            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
          )}
          <button
            type="button"
            aria-label={
              node.is_active ? `Hide ${node.label} from nav` : `Show ${node.label} in nav`
            }
            title={
              node.is_active
                ? 'Shown in the main menu — click to hide it (and its sub-items) from the main menu; the page stays reachable by URL'
                : 'Hidden from the main menu — click to show it again'
            }
            onClick={() => toggleVisibility(node)}
            className={cn(
              'flex h-4.5 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 text-[10px] leading-none',
              node.is_active ? 'bg-white text-primary' : 'bg-white/25'
            )}
          >
            {node.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Main menu
          </button>
          {isHeader &&
            (() => {
              const mirrored = Boolean(findFooterMirror(node))
              return (
                <button
                  type="button"
                  aria-label={
                    mirrored
                      ? `Remove ${node.label} from footer`
                      : `Also show ${node.label} on footer`
                  }
                  title={
                    mirrored
                      ? 'Also shown on the footer — click to remove it from the footer'
                      : 'Also show this in the footer menu'
                  }
                  onClick={() => toggleFooterMirror(node)}
                  className={cn(
                    'flex h-4.5 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 text-[10px] leading-none',
                    mirrored ? 'bg-white text-primary' : 'bg-white/25'
                  )}
                >
                  <Globe className="h-3 w-3" />
                  Footer
                </button>
              )
            })()}
          <button
            type="button"
            aria-label={
              node.no_page
                ? `Make ${node.label} clickable again`
                : `Make ${node.label} a non-clickable label`
            }
            title={
              node.no_page
                ? 'Label only — click to make it a link again'
                : 'Keep in nav (and its dropdown, if any) but make the label non-clickable'
            }
            onClick={() => toggleNoPage(node)}
            className={cn(
              'flex h-4.5 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 text-[10px] leading-none',
              node.no_page ? 'bg-white text-primary' : 'bg-white/25'
            )}
          >
            <Link2Off className="h-3 w-3" />
            No page
          </button>
          <button
            type="button"
            aria-label={`Edit ${node.label}`}
            title="Edit the label and link"
            onClick={() => setEditing(node)}
            className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/25 leading-none"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label={`Remove ${node.label}`}
            onClick={() => removeNavNode(node.id)}
            className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/25 leading-none"
          >
            ✕
          </button>
        </div>
        {isDropAfter && <div className="mx-2 h-0.5 rounded bg-primary" />}
        {hasChildren && !isCollapsed && (
          <div className="space-y-1.5 pt-1.5">
            {node.children.map((c) => renderNavRow(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
        disabled={isSavingNav}
        className="gap-1.5 px-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Button>

      <div>
        <h3 className="text-base font-semibold">
          {isHeader ? 'Website · Navigation' : 'Website · Footer navigation'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isHeader
            ? 'Choose the pages this platform\'s navigation should include, or add your own. Only the first 7 top-level items show in a header; any more go under a "More" dropdown.'
            : "The links in your website's footer. Add existing pages or your own links."}
        </p>
      </div>

      {/* Header and Footer are two separate menus; this switches which one the editor below changes. */}
      <div className="flex gap-2" role="tablist" aria-label="Menu">
        {(
          [
            ['header', 'Header menu'],
            ['footer', 'Footer menu'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={menuKey === key}
            disabled={isSavingNav}
            onClick={() => setMenuKey(key)}
            data-testid={`nav-tab-${key}`}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
              menuKey === key
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {!isHeader && (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <Switch
            checked={options?.footer_same_as_header === true}
            onCheckedChange={(v) => optionsMutation.mutate(v)}
            disabled={!options || optionsMutation.isPending}
            aria-label="Use the same links as the header menu"
            data-testid="footer-same-as-header"
          />
          <div className="text-sm">
            <p className="font-medium">Use the same links as the header menu</p>
            <p className="text-muted-foreground">
              {mirroredFooter
                ? 'The footer now shows the header menu. Turn this off to give the footer its own list.'
                : 'Off: the footer has its own list that you order separately.'}
            </p>
          </div>
        </div>
      )}

      {isHeader && tree.length > 7 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This menu has {tree.length} top-level items. The first 7 show in the header; the other{' '}
          {tree.length - 7} appear under &quot;More&quot;.
        </p>
      )}

      <div
        className={cn(
          'grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]',
          mirroredFooter && 'pointer-events-none select-none opacity-40'
        )}
        aria-disabled={mirroredFooter || undefined}
      >
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Pages</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {selectedLabels.length} selected
            </span>
          </div>
          {isHeader && (
            <>
              <p className="text-xs font-medium text-muted-foreground">Common pages — tap to add</p>
              <div className="flex flex-wrap gap-2">
                {[...SUGGESTED_PAGES, ...extras].map((name) => {
                  const on = selectedLabels.includes(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={isSavingNav}
                      onClick={() => togglePage(name)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        on ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'
                      )}
                    >
                      <span className="text-[11px]">{on ? '✓' : '+'}</span>
                      {name}
                    </button>
                  )
                })}
                {detailPageTypeStates.map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    disabled={isSavingNav || !r.hasPages}
                    onClick={() => r.sync()}
                    title={
                      !r.hasPages
                        ? `No ${r.parentLabel.toLowerCase()} pages yet — add entries in the ${r.parentLabel} module first`
                        : r.synced
                          ? `Every ${r.parentLabel.toLowerCase()} page is already linked under "${r.parentLabel}" in the nav`
                          : `Nest a real link to each ${r.parentLabel.toLowerCase()} page under "${r.parentLabel}" in the nav`
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      r.synced
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-dashed text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <span className="text-[11px]">{r.synced ? '✓' : '+'}</span>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Input
                  placeholder="Add a custom page (e.g. Case studies)"
                  value={customName}
                  disabled={isSavingNav}
                  onChange={(e) => {
                    setCustomName(e.target.value)
                    setCustomNameError(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomPage()}
                />
                <Button type="button" onClick={addCustomPage} disabled={isSavingNav}>
                  Add
                </Button>
              </div>
              {customNameError && <p className="text-xs text-destructive">{customNameError}</p>}
            </>
          )}

          {showExternalForm ? (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">External link</span>
                <button
                  type="button"
                  onClick={() => setShowExternalForm(false)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              </div>
              <Input
                placeholder="Label (e.g. Partner Portal)"
                value={externalLabel}
                disabled={isSavingNav}
                onChange={(e) => setExternalLabel(e.target.value)}
              />
              <Input
                placeholder="https://..."
                value={externalUrl}
                disabled={isSavingNav}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={externalNewTab}
                  onChange={(e) => setExternalNewTab(e.target.checked)}
                />
                Open in new tab
              </label>
              <Button
                type="button"
                size="sm"
                onClick={addExternalLink}
                disabled={isSavingNav || !externalLabel.trim() || !externalUrl.trim()}
              >
                Add external link
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowExternalForm(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />+ External link
            </button>
          )}

          <details className="rounded-md border p-3" open={!isHeader} data-testid="existing-pages">
            <summary className="cursor-pointer text-xs font-semibold">
              Existing pages ({existingPages.length})
            </summary>
            <div className="mt-2 max-h-56 space-y-1 overflow-auto">
              {existingPages.map((pg) => (
                <button
                  key={pg.id}
                  type="button"
                  disabled={isSavingNav}
                  onClick={() => addExistingPage(pg)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <span className="truncate">{pg.title}</span>
                  <span className="text-xs text-primary">+ Add</span>
                </button>
              ))}
              {existingPages.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Every existing page is already in this menu.
                </p>
              )}
            </div>
          </details>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Selected navigation</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                isSavingNav ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
              )}
            >
              {isSavingNav ? 'Saving…' : 'Live'}
            </span>
          </div>
          {isSavingNav && (
            <p className="text-xs text-amber-700">
              Saving your change — don&apos;t refresh or leave this step yet.
            </p>
          )}
          {tree.length > 0 ? (
            <>
              <p className="text-[11px] text-muted-foreground">
                Drag a page onto another to nest it (up to {NAV_MAX_DEPTH} levels); drag to the
                top/bottom edge of a row to reorder instead.
              </p>
              <div className="space-y-1.5">{tree.map((n) => renderNavRow(n, 1))}</div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              No pages yet — pick from the list or add your own.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {/* Changes save as you make them, so there is no Save button here. */}
        <Button
          type="button"
          variant="outline"
          onClick={onLayouts}
          disabled={isSavingNav}
          data-testid="nav-skip-layouts"
        >
          Skip to Layouts
        </Button>
        <Button type="button" onClick={onNext} disabled={isSavingNav} data-testid="nav-next">
          Next: Pages
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>

      <EditMenuItemModal
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(id, patch) => {
          setDirty(true)
          updateItemMutation.mutate({ id, ...patch })
        }}
      />
    </div>
  )
}
