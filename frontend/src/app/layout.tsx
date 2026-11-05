import type { Metadata } from 'next'
import { Inter, Sora } from 'next/font/google'
import './globals.css'
import './th-typography.css'
import './th-layout.css'
import './th-components.css'
import { Providers } from './providers'
import { WebVitals } from '@/components/WebVitals'
import { buildIdentityMetadata, fetchAppIdentity } from '@/lib/app-identity'
import { UUID_POLYFILL } from '@/lib/uuid-polyfill'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })

// Rendered per request (identity data itself is cached 60 s by fetch), so the first visit after a
// deploy or an identity change never serves a stale pre-rendered title.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return buildIdentityMetadata(await fetchAppIdentity())
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        {/* Must run before the app bundles: see lib/uuid-polyfill.ts */}
        <script dangerouslySetInnerHTML={{ __html: UUID_POLYFILL }} />
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
