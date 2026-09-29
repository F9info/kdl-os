export const MAX_DEPTH = 3

export interface MenuItemNode {
  id: string
  parent_id: string | null
  label: string
  link_type: 'page' | 'custom' | 'external'
  page_id: string | null
  url: string | null
  open_in_new_tab: boolean
  is_active: boolean
  no_page: boolean
  order: number
  children: MenuItemNode[]
}

/** Depth of a node within its own subtree — a root node is depth 1. */
export function depthOf(node: MenuItemNode): number {
  if (node.children.length === 0) return 1
  return 1 + Math.max(...node.children.map(depthOf))
}

/** How many levels a node's own subtree is tall (1 = leaf, matches depthOf). */
function subtreeHeight(node: MenuItemNode): number {
  return depthOf(node)
}

/** Depth of `targetId` counting from the tree's roots (root = 1). */
function depthFromRoot(roots: MenuItemNode[], targetId: string, current = 1): number | null {
  for (const node of roots) {
    if (node.id === targetId) return current
    const found = depthFromRoot(node.children, targetId, current + 1)
    if (found !== null) return found
  }
  return null
}

/** Removes `id` from wherever it sits in the tree, returning the removed node (or null). */
function removeNode(roots: MenuItemNode[], id: string): MenuItemNode | null {
  for (let i = 0; i < roots.length; i++) {
    const node = roots[i]
    if (node && node.id === id) return roots.splice(i, 1)[0] ?? null
  }
  for (const node of roots) {
    const removed = removeNode(node.children, id)
    if (removed) return removed
  }
  return null
}

function findNode(roots: MenuItemNode[], id: string): MenuItemNode | null {
  for (const node of roots) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return null
}

/** True if `ancestorId` is `id` itself or contains it anywhere in its subtree — used to refuse dropping a node onto/inside its own descendant. */
function isSelfOrDescendant(node: MenuItemNode, id: string): boolean {
  if (node.id === id) return true
  return node.children.some((c) => isSelfOrDescendant(c, id))
}

export type DropZone = 'before' | 'after' | 'inside'

/**
 * Moves `dragId` relative to `targetId` (before/after as a sibling at the
 * target's own level, or inside as the target's last child) and renumbers
 * `order` at every affected level. Returns a new tree (deep-cloned) — never
 * mutates the input — or `null` if the move is illegal (dropping onto
 * itself/its own descendant, or would exceed MAX_DEPTH).
 */
export function moveNode(
  tree: MenuItemNode[],
  dragId: string,
  targetId: string,
  zone: DropZone
): MenuItemNode[] | null {
  if (dragId === targetId) return null
  const cloned: MenuItemNode[] = JSON.parse(JSON.stringify(tree))
  const dragNode = findNode(cloned, dragId)
  if (!dragNode) return null
  if (isSelfOrDescendant(dragNode, targetId)) return null // can't drop onto own descendant

  const dragHeight = subtreeHeight(dragNode)

  if (zone === 'inside') {
    const targetDepth = depthFromRoot(cloned, targetId)
    if (targetDepth === null) return null
    if (targetDepth + dragHeight > MAX_DEPTH) return null
    removeNode(cloned, dragId)
    const target = findNode(cloned, targetId)
    if (!target) return null
    dragNode.parent_id = target.id
    dragNode.order = target.children.length
    target.children.push(dragNode)
    return cloned
  }

  // before/after — becomes a sibling at the target's own level.
  removeNode(cloned, dragId)
  const target = findNode(cloned, targetId)
  if (!target) return null
  const targetParentDepth = target.parent_id ? depthFromRoot(cloned, target.parent_id) : 0
  if ((targetParentDepth ?? 0) + dragHeight > MAX_DEPTH) return null
  dragNode.parent_id = target.parent_id

  const siblings = target.parent_id ? findNode(cloned, target.parent_id)!.children : cloned
  const targetIndex = siblings.findIndex((s) => s.id === targetId)
  const insertAt = zone === 'before' ? targetIndex : targetIndex + 1
  siblings.splice(insertAt, 0, dragNode)

  renumber(cloned)
  return cloned
}

function renumber(nodes: MenuItemNode[]) {
  nodes.forEach((node, i) => {
    node.order = i
    renumber(node.children)
  })
}

/** Flattens the tree into the {id, parent_id, order}[] shape the reorder API expects. */
export function flattenForApi(
  nodes: MenuItemNode[]
): { id: string; parent_id: string | null; order: number }[] {
  const out: { id: string; parent_id: string | null; order: number }[] = []
  const walk = (list: MenuItemNode[]) => {
    for (const node of list) {
      out.push({ id: node.id, parent_id: node.parent_id, order: node.order })
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}
