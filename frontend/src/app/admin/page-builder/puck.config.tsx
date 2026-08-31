import type { Config, Data } from '@puckeditor/core'
import type { ReactNode } from 'react'
import { composePacks } from './packs/compose'
import { composer } from './packs/composer'
import { construction } from './packs/construction'
import { general } from './packs/general'
import { medical } from './packs/medical'

/**
 * KDL Page Builder — single source of truth for editor and public renderer.
 *
 * Both surfaces import `config` from this file:
 *   editor:   <Puck config={config} />    (admin/page-builder/[id]/page.tsx)
 *   renderer: <Render config={config} />  (app/p/[slug]/page.tsx)
 *
 * Component blocks live in packs/. Add new packs by importing and including
 * them in the composePacks call below — no second Puck instance, ever.
 */

const root: Config['root'] = {
  fields: { title: { type: 'text' } },
  defaultProps: { title: 'Untitled page' },
  render: ({ children }: { children: ReactNode }) => (
    <main className="min-h-screen bg-white text-slate-900">{children}</main>
  ),
}

const composed = composePacks(root, [general, construction, medical, composer])

// Construction's header/top-bar/hero blocks each ship multiple selectable
// designs (Insert-a-block picker: one card per design) — pulled into their
// own top-level categories so picking one shows just its own designs,
// instead of being buried inside the construction pack's own grouping.
// Every other category from every pack (Layout, Content, Construction —
// Sections/CTA & Stats/Homepage, Clinic template, Services & Departments,
// Team, Patient, Calls to Action, ...) stays exactly as each pack defines
// it — none of that was ever removed, only these 3 keys are added/renamed.
export const config: Config = {
  ...composed,
  categories: {
    ...composed.categories,
    'top-bar': { title: 'Top Bar', components: ['ConstructionTopBar'] },
    header: { title: 'Header', components: ['ConstructionHeader'] },
    hero: { title: 'Hero', components: ['ConstructionHero'] },
  },
}

/**
 * Component key -> ordered `variant` values, merged from every pack. Powers
 * the "Insert a block" modal's per-variant preview cards.
 */
export const blockVariants: Record<string, string[]> = {
  ...general.variants,
  ...construction.variants,
  ...medical.variants,
}

export const emptyData: Data = {
  root: { props: { title: 'Untitled page' } },
  content: [],
  zones: {},
}

export default config
