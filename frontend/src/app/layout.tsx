import type { Metadata } from 'next'
import {
  Bricolage_Grotesque,
  Fraunces,
  Inter,
  Lobster,
  Playfair_Display,
  Poppins,
  Sora,
} from 'next/font/google'
import './globals.css'
import './th-typography.css'
import './th-layout.css'
import './th-components.css'
import { Providers } from './providers'
import { WebVitals } from '@/components/WebVitals'
import { buildIdentityMetadata, fetchAppIdentity } from '@/frontend/lib/app-identity'
import { UUID_POLYFILL } from '@/lib/uuid-polyfill'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })

// Display and body fonts of the Landing blocks (packs/landing/fonts.ts). Self-hosted by next/font, so
// the font-src 'self' policy holds. Their files are only fetched by pages that actually use them.
const lobster = Lobster({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-lobster',
  preload: false,
})
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', preload: false })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  preload: false,
})
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  preload: false,
})
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  preload: false,
})
const landingFontVars = [lobster, fraunces, playfair, bricolage, poppins]
  .map((f) => f.variable)
  .join(' ')

// Rendered per request (identity data itself is cached 60 s by fetch), so the first visit after a
// deploy or an identity change never serves a stale pre-rendered title.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return buildIdentityMetadata(await fetchAppIdentity())
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable} ${landingFontVars}`}
      suppressHydrationWarning
    >
      <head>
        {/* Must run before the app bundles: see lib/uuid-polyfill.ts */}
        <script dangerouslySetInnerHTML={{ __html: UUID_POLYFILL }} />
        {/* "Convert to Static Website": the theme is a plain CSS file in the folder (see static-build.js),
            so the finished site needs no server for its colours and fonts. */}
        {process.env.NEXT_PUBLIC_STATIC_SITE === '1' && (
          // eslint-disable-next-line @next/next/no-css-tags -- a plain file next to the pages, by design
          <link rel="stylesheet" href="/th-tokens.css" />
        )}
      </head>
      {/* Body font comes from the Theme Engine's Typography > Body token.
          Inline style beats any class-level font-family. The --font-inter
          variable (next/font-optimised Inter) is the pre-hydration fallback
          so the correct font renders before the TE provider's first fetch. */}
      {/* data-gramm* / data-enable-grammarly: opt out of Grammarly, which decorates
          arbitrary elements (contenteditable, cursor styles) before hydration and
          triggers dev-only hydration-mismatch overlays. */}
      <body
        suppressHydrationWarning
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        style={{
          fontFamily:
            'var(--th-typo-body-family, var(--font-inter)), ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <WebVitals />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
