'use client'

// GDG pack: the Google Developer Groups chapter website (ported from the GDG Vizag site) as page-builder
// blocks. Styles live in gdg.css, scoped under `.gdg`, so they never reach admin screens or other packs.
import './gdg.css'
import type { Config } from '@puckeditor/core'
import type { AnyBlock } from './lib'
import type { ComponentPack } from '../types'
import { GdgHeader, GdgFooter, GdgPageHead, GdgJoinBanner, GdgSoundToggle } from './chrome'
import { homeComponents } from './home'
import { eventsComponents } from './events'
import { communityComponents } from './community'
import { devfestComponents } from './devfest'
import { playComponents } from './play'

// A block stored with only some props (pages created by the GDG chapter preset store none) still
// renders its full default content: missing props fall back to the block's defaultProps.

function withDefaults(c: AnyBlock): AnyBlock {
  const defaults = (c.defaultProps ?? {}) as Record<string, unknown>
  const render = c.render
  return {
    ...c,
    render: (props: Record<string, unknown>) => {
      const merged: Record<string, unknown> = { ...defaults }
      for (const [k, v] of Object.entries(props)) if (v !== undefined && v !== null) merged[k] = v
      return render(merged as Parameters<typeof render>[0])
    },
  }
}

const raw: Record<string, AnyBlock> = {
  GdgHeader,
  GdgFooter,
  GdgPageHead,
  GdgJoinBanner,
  GdgSoundToggle,
  ...homeComponents,
  ...eventsComponents,
  ...communityComponents,
  ...devfestComponents,
  ...playComponents,
}

const components = Object.fromEntries(Object.entries(raw).map(([k, c]) => [k, withDefaults(c)]))

export const gdg: ComponentPack = {
  key: 'gdg',
  label: 'GDG chapter',
  components: components as NonNullable<Config['components']>,
  categories: {
    gdg: { title: 'GDG chapter', components: Object.keys(components) },
  },
}
