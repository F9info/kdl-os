import type { Metadata } from 'next'
import { Inter, Sora } from 'next/font/google'
import './globals.css'
import './te-typography.css'
import './te-layout.css'
import './te-components.css'
import { Providers } from './providers'
import { WebVitals } from '@/components/WebVitals'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })

export const metadata: Metadata = {
  title: 'KDL Admin',
  description: 'KDL Starter Kit Admin Panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      {/* Body font comes from the Template Engine's Typography > Body token.
          Inline style beats any class-level font-family. The --font-inter
          variable (next/font-optimised Inter) is the pre-hydration fallback
          so the correct font renders before the TE provider's first fetch. */}
      <body
        style={{
          fontFamily:
            'var(--te-typo-body-family, var(--font-inter)), ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <WebVitals />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
