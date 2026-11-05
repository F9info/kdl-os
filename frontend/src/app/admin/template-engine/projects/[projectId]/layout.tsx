'use client'

// The Template Engine "Studio" bar (title + Overview tab) is gone: every step now lives under
// CMS in the sidebar (Website Details, Color Palette, Brands, Pages). These routes still serve
// those CMS entries, so this layout only renders the page content.
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <main id="main-content" className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
