import type { Config } from '@puckeditor/core'

export interface ComponentPack {
  key: string
  label: string
  components: NonNullable<Config['components']>
  categories?: NonNullable<Config['categories']>
  /**
   * Component key -> ordered list of its `variant` prop values, for
   * components with an Odoo-style "Design 1-4" picker. Drives the "Insert a
   * block" modal's per-variant preview cards (InsertBlockModal.tsx) — a
   * component absent here is treated as single-variant (one card, no badge
   * suffix).
   */
  variants?: Record<string, string[]>
}
