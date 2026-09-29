import { describe, it, expect } from 'vitest'
import { construction } from '@/app/admin/page-builder/packs/construction'

/**
 * Regression test for the "Insert a block" / Section Builder variant-preview
 * gallery (insert-block-modal.tsx's BlockCard grid, blocks-panel.tsx's
 * SectionPickerPopup): both read `pack.variants[componentKey]` to decide how
 * many per-design cards to render. A component with a real 4-design `variant`
 * select field but no matching entry in `construction.variants` silently
 * shows only Design 1 in the gallery — exactly what happened to
 * ConstructionFooter and ConstructionSectorDetailList (both reachable via a
 * normal category: 'bottombar' and 'sectors' respectively) before this test
 * was added. general/index.tsx already documents having fixed the same class
 * of bug for Hero/NavBar/FeatureCards/Footer/TaglineStrip.
 *
 * This walks every component construction actually exposes through a
 * category (i.e. reachable from the gallery) and checks its declared
 * `variant` field options against `construction.variants` — so a future
 * component with the same oversight fails this test instead of shipping a
 * gallery that quietly hides its other designs.
 */
describe('construction pack variant gallery', () => {
  const categorizedKeys = new Set(
    Object.values(construction.categories ?? {}).flatMap((cat) => cat.components ?? [])
  )

  type FieldWithOptions = { type?: string; options?: { value: string }[] }

  for (const key of categorizedKeys) {
    const comp = (construction.components as Record<string, { fields?: Record<string, unknown> }>)[
      key
    ]
    const variantField = comp?.fields?.variant as FieldWithOptions | undefined
    if (variantField?.type !== 'select' || !variantField.options) continue
    if (variantField.options.length <= 1) continue

    it(`registers all ${variantField.options.length} designs of ${key} in blockVariants`, () => {
      const registered = construction.variants?.[key]
      expect(
        registered,
        `${key} has a multi-design variant field but no blockVariants entry`
      ).toBeDefined()
      expect(registered).toEqual(variantField.options!.map((o) => o.value))
    })
  }

  it('found at least one multi-design component to check (sanity: the loop above did not no-op)', () => {
    const checked = [...categorizedKeys].filter((key) => {
      const comp = (
        construction.components as Record<string, { fields?: Record<string, unknown> }>
      )[key]
      const variantField = comp?.fields?.variant as FieldWithOptions | undefined
      return variantField?.type === 'select' && (variantField.options?.length ?? 0) > 1
    })
    expect(checked.length).toBeGreaterThan(0)
  })
})
