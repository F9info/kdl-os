'use client'

import type { ComponentType } from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { useIdentity } from '@/hooks/useIdentity'
import { BRAND_LOGO_BLOCK_TYPES, brandProps, mergeIdentity } from '@/frontend/lib/apply-identity'

type Props = Record<string, unknown> & {
  puck?: { metadata?: { identity?: Record<string, string> } }
}

/**
 * The company name and logo of a header, footer or tagline block come from Application Identity, wherever the
 * block is drawn: the live site, the editor canvas, a preview. The values saved inside the page are only the
 * fallback for when Identity has nothing set. (applyIdentity does the same for whole pages; this covers every
 * surface that draws a block without going through it.)
 */
export function withLiveBrand<C extends ComponentConfig>(type: string, config: C): C {
  if (!BRAND_LOGO_BLOCK_TYPES.has(type)) return config
  const Inner = config.render as ComponentType<Props>
  function LiveBrand(props: Props) {
    const { identity } = useIdentity()
    // A landing page's own Branding arrives through the page metadata and wins over the project's Identity.
    const overlay = brandProps(mergeIdentity(identity, props.puck?.metadata?.identity))
    return <Inner {...props} {...overlay} />
  }
  return { ...config, render: LiveBrand } as C
}
