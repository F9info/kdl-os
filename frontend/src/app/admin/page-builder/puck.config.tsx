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

// Temporary: "Insert a block" picker pared down to one category while
// building the construction homepage section-by-section — every other
// category (Layout, Content, Construction — Sections/CTA & Stats/Homepage,
// Clinic template, Hero, Services & Departments, Team, Patient, Calls to
// Action, ...) is hidden app-wide, for every pack and every page. This does
// NOT remove any component — `composed.components` is untouched, so every
// already-seeded page (medical, general, construction) still renders fine.
// It only shrinks what's browsable/searchable in the picker. Revert by
// restoring `categories: composed.categories` below once done.
export const config: Config = {
  ...composed,
  categories: {
    'header-top': { title: 'header-top', components: ['ConstructionHeader'] },
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
