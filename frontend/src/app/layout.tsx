import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import './te-typography.css'
import './te-layout.css'
import './te-components.css'
import { Providers } from './providers'
import { WebVitals } from '@/components/WebVitals'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'KDL Admin',
  description: 'KDL Starter Kit Admin Panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Body font comes from the Template Engine's Typography > Body token.
          It must be an inline style: next/font's generated class on <body>
          outranks the element selector in te-typography.css. The --te-typo-*
          alias is always defined there (with an Inter fallback), and
          inter.className stays so the fallback font is actually loaded. */}
      <body
        className={inter.className}
        style={{ fontFamily: 'var(--te-typo-body-family), ui-sans-serif, system-ui, sans-serif' }}
      >
        <WebVitals />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
