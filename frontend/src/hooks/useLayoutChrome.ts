import { createElement, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ComposerProjectContext } from '@/app/admin/page-builder/packs/composer/atoms'
import { renderComposedBlock } from '@/app/admin/page-builder/packs/composer/render-composed-block'
import { listCustomBlocks } from '@/app/admin/page-builder/packs/composer/custom-blocks-store'
import { construction } from '@/app/admin/page-builder/packs/construction'
import {
  footerOverrides,
  headerFooterOverrides,
  mergeLayoutSelection,
  customBlockIdOf,
  readLocal,
  type SectionVariant,
  topHeaderOverrides,
  websiteLayoutStorageKey,
  type LayoutSelection,
} from '@/lib/website-layout-overrides'
import { useWebsiteBrandContext } from './useWebsiteBrandContext'

type BlockRender = (props: Record<string, unknown>) => ReactNode
const TOP_HEADER_CONFIG = construction.components.ConstructionTopBar!
const HEADER_CONFIG = construction.components.ConstructionHeader!
const FOOTER_CONFIG = construction.components.ConstructionFooter!

/** The saved Section Builder block picked for a layout slot (variant
 *  `custom:<id>`), rendered live from the DB — null for a fixed design. */
export function useCustomSlotNode(
  projectId: string | null,
  category: 'top-bar' | 'header' | 'footer',
  variant: SectionVariant
): ReactNode | null {
  const id = customBlockIdOf(variant)
  const { data } = useQuery({
    queryKey: ['custom-blocks', projectId, category],
    queryFn: () => listCustomBlocks(projectId ?? undefined, category),
    enabled: Boolean(projectId && id),
  })
  const block = id ? data?.find((b) => b.id === id) : undefined
  if (!block) return null
  return createElement(
    ComposerProjectContext.Provider,
    { value: projectId ?? undefined },
    renderComposedBlock(block.config)
  )
}

// Renders a project's actual Top Header/Header/Footer — whatever design is
// picked on the Layout page — as plain (non-Puck, non-editable) React
// nodes. Used to show the real chrome around a page's content without
// letting it be edited or duplicated from inside that page's own editor;
// the Layout page (website/layout) is the only place that changes it.
export function useLayoutChrome(projectId: string | null): {
  topHeaderNode: ReactNode | null
  headerNode: ReactNode | null
  footerNode: ReactNode | null
} {
  const brand = useWebsiteBrandContext(projectId ?? '')
  const selection: LayoutSelection = projectId
    ? mergeLayoutSelection(
        readLocal<Partial<LayoutSelection>>(websiteLayoutStorageKey(projectId), {})
      )
    : {
        topHeader: { enabled: false, variant: '1' },
        header: { enabled: false, variant: '1' },
        footer: { enabled: false, variant: '1' },
      }

  const customTop = useCustomSlotNode(projectId, 'top-bar', selection.topHeader.variant)
  const customHeader = useCustomSlotNode(projectId, 'header', selection.header.variant)
  const customFooter = useCustomSlotNode(projectId, 'footer', selection.footer.variant)

  if (!projectId) return { topHeaderNode: null, headerNode: null, footerNode: null }

  const topHeaderRender = TOP_HEADER_CONFIG.render as BlockRender
  const headerRender = HEADER_CONFIG.render as BlockRender
  const footerRender = FOOTER_CONFIG.render as BlockRender

  return {
    topHeaderNode: selection.topHeader.enabled
      ? (customTop ??
        topHeaderRender({
          ...TOP_HEADER_CONFIG.defaultProps,
          ...topHeaderOverrides(brand),
          variant: selection.topHeader.variant,
        }))
      : null,
    headerNode: selection.header.enabled
      ? (customHeader ??
        headerRender({
          ...HEADER_CONFIG.defaultProps,
          ...headerFooterOverrides(brand),
          variant: selection.header.variant,
          puck: { isEditing: true, metadata: { projectId } },
        }))
      : null,
    footerNode: selection.footer.enabled
      ? (customFooter ??
        footerRender({
          ...FOOTER_CONFIG.defaultProps,
          ...footerOverrides(brand),
          variant: selection.footer.variant,
        }))
      : null,
  }
}
