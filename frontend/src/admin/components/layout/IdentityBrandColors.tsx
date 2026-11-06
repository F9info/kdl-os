'use client'

import { useEffect } from 'react'
import { useIdentity } from '@/hooks/useIdentity'
import { readableOn } from '@/app/admin/theme-engine/simple/palette'

const STYLE_ID = 'kdl-identity-brand'
const HEX = /^#[0-9a-f]{6}$/i

/**
 * The CSS that makes the admin app use the colours set in Settings > Identity: the primary colour
 * drives every primary button, link and focus ring (Tailwind `primary` reads this token), the
 * secondary colour the `secondary` token. The button label switches to white or near-black,
 * whichever reads on the primary. Empty or invalid colours emit nothing, so the Theme Engine's own
 * values stay in force. `:root[data-theme]` outranks the Theme Engine's `:root` and
 * `[data-theme="light"]` blocks whatever order the style tags were added in.
 */
export function identityBrandCss(primary?: string, secondary?: string): string {
  const vars: string[] = []
  if (primary && HEX.test(primary)) {
    vars.push(`--branding_brand_colors_primary_color:${primary}`)
    vars.push(`--buttons_primary_button_text_color:${readableOn(primary)}`)
  }
  if (secondary && HEX.test(secondary))
    vars.push(`--branding_brand_colors_secondary_color:${secondary}`)
  return vars.length ? `:root[data-theme]{${vars.join(';')}}` : ''
}

// Renders nothing: keeps one <style> tag in sync with the identity colours.
export function IdentityBrandColors() {
  const { identity } = useIdentity()
  const css = identityBrandCss(identity.brand_primary, identity.brand_secondary)

  useEffect(() => {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!css) {
      el?.remove()
      return
    }
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ID
      document.head.appendChild(el)
    }
    el.textContent = css
  }, [css])

  return null
}
