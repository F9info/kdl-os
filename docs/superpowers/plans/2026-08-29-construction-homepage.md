# Construction Pack Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, real "Home" page for the `construction` Puck pack — 3 components reused as-is, 3 adapted, 10 built new — and wire it into `seedConstructionPageData` so it ships as committed, reproducible seed content instead of something built by hand in the editor.

**Architecture:** Everything lives in the existing single-file pack `frontend/src/app/admin/page-builder/packs/construction/index.tsx` (flat-per-item-field convention, inline SVG icons, no new npm deps) plus `backend/src/modules/template-engine/drivers/website-seed-content.js` (seed wiring). No new files. Puck merges every pack into one flat component registry via `composePacks()`, so new component keys just need adding to `typedComponents`/`typedCategories` in that one file — no changes to `compose.ts` or `puck.config.tsx`.

**Tech Stack:** Next.js 15 + TypeScript 5 (frontend), Node/Express (backend seed driver), TailwindCSS (all styling), inline SVG icons (no icon library), a small `IntersectionObserver`-based hook (no AOS), React `useState`/`useEffect`/`useRef` for the header's mobile menu, the products tab filter, the clients pagination, and the FAQ accordion — legal here because the entire render tree (`app/p/[slug]/page.tsx`) is already a top-level `'use client'` component, so no portal or extra `'use client'` directive is needed for `position: fixed` or hooks to work.

---

## Decisions carried over from the design spec (not re-litigated here)

- Images: the codebase already replaced `placehold.co` with an inline SVG `dummyImage(w, h, label)` data-URI helper (see `website-seed-content.js` — comment explicitly says this was done *because* `placehold.co` requires network access and can fail under CSP). This plan uses `dummyImage()` everywhere for consistency with every other seeder, not literal `placehold.co` URLs.
- Buttons: pack convention is a solid `bg-orange-500 hover:bg-orange-600` accent, not a gradient. This plan keeps that convention for the "Get a Quote" / primary CTAs instead of introducing a one-off gradient utility class used nowhere else in the pack.
- No `variants` map entries for any new component — the construction pack doesn't use Puck's variant-picker pattern at all (confirmed: `construction.ts`'s `ComponentPack` has no `variants` key). New components follow the same single-variant convention as the 11 existing ones.
- `ConstructionHeader` and `ConstructionFooter` both carry a `links` prop in the exact same pipe-delimited (`Label|href`, newline-joined) format `NavBar`/`Footer`/`MedicalTopNav` already use, and both get registered in `NAV_LINK_PROP_BY_BLOCK_TYPE` (Task 15) — this is what makes the existing nav-staleness-fix (`patchNavLinks`) keep working automatically for construction Home pages on re-runs, with zero new code needed there.
- Changing `ConstructionHero`'s prop shape (Task 2) also touches `about`/`contact`/generic-fallback seed content (Task 15) — those pages use the *same* `ConstructionHero` component type, so leaving their seed props in the old shape would silently break their rendered hero (empty slider, no badge). This is called out explicitly in Task 15 so it isn't missed.

---

### Task 1: Shared scroll-reveal hook + icon-key lookup (setup)

**Files:**
- Modify: `frontend/src/app/admin/page-builder/packs/construction/index.tsx:1-8` (imports) and after line 225 (icon definitions)

- [ ] **Step 1: Add React hook imports**

Change line 1 from:

```tsx
import type { Config } from '@puckeditor/core'
```

to:

```tsx
import type { Config } from '@puckeditor/core'
import { useState, useEffect, useRef } from 'react'
```

- [ ] **Step 2: Add the scroll-reveal hook and the icon-key lookup right after the `StarIcon` function (currently ending at line 225, right before the `// ── components ──` comment)**

```tsx
type IconKey = 'hardhat' | 'shield' | 'star'

const ICON_BY_KEY: Record<IconKey, () => JSX.Element> = {
  hardhat: HardHatIcon,
  shield: CheckShieldIcon,
  star: StarIcon,
}

const REVEAL_BASE = 'transition-all duration-700 ease-out'

function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return {
    ref,
    revealCls: `${REVEAL_BASE} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`,
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors (the two new symbols are unused until later tasks reference them — TypeScript won't complain about unused top-level exports/consts, only unused local vars, so this passes clean).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add shared scroll-reveal hook and icon lookup"
```

---

### Task 2: Adapt `ConstructionHero` — two-column split with slider

**Files:**
- Modify: `frontend/src/app/admin/page-builder/packs/construction/index.tsx:12-21` (type), `:230-307` (fields/defaultProps/render)

- [ ] **Step 1: Replace the `ConstructionHero` type entry (lines 12-21)**

```tsx
  ConstructionHero: {
    badgeText: string
    headline: string
    highlightWord: string
    subheadline: string
    ctaLabel: string
    ctaHref: string
    secondaryLabel: string
    secondaryHref: string
    avatar1: string
    avatar2: string
    avatar3: string
    trustText: string
    slide1Image: string
    slide1Tag: string
    slide1Title: string
    slide1Subtitle: string
    slide2Image: string
    slide2Tag: string
    slide2Title: string
    slide2Subtitle: string
    slide3Image: string
    slide3Tag: string
    slide3Title: string
    slide3Subtitle: string
    slide4Image: string
    slide4Tag: string
    slide4Title: string
    slide4Subtitle: string
    slide5Image: string
    slide5Tag: string
    slide5Title: string
    slide5Subtitle: string
  }
```

- [ ] **Step 2: Replace the whole `ConstructionHero` component entry (lines 230-307) with:**

```tsx
  // 1. Hero section
  ConstructionHero: {
    label: 'Construction Hero',
    fields: {
      badgeText: { type: 'text' },
      headline: { type: 'text' },
      highlightWord: { type: 'text' },
      subheadline: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      secondaryLabel: { type: 'text' },
      secondaryHref: { type: 'text' },
      avatar1: { type: 'text' },
      avatar2: { type: 'text' },
      avatar3: { type: 'text' },
      trustText: { type: 'text' },
      slide1Image: { type: 'text' },
      slide1Tag: { type: 'text' },
      slide1Title: { type: 'text' },
      slide1Subtitle: { type: 'textarea' },
      slide2Image: { type: 'text' },
      slide2Tag: { type: 'text' },
      slide2Title: { type: 'text' },
      slide2Subtitle: { type: 'textarea' },
      slide3Image: { type: 'text' },
      slide3Tag: { type: 'text' },
      slide3Title: { type: 'text' },
      slide3Subtitle: { type: 'textarea' },
      slide4Image: { type: 'text' },
      slide4Tag: { type: 'text' },
      slide4Title: { type: 'text' },
      slide4Subtitle: { type: 'textarea' },
      slide5Image: { type: 'text' },
      slide5Tag: { type: 'text' },
      slide5Title: { type: 'text' },
      slide5Subtitle: { type: 'textarea' },
    },
    defaultProps: {
      badgeText: 'Trusted General Contractor',
      headline: 'Building Your Vision, On Time & On Budget',
      highlightWord: 'Vision',
      subheadline:
        'Award-winning general contractor serving residential and commercial clients across the region. Licensed, insured, and safety-certified.',
      ctaLabel: 'Get a Free Quote',
      ctaHref: '#quote',
      secondaryLabel: 'See Our Work',
      secondaryHref: '#projects',
      avatar1: 'https://placehold.co/80x80/475569/ffffff?text=C1',
      avatar2: 'https://placehold.co/80x80/334155/ffffff?text=C2',
      avatar3: 'https://placehold.co/80x80/1e293b/ffffff?text=C3',
      trustText: '500+ clients trust us',
      slide1Image: 'https://placehold.co/900x700/475569/ffffff?text=Project+One',
      slide1Tag: 'Residential',
      slide1Title: 'Riverside Villas',
      slide1Subtitle: 'A 24-unit residential development delivered ahead of schedule.',
      slide2Image: 'https://placehold.co/900x700/334155/ffffff?text=Project+Two',
      slide2Tag: 'Commercial',
      slide2Title: 'Tech Park Phase 2',
      slide2Subtitle: 'A 6-storey commercial office park with LEED-aligned design.',
      slide3Image: 'https://placehold.co/900x700/1e293b/ffffff?text=Project+Three',
      slide3Tag: 'Infrastructure',
      slide3Title: 'Highway Bridge Rehab',
      slide3Subtitle: 'Structural rehabilitation completed with zero traffic disruption.',
      slide4Image: 'https://placehold.co/900x700/0f172a/ffffff?text=Project+Four',
      slide4Tag: 'Institutional',
      slide4Title: 'School Expansion Wing',
      slide4Subtitle: 'A new academic wing built during active term time.',
      slide5Image: 'https://placehold.co/900x700/14532d/ffffff?text=Project+Five',
      slide5Tag: 'Industrial',
      slide5Title: 'Industrial Warehouse',
      slide5Subtitle: 'A 90,000 sq ft warehouse and logistics facility.',
    },
    render: ({
      badgeText,
      headline,
      highlightWord,
      subheadline,
      ctaLabel,
      ctaHref,
      secondaryLabel,
      secondaryHref,
      avatar1,
      avatar2,
      avatar3,
      trustText,
      slide1Image,
      slide1Tag,
      slide1Title,
      slide1Subtitle,
      slide2Image,
      slide2Tag,
      slide2Title,
      slide2Subtitle,
      slide3Image,
      slide3Tag,
      slide3Title,
      slide3Subtitle,
      slide4Image,
      slide4Tag,
      slide4Title,
      slide4Subtitle,
      slide5Image,
      slide5Tag,
      slide5Title,
      slide5Subtitle,
    }) => {
      const [activeSlide, setActiveSlide] = useState(0)
      const slides = [
        { image: slide1Image, tag: slide1Tag, title: slide1Title, subtitle: slide1Subtitle },
        { image: slide2Image, tag: slide2Tag, title: slide2Title, subtitle: slide2Subtitle },
        { image: slide3Image, tag: slide3Tag, title: slide3Title, subtitle: slide3Subtitle },
        { image: slide4Image, tag: slide4Tag, title: slide4Title, subtitle: slide4Subtitle },
        { image: slide5Image, tag: slide5Tag, title: slide5Title, subtitle: slide5Subtitle },
      ].filter((s) => s.image)
      const slide = slides[Math.min(activeSlide, Math.max(slides.length - 1, 0))]
      const headlineParts =
        highlightWord && headline.includes(highlightWord) ? headline.split(highlightWord) : [headline, '']
      const avatars = [avatar1, avatar2, avatar3].filter(Boolean)
      return (
        <section className="bg-white py-14 md:py-20">
          <div className={`${wrap} grid grid-cols-1 md:grid-cols-2 gap-10 items-center`}>
            <div>
              {badgeText && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-semibold px-3 py-1 mb-5">
                  {badgeText}
                </span>
              )}
              <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-5">
                {headlineParts[0]}
                {highlightWord && <span className="text-orange-500">{highlightWord}</span>}
                {headlineParts[1]}
              </h1>
              <p className="text-slate-600 text-base md:text-lg mb-8 max-w-lg">{subheadline}</p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                {ctaLabel && (
                  <a
                    href={ctaHref}
                    className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-7 py-3.5 text-white font-semibold hover:bg-orange-600 transition text-base"
                  >
                    {ctaLabel}
                  </a>
                )}
                {secondaryLabel && (
                  <a
                    href={secondaryHref}
                    className="inline-flex items-center justify-center rounded-lg border-2 border-slate-300 px-7 py-3.5 text-slate-900 font-semibold hover:bg-slate-50 transition text-base"
                  >
                    {secondaryLabel}
                  </a>
                )}
              </div>
              {avatars.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {avatars.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="w-9 h-9 rounded-full border-2 border-white object-cover"
                      />
                    ))}
                  </div>
                  {trustText && <p className="text-sm text-slate-600">{trustText}</p>}
                </div>
              )}
            </div>
            <div>
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100">
                {slide?.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {slide && (slide.title || slide.subtitle) && (
                  <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/90 backdrop-blur p-4">
                    {slide.tag && (
                      <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">
                        {slide.tag}
                      </span>
                    )}
                    <p className="font-semibold text-slate-900">{slide.title}</p>
                    {slide.subtitle && <p className="text-xs text-slate-600 mt-0.5">{slide.subtitle}</p>}
                  </div>
                )}
              </div>
              {slides.length > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setActiveSlide(i)}
                      className={`w-2.5 h-2.5 rounded-full transition ${
                        i === activeSlide ? 'bg-orange-500' : 'bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes. (`useState` is already imported from Task 1.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): adapt ConstructionHero to two-column split with slider"
```

---

### Task 3: New `ConstructionHeader` — sticky, mobile slide-out

**Files:**
- Modify: `frontend/src/app/admin/page-builder/packs/construction/index.tsx` — add a new type entry to `ConstructionProps` (after `ConstructionSafetyRecord`, before the closing `}` of the type block, i.e. after what is currently line 175) and a new component entry to `typedComponents` (add right after the `ConstructionHero` entry from Task 2, before `ConstructionServicesGrid`)

- [ ] **Step 1: Add the type entry**

```tsx
  ConstructionHeader: {
    brand: string
    logoUrl: string
    links: string
    loginLabel: string
    loginHref: string
    ctaLabel: string
    ctaHref: string
    primaryColor: string
  }
```

- [ ] **Step 2: Add the component entry**

```tsx
  // 0. Sticky header
  ConstructionHeader: {
    label: 'Construction Header',
    fields: {
      brand: { type: 'text' },
      logoUrl: { type: 'text' },
      links: { type: 'textarea' },
      loginLabel: { type: 'text' },
      loginHref: { type: 'text' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      primaryColor: { type: 'text' },
    },
    defaultProps: {
      brand: 'Your Brand',
      logoUrl: '',
      links: 'Home|#\nAbout|#\nProducts|#\nServices|#\nSectors|#\nContact|#',
      loginLabel: 'Login',
      loginHref: '#login',
      ctaLabel: 'Get a Quote',
      ctaHref: '#quote',
      primaryColor: '',
    },
    render: ({ brand, logoUrl, links, loginLabel, loginHref, ctaLabel, ctaHref, primaryColor }) => {
      const [mobileOpen, setMobileOpen] = useState(false)
      const navItems = (links || '')
        .split('\n')
        .map((line) => line.split('|'))
        .filter(([label]) => label)
      const ctaStyle = primaryColor ? { backgroundColor: primaryColor } : undefined
      return (
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100">
          <div className={`${wrap} flex items-center justify-between h-16`}>
            <a href="#" className="flex items-center gap-2 font-bold text-slate-900">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={brand} className="h-8 w-auto" />
              )}
              <span>{brand}</span>
            </a>
            <nav className="hidden md:flex items-center gap-7">
              {navItems.map(([label, href], i) => (
                <a
                  key={i}
                  href={href || '#'}
                  className="text-sm font-medium text-slate-700 hover:text-orange-500 transition"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-3">
              {loginLabel && (
                <a
                  href={loginHref}
                  className="inline-flex items-center rounded-lg border-2 border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
                >
                  {loginLabel}
                </a>
              )}
              {ctaLabel && (
                <a
                  href={ctaHref}
                  style={ctaStyle}
                  className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
                >
                  {ctaLabel}
                </a>
              )}
            </div>
            <button
              type="button"
              aria-label="Toggle menu"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 -mr-2 text-slate-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          {mobileOpen && (
            <div className="fixed inset-0 z-50 bg-white flex flex-col p-6 md:hidden">
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-slate-900">{brand}</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 -mr-2 text-slate-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col gap-5 mb-8">
                {navItems.map(([label, href], i) => (
                  <a
                    key={i}
                    href={href || '#'}
                    onClick={() => setMobileOpen(false)}
                    className="text-lg font-medium text-slate-900"
                  >
                    {label}
                  </a>
                ))}
              </nav>
              <div className="flex flex-col gap-3 mt-auto">
                {loginLabel && (
                  <a
                    href={loginHref}
                    className="inline-flex items-center justify-center rounded-lg border-2 border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900"
                  >
                    {loginLabel}
                  </a>
                )}
                {ctaLabel && (
                  <a
                    href={ctaHref}
                    style={ctaStyle}
                    className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
                  >
                    {ctaLabel}
                  </a>
                )}
              </div>
            </div>
          )}
        </header>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add sticky ConstructionHeader with mobile slide-out"
```

---

### Task 4: New `ConstructionOfferingsRows`

**Files:**
- Modify: same file — type entry after `ConstructionHeader`'s type entry; component entry anywhere in `typedComponents` (place after `ConstructionServicesGrid`'s entry, i.e. after what was originally line 425)

- [ ] **Step 1: Add the type entry**

```tsx
  ConstructionOfferingsRows: {
    sectionTitle: string
    sectionSubtitle: string
    offering1NumberTag: string
    offering1Image: string
    offering1Heading: string
    offering1Description: string
    offering1BrandNames: string
    offering1Href: string
    offering2NumberTag: string
    offering2Image: string
    offering2Heading: string
    offering2Description: string
    offering2BrandNames: string
    offering2Href: string
    offering3NumberTag: string
    offering3Image: string
    offering3Heading: string
    offering3Description: string
    offering3BrandNames: string
    offering3Href: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
```

- [ ] **Step 2: Add the component entry**

```tsx
  // Core offerings — alternating rows
  ConstructionOfferingsRows: {
    label: 'Core Offerings (Alternating Rows)',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      offering1NumberTag: { type: 'text' },
      offering1Image: { type: 'text' },
      offering1Heading: { type: 'text' },
      offering1Description: { type: 'textarea' },
      offering1BrandNames: { type: 'text' },
      offering1Href: { type: 'text' },
      offering2NumberTag: { type: 'text' },
      offering2Image: { type: 'text' },
      offering2Heading: { type: 'text' },
      offering2Description: { type: 'textarea' },
      offering2BrandNames: { type: 'text' },
      offering2Href: { type: 'text' },
      offering3NumberTag: { type: 'text' },
      offering3Image: { type: 'text' },
      offering3Heading: { type: 'text' },
      offering3Description: { type: 'textarea' },
      offering3BrandNames: { type: 'text' },
      offering3Href: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Our Core Offerings',
      sectionSubtitle: 'Everything you need from a single, accountable contractor.',
      offering1NumberTag: '01',
      offering1Image: 'https://placehold.co/700x500/475569/ffffff?text=Offering+One',
      offering1Heading: 'Structural Construction',
      offering1Description: 'End-to-end structural builds engineered to code, from footings to rooftop.',
      offering1BrandNames: 'Brand One · Brand Two',
      offering1Href: '#',
      offering2NumberTag: '02',
      offering2Image: 'https://placehold.co/700x500/334155/ffffff?text=Offering+Two',
      offering2Heading: 'MEP & Systems Integration',
      offering2Description:
        'Mechanical, electrical, and plumbing systems coordinated under one schedule.',
      offering2BrandNames: 'Brand Three · Brand Four',
      offering2Href: '#',
      offering3NumberTag: '03',
      offering3Image: 'https://placehold.co/700x500/1e293b/ffffff?text=Offering+Three',
      offering3Heading: 'Finishing & Interiors',
      offering3Description: 'Precision finishing work that turns a shell into a move-in-ready space.',
      offering3BrandNames: 'Brand Five · Brand Six',
      offering3Href: '#',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      offering1NumberTag,
      offering1Image,
      offering1Heading,
      offering1Description,
      offering1BrandNames,
      offering1Href,
      offering2NumberTag,
      offering2Image,
      offering2Heading,
      offering2Description,
      offering2BrandNames,
      offering2Href,
      offering3NumberTag,
      offering3Image,
      offering3Heading,
      offering3Description,
      offering3BrandNames,
      offering3Href,
      padding,
      background,
    }) => {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const offerings = [
        {
          numberTag: offering1NumberTag,
          image: offering1Image,
          heading: offering1Heading,
          description: offering1Description,
          brandNames: offering1BrandNames,
          href: offering1Href,
        },
        {
          numberTag: offering2NumberTag,
          image: offering2Image,
          heading: offering2Heading,
          description: offering2Description,
          brandNames: offering2BrandNames,
          href: offering2Href,
        },
        {
          numberTag: offering3NumberTag,
          image: offering3Image,
          heading: offering3Heading,
          description: offering3Description,
          brandNames: offering3BrandNames,
          href: offering3Href,
        },
      ].filter((o) => o.heading)
      const icons: (() => JSX.Element)[] = [HardHatIcon, CheckShieldIcon]
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="flex flex-col gap-16">
              {offerings.map((o, i) => {
                const Icon = icons[i % icons.length]
                return (
                  <div
                    key={i}
                    className={`md:flex gap-10 items-center ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                  >
                    <div className="md:w-1/2 relative mb-6 md:mb-0">
                      <span className="absolute -top-6 -left-2 text-7xl font-extrabold text-slate-100 select-none">
                        {o.numberTag}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.image}
                        alt={o.heading}
                        className="relative rounded-xl w-full h-64 object-cover"
                      />
                    </div>
                    <div className="md:w-1/2">
                      <div className="text-orange-500 mb-3">
                        <Icon />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{o.heading}</h3>
                      <p className="text-slate-600 leading-relaxed mb-3">{o.description}</p>
                      {o.brandNames && <p className="text-xs text-slate-400 mb-4">{o.brandNames}</p>}
                      <a
                        href={o.href}
                        className="inline-flex items-center gap-1 text-orange-600 font-semibold text-sm hover:gap-2 transition-all"
                      >
                        Explore <span aria-hidden="true">→</span>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add ConstructionOfferingsRows (alternating core offerings)"
```

---

### Task 5: New `ConstructionAboutSplit`

**Files:**
- Modify: same file — type entry + component entry (place component entry after `ConstructionOfferingsRows`)

- [ ] **Step 1: Add the type entry**

```tsx
  ConstructionAboutSplit: {
    eyebrow: string
    heading: string
    paragraph: string
    photo: string
    badgeNumber: string
    badgeLabel: string
    check1Text: string
    check2Text: string
    check3Text: string
    brochureLabel: string
    brochureHref: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
```

- [ ] **Step 2: Add the component entry**

```tsx
  // About — split with badge overlay
  ConstructionAboutSplit: {
    label: 'About (Split with Badge)',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      paragraph: { type: 'textarea' },
      photo: { type: 'text' },
      badgeNumber: { type: 'text' },
      badgeLabel: { type: 'text' },
      check1Text: { type: 'text' },
      check2Text: { type: 'text' },
      check3Text: { type: 'text' },
      brochureLabel: { type: 'text' },
      brochureHref: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      eyebrow: 'About Us',
      heading: 'Two Decades of Building With Integrity',
      paragraph:
        'We are a full-service general contractor delivering residential, commercial, and infrastructure projects. Our in-house engineering and project management teams keep every job transparent, on schedule, and within budget.',
      photo: 'https://placehold.co/700x800/475569/ffffff?text=Our+Team',
      badgeNumber: '15+',
      badgeLabel: 'Years Experience',
      check1Text: 'Licensed & fully insured',
      check2Text: 'In-house engineering team',
      check3Text: 'Transparent weekly reporting',
      brochureLabel: 'Download Brochure',
      brochureHref: '#',
      padding: 'md',
      background: 'white',
    },
    render: ({
      eyebrow,
      heading,
      paragraph,
      photo,
      badgeNumber,
      badgeLabel,
      check1Text,
      check2Text,
      check3Text,
      brochureLabel,
      brochureHref,
      padding,
      background,
    }) => {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const checks = [check1Text, check2Text, check3Text].filter(Boolean)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={`${wrap} md:flex gap-14 items-center`}>
            <div className="md:w-2/5 relative mb-10 md:mb-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={heading} className="rounded-2xl w-full h-96 object-cover" />
              {(badgeNumber || badgeLabel) && (
                <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-orange-500 text-white flex flex-col items-center justify-center text-center shadow-lg">
                  <span className="text-2xl font-extrabold leading-none">{badgeNumber}</span>
                  <span className="text-[11px] font-medium mt-1 px-2">{badgeLabel}</span>
                </div>
              )}
            </div>
            <div className="md:w-3/5">
              {eyebrow && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">{heading}</h2>
              {paragraph && <p className="text-slate-600 leading-relaxed mb-6">{paragraph}</p>}
              {checks.length > 0 && (
                <ul className="flex flex-col gap-3 mb-8">
                  {checks.map((c, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700">
                      <span className="text-green-600 flex-shrink-0">
                        <CheckShieldIcon />
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              {brochureLabel && (
                <a
                  href={brochureHref}
                  className="inline-flex items-center rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                >
                  {brochureLabel}
                </a>
              )}
            </div>
          </div>
        </section>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add ConstructionAboutSplit"
```

---

### Task 6: Adapt `ConstructionProjectGallery` → Sectors grid (8 items)

**Files:**
- Modify: same file — `ConstructionProjectGallery` type entry (originally lines 40-62) and component entry (originally lines 428-549)

- [ ] **Step 1: Replace the `ConstructionProjectGallery` type entry**

```tsx
  ConstructionProjectGallery: {
    sectionTitle: string
    sectionSubtitle: string
    project1Title: string
    project1Category: string
    project1Image: string
    project1NumberTag: string
    project1Description: string
    project1Href: string
    project2Title: string
    project2Category: string
    project2Image: string
    project2NumberTag: string
    project2Description: string
    project2Href: string
    project3Title: string
    project3Category: string
    project3Image: string
    project3NumberTag: string
    project3Description: string
    project3Href: string
    project4Title: string
    project4Category: string
    project4Image: string
    project4NumberTag: string
    project4Description: string
    project4Href: string
    project5Title: string
    project5Category: string
    project5Image: string
    project5NumberTag: string
    project5Description: string
    project5Href: string
    project6Title: string
    project6Category: string
    project6Image: string
    project6NumberTag: string
    project6Description: string
    project6Href: string
    project7Title: string
    project7Category: string
    project7Image: string
    project7NumberTag: string
    project7Description: string
    project7Href: string
    project8Title: string
    project8Category: string
    project8Image: string
    project8NumberTag: string
    project8Description: string
    project8Href: string
    padding: 'sm' | 'md' | 'lg'
  }
```

- [ ] **Step 2: Replace the whole `ConstructionProjectGallery` component entry**

```tsx
  // 3. Project / Portfolio gallery → repurposed as Sectors grid
  ConstructionProjectGallery: {
    label: 'Project Gallery (Sectors Grid)',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      project1Title: { type: 'text' },
      project1Category: { type: 'text' },
      project1Image: { type: 'text' },
      project1NumberTag: { type: 'text' },
      project1Description: { type: 'textarea' },
      project1Href: { type: 'text' },
      project2Title: { type: 'text' },
      project2Category: { type: 'text' },
      project2Image: { type: 'text' },
      project2NumberTag: { type: 'text' },
      project2Description: { type: 'textarea' },
      project2Href: { type: 'text' },
      project3Title: { type: 'text' },
      project3Category: { type: 'text' },
      project3Image: { type: 'text' },
      project3NumberTag: { type: 'text' },
      project3Description: { type: 'textarea' },
      project3Href: { type: 'text' },
      project4Title: { type: 'text' },
      project4Category: { type: 'text' },
      project4Image: { type: 'text' },
      project4NumberTag: { type: 'text' },
      project4Description: { type: 'textarea' },
      project4Href: { type: 'text' },
      project5Title: { type: 'text' },
      project5Category: { type: 'text' },
      project5Image: { type: 'text' },
      project5NumberTag: { type: 'text' },
      project5Description: { type: 'textarea' },
      project5Href: { type: 'text' },
      project6Title: { type: 'text' },
      project6Category: { type: 'text' },
      project6Image: { type: 'text' },
      project6NumberTag: { type: 'text' },
      project6Description: { type: 'textarea' },
      project6Href: { type: 'text' },
      project7Title: { type: 'text' },
      project7Category: { type: 'text' },
      project7Image: { type: 'text' },
      project7NumberTag: { type: 'text' },
      project7Description: { type: 'textarea' },
      project7Href: { type: 'text' },
      project8Title: { type: 'text' },
      project8Category: { type: 'text' },
      project8Image: { type: 'text' },
      project8NumberTag: { type: 'text' },
      project8Description: { type: 'textarea' },
      project8Href: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Sectors We Serve',
      sectionSubtitle: 'Specialised delivery across every major construction vertical.',
      project1Title: 'Sector One',
      project1Category: 'Residential',
      project1Image: 'https://placehold.co/600x450/475569/ffffff?text=Sector+One',
      project1NumberTag: '01',
      project1Description: 'Placeholder description for this sector.',
      project1Href: '#sector-1',
      project2Title: 'Sector Two',
      project2Category: 'Commercial',
      project2Image: 'https://placehold.co/600x450/334155/ffffff?text=Sector+Two',
      project2NumberTag: '02',
      project2Description: 'Placeholder description for this sector.',
      project2Href: '#sector-2',
      project3Title: 'Sector Three',
      project3Category: 'Infrastructure',
      project3Image: 'https://placehold.co/600x450/1e293b/ffffff?text=Sector+Three',
      project3NumberTag: '03',
      project3Description: 'Placeholder description for this sector.',
      project3Href: '#sector-3',
      project4Title: 'Sector Four',
      project4Category: 'Institutional',
      project4Image: 'https://placehold.co/600x450/0f172a/ffffff?text=Sector+Four',
      project4NumberTag: '04',
      project4Description: 'Placeholder description for this sector.',
      project4Href: '#sector-4',
      project5Title: 'Sector Five',
      project5Category: 'Industrial',
      project5Image: 'https://placehold.co/600x450/1e3a5f/ffffff?text=Sector+Five',
      project5NumberTag: '05',
      project5Description: 'Placeholder description for this sector.',
      project5Href: '#sector-5',
      project6Title: 'Sector Six',
      project6Category: 'Specialist',
      project6Image: 'https://placehold.co/600x450/14532d/ffffff?text=Sector+Six',
      project6NumberTag: '06',
      project6Description: 'Placeholder description for this sector.',
      project6Href: '#sector-6',
      project7Title: 'Sector Seven',
      project7Category: 'Hospitality',
      project7Image: 'https://placehold.co/600x450/78350f/ffffff?text=Sector+Seven',
      project7NumberTag: '07',
      project7Description: 'Placeholder description for this sector.',
      project7Href: '#sector-7',
      project8Title: 'Sector Eight',
      project8Category: 'Retail',
      project8Image: 'https://placehold.co/600x450/581c87/ffffff?text=Sector+Eight',
      project8NumberTag: '08',
      project8Description: 'Placeholder description for this sector.',
      project8Href: '#sector-8',
      padding: 'md',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      project1Title,
      project1Category,
      project1Image,
      project1NumberTag,
      project1Description,
      project1Href,
      project2Title,
      project2Category,
      project2Image,
      project2NumberTag,
      project2Description,
      project2Href,
      project3Title,
      project3Category,
      project3Image,
      project3NumberTag,
      project3Description,
      project3Href,
      project4Title,
      project4Category,
      project4Image,
      project4NumberTag,
      project4Description,
      project4Href,
      project5Title,
      project5Category,
      project5Image,
      project5NumberTag,
      project5Description,
      project5Href,
      project6Title,
      project6Category,
      project6Image,
      project6NumberTag,
      project6Description,
      project6Href,
      project7Title,
      project7Category,
      project7Image,
      project7NumberTag,
      project7Description,
      project7Href,
      project8Title,
      project8Category,
      project8Image,
      project8NumberTag,
      project8Description,
      project8Href,
      padding,
    }) => {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const projects = [
        { title: project1Title, category: project1Category, image: project1Image, numberTag: project1NumberTag, description: project1Description, href: project1Href },
        { title: project2Title, category: project2Category, image: project2Image, numberTag: project2NumberTag, description: project2Description, href: project2Href },
        { title: project3Title, category: project3Category, image: project3Image, numberTag: project3NumberTag, description: project3Description, href: project3Href },
        { title: project4Title, category: project4Category, image: project4Image, numberTag: project4NumberTag, description: project4Description, href: project4Href },
        { title: project5Title, category: project5Category, image: project5Image, numberTag: project5NumberTag, description: project5Description, href: project5Href },
        { title: project6Title, category: project6Category, image: project6Image, numberTag: project6NumberTag, description: project6Description, href: project6Href },
        { title: project7Title, category: project7Category, image: project7Image, numberTag: project7NumberTag, description: project7Description, href: project7Href },
        { title: project8Title, category: project8Category, image: project8Image, numberTag: project8NumberTag, description: project8Description, href: project8Href },
      ].filter((p) => p.title)
      return (
        <section ref={ref} className={`${revealCls} ${padY[padding]} bg-white`}>
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {projects.map((p, i) => (
                <a
                  key={i}
                  href={p.href || '#'}
                  className="group relative rounded-xl overflow-hidden aspect-[4/3] block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/20 to-transparent" />
                  {p.numberTag && (
                    <span className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/90 text-slate-900 text-xs font-bold flex items-center justify-center">
                      {p.numberTag}
                    </span>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    {p.category && (
                      <span className="text-xs font-medium text-orange-300 uppercase tracking-wide">
                        {p.category}
                      </span>
                    )}
                    <p className="font-semibold">{p.title}</p>
                    {p.description && <p className="text-xs text-white/80 mt-0.5">{p.description}</p>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): adapt ConstructionProjectGallery into an 8-item Sectors grid"
```

---

### Task 7: New `ConstructionFeaturedProject`

**Files:**
- Modify: same file — type entry + component entry (place component entry after `ConstructionProjectGallery`)

- [ ] **Step 1: Add the type entry**

```tsx
  ConstructionFeaturedProject: {
    sectionTitle: string
    image: string
    paragraph: string
    scope1Icon: IconKey
    scope1Label: string
    scope2Icon: IconKey
    scope2Label: string
    scope3Icon: IconKey
    scope3Label: string
    scope4Icon: IconKey
    scope4Label: string
    linkLabel: string
    linkHref: string
    ctaLabel: string
    ctaHref: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
```

- [ ] **Step 2: Add the component entry**

```tsx
  // Featured project / case study
  ConstructionFeaturedProject: {
    label: 'Featured Project',
    fields: {
      sectionTitle: { type: 'text' },
      image: { type: 'text' },
      paragraph: { type: 'textarea' },
      scope1Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      scope1Label: { type: 'text' },
      scope2Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      scope2Label: { type: 'text' },
      scope3Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      scope3Label: { type: 'text' },
      scope4Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      scope4Label: { type: 'text' },
      linkLabel: { type: 'text' },
      linkHref: { type: 'text' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Featured Project',
      image: 'https://placehold.co/900x650/475569/ffffff?text=Featured+Project',
      paragraph:
        'A ground-up commercial build delivered across 14 months — from site mobilisation to final handover — with zero schedule slippage.',
      scope1Icon: 'hardhat',
      scope1Label: 'Site Development',
      scope2Icon: 'shield',
      scope2Label: 'Safety Compliance',
      scope3Icon: 'star',
      scope3Label: 'Quality Assurance',
      scope4Icon: 'hardhat',
      scope4Label: 'MEP Coordination',
      linkLabel: 'View Case Study',
      linkHref: '#',
      ctaLabel: 'Start Your Project',
      ctaHref: '#quote',
      padding: 'md',
      background: 'muted',
    },
    render: ({
      sectionTitle,
      image,
      paragraph,
      scope1Icon,
      scope1Label,
      scope2Icon,
      scope2Label,
      scope3Icon,
      scope3Label,
      scope4Icon,
      scope4Label,
      linkLabel,
      linkHref,
      ctaLabel,
      ctaHref,
      padding,
      background,
    }) => {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const scopes = [
        { icon: scope1Icon, label: scope1Label },
        { icon: scope2Icon, label: scope2Label },
        { icon: scope3Icon, label: scope3Label },
        { icon: scope4Icon, label: scope4Label },
      ].filter((s) => s.label)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="md:flex gap-12 items-center">
              <div className="md:w-1/2 mb-8 md:mb-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={sectionTitle} className="rounded-2xl w-full h-80 object-cover" />
              </div>
              <div className="md:w-1/2">
                {paragraph && <p className="text-slate-600 leading-relaxed mb-6">{paragraph}</p>}
                {scopes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {scopes.map((s, i) => {
                      const Icon = ICON_BY_KEY[s.icon] ?? HardHatIcon
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          <span className="text-orange-500 [&>svg]:w-4 [&>svg]:h-4">
                            <Icon />
                          </span>
                          {s.label}
                        </span>
                      )
                    })}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-6">
                  {ctaLabel && (
                    <a
                      href={ctaHref}
                      className="inline-flex items-center rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                    >
                      {ctaLabel}
                    </a>
                  )}
                  {linkLabel && (
                    <a href={linkHref} className="text-orange-600 font-semibold text-sm hover:underline">
                      {linkLabel}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add ConstructionFeaturedProject"
```

---

### Task 8: New `ConstructionProductsShowcase` (stateful — tab filter)

**Files:**
- Modify: same file — type entry + component entry (place component entry after `ConstructionFeaturedProject`)

- [ ] **Step 1: Add the type entry**

```tsx
  ConstructionProductsShowcase: {
    sectionTitle: string
    sectionSubtitle: string
    category1Label: string
    category2Label: string
    category3Label: string
    category4Label: string
    product1Category: string
    product1Icon: IconKey
    product1Title: string
    product1Description: string
    product2Category: string
    product2Icon: IconKey
    product2Title: string
    product2Description: string
    product3Category: string
    product3Icon: IconKey
    product3Title: string
    product3Description: string
    product4Category: string
    product4Icon: IconKey
    product4Title: string
    product4Description: string
    product5Category: string
    product5Icon: IconKey
    product5Title: string
    product5Description: string
    product6Category: string
    product6Icon: IconKey
    product6Title: string
    product6Description: string
    product7Category: string
    product7Icon: IconKey
    product7Title: string
    product7Description: string
    product8Category: string
    product8Icon: IconKey
    product8Title: string
    product8Description: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
```

- [ ] **Step 2: Add the component entry**

```tsx
  // Products showcase — tab filtered
  ConstructionProductsShowcase: {
    label: 'Products Showcase (Tabbed)',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      category1Label: { type: 'text' },
      category2Label: { type: 'text' },
      category3Label: { type: 'text' },
      category4Label: { type: 'text' },
      product1Category: { type: 'text' },
      product1Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product1Title: { type: 'text' },
      product1Description: { type: 'textarea' },
      product2Category: { type: 'text' },
      product2Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product2Title: { type: 'text' },
      product2Description: { type: 'textarea' },
      product3Category: { type: 'text' },
      product3Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product3Title: { type: 'text' },
      product3Description: { type: 'textarea' },
      product4Category: { type: 'text' },
      product4Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product4Title: { type: 'text' },
      product4Description: { type: 'textarea' },
      product5Category: { type: 'text' },
      product5Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product5Title: { type: 'text' },
      product5Description: { type: 'textarea' },
      product6Category: { type: 'text' },
      product6Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product6Title: { type: 'text' },
      product6Description: { type: 'textarea' },
      product7Category: { type: 'text' },
      product7Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product7Title: { type: 'text' },
      product7Description: { type: 'textarea' },
      product8Category: { type: 'text' },
      product8Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product8Title: { type: 'text' },
      product8Description: { type: 'textarea' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Our Products',
      sectionSubtitle: 'Sourced and supplied through our vetted vendor network.',
      category1Label: 'Category One',
      category2Label: 'Category Two',
      category3Label: 'Category Three',
      category4Label: 'Category Four',
      product1Category: 'Category One',
      product1Icon: 'hardhat',
      product1Title: 'Product One',
      product1Description: 'Placeholder product description for this listing.',
      product2Category: 'Category One',
      product2Icon: 'shield',
      product2Title: 'Product Two',
      product2Description: 'Placeholder product description for this listing.',
      product3Category: 'Category Two',
      product3Icon: 'star',
      product3Title: 'Product Three',
      product3Description: 'Placeholder product description for this listing.',
      product4Category: 'Category Two',
      product4Icon: 'hardhat',
      product4Title: 'Product Four',
      product4Description: 'Placeholder product description for this listing.',
      product5Category: 'Category Three',
      product5Icon: 'shield',
      product5Title: 'Product Five',
      product5Description: 'Placeholder product description for this listing.',
      product6Category: 'Category Three',
      product6Icon: 'star',
      product6Title: 'Product Six',
      product6Description: 'Placeholder product description for this listing.',
      product7Category: 'Category Four',
      product7Icon: 'hardhat',
      product7Title: 'Product Seven',
      product7Description: 'Placeholder product description for this listing.',
      product8Category: 'Category Four',
      product8Icon: 'shield',
      product8Title: 'Product Eight',
      product8Description: 'Placeholder product description for this listing.',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      category1Label,
      category2Label,
      category3Label,
      category4Label,
      product1Category,
      product1Icon,
      product1Title,
      product1Description,
      product2Category,
      product2Icon,
      product2Title,
      product2Description,
      product3Category,
      product3Icon,
      product3Title,
      product3Description,
      product4Category,
      product4Icon,
      product4Title,
      product4Description,
      product5Category,
      product5Icon,
      product5Title,
      product5Description,
      product6Category,
      product6Icon,
      product6Title,
      product6Description,
      product7Category,
      product7Icon,
      product7Title,
      product7Description,
      product8Category,
      product8Icon,
      product8Title,
      product8Description,
      padding,
      background,
    }) => {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const categories = [category1Label, category2Label, category3Label, category4Label].filter(Boolean)
      const products = [
        { category: product1Category, icon: product1Icon, title: product1Title, description: product1Description },
        { category: product2Category, icon: product2Icon, title: product2Title, description: product2Description },
        { category: product3Category, icon: product3Icon, title: product3Title, description: product3Description },
        { category: product4Category, icon: product4Icon, title: product4Title, description: product4Description },
        { category: product5Category, icon: product5Icon, title: product5Title, description: product5Description },
        { category: product6Category, icon: product6Icon, title: product6Title, description: product6Description },
        { category: product7Category, icon: product7Icon, title: product7Title, description: product7Description },
        { category: product8Category, icon: product8Icon, title: product8Title, description: product8Description },
      ].filter((p) => p.title)
      const [activeTab, setActiveTab] = useState(categories[0] ?? '')
      const visible = products.filter((p) => p.category === activeTab)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveTab(c)}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                      c === activeTab
                        ? 'bg-orange-500 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-orange-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {visible.map((p, i) => {
                const Icon = ICON_BY_KEY[p.icon] ?? HardHatIcon
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition"
                  >
                    <div className="text-orange-500 mb-3">
                      <Icon />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">{p.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{p.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add tab-filtered ConstructionProductsShowcase"
```

---

### Task 9: New `ConstructionClientsGrid` (stateful — pagination)

**Files:**
- Modify: same file — type entry + component entry (place component entry after `ConstructionProductsShowcase`)

- [ ] **Step 1: Add the type entry**

```tsx
  ConstructionClientsGrid: {
    sectionTitle: string
    sectionSubtitle: string
    client1Logo: string
    client1Name: string
    client2Logo: string
    client2Name: string
    client3Logo: string
    client3Name: string
    client4Logo: string
    client4Name: string
    client5Logo: string
    client5Name: string
    client6Logo: string
    client6Name: string
    client7Logo: string
    client7Name: string
    client8Logo: string
    client8Name: string
    client9Logo: string
    client9Name: string
    client10Logo: string
    client10Name: string
    client11Logo: string
    client11Name: string
    client12Logo: string
    client12Name: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
```

- [ ] **Step 2: Add the component entry**

```tsx
  // Clients — paginated logo grid
  ConstructionClientsGrid: {
    label: 'Clients (Paginated Grid)',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      client1Logo: { type: 'text' },
      client1Name: { type: 'text' },
      client2Logo: { type: 'text' },
      client2Name: { type: 'text' },
      client3Logo: { type: 'text' },
      client3Name: { type: 'text' },
      client4Logo: { type: 'text' },
      client4Name: { type: 'text' },
      client5Logo: { type: 'text' },
      client5Name: { type: 'text' },
      client6Logo: { type: 'text' },
      client6Name: { type: 'text' },
      client7Logo: { type: 'text' },
      client7Name: { type: 'text' },
      client8Logo: { type: 'text' },
      client8Name: { type: 'text' },
      client9Logo: { type: 'text' },
      client9Name: { type: 'text' },
      client10Logo: { type: 'text' },
      client10Name: { type: 'text' },
      client11Logo: { type: 'text' },
      client11Name: { type: 'text' },
      client12Logo: { type: 'text' },
      client12Name: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Trusted By',
      sectionSubtitle: 'A selection of clients we have partnered with.',
      client1Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+1',
      client1Name: 'Client 1',
      client2Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+2',
      client2Name: 'Client 2',
      client3Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+3',
      client3Name: 'Client 3',
      client4Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+4',
      client4Name: 'Client 4',
      client5Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+5',
      client5Name: 'Client 5',
      client6Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+6',
      client6Name: 'Client 6',
      client7Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+7',
      client7Name: 'Client 7',
      client8Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+8',
      client8Name: 'Client 8',
      client9Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+9',
      client9Name: 'Client 9',
      client10Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+10',
      client10Name: 'Client 10',
      client11Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+11',
      client11Name: 'Client 11',
      client12Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+12',
      client12Name: 'Client 12',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      client1Logo,
      client1Name,
      client2Logo,
      client2Name,
      client3Logo,
      client3Name,
      client4Logo,
      client4Name,
      client5Logo,
      client5Name,
      client6Logo,
      client6Name,
      client7Logo,
      client7Name,
      client8Logo,
      client8Name,
      client9Logo,
      client9Name,
      client10Logo,
      client10Name,
      client11Logo,
      client11Name,
      client12Logo,
      client12Name,
      padding,
      background,
    }) => {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const clients = [
        { logo: client1Logo, name: client1Name },
        { logo: client2Logo, name: client2Name },
        { logo: client3Logo, name: client3Name },
        { logo: client4Logo, name: client4Name },
        { logo: client5Logo, name: client5Name },
        { logo: client6Logo, name: client6Name },
        { logo: client7Logo, name: client7Name },
        { logo: client8Logo, name: client8Name },
        { logo: client9Logo, name: client9Name },
        { logo: client10Logo, name: client10Name },
        { logo: client11Logo, name: client11Name },
        { logo: client12Logo, name: client12Name },
      ].filter((c) => c.logo)
      const pageSize = 6
      const pageCount = Math.max(1, Math.ceil(clients.length / pageSize))
      const [page, setPage] = useState(0)
      const visible = clients.slice(page * pageSize, page * pageSize + pageSize)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 mb-8">
              {visible.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 h-24"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.logo}
                    alt={c.name}
                    className="max-h-10 max-w-full object-contain grayscale hover:grayscale-0 transition"
                  />
                </div>
              ))}
            </div>
            {pageCount > 1 && (
              <div className="flex justify-center gap-2">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Show clients page ${i + 1}`}
                    onClick={() => setPage(i)}
                    className={`w-2.5 h-2.5 rounded-full transition ${
                      i === page ? 'bg-orange-500' : 'bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add paginated ConstructionClientsGrid"
```

---

### Task 10: Adapt `ConstructionTestimonials` — add avatar-initials circle

**Files:**
- Modify: same file — `ConstructionTestimonials` type entry and component entry (originally lines 120-133 for type, 938-1036 for component)

- [ ] **Step 1: Add 3 fields to the `ConstructionTestimonials` type entry**

Change:

```tsx
  ConstructionTestimonials: {
    sectionTitle: string
    quote1Text: string
    quote1Author: string
    quote1Company: string
    quote2Text: string
    quote2Author: string
    quote2Company: string
    quote3Text: string
    quote3Author: string
    quote3Company: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
```

to:

```tsx
  ConstructionTestimonials: {
    sectionTitle: string
    quote1Text: string
    quote1Author: string
    quote1Company: string
    quote1Initials: string
    quote2Text: string
    quote2Author: string
    quote2Company: string
    quote2Initials: string
    quote3Text: string
    quote3Author: string
    quote3Company: string
    quote3Initials: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
```

- [ ] **Step 2: Replace the whole `ConstructionTestimonials` component entry**

```tsx
  // 8. Testimonials
  ConstructionTestimonials: {
    label: 'Testimonials',
    fields: {
      sectionTitle: { type: 'text' },
      quote1Text: { type: 'textarea' },
      quote1Author: { type: 'text' },
      quote1Company: { type: 'text' },
      quote1Initials: { type: 'text' },
      quote2Text: { type: 'textarea' },
      quote2Author: { type: 'text' },
      quote2Company: { type: 'text' },
      quote2Initials: { type: 'text' },
      quote3Text: { type: 'textarea' },
      quote3Author: { type: 'text' },
      quote3Company: { type: 'text' },
      quote3Initials: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'What Our Clients Say',
      quote1Text:
        'The team delivered our 12-unit residential complex three weeks ahead of schedule, without a single quality defect. Exceptional work.',
      quote1Author: 'Venkat Reddy',
      quote1Company: 'Reddy Builders Pvt Ltd',
      quote1Initials: 'VR',
      quote2Text:
        'Their safety record across our 18-month infrastructure project was impeccable. Zero LTIs. We will work with them again.',
      quote2Author: 'Anita Sharma',
      quote2Company: 'National Highways Authority (Vendor)',
      quote2Initials: 'AS',
      quote3Text:
        'Transparent budgeting and weekly reporting made it easy to track progress. No surprises. Highly recommended.',
      quote3Author: 'Mohan Das',
      quote3Company: 'Das Commercial Properties',
      quote3Initials: 'MD',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      quote1Text,
      quote1Author,
      quote1Company,
      quote1Initials,
      quote2Text,
      quote2Author,
      quote2Company,
      quote2Initials,
      quote3Text,
      quote3Author,
      quote3Company,
      quote3Initials,
      padding,
      background,
    }) => {
      const quotes = [
        { text: quote1Text, author: quote1Author, company: quote1Company, initials: quote1Initials },
        { text: quote2Text, author: quote2Author, company: quote2Company, initials: quote2Initials },
        { text: quote3Text, author: quote3Author, company: quote3Company, initials: quote3Initials },
      ].filter((q) => q.text)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quotes.map((q, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col gap-4"
                >
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, si) => (
                      <StarIcon key={si} />
                    ))}
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed flex-1">
                    &#8220;{q.text}&#8221;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {q.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{q.author}</p>
                      <p className="text-xs text-slate-500">{q.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add avatar-initials circle to ConstructionTestimonials"
```

---

### Task 11: New `ConstructionLeadFormFAQ` (stateful — accordion; inert display-only form)

**Files:**
- Modify: same file — type entry + component entry (place component entry after `ConstructionTestimonials`)

- [ ] **Step 1: Add the type entry**

```tsx
  ConstructionLeadFormFAQ: {
    sectionTitle: string
    faq1Question: string
    faq1Answer: string
    faq2Question: string
    faq2Answer: string
    faq3Question: string
    faq3Answer: string
    faq4Question: string
    faq4Answer: string
    faq5Question: string
    faq5Answer: string
    faq6Question: string
    faq6Answer: string
    formHeading: string
    formSubtext: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
```

- [ ] **Step 2: Add the component entry**

```tsx
  // Lead form + FAQ
  ConstructionLeadFormFAQ: {
    label: 'Lead Form + FAQ',
    fields: {
      sectionTitle: { type: 'text' },
      faq1Question: { type: 'text' },
      faq1Answer: { type: 'textarea' },
      faq2Question: { type: 'text' },
      faq2Answer: { type: 'textarea' },
      faq3Question: { type: 'text' },
      faq3Answer: { type: 'textarea' },
      faq4Question: { type: 'text' },
      faq4Answer: { type: 'textarea' },
      faq5Question: { type: 'text' },
      faq5Answer: { type: 'textarea' },
      faq6Question: { type: 'text' },
      faq6Answer: { type: 'textarea' },
      formHeading: { type: 'text' },
      formSubtext: { type: 'textarea' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Frequently Asked Questions',
      faq1Question: 'How long does a typical project take?',
      faq1Answer: 'Timelines vary by scope — a detailed schedule is provided after site assessment.',
      faq2Question: 'Do you provide fixed-price contracts?',
      faq2Answer: 'Yes, most projects are quoted and contracted on a fixed-price basis.',
      faq3Question: 'Are you licensed and insured?',
      faq3Answer: 'Yes, we are fully licensed and carry comprehensive insurance cover.',
      faq4Question: 'Can I see your past work?',
      faq4Answer: 'Yes — see the Sectors and Featured Project sections above, or request our portfolio.',
      faq5Question: 'Do you handle permits and approvals?',
      faq5Answer: 'Yes, permit acquisition is coordinated as part of our project management scope.',
      faq6Question: 'What areas do you serve?',
      faq6Answer: 'We currently serve residential and commercial clients across the region.',
      formHeading: 'Get a Free Quote',
      formSubtext: 'Tell us about your project and our team will get back to you within 48 hours.',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      faq1Question,
      faq1Answer,
      faq2Question,
      faq2Answer,
      faq3Question,
      faq3Answer,
      faq4Question,
      faq4Answer,
      faq5Question,
      faq5Answer,
      faq6Question,
      faq6Answer,
      formHeading,
      formSubtext,
      padding,
      background,
    }) => {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const [openIndex, setOpenIndex] = useState<number | null>(0)
      const faqs = [
        { question: faq1Question, answer: faq1Answer },
        { question: faq2Question, answer: faq2Answer },
        { question: faq3Question, answer: faq3Answer },
        { question: faq4Question, answer: faq4Answer },
        { question: faq5Question, answer: faq5Answer },
        { question: faq6Question, answer: faq6Answer },
      ].filter((f) => f.question)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={`${wrap} md:flex gap-12`}>
            <div className="md:w-1/2 mb-10 md:mb-0">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">{sectionTitle}</h2>
              <div className="flex flex-col gap-3">
                {faqs.map((f, i) => {
                  const isOpen = openIndex === i
                  return (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenIndex(isOpen ? null : i)}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-medium text-slate-900"
                      >
                        {f.question}
                        <svg
                          className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen && (
                        <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{f.answer}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{formHeading}</h3>
                {formSubtext && <p className="text-sm text-slate-600 mb-6">{formSubtext}</p>}
                {/*
                  Display-only: no lead-capture endpoint exists in this app
                  yet. Plain div (not <form>) + type="button" submit so
                  nothing navigates or posts on click — deliberate, not an
                  oversight.
                */}
                <div className="flex flex-col gap-4">
                  <input
                    type="text"
                    placeholder="Name"
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                  <select className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700">
                    <option>General Inquiry</option>
                    <option>Residential Project</option>
                    <option>Commercial Project</option>
                    <option>Infrastructure Project</option>
                  </select>
                  <div className="flex gap-5 text-sm text-slate-700">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="lead-form-fake-contact-pref" defaultChecked /> Phone
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="lead-form-fake-contact-pref" /> Email
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="lead-form-fake-contact-pref" /> WhatsApp
                    </label>
                  </div>
                  <textarea
                    placeholder="Message (optional)"
                    rows={3}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add ConstructionLeadFormFAQ (accordion + inert display-only form)"
```

---

### Task 12: New `ConstructionTaglineStrip` + `ConstructionFloatingActions`

**Files:**
- Modify: same file — 2 type entries + 2 component entries (place after `ConstructionLeadFormFAQ`)

- [ ] **Step 1: Add both type entries**

```tsx
  ConstructionTaglineStrip: {
    logoUrl: string
    brand: string
    tagline: string
  }
  ConstructionFloatingActions: {
    whatsappHref: string
  }
```

- [ ] **Step 2: Add both component entries**

```tsx
  // Tagline strip
  ConstructionTaglineStrip: {
    label: 'Tagline Strip',
    fields: {
      logoUrl: { type: 'text' },
      brand: { type: 'text' },
      tagline: { type: 'text' },
    },
    defaultProps: {
      logoUrl: '',
      brand: 'Your Brand',
      tagline: 'Building with integrity, delivering with precision.',
    },
    render: ({ logoUrl, brand, tagline }) => (
      <div className="bg-slate-900 text-white py-6">
        <div className={`${wrap} flex items-center justify-center gap-3 text-center`}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brand} className="h-7 w-auto" />
          )}
          <p className="text-sm font-medium opacity-90">{tagline}</p>
        </div>
      </div>
    ),
  },

  // Floating WhatsApp + back-to-top
  ConstructionFloatingActions: {
    label: 'Floating Actions (WhatsApp + Back to Top)',
    fields: {
      whatsappHref: { type: 'text' },
    },
    defaultProps: {
      whatsappHref: 'https://wa.me/919876543210',
    },
    render: ({ whatsappHref }) => {
      const scrollTop = () => {
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat on WhatsApp"
              className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:bg-green-600 transition"
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.3 14.8l-.3-.2-3 .8.8-3-.2-.3A8 8 0 0 1 12 4zm-2.2 3.6c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.1 1.7 2.7 4.3 3.7 2.1.8 2.5.7 3 .6.4-.1 1.3-.5 1.5-1 .2-.5.2-.9.1-1-.1-.1-.2-.2-.5-.3l-1.9-.9c-.3-.1-.4-.1-.6.1l-.7 1c-.1.2-.3.2-.5.1-.7-.3-1.6-.8-2.3-1.6-.6-.6-1-1.3-1.2-1.7-.1-.2 0-.4.1-.5l.5-.6c.1-.2.1-.3 0-.5l-.9-2.1c-.1-.3-.3-.3-.5-.3h-.3z" />
              </svg>
            </a>
          )}
          <button
            type="button"
            aria-label="Back to top"
            onClick={scrollTop}
            className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      )
    },
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add ConstructionTaglineStrip and ConstructionFloatingActions"
```

---

### Task 13: New `ConstructionFooter` + register all new categories

**Files:**
- Modify: same file — type entry + component entry (place after `ConstructionFloatingActions`); update `typedCategories` (originally lines 1357-1378)

- [ ] **Step 1: Add the type entry**

```tsx
  ConstructionFooter: {
    logoUrl: string
    brand: string
    tagline: string
    social1Label: string
    social1Href: string
    social2Label: string
    social2Href: string
    social3Label: string
    social3Href: string
    social4Label: string
    social4Href: string
    newsletterPlaceholder: string
    newsletterButtonLabel: string
    companyLinksTitle: string
    links: string
    contactTitle: string
    contactPhone: string
    contactEmail: string
    contactAddress: string
    showroomTitle: string
    showroomAddress: string
    qrImage: string
    qrCaption: string
    copyright: string
  }
```

- [ ] **Step 2: Add the component entry**

```tsx
  // 4-column footer
  ConstructionFooter: {
    label: 'Construction Footer (4 Column)',
    fields: {
      logoUrl: { type: 'text' },
      brand: { type: 'text' },
      tagline: { type: 'textarea' },
      social1Label: { type: 'text' },
      social1Href: { type: 'text' },
      social2Label: { type: 'text' },
      social2Href: { type: 'text' },
      social3Label: { type: 'text' },
      social3Href: { type: 'text' },
      social4Label: { type: 'text' },
      social4Href: { type: 'text' },
      newsletterPlaceholder: { type: 'text' },
      newsletterButtonLabel: { type: 'text' },
      companyLinksTitle: { type: 'text' },
      links: { type: 'textarea' },
      contactTitle: { type: 'text' },
      contactPhone: { type: 'text' },
      contactEmail: { type: 'text' },
      contactAddress: { type: 'textarea' },
      showroomTitle: { type: 'text' },
      showroomAddress: { type: 'textarea' },
      qrImage: { type: 'text' },
      qrCaption: { type: 'text' },
      copyright: { type: 'text' },
    },
    defaultProps: {
      logoUrl: '',
      brand: 'Your Brand',
      tagline: 'Building with integrity, delivering with precision.',
      social1Label: 'f',
      social1Href: '#',
      social2Label: 'in',
      social2Href: '#',
      social3Label: 'ig',
      social3Href: '#',
      social4Label: 'x',
      social4Href: '#',
      newsletterPlaceholder: 'Your email address',
      newsletterButtonLabel: 'Subscribe',
      companyLinksTitle: 'Company',
      links: 'Home|#\nAbout|#\nContact|#',
      contactTitle: 'Contact',
      contactPhone: '+91-98765-43210',
      contactEmail: 'info@yourbrand.com',
      contactAddress: '123 Business Avenue\nCity, State 000000',
      showroomTitle: 'Showroom',
      showroomAddress: '456 Showroom Road\nCity, State 000000',
      qrImage: 'https://placehold.co/160x160/ffffff/1e293b?text=QR+Code',
      qrCaption: 'Scan for directions',
      copyright: '© Your Brand. All rights reserved.',
    },
    render: ({
      logoUrl,
      brand,
      tagline,
      social1Label,
      social1Href,
      social2Label,
      social2Href,
      social3Label,
      social3Href,
      social4Label,
      social4Href,
      newsletterPlaceholder,
      newsletterButtonLabel,
      companyLinksTitle,
      links,
      contactTitle,
      contactPhone,
      contactEmail,
      contactAddress,
      showroomTitle,
      showroomAddress,
      qrImage,
      qrCaption,
      copyright,
    }) => {
      const companyLinks = (links || '')
        .split('\n')
        .map((line) => line.split('|'))
        .filter(([label]) => label)
      const socials = [
        { label: social1Label, href: social1Href },
        { label: social2Label, href: social2Href },
        { label: social3Label, href: social3Href },
        { label: social4Label, href: social4Href },
      ].filter((s) => s.label)
      return (
        <footer className="bg-slate-900 text-white pt-16 pb-8">
          <div className={wrap}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
              <div>
                <div className="flex items-center gap-2 font-bold text-lg mb-3">
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-8 w-auto" />
                  )}
                  <span>{brand}</span>
                </div>
                {tagline && <p className="text-sm text-white/70 mb-5 whitespace-pre-line">{tagline}</p>}
                {socials.length > 0 && (
                  <div className="flex gap-2 mb-6">
                    {socials.map((s, i) => (
                      <a
                        key={i}
                        href={s.href}
                        aria-label={s.label}
                        className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold hover:bg-white/20 transition"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                )}
                <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
                  <input
                    type="email"
                    placeholder={newsletterPlaceholder}
                    className="min-w-0 flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold hover:bg-orange-600 transition flex-shrink-0"
                  >
                    {newsletterButtonLabel}
                  </button>
                </form>
              </div>
              <div>
                <h4 className="font-semibold mb-4">{companyLinksTitle}</h4>
                <ul className="flex flex-col gap-2.5 text-sm text-white/70">
                  {companyLinks.map(([label, href], i) => (
                    <li key={i}>
                      <a href={href || '#'} className="hover:text-white transition">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">{contactTitle}</h4>
                <ul className="flex flex-col gap-2.5 text-sm text-white/70">
                  {contactPhone && <li>{contactPhone}</li>}
                  {contactEmail && <li>{contactEmail}</li>}
                  {contactAddress && <li className="whitespace-pre-line">{contactAddress}</li>}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">{showroomTitle}</h4>
                {showroomAddress && (
                  <p className="text-sm text-white/70 whitespace-pre-line mb-4">{showroomAddress}</p>
                )}
                {qrImage && (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrImage} alt={qrCaption} className="w-20 h-20 rounded-lg bg-white p-1" />
                    {qrCaption && <p className="text-xs text-white/50 mt-1.5">{qrCaption}</p>}
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
              <p>{copyright}</p>
              <p>Design by KDL</p>
            </div>
          </div>
        </footer>
      )
    },
  },
```

- [ ] **Step 3: Replace `typedCategories` to register every new component**

Change the `typedCategories` block from:

```tsx
const typedCategories: NonNullable<Config<ConstructionProps>['categories']> = {
  'construction-hero': {
    title: 'Construction — Hero',
    components: ['ConstructionHero'],
  },
  'construction-sections': {
    title: 'Construction — Sections',
    components: [
      'ConstructionServicesGrid',
      'ConstructionProjectGallery',
      'ConstructionProcessTimeline',
      'ConstructionWhyChooseUs',
      'ConstructionTeamCrew',
      'ConstructionCertificationsBadges',
      'ConstructionTestimonials',
    ],
  },
  'construction-cta': {
    title: 'Construction — CTA & Stats',
    components: ['ConstructionQuoteCTA', 'ConstructionStatsStrip', 'ConstructionSafetyRecord'],
  },
}
```

to:

```tsx
const typedCategories: NonNullable<Config<ConstructionProps>['categories']> = {
  'construction-hero': {
    title: 'Construction — Hero',
    components: ['ConstructionHeader', 'ConstructionHero'],
  },
  'construction-sections': {
    title: 'Construction — Sections',
    components: [
      'ConstructionServicesGrid',
      'ConstructionProjectGallery',
      'ConstructionProcessTimeline',
      'ConstructionWhyChooseUs',
      'ConstructionTeamCrew',
      'ConstructionCertificationsBadges',
      'ConstructionTestimonials',
      'ConstructionOfferingsRows',
      'ConstructionAboutSplit',
      'ConstructionFeaturedProject',
      'ConstructionProductsShowcase',
      'ConstructionClientsGrid',
    ],
  },
  'construction-cta': {
    title: 'Construction — CTA & Stats',
    components: ['ConstructionQuoteCTA', 'ConstructionStatsStrip', 'ConstructionSafetyRecord'],
  },
  'construction-homepage': {
    title: 'Construction — Homepage',
    components: [
      'ConstructionLeadFormFAQ',
      'ConstructionTaglineStrip',
      'ConstructionFooter',
      'ConstructionFloatingActions',
    ],
  },
}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: passes — this is the last frontend task, so this is also the point to run the full frontend verification:

Run: `cd frontend && pnpm lint && npx tsc --noEmit`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/construction/index.tsx
git commit -m "feat(construction-pack): add ConstructionFooter and register all new components in categories"
```

---

### Task 14: Wire `seedConstructionPageData` — full Home content + nav-link registration (TDD)

**Files:**
- Modify: `backend/src/modules/template-engine/drivers/website-seed-content.js:56` (`NAV_LINK_PROP_BY_BLOCK_TYPE`), `:491-651` (construction seeder section)
- Test: `backend/src/modules/template-engine/drivers/website.driver.test.js`

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block at the end of the file (after the last existing `describe`, e.g. right after the `guidelines driver` block closes):

```js
describe('website driver — construction pack seeding (KDL-558 homepage)', () => {
  it('seeds Home with the full construction homepage block sequence when templatePack is construction', async () => {
    createPage.mockResolvedValueOnce({ id: 'page-home' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      templatePack: 'construction',
      navigationPages: ['Home'],
    });

    const call = createPage.mock.calls[0][0];
    const types = call.data.content.map((b) => b.type);
    expect(types).toEqual([
      'ConstructionHeader',
      'ConstructionHero',
      'ConstructionStatsStrip',
      'ConstructionOfferingsRows',
      'ConstructionAboutSplit',
      'ConstructionProcessTimeline',
      'ConstructionProjectGallery',
      'ConstructionFeaturedProject',
      'ConstructionProductsShowcase',
      'ConstructionWhyChooseUs',
      'ConstructionClientsGrid',
      'ConstructionTestimonials',
      'ConstructionLeadFormFAQ',
      'ConstructionTaglineStrip',
      'ConstructionFooter',
      'ConstructionFloatingActions',
    ]);
  });

  it('Sectors grid ships 8 items with number tags and hrefs', async () => {
    createPage.mockResolvedValueOnce({ id: 'page-home' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      templatePack: 'construction',
      navigationPages: ['Home'],
    });

    const call = createPage.mock.calls[0][0];
    const sectors = call.data.content.find((b) => b.type === 'ConstructionProjectGallery');
    expect(sectors.props.project8Title).toBe('Sector Eight');
    expect(sectors.props.project1NumberTag).toBe('01');
    expect(sectors.props.project1Href).toBe('#sector-1');
  });

  it('Header and Footer nav links reflect the real selected page set, not a hardcoded default', async () => {
    createPage
      .mockResolvedValueOnce({ id: 'page-home' })
      .mockResolvedValueOnce({ id: 'page-services' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      templatePack: 'construction',
      navigationPages: ['Home', 'Services'],
    });

    const expectedLinks = 'Home|#\nServices|#';
    const homeCall = createPage.mock.calls[0][0];
    const header = homeCall.data.content.find((b) => b.type === 'ConstructionHeader');
    const footer = homeCall.data.content.find((b) => b.type === 'ConstructionFooter');
    expect(header.props.links).toBe(expectedLinks);
    expect(footer.props.links).toBe(expectedLinks);
  });

  it('non-home construction pages still use the plain NavBar/ConstructionHero/Footer path with the new hero shape', async () => {
    createPage
      .mockResolvedValueOnce({ id: 'page-home' })
      .mockResolvedValueOnce({ id: 'page-about' });

    await getDriver('website').execute({
      run: makeRun(),
      stageRecord: makeStageRecord(),
      userId: 'user-1',
      projectId: 'proj-A',
      templatePack: 'construction',
      navigationPages: ['Home', 'About'],
    });

    const aboutCall = createPage.mock.calls[1][0];
    const navBar = aboutCall.data.content.find((b) => b.type === 'NavBar');
    const hero = aboutCall.data.content.find((b) => b.type === 'ConstructionHero');
    expect(navBar).toBeTruthy();
    expect(hero.props.headline).toBe('About Our Company');
    // New shape's slide1Image must be populated so ConstructionHero's
    // slider never renders empty on non-home pages after the shape change.
    expect(hero.props.slide1Image).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd backend && npx vitest run src/modules/template-engine/drivers/website.driver.test.js -t "construction pack seeding"`
Expected: FAIL — `types` won't match (current seeder still emits `NavBar`/old `ConstructionHero`/4-block middle), and `ConstructionHeader`/`ConstructionFooter`/new Sectors fields don't exist yet in the seeded props.

- [ ] **Step 3: Update `NAV_LINK_PROP_BY_BLOCK_TYPE`**

Change (line 56):

```js
const NAV_LINK_PROP_BY_BLOCK_TYPE = { NavBar: 'links', Footer: 'links', MedicalTopNav: 'navLinks' };
```

to:

```js
const NAV_LINK_PROP_BY_BLOCK_TYPE = {
  NavBar: 'links',
  Footer: 'links',
  MedicalTopNav: 'navLinks',
  ConstructionHeader: 'links',
  ConstructionFooter: 'links',
};
```

- [ ] **Step 4: Replace the entire construction-seeder section (currently lines 483-651, from the `// ─── Construction pack seeder` comment to the end of the file) with:**

```js
// ─── Construction pack seeder (KDL-558 task 3/5, homepage KDL-558 step N) ──
//
// Not wired to the Templates step yet. Home gets a full, real homepage
// (16 blocks) built from the construction pack's own components. About/
// Contact/generic pages keep the same lean NavBar + ConstructionHero +
// one section + Footer shape they always had — only Home's content
// changed here.

const CONSTRUCTION_HERO_BY_KEY = {
  about: {
    badgeText: '',
    headline: 'About Our Company',
    highlightWord: '',
    subheadline:
      'Decades of building experience, one crew you can trust from groundbreak to handover.',
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    avatar1: '',
    avatar2: '',
    avatar3: '',
    trustText: '',
    slide1Image: dummyImage(900, 700, 'Our Team'),
    slide1Tag: '',
    slide1Title: '',
    slide1Subtitle: '',
    slide2Image: '',
    slide2Tag: '',
    slide2Title: '',
    slide2Subtitle: '',
    slide3Image: '',
    slide3Tag: '',
    slide3Title: '',
    slide3Subtitle: '',
    slide4Image: '',
    slide4Tag: '',
    slide4Title: '',
    slide4Subtitle: '',
    slide5Image: '',
    slide5Tag: '',
    slide5Title: '',
    slide5Subtitle: '',
  },
  contact: {
    badgeText: '',
    headline: 'Get a Free Quote',
    highlightWord: '',
    subheadline:
      'Tell us about your project and our estimators will get back to you within 48 hours.',
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    avatar1: '',
    avatar2: '',
    avatar3: '',
    trustText: '',
    slide1Image: dummyImage(900, 700, 'Contact Us'),
    slide1Tag: '',
    slide1Title: '',
    slide1Subtitle: '',
    slide2Image: '',
    slide2Tag: '',
    slide2Title: '',
    slide2Subtitle: '',
    slide3Image: '',
    slide3Tag: '',
    slide3Title: '',
    slide3Subtitle: '',
    slide4Image: '',
    slide4Tag: '',
    slide4Title: '',
    slide4Subtitle: '',
    slide5Image: '',
    slide5Tag: '',
    slide5Title: '',
    slide5Subtitle: '',
  },
};

const CONSTRUCTION_STATS_STRIP = {
  stat1Value: '25+',
  stat1Label: 'Years in Business',
  stat2Value: '850+',
  stat2Label: 'Projects Completed',
  stat3Value: '₹500 Cr+',
  stat3Label: 'Work Executed',
  stat4Value: '98%',
  stat4Label: 'Client Satisfaction',
  background: 'dark',
  padding: 'md',
};

const CONSTRUCTION_QUOTE_CTA = {
  headline: 'Ready to Start Your Project?',
  subtext:
    'Get a detailed, no-obligation quote within 48 hours. Our estimators will assess your site and deliver a comprehensive scope of work.',
  ctaLabel: 'Request a Free Quote',
  ctaHref: '#contact',
  phoneNumber: '+91-98765-43210',
  phoneLabel: 'Or call us directly',
  background: 'dark',
};

const CONSTRUCTION_TEAM_CREW = {
  sectionTitle: 'Meet Our Team',
  sectionSubtitle: 'Experienced professionals committed to delivering quality on every project.',
  member1Name: 'Ramesh Kapoor',
  member1Role: 'Director & Project Head',
  member1Image: dummyImage(400, 400, 'RK'),
  member2Name: 'Sunita Joshi',
  member2Role: 'Senior Site Engineer',
  member2Image: dummyImage(400, 400, 'SJ'),
  member3Name: 'Arun Mehta',
  member3Role: 'Safety & Compliance Officer',
  member3Image: dummyImage(400, 400, 'AM'),
  member4Name: 'Priya Nair',
  member4Role: 'Estimation & Contracts',
  member4Image: dummyImage(400, 400, 'PN'),
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_TESTIMONIALS = {
  sectionTitle: 'What Our Clients Say',
  quote1Text:
    'The team delivered our 12-unit residential complex three weeks ahead of schedule, without a single quality defect. Exceptional work.',
  quote1Author: 'Venkat Reddy',
  quote1Company: 'Reddy Builders Pvt Ltd',
  quote1Initials: 'VR',
  quote2Text:
    'Their safety record across our 18-month infrastructure project was impeccable. Zero LTIs. We will work with them again.',
  quote2Author: 'Anita Sharma',
  quote2Company: 'National Highways Authority (Vendor)',
  quote2Initials: 'AS',
  quote3Text:
    'Transparent budgeting and weekly reporting made it easy to track progress. No surprises. Highly recommended.',
  quote3Author: 'Mohan Das',
  quote3Company: 'Das Commercial Properties',
  quote3Initials: 'MD',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_MIDDLE_BY_KEY = {
  about: (pageKey) => [
    block(pageKey, 'ConstructionTeamCrew', CONSTRUCTION_TEAM_CREW),
    block(pageKey, 'ConstructionStatsStrip', CONSTRUCTION_STATS_STRIP),
  ],
  contact: (pageKey) => [block(pageKey, 'ConstructionQuoteCTA', CONSTRUCTION_QUOTE_CTA)],
};

// Same reasoning as genericHero()/genericMedicalHero() above.
function genericConstructionHero(pageTitle) {
  return {
    badgeText: '',
    headline: pageTitle,
    highlightWord: '',
    subheadline: `Learn more about ${pageTitle.toLowerCase()}.`,
    ctaLabel: '',
    ctaHref: '#',
    secondaryLabel: '',
    secondaryHref: '#',
    avatar1: '',
    avatar2: '',
    avatar3: '',
    trustText: '',
    slide1Image: dummyImage(900, 700, pageTitle),
    slide1Tag: '',
    slide1Title: '',
    slide1Subtitle: '',
    slide2Image: '',
    slide2Tag: '',
    slide2Title: '',
    slide2Subtitle: '',
    slide3Image: '',
    slide3Tag: '',
    slide3Title: '',
    slide3Subtitle: '',
    slide4Image: '',
    slide4Tag: '',
    slide4Title: '',
    slide4Subtitle: '',
    slide5Image: '',
    slide5Tag: '',
    slide5Title: '',
    slide5Subtitle: '',
  };
}

// ─── Home page: full construction homepage (KDL-558) ────────────────────

const CONSTRUCTION_HERO_HOME = {
  badgeText: 'Trusted General Contractor',
  headline: 'Building Your Vision, On Time & On Budget',
  highlightWord: 'Vision',
  subheadline:
    'Award-winning general contractor serving residential and commercial clients across the region. Licensed, insured, and safety-certified.',
  ctaLabel: 'Get a Free Quote',
  ctaHref: '#quote',
  secondaryLabel: 'See Our Work',
  secondaryHref: '#projects',
  avatar1: dummyImage(80, 80, 'C1'),
  avatar2: dummyImage(80, 80, 'C2'),
  avatar3: dummyImage(80, 80, 'C3'),
  trustText: '500+ clients trust us',
  slide1Image: dummyImage(900, 700, 'Project One'),
  slide1Tag: 'Residential',
  slide1Title: 'Riverside Villas',
  slide1Subtitle: 'A 24-unit residential development delivered ahead of schedule.',
  slide2Image: dummyImage(900, 700, 'Project Two'),
  slide2Tag: 'Commercial',
  slide2Title: 'Tech Park Phase 2',
  slide2Subtitle: 'A 6-storey commercial office park with LEED-aligned design.',
  slide3Image: dummyImage(900, 700, 'Project Three'),
  slide3Tag: 'Infrastructure',
  slide3Title: 'Highway Bridge Rehab',
  slide3Subtitle: 'Structural rehabilitation completed with zero traffic disruption.',
  slide4Image: dummyImage(900, 700, 'Project Four'),
  slide4Tag: 'Institutional',
  slide4Title: 'School Expansion Wing',
  slide4Subtitle: 'A new academic wing built during active term time.',
  slide5Image: dummyImage(900, 700, 'Project Five'),
  slide5Tag: 'Industrial',
  slide5Title: 'Industrial Warehouse',
  slide5Subtitle: 'A 90,000 sq ft warehouse and logistics facility.',
};

const CONSTRUCTION_OFFERINGS_ROWS = {
  sectionTitle: 'Our Core Offerings',
  sectionSubtitle: 'Everything you need from a single, accountable contractor.',
  offering1NumberTag: '01',
  offering1Image: dummyImage(700, 500, 'Offering One'),
  offering1Heading: 'Structural Construction',
  offering1Description: 'End-to-end structural builds engineered to code, from footings to rooftop.',
  offering1BrandNames: 'Brand One · Brand Two',
  offering1Href: '#',
  offering2NumberTag: '02',
  offering2Image: dummyImage(700, 500, 'Offering Two'),
  offering2Heading: 'MEP & Systems Integration',
  offering2Description: 'Mechanical, electrical, and plumbing systems coordinated under one schedule.',
  offering2BrandNames: 'Brand Three · Brand Four',
  offering2Href: '#',
  offering3NumberTag: '03',
  offering3Image: dummyImage(700, 500, 'Offering Three'),
  offering3Heading: 'Finishing & Interiors',
  offering3Description: 'Precision finishing work that turns a shell into a move-in-ready space.',
  offering3BrandNames: 'Brand Five · Brand Six',
  offering3Href: '#',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_ABOUT_SPLIT = {
  eyebrow: 'About Us',
  heading: 'Two Decades of Building With Integrity',
  paragraph:
    'We are a full-service general contractor delivering residential, commercial, and infrastructure projects. Our in-house engineering and project management teams keep every job transparent, on schedule, and within budget.',
  photo: dummyImage(700, 800, 'Our Team'),
  badgeNumber: '15+',
  badgeLabel: 'Years Experience',
  check1Text: 'Licensed & fully insured',
  check2Text: 'In-house engineering team',
  check3Text: 'Transparent weekly reporting',
  brochureLabel: 'Download Brochure',
  brochureHref: '#',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_PROCESS_TIMELINE = {
  sectionTitle: 'How We Work',
  sectionSubtitle: 'A structured, transparent process from consultation to project handover.',
  step1Title: 'Initial Consultation',
  step1Description:
    'We listen to your vision, review the site, and understand your budget and timeline constraints.',
  step2Title: 'Detailed Estimation',
  step2Description:
    'Our estimators produce a line-item BOQ with material specifications, labour rates, and contingencies.',
  step3Title: 'Contract & Mobilisation',
  step3Description:
    'We finalise scope, sign a fixed-price contract, obtain permits, and mobilise crew and machinery.',
  step4Title: 'Construction & Oversight',
  step4Description:
    'Daily site management, weekly client progress reports, and third-party quality audits throughout execution.',
  step5Title: 'Handover & Warranty',
  step5Description:
    'Final snag clearance, documentation handover, and a 12-month defect liability period for your peace of mind.',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_SECTORS_GRID = {
  sectionTitle: 'Sectors We Serve',
  sectionSubtitle: 'Specialised delivery across every major construction vertical.',
  project1Title: 'Sector One',
  project1Category: 'Residential',
  project1Image: dummyImage(600, 450, 'Sector One'),
  project1NumberTag: '01',
  project1Description: 'Placeholder description for this sector.',
  project1Href: '#sector-1',
  project2Title: 'Sector Two',
  project2Category: 'Commercial',
  project2Image: dummyImage(600, 450, 'Sector Two'),
  project2NumberTag: '02',
  project2Description: 'Placeholder description for this sector.',
  project2Href: '#sector-2',
  project3Title: 'Sector Three',
  project3Category: 'Infrastructure',
  project3Image: dummyImage(600, 450, 'Sector Three'),
  project3NumberTag: '03',
  project3Description: 'Placeholder description for this sector.',
  project3Href: '#sector-3',
  project4Title: 'Sector Four',
  project4Category: 'Institutional',
  project4Image: dummyImage(600, 450, 'Sector Four'),
  project4NumberTag: '04',
  project4Description: 'Placeholder description for this sector.',
  project4Href: '#sector-4',
  project5Title: 'Sector Five',
  project5Category: 'Industrial',
  project5Image: dummyImage(600, 450, 'Sector Five'),
  project5NumberTag: '05',
  project5Description: 'Placeholder description for this sector.',
  project5Href: '#sector-5',
  project6Title: 'Sector Six',
  project6Category: 'Specialist',
  project6Image: dummyImage(600, 450, 'Sector Six'),
  project6NumberTag: '06',
  project6Description: 'Placeholder description for this sector.',
  project6Href: '#sector-6',
  project7Title: 'Sector Seven',
  project7Category: 'Hospitality',
  project7Image: dummyImage(600, 450, 'Sector Seven'),
  project7NumberTag: '07',
  project7Description: 'Placeholder description for this sector.',
  project7Href: '#sector-7',
  project8Title: 'Sector Eight',
  project8Category: 'Retail',
  project8Image: dummyImage(600, 450, 'Sector Eight'),
  project8NumberTag: '08',
  project8Description: 'Placeholder description for this sector.',
  project8Href: '#sector-8',
  padding: 'md',
};

const CONSTRUCTION_FEATURED_PROJECT = {
  sectionTitle: 'Featured Project',
  image: dummyImage(900, 650, 'Featured Project'),
  paragraph:
    'A ground-up commercial build delivered across 14 months — from site mobilisation to final handover — with zero schedule slippage.',
  scope1Icon: 'hardhat',
  scope1Label: 'Site Development',
  scope2Icon: 'shield',
  scope2Label: 'Safety Compliance',
  scope3Icon: 'star',
  scope3Label: 'Quality Assurance',
  scope4Icon: 'hardhat',
  scope4Label: 'MEP Coordination',
  linkLabel: 'View Case Study',
  linkHref: '#',
  ctaLabel: 'Start Your Project',
  ctaHref: '#quote',
  padding: 'md',
  background: 'muted',
};

const CONSTRUCTION_PRODUCTS_SHOWCASE = {
  sectionTitle: 'Our Products',
  sectionSubtitle: 'Sourced and supplied through our vetted vendor network.',
  category1Label: 'Category One',
  category2Label: 'Category Two',
  category3Label: 'Category Three',
  category4Label: 'Category Four',
  product1Category: 'Category One',
  product1Icon: 'hardhat',
  product1Title: 'Product One',
  product1Description: 'Placeholder product description for this listing.',
  product2Category: 'Category One',
  product2Icon: 'shield',
  product2Title: 'Product Two',
  product2Description: 'Placeholder product description for this listing.',
  product3Category: 'Category Two',
  product3Icon: 'star',
  product3Title: 'Product Three',
  product3Description: 'Placeholder product description for this listing.',
  product4Category: 'Category Two',
  product4Icon: 'hardhat',
  product4Title: 'Product Four',
  product4Description: 'Placeholder product description for this listing.',
  product5Category: 'Category Three',
  product5Icon: 'shield',
  product5Title: 'Product Five',
  product5Description: 'Placeholder product description for this listing.',
  product6Category: 'Category Three',
  product6Icon: 'star',
  product6Title: 'Product Six',
  product6Description: 'Placeholder product description for this listing.',
  product7Category: 'Category Four',
  product7Icon: 'hardhat',
  product7Title: 'Product Seven',
  product7Description: 'Placeholder product description for this listing.',
  product8Category: 'Category Four',
  product8Icon: 'shield',
  product8Title: 'Product Eight',
  product8Description: 'Placeholder product description for this listing.',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_WHY_CHOOSE_US = {
  sectionTitle: 'Why Choose Us',
  sectionSubtitle:
    'We combine deep technical expertise with a relentless focus on timelines, budget, and safety.',
  point1Title: 'Fixed-Price Contracts',
  point1Description: 'No surprises. We absorb cost overruns within scope — your budget stays intact.',
  point2Title: 'Licensed & Insured',
  point2Description:
    'Fully licensed by PWD, CPWD-empanelled, and covered under comprehensive workmen compensation.',
  point3Title: 'On-Time Delivery',
  point3Description:
    '93% of our projects are delivered on or before the agreed schedule over the last 5 years.',
  point4Title: '24/7 Site Supervision',
  point4Description:
    'Dedicated engineers on-site daily. Real-time reporting via our project management portal.',
  ctaLabel: 'Start a Conversation',
  ctaHref: '#contact',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_CLIENTS_GRID = {
  sectionTitle: 'Trusted By',
  sectionSubtitle: 'A selection of clients we have partnered with.',
  client1Logo: dummyImage(200, 100, 'Client 1'),
  client1Name: 'Client 1',
  client2Logo: dummyImage(200, 100, 'Client 2'),
  client2Name: 'Client 2',
  client3Logo: dummyImage(200, 100, 'Client 3'),
  client3Name: 'Client 3',
  client4Logo: dummyImage(200, 100, 'Client 4'),
  client4Name: 'Client 4',
  client5Logo: dummyImage(200, 100, 'Client 5'),
  client5Name: 'Client 5',
  client6Logo: dummyImage(200, 100, 'Client 6'),
  client6Name: 'Client 6',
  client7Logo: dummyImage(200, 100, 'Client 7'),
  client7Name: 'Client 7',
  client8Logo: dummyImage(200, 100, 'Client 8'),
  client8Name: 'Client 8',
  client9Logo: dummyImage(200, 100, 'Client 9'),
  client9Name: 'Client 9',
  client10Logo: dummyImage(200, 100, 'Client 10'),
  client10Name: 'Client 10',
  client11Logo: dummyImage(200, 100, 'Client 11'),
  client11Name: 'Client 11',
  client12Logo: dummyImage(200, 100, 'Client 12'),
  client12Name: 'Client 12',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_LEAD_FORM_FAQ = {
  sectionTitle: 'Frequently Asked Questions',
  faq1Question: 'How long does a typical project take?',
  faq1Answer: 'Timelines vary by scope — a detailed schedule is provided after site assessment.',
  faq2Question: 'Do you provide fixed-price contracts?',
  faq2Answer: 'Yes, most projects are quoted and contracted on a fixed-price basis.',
  faq3Question: 'Are you licensed and insured?',
  faq3Answer: 'Yes, we are fully licensed and carry comprehensive insurance cover.',
  faq4Question: 'Can I see your past work?',
  faq4Answer: 'Yes — see the Sectors and Featured Project sections above, or request our portfolio.',
  faq5Question: 'Do you handle permits and approvals?',
  faq5Answer: 'Yes, permit acquisition is coordinated as part of our project management scope.',
  faq6Question: 'What areas do you serve?',
  faq6Answer: 'We currently serve residential and commercial clients across the region.',
  formHeading: 'Get a Free Quote',
  formSubtext: 'Tell us about your project and our team will get back to you within 48 hours.',
  padding: 'md',
  background: 'white',
};

const CONSTRUCTION_FLOATING_ACTIONS = {
  whatsappHref: 'https://wa.me/919876543210',
};

function constructionHeaderProps(brand = {}, pages) {
  return {
    brand: brand.companyName || 'Your Brand',
    logoUrl: brand.logoUrl || '',
    links: navLinksFor(pages),
    loginLabel: 'Login',
    loginHref: '#login',
    ctaLabel: 'Get a Quote',
    ctaHref: '#quote',
    primaryColor: brand.primaryHex || '',
  };
}

function constructionTaglineStripProps(brand = {}) {
  return {
    logoUrl: brand.logoUrl || '',
    brand: brand.companyName || 'Your Brand',
    tagline: 'Building with integrity, delivering with precision.',
  };
}

function constructionFooterProps(brand = {}, pages) {
  const name = brand.companyName || 'Your Brand';
  const lastUpdated = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return {
    logoUrl: brand.logoUrl || '',
    brand: name,
    tagline: 'Building with integrity, delivering with precision.',
    social1Label: 'f',
    social1Href: '#',
    social2Label: 'in',
    social2Href: '#',
    social3Label: 'ig',
    social3Href: '#',
    social4Label: 'x',
    social4Href: '#',
    newsletterPlaceholder: 'Your email address',
    newsletterButtonLabel: 'Subscribe',
    companyLinksTitle: 'Company',
    links: navLinksFor(pages),
    contactTitle: 'Contact',
    contactPhone: '+91-98765-43210',
    contactEmail: `info@${name.toLowerCase().replace(/\s+/g, '')}.com`,
    contactAddress: '123 Business Avenue\nCity, State 000000',
    showroomTitle: 'Showroom',
    showroomAddress: '456 Showroom Road\nCity, State 000000',
    qrImage: dummyImage(160, 160, 'QR Code'),
    qrCaption: 'Scan for directions',
    copyright: `© ${new Date().getFullYear()} ${name}. All rights reserved. · Last updated ${lastUpdated}`,
  };
}

function constructionHomeContent(pageKey, brand, pages) {
  return [
    block(pageKey, 'ConstructionHeader', constructionHeaderProps(brand, pages)),
    block(pageKey, 'ConstructionHero', CONSTRUCTION_HERO_HOME),
    block(pageKey, 'ConstructionStatsStrip', CONSTRUCTION_STATS_STRIP),
    block(pageKey, 'ConstructionOfferingsRows', CONSTRUCTION_OFFERINGS_ROWS),
    block(pageKey, 'ConstructionAboutSplit', CONSTRUCTION_ABOUT_SPLIT),
    block(pageKey, 'ConstructionProcessTimeline', CONSTRUCTION_PROCESS_TIMELINE),
    block(pageKey, 'ConstructionProjectGallery', CONSTRUCTION_SECTORS_GRID),
    block(pageKey, 'ConstructionFeaturedProject', CONSTRUCTION_FEATURED_PROJECT),
    block(pageKey, 'ConstructionProductsShowcase', CONSTRUCTION_PRODUCTS_SHOWCASE),
    block(pageKey, 'ConstructionWhyChooseUs', CONSTRUCTION_WHY_CHOOSE_US),
    block(pageKey, 'ConstructionClientsGrid', CONSTRUCTION_CLIENTS_GRID),
    block(pageKey, 'ConstructionTestimonials', CONSTRUCTION_TESTIMONIALS),
    block(pageKey, 'ConstructionLeadFormFAQ', CONSTRUCTION_LEAD_FORM_FAQ),
    block(pageKey, 'ConstructionTaglineStrip', constructionTaglineStripProps(brand)),
    block(pageKey, 'ConstructionFooter', constructionFooterProps(brand, pages)),
    block(pageKey, 'ConstructionFloatingActions', CONSTRUCTION_FLOATING_ACTIONS),
  ];
}

export function seedConstructionPageData(pageKey, pageTitle, brand = {}, pages) {
  if (pageKey === 'home') {
    return {
      root: { props: { title: pageTitle } },
      content: constructionHomeContent(pageKey, brand, pages),
      zones: {},
    };
  }
  const buildMiddle = CONSTRUCTION_MIDDLE_BY_KEY[pageKey];
  const content = [
    block(pageKey, 'NavBar', navBarProps(brand, pages)),
    block(
      pageKey,
      'ConstructionHero',
      CONSTRUCTION_HERO_BY_KEY[pageKey] ?? genericConstructionHero(pageTitle)
    ),
    ...(buildMiddle ? buildMiddle(pageKey) : genericMiddle(pageKey, pageTitle)),
    block(pageKey, 'Footer', footerProps(brand, pages)),
  ];
  return { root: { props: { title: pageTitle } }, content, zones: {} };
}
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `cd backend && npx vitest run src/modules/template-engine/drivers/website.driver.test.js`
Expected: PASS — all tests in the file, including the 4 new ones and every pre-existing one (About/Contact and the other seeders are untouched).

- [ ] **Step 6: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: PASS, same total count as before plus 4.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/template-engine/drivers/website-seed-content.js backend/src/modules/template-engine/drivers/website.driver.test.js
git commit -m "feat(template-engine): wire full construction homepage into seedConstructionPageData"
```

---

### Task 15: Manual Playwright verification

**Files:** none (verification only)

- [ ] **Step 1: Rebuild containers from the repo root**

```bash
cd "/Users/f9developer/Documents/Claude/Projects/F9 Tech/kdl-starter-kit"
docker compose build frontend backend
docker compose up -d frontend backend
```

- [ ] **Step 2: Seed a fresh project's WEBSITE stage with `templatePack: 'construction'`**

Use an existing template-engine run (or create one), then call advance directly:

```bash
curl -s -X POST http://localhost:4100/api/template-engine/runs/<runId>/advance \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"stage":"WEBSITE","body":{"templatePack":"construction","navigationPages":["Home","About","Products","Services","Sectors","Contact"]}}'
```

Expected: 6 pages created/updated, `home`'s `pageKeyToId` present in the response.

- [ ] **Step 3: Open the seeded Home page's public render**

Navigate to `http://localhost:3101/p/te-<runId>-home` in a browser at three widths: 375px (mobile), 768px (tablet), 1440px (desktop).

Confirm for each width:
- Header is sticky on scroll; on mobile, the hamburger opens a full-screen panel with all 6 nav links + Login + Get a Quote, and the X closes it.
- Hero shows the badge, the highlighted word in the headline, both CTAs, the 3 overlapping avatars + trust text, and the slider's dot navigation changes the image/tag/title/subtitle when clicked.
- Stats strip, Offerings rows (alternating image position), About split (with the circular badge overlay), How We Work steps, Sectors grid (8 cards with number tag + gradient overlay + description), Featured Project (pill scope tags), Why Choose Us, Testimonials (avatar-initials circle + 5 stars) all render with no missing/undefined text.
- Products Showcase: clicking each of the 4 category tabs swaps the visible product grid.
- Clients grid: clicking each pagination dot swaps the visible 6 logos.
- Lead Form + FAQ: clicking a FAQ question expands/collapses its answer; the form's Submit button does not navigate or reload the page.
- Tagline strip, 4-column Footer (with QR image + Company links reflecting the real page list), and the floating WhatsApp + Back-to-top buttons are all visible and functional (Back-to-top scrolls smoothly to the top; WhatsApp opens `wa.me` in a new tab).

- [ ] **Step 4: Confirm no regression on About/Contact**

Navigate to `http://localhost:3101/p/te-<runId>-about` and `.../contact`. Confirm the hero renders with real (non-empty) text and a background slide image — not a blank/broken hero — proving the `ConstructionHero` shape-change migration in Task 14 didn't break these pages.

- [ ] **Step 5: Report results to the user**

Summarize pass/fail per section above; file any visual bugs found as follow-up fixes before considering the feature done.
