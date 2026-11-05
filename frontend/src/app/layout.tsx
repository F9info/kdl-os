import type { Metadata } from 'next'
import { Inter, Sora } from 'next/font/google'
import './globals.css'
import './th-typography.css'
import './th-layout.css'
import './th-components.css'
import { Providers } from './providers'
import { WebVitals } from '@/components/WebVitals'
import { buildIdentityMetadata, fetchAppIdentity } from '@/lib/app-identity'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })

export async function generateMetadata(): Promise<Metadata> {
  return buildIdentityMetadata(await fetchAppIdentity())
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
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
