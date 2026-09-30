'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  PanelTop,
  LayoutTemplate,
  GalleryHorizontal,
  Sparkles,
  BarChart3,
  UserCircle,
  Video,
  Newspaper,
  Users,
  Briefcase,
  HelpCircle,
  MessageSquareQuote,
  ClipboardList,
  Megaphone,
  PanelBottom,
  Share2,
} from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ComposerCanvas } from '../packs/composer/ComposerCanvas'
import { getDefaultProjectId } from '../packs/composer/custom-blocks-store'

/** The 16-category taxonomy from templateEnginesections.html — same names as
 *  the in-editor "Insert a block" section picker (puck.config.tsx /
 *  blocks-panel.tsx), reused here as a landing picker since this route has
 *  no live Puck instance to derive categories from. */
const SECTION_CATEGORIES = [
  { key: 'top-bar', label: 'Top Header', icon: PanelTop },
  { key: 'header', label: 'Header', icon: LayoutTemplate },
  { key: 'hero-slider', label: 'Hero Slider', icon: GalleryHorizontal },
  { key: 'welcome', label: 'Welcome', icon: Sparkles },
  { key: 'counters', label: 'Counters', icon: BarChart3 },
  { key: 'founder', label: 'Founder', icon: UserCircle },
  { key: 'video', label: 'Video', icon: Video },
  { key: 'blog-posts', label: 'Blog Posts', icon: Newspaper },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'services', label: 'Services', icon: Briefcase },
  { key: 'faq', label: 'FAQ', icon: HelpCircle },
  { key: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
  { key: 'forms', label: 'Forms', icon: ClipboardList },
  { key: 'cta', label: 'Call to Action', icon: Megaphone },
  { key: 'footer', label: 'Footer', icon: PanelBottom },
  { key: 'social-media', label: 'Social Media', icon: Share2 },
] as const

/**
 * Section Builder — a real, full-page screen for building a brand-new custom
 * section from atomic elements (heading, paragraph, button, image, layout,
 * testimonial, ...), reached via any "Insert a block" flow's "Create new"
 * card, or directly from the admin sidebar. Not a modal: it has its own URL,
 * survives a refresh, and the browser back button returns to wherever it was
 * opened from (`returnTo`).
 *
 * `category` pins which block category the finished section will be filed
 * under (so it shows up back in that category's Insert-a-block picker). When
 * it's absent — the sidebar link and the bare URL both omit it — this shows
 * a category picker first instead of guessing 'content'; picking a card
 * re-navigates to this same route with `?category=<key>` set.
 * `projectId` carries the single-project scoping key transparently — the
 * operator never sees or picks it (see KDL "no projects concept" removal);
 * falls back to the one default project when the caller has none in scope.
 */
export default function SectionBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get('category')
  // Open-redirect guard: `returnTo` is caller-controlled (query param) and
  // fed straight to router.push — must be a same-origin admin path, never
  // an absolute/protocol-relative URL (`//evil.com`, `https://evil.com`)
  // that a crafted link could use to bounce an admin off-site on close/save.
  const rawReturnTo = searchParams.get('returnTo') ?? ''
  const returnTo =
    rawReturnTo.startsWith('/admin/') && !rawReturnTo.startsWith('//')
      ? rawReturnTo
      : '/admin/template-engine'
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '')

  useEffect(() => {
    if (!category || projectId) return
    getDefaultProjectId().then(setProjectId)
  }, [category, projectId])

  if (!category) {
    return (
      <ModuleGuard slug="page-builder">
        <div className="mx-auto max-w-5xl p-8">
          <h1 className="mb-1 text-xl font-bold">Section Builder</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Pick what kind of section you want to build.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {SECTION_CATEGORIES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => router.push(`/admin/page-builder/section-builder?category=${key}`)}
                className="flex flex-col items-center gap-2.5 rounded-lg border border-border bg-card py-6 text-card-foreground transition hover:border-primary hover:text-primary"
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </ModuleGuard>
    )
  }

  return (
    <ModuleGuard slug="page-builder">
      {/* z-[2100] matches BlockComposer.tsx's own full-screen composer overlay —
          anything lower (e.g. the shared Dialog's z-50) renders behind this
          page and is invisible even though it's mounted, like the MediaPicker
          opened from the Image URL field's Upload button. */}
      <div className="fixed inset-0 z-[2100]">
        {projectId ? (
          <ComposerCanvas
            projectId={projectId}
            categoryKey={category}
            onClose={() => router.push(returnTo)}
            onSaved={() => router.push(returnTo)}
          />
        ) : (
          <LoadingSpinner fullPage />
        )}
      </div>
    </ModuleGuard>
  )
}
