import type { Metadata } from 'next'

// A preview is for the person holding the link, never for search engines or caches.
export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false, follow: false, nocache: true },
}

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
