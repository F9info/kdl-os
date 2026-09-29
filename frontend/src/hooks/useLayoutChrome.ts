import type { ReactNode } from 'react'
import { construction } from '@/app/admin/page-builder/packs/construction'
import {
  footerOverrides,
  headerFooterOverrides,
  mergeLayoutSelection,
  readLocal,
  topHeaderOverrides,
  websiteLayoutStorageKey,
  type LayoutSelection,
} from '@/lib/website-layout-overrides'
import { useWebsiteBrandContext } from './useWebsiteBrandContext'

type BlockRender = (props: Record<string, unknown>) => ReactNode
const TOP_HEADER_CONFIG = construction.components.ConstructionTopBar!
const HEADER_CONFIG = construction.components.ConstructionHeader!
const FOOTER_CONFIG = construction.components.ConstructionFooter!

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

  if (!projectId) return { topHeaderNode: null, headerNode: null, footerNode: null }

  const topHeaderRender = TOP_HEADER_CONFIG.render as BlockRender
  const headerRender = HEADER_CONFIG.render as BlockRender
  const footerRender = FOOTER_CONFIG.render as BlockRender

  return {
    topHeaderNode: selection.topHeader.enabled
      ? topHeaderRender({
          ...TOP_HEADER_CONFIG.defaultProps,
          ...topHeaderOverrides(brand),
          variant: selection.topHeader.variant,
        })
      : null,
    headerNode: selection.header.enabled
      ? headerRender({
          ...HEADER_CONFIG.defaultProps,
          ...headerFooterOverrides(brand),
          variant: selection.header.variant,
          puck: { isEditing: true, metadata: { projectId } },
        })
      : null,
    footerNode: selection.footer.enabled
      ? footerRender({
          ...FOOTER_CONFIG.defaultProps,
          ...footerOverrides(brand),
          variant: selection.footer.variant,
        })
      : null,
  }
}
