import type { Config } from '@puckeditor/core'
import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Eye, Rocket } from 'lucide-react'
import type { ComponentPack } from '../types'
import { imageField } from '../image-field'
import { InlineEditableText } from '../inline-editable-text'
import { teamMemberField } from '../team-member-field'
import { useSettingsFieldValues } from '../use-settings-field-values'
import { useHeaderMenuTree, HeaderNavMenu } from '../header-nav-menu'

// ── shared helpers ────────────────────────────────────────────────────────────

// Bootstrap Icons (the client-approved mockups use them) — served from
// /vendor/bootstrap-icons, stylesheet injected once on first use.
function BiIcon({ name, className = '' }: { name: string; className?: string }) {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('bi-icons-css')) return
    const l = document.createElement('link')
    l.id = 'bi-icons-css'
    l.rel = 'stylesheet'
    l.href = '/vendor/bootstrap-icons/bootstrap-icons.css'
    document.head.appendChild(l)
  }, [])
  return <i className={`bi ${name} ${className}`} aria-hidden="true" />
}

// "100%" -> 100 + orange %, as in the mockup's stat cards.
function StatValue({ value }: { value: string }) {
  return value.endsWith('%') ? (
    <>
      {value.slice(0, -1)}
      <em className="not-italic text-[#e8622c]">%</em>
    </>
  ) : (
    <>{value}</>
  )
}

const padY = { sm: 'py-8', md: 'py-14', lg: 'py-24' } as const
const wrap = 'mx-auto max-w-6xl px-4 md:px-8'

// Text-badge fallback for platform indicators — no lucide-react social icons
// (Facebook/Instagram/LinkedIn/YouTube) are imported anywhere in this file, so
// a small colored initials badge is used instead of adding a new dependency.
const socialPlatformBadge: Record<
  'instagram' | 'facebook' | 'linkedin' | 'youtube',
  { label: string; cls: string }
> = {
  instagram: { label: 'IG', cls: 'bg-gradient-to-br from-purple-600 to-pink-500' },
  facebook: { label: 'FB', cls: 'bg-blue-600' },
  linkedin: { label: 'in', cls: 'bg-sky-800' },
  youtube: { label: 'YT', cls: 'bg-red-600' },
}

// Shared option lists + style resolver for the "Slider Settings" /
// "Typography" Style-tab accordions (blocks-panel.tsx `SplitFieldEditor`
// groups any `slider*`/`typo*` field into those accordions automatically —
// see `isStyleField` there). Font size/weight are resolved via inline style
// rather than Tailwind utility classes so an override always wins over the
// component's own responsive `text-3xl md:text-5xl`-style classes.
const FONT_SIZE_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Small', value: 'sm' },
  { label: 'Base', value: 'base' },
  { label: 'Large', value: 'lg' },
  { label: 'XL', value: 'xl' },
  { label: '2XL', value: '2xl' },
  { label: '3XL', value: '3xl' },
  { label: '4XL', value: '4xl' },
  { label: '5XL', value: '5xl' },
] as const

const FONT_WEIGHT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'Normal', value: 'normal' },
  { label: 'Medium', value: 'medium' },
  { label: 'Semibold', value: 'semibold' },
  { label: 'Bold', value: 'bold' },
  { label: 'Extrabold', value: 'extrabold' },
] as const

const FONT_SIZE_PX: Record<string, string> = {
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px',
  '5xl': '48px',
}

const FONT_WEIGHT_VAL: Record<string, string> = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
}

function typoStyle(size?: string, weight?: string, color?: string): CSSProperties {
  const style: CSSProperties = {}
  if (size && FONT_SIZE_PX[size]) style.fontSize = FONT_SIZE_PX[size]
  if (weight && FONT_WEIGHT_VAL[weight]) style.fontWeight = FONT_WEIGHT_VAL[weight]
  if (color) style.color = color
  return style
}

// Brand-color-aware contrast helpers — a solid-color header (Design 3) needs
// its accent strip visibly distinct from the main bar and its text/icons
// readable against whatever brand color the bar ends up being (reported:
// "why look like this?? ... all should be visable not the logo and nav
// also not visable" when primaryColor happened to be red, same as the
// hardcoded red accent strip and red login text — everything collapsed
// into one unreadable block). No palette-role plumbing beyond the two
// colors already available (primary/secondary): a distinct accent is
// derived by shading the bar color itself when secondary is missing or too
// close to it, so this always produces a visible result with zero new data
// requirements.
function hexToRgb(hex: string | undefined): { r: number; g: number; b: number } | null {
  const clean = (hex || '').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  const num = parseInt(clean, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b)
}

// Black or white, whichever reads better against `hex`.
function readableTextColor(hex: string | undefined, fallback = '#111827'): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return fallback
  return relativeLuminance(rgb) > 0.55 ? '#111827' : '#ffffff'
}

function colorsAreClose(hexA: string | undefined, hexB: string | undefined): boolean {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return false
  return Math.abs(relativeLuminance(a) - relativeLuminance(b)) < 0.18
}

// Push `hex` toward black (amount < 0) or white (amount > 0) by `amount`
// (0-1) — a guaranteed-distinct fallback accent when there's no usable
// secondary color to contrast against the bar.
function shadeColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const adjust = (c: number) =>
    Math.max(0, Math.min(255, Math.round(amount > 0 ? c + (255 - c) * amount : c + c * amount)))
  const toHex = (c: number) => c.toString(16).padStart(2, '0')
  return `#${toHex(adjust(rgb.r))}${toHex(adjust(rgb.g))}${toHex(adjust(rgb.b))}`
}

// The accent strip's color: the brand's secondary color if it's actually
// distinct from the bar, otherwise a shaded version of the bar color
// itself (always visible, never requires a second brand color to exist).
function accentColorFor(barColor: string, secondaryColor: string | undefined): string {
  if (secondaryColor && !colorsAreClose(secondaryColor, barColor)) return secondaryColor
  const rgb = hexToRgb(barColor)
  const isLight = rgb ? relativeLuminance(rgb) > 0.55 : false
  return shadeColor(barColor, isLight ? -0.45 : 0.45)
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): {
  h: number
  s: number
  l: number
} {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d) % 6
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h = (h * 60 + 360) % 360
  return { h, s, l }
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r0, g0, b0] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r0)}${toHex(g0)}${toHex(b0)}`
}

// A vivid, hue-shifted twin of `hex` — for a two-tone block layout (Footer
// Design 2) where the accent needs to visibly read as a *different* color,
// not just a lighter/darker version of the same hue. Plain lightness
// shading (shadeColor) keeps the same hue, so an orange bar's "shaded"
// accent is still orange — reported as "still not change" on a project
// whose brand secondary is an unsaturated placeholder gray (reads as
// same-family as the primary once shaded). Rotating the hue guarantees a
// different color family regardless of the input.
function hueShiftAccent(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#f5a623'
  const { h } = rgbToHsl(rgb)
  return hslToHex((h + 45) % 360, 0.85, 0.55)
}

// Whether `hex` is saturated/distinct enough from `barColor` to use as-is
// for a colorful two-tone accent — a low-saturation brand "secondary"
// (an unset placeholder gray, common when no real second color was ever
// chosen) isn't colorful even when its luminance test passes, so it falls
// through to hueShiftAccent instead of painting a dull gray block.
function isVividAccent(hex: string | undefined, barColor: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const { h, s } = rgbToHsl(rgb)
  if (s < 0.2) return false
  const barHsl = hexToRgb(barColor)
  if (!barHsl) return true
  const hueDiff = Math.abs(h - rgbToHsl(barHsl).h)
  return Math.min(hueDiff, 360 - hueDiff) > 20
}

// A CSS gradient string mixing two brand-palette colors — used everywhere
// a section needs a "colorful" theme-driven background instead of a flat
// single hue, per the standing rule: every section pulls only from the
// project's own primary/secondary/tertiary/quaternary palette (never an
// unrelated hardcoded hue like the old purple/pink promo bar), and
// different sections mix different pairs of those 4 so the whole layout
// doesn't read as one repeated color.
function themeGradient(colorA: string, colorB: string, angle = 135): string {
  return `linear-gradient(${angle}deg, ${colorA}, ${colorB})`
}

// Components that ship 4 designs under a `d1Foo`/`d2Foo`/`d3Foo`/`d4Foo`
// field-naming convention (Hero, Top Bar) have no per-variant field
// scoping from Puck itself — every field for all 4 designs shows at once
// in the right-hand panel regardless of which `variant` is selected,
// a wall of ~70 fields with no indication which ones actually do
// anything for the design you're looking at (reported: editing the Hero
// only offered a way to "change theme and edit the slider" buried in that
// wall, not a scoped/obvious one). `resolveFields` is Puck's supported
// hook for narrowing the fields shown based on current props — keep
// `variant`/`visible` and any shared (non-`d{n}`-prefixed) field always,
// and only the current variant's own `d{variant}...` fields.
function variantFields<T extends Record<string, unknown>>(
  fields: T,
  variant: string | undefined
): Partial<T> {
  const v = variant || '1'
  const otherVariantPrefix = /^d[1-4]/
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([key]) => !otherVariantPrefix.test(key) || key.startsWith(`d${v}`)
    )
  ) as Partial<T>
}

// Neutral gray-box placeholder for logo/QR-style slots — a real stock photo
// would look wrong there (see the dummyImage() twin in the backend seed
// driver). A data: URI, unlike placehold.co, needs no CSP img-src allowlist
// entry since 'data:' is already permitted everywhere.
function dummyLogo(w: number, h: number, label: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="#e2e8f0"/>` +
    `<text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(Math.min(w, h) / 5)}" ` +
    `fill="#64748b" text-anchor="middle" dominant-baseline="middle">${label}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// ── per-component prop shapes ─────────────────────────────────────────────────

type ConstructionProps = {
  ConstructionHeader: {
    variant: '1' | '2' | '3' | '4'
    visible: boolean
    brand: string
    logoUrl: string
    links: string
    loginLabel: string
    loginHref: string
    ctaLabel: string
    ctaHref: string
    phoneNumber: string
    email: string
    primaryColor: string
    secondaryColor: string
    tertiaryColor: string
    quaternaryColor: string
    transparent: boolean
    lightText: boolean
    social1Href: string
    social2Href: string
    social3Href: string
    social4Href: string
  }
  ConstructionTopBar: {
    variant: '1' | '2' | '3' | '4'
    visible: boolean
    primaryColor: string
    secondaryColor: string
    tertiaryColor: string
    quaternaryColor: string
    d1Address: string
    d1Phone: string
    d1Email: string
    d1Link1Label: string
    d1Link1Href: string
    d1Link2Label: string
    d1Link2Href: string
    d1Link3Label: string
    d1Link3Href: string
    d1Social1Href: string
    d1Social2Href: string
    d1Social3Href: string
    d1Social4Href: string
    d2Item1Text: string
    d2Item2Text: string
    d2Item3Text: string
    d2TrackLabel: string
    d2Language: string
    d3Tagline: string
    d3Phone: string
    d3Email: string
    d3CtaLabel: string
    d3CtaHref: string
    d4Tagline: string
    d4Social1Href: string
    d4Social2Href: string
    d4Social3Href: string
    d4Social4Href: string
    d4HelpLabel: string
    d4HelpHref: string
    d4FaqLabel: string
    d4FaqHref: string
    d4Language: string
  }
  ConstructionHero: {
    variant: '1' | '2' | '3' | '4'
    visible: boolean
    primaryColor: string
    secondaryColor: string
    d1Slides: {
      image: string
      badge: string
      headline: string
      subheadline: string
      ctaLabel: string
      ctaHref: string
    }[]
    d2BadgeText: string
    d2BrandsLabel: string
    d2CtaLabel: string
    d2CtaHref: string
    d2SecondaryLabel: string
    d2Avatar1: string
    d2Avatar2: string
    d2Avatar3: string
    d2TrustText: string
    d2Stat1Value: string
    d2Stat1Label: string
    d2Stat2Value: string
    d2Stat2Label: string
    d2Stat3Value: string
    d2Stat3Label: string
    d2Slides: {
      dotLabel: string
      image: string
      lead: string
      highlight: string
      description: string
      brands: { name: string; logo: string }[]
      workHref: string
    }[]
    d3Eyebrow: string
    d3Headline: string
    d3Subheadline: string
    d3CtaLabel: string
    d3CtaHref: string
    d3Slides: {
      image: string
      quote: string
      author: string
      role: string
    }[]
    d4Headline: string
    d4Subheadline: string
    d4CtaLabel: string
    d4CtaHref: string
    d4Slides: {
      icon: IconKey
      title: string
      description: string
    }[]
    sliderShowArrows: boolean
    sliderShowDots: boolean
    sliderAutoplay: boolean
    sliderAutoplaySpeed: number
    sliderLoop: boolean
    sliderTransition: 'slide' | 'fade'
    typoTitleSize: string
    typoTitleWeight: string
    typoTitleColor: string
    typoTaglineSize: string
    typoTaglineWeight: string
    typoTaglineColor: string
    typoParaSize: string
    typoParaWeight: string
    typoParaColor: string
    typoButtonSize: string
    typoButtonWeight: string
    typoButtonColor: string
    activeSlideIndex: number
  }
  ConstructionInnerBanner: {
    variant: '1' | '2' | '3' | '4'
    visible: boolean
    backgroundImage: string
    imageAlt: string
    subtitle: string
    homeHref: string
    eyebrow: string
    parentLabel: string
    parentHref: string
    ctaPrimaryLabel: string
    ctaPrimaryHref: string
    ctaSecondaryLabel: string
    ctaSecondaryHref: string
    headline?: string
    currentLabel?: string
    ctaTertiaryLabel?: string
    ctaTertiaryHref?: string
  }
  ConstructionServicesGrid: {
    sectionTitle: string
    sectionSubtitle: string
    service1Title: string
    service1Description: string
    service2Title: string
    service2Description: string
    service3Title: string
    service3Description: string
    service4Title: string
    service4Description: string
    service5Title: string
    service5Description: string
    service6Title: string
    service6Description: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionProjectGallery: {
    sectionEyebrow?: string
    sectionTitle: string
    sectionSubtitle: string
    items: {
      title: string
      category: string
      image: string
      numberTag: string
      description: string
      href: string
    }[]
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionQuoteCTA: {
    eyebrow?: string
    headline: string
    subtext: string
    ctaLabel: string
    ctaHref: string
    secondaryCtaLabel: string
    secondaryCtaHref: string
    phoneNumber: string
    phoneLabel: string
    background: 'dark' | 'accent' | 'muted'
  }
  ConstructionUrgencyBanner: {
    padding: 'sm' | 'md' | 'lg'
    background: 'accent' | 'dark'
    headline: string
    ctaLabel: string
    ctaHref: string
    phoneNumber: string
    phoneLabel: string
  }
  ConstructionStatsStrip: {
    stat1Value: string
    stat1Label: string
    stat2Value: string
    stat2Label: string
    stat3Value: string
    stat3Label: string
    stat4Value: string
    stat4Label: string
    background: 'dark' | 'accent' | 'muted'
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionTeamCrew: {
    sectionTitle: string
    sectionSubtitle: string
    member1Name: string
    member1Role: string
    member1Image: string
    member2Name: string
    member2Role: string
    member2Image: string
    member3Name: string
    member3Role: string
    member3Image: string
    member4Name: string
    member4Role: string
    member4Image: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionCertificationsBadges: {
    sectionTitle: string
    sectionSubtitle: string
    badge1Label: string
    badge1Detail: string
    badge2Label: string
    badge2Detail: string
    badge3Label: string
    badge3Detail: string
    badge4Label: string
    badge4Detail: string
    badge5Label: string
    badge5Detail: string
    badge6Label: string
    badge6Detail: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionOrgChart: {
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
    heading: string
    topName: string
    topRole: string
    topPhoto: string
    report1Name: string
    report1Role: string
    report1Photo: string
    report2Name: string
    report2Role: string
    report2Photo: string
    report3Name: string
    report3Role: string
    report3Photo: string
  }
  ConstructionTeamStats: {
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
    stat1Value: string
    stat1Label: string
    stat2Value: string
    stat2Label: string
    stat3Value: string
    stat3Label: string
    crew1Photo: string
    crew1Name: string
    crew1YearsWithUs: string
    crew2Photo: string
    crew2Name: string
    crew2YearsWithUs: string
    crew3Photo: string
    crew3Name: string
    crew3YearsWithUs: string
  }
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
  ConstructionTestimonialsCarousel: {
    sectionTitle: string
    slides: CarouselTestimonialSlide[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionVideoTestimonials: {
    sectionTitle: string
    testimonial1Thumbnail: string
    testimonial1Name: string
    testimonial1Quote: string
    testimonial2Thumbnail: string
    testimonial2Name: string
    testimonial2Quote: string
    testimonial3Thumbnail: string
    testimonial3Name: string
    testimonial3Quote: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionProcessTimeline: {
    sectionTitle: string
    sectionSubtitle: string
    step1Title: string
    step1Description: string
    step2Title: string
    step2Description: string
    step3Title: string
    step3Description: string
    step4Title: string
    step4Description: string
    step5Title: string
    step5Description: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionWhyChooseUs: {
    sectionTitle: string
    sectionSubtitle: string
    point1Title: string
    point1Description: string
    point2Title: string
    point2Description: string
    point3Title: string
    point3Description: string
    point4Title: string
    point4Description: string
    ctaLabel: string
    ctaHref: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionSafetyRecord: {
    sectionTitle: string
    sectionSubtitle: string
    incidentFreeDays: string
    safetyRating: string
    trainedWorkers: string
    complianceNote: string
    padding: 'sm' | 'md' | 'lg'
    background: 'dark' | 'accent' | 'muted'
  }
  ConstructionMilestoneTimeline: {
    eyebrow: string
    heading: string
    milestone1Year: string
    milestone1Label: string
    milestone2Year: string
    milestone2Label: string
    milestone3Year: string
    milestone3Label: string
    milestone4Year: string
    milestone4Label: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
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
  ConstructionAboutSplit: {
    useSettings?: boolean
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
    membershipLabel: string
    members: { title: string; logo: string }[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
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
  ConstructionProjectsGridCards: {
    heading: string
    project1Image: string
    project1Title: string
    project1Category: string
    project1Stat: string
    project2Image: string
    project2Title: string
    project2Category: string
    project2Stat: string
    project3Image: string
    project3Title: string
    project3Category: string
    project3Stat: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionProjectShowcaseSplit: {
    image: string
    title: string
    description: string
    stat1Value: string
    stat1Label: string
    stat2Value: string
    stat2Label: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionProjectMapStrip: {
    heading: string
    location1Thumbnail: string
    location1City: string
    location2Thumbnail: string
    location2City: string
    location3Thumbnail: string
    location3City: string
    location4Thumbnail: string
    location4City: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionProductsShowcase: {
    sectionEyebrow: string
    sectionTitle: string
    sectionSubtitle: string
    category1Label: string
    category2Label: string
    category3Label: string
    category4Label: string
    items: {
      category: string
      icon: 'hardhat' | 'shield' | 'star'
      image: string
      title: string
      description: string
      brands: string
      href?: string
      linkLabel?: string
    }[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionClientsGrid: {
    sectionEyebrow: string
    sectionTitle: string
    sectionSubtitle: string
    items: { logo: string; name: string }[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionClientsTestimonialStrip: {
    sectionTitle: string
    client1Logo: string
    client1Quote: string
    client2Logo: string
    client2Quote: string
    client3Logo: string
    client3Quote: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionClientsMarquee: {
    sectionTitle: string
    logo1: string
    logo2: string
    logo3: string
    logo4: string
    logo5: string
    logo6: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionClientsCaseHighlight: {
    spotlightLogo: string
    spotlightStat: string
    spotlightQuote: string
    otherLogo1: string
    otherLogo2: string
    otherLogo3: string
    otherLogo4: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionLeadFormFAQ: {
    sectionEyebrow: string
    sectionTitle: string
    sectionIntroLinkLabel: string
    sectionIntroLinkHref: string
    faqs: { question: string; answer: string }[]
    showFaqs?: boolean
    faqSource?: 'module' | 'block'
    introText?: string
    checklistItems: string
    trustStats: { number: string; label: string }[]
    formHeading: string
    formSubtext: string
    interestOptions: string
    ctaLabel: string
    formPrivacyNote: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionSimpleContactForm: {
    heading: string
    submitLabel: string
  }
  ConstructionQuoteRequestForm: {
    heading: string
    submitLabel: string
    trustText: string
  }
  ConstructionContactSplitMap: {
    eyebrow: string
    heading: string
    subcopy: string
    infoItems: { icon: string; label: string; lines: string; linkPrefix: string }[]
    mapEmbedUrl: string
    formEyebrow: string
    formHeading: string
    formAction: string
    submitLabel: string
  }
  ConstructionTaglineStrip: {
    logoUrl: string
    brand: string
    tagline: string
  }
  ConstructionFloatingActions: {
    whatsappHref: string
    brochureHref: string
    badgeYearLabel: string
    badgeNumber: string
    badgeLabel: string
  }
  ConstructionFooter: {
    variant: '1' | '2' | '3' | '4'
    logoUrl: string
    brand: string
    tagline: string
    aboutTitle: string
    aboutText: string
    aboutLinkLabel: string
    aboutLinkHref: string
    primaryColor: string
    secondaryColor: string
    tertiaryColor: string
    quaternaryColor: string
    social1Label: string
    social1Href: string
    social2Label: string
    social2Href: string
    social3Label: string
    social3Href: string
    social4Label: string
    social4Href: string
    companyLinksTitle: string
    links: string
    group2Title: string
    group2Links: string
    group3Title: string
    group3Links: string
    partnerLogo1Url: string
    partnerLogo2Url: string
    partnerLogo3Url: string
    partnerLogo4Url: string
    badge1Url: string
    badge1Label: string
    badge2Url: string
    badge2Label: string
    policyLinks: string
    group4Links: string
    newsletterTitle: string
    newsletterPlaceholder: string
    newsletterButtonLabel: string
    contactTitle: string
    contactPhone: string
    contactPhone2: string
    contactEmail: string
    contactEmail2: string
    contactAddress: string
    showroomTitle: string
    showroomAddress: string
    regdOfficeTitle: string
    regdOfficeAddress: string
    qrImage: string
    qrCaption: string
    estdYear: string
    copyright: string
  }
  ConstructionFounder: {
    sectionTitle: string
    photo: string
    quoteText: string
    founderName: string
    founderTitle: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionTimelineHistory: {
    eyebrow: string
    heading: string
    subtitle?: string
    entry1Year: string
    entry1Title?: string
    entry1Text: string
    entry1Image: string
    entry2Year: string
    entry2Title?: string
    entry2Text: string
    entry2Image: string
    entry3Year: string
    entry3Title?: string
    entry3Text: string
    entry3Image: string
    entry4Year: string
    entry4Title?: string
    entry4Text: string
    entry4Image: string
    entry5Year: string
    entry5Title?: string
    entry5Text: string
    entry5Image: string
    entry6Year: string
    entry6Title?: string
    entry6Text: string
    entry6Image: string
    entry7Year: string
    entry7Title?: string
    entry7Text: string
    entry7Image: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionLeadershipGrid: {
    eyebrow: string
    heading: string
    leader1Photo: string
    leader1Name: string
    leader1Title: string
    leader1Bio: string
    leader2Photo: string
    leader2Name: string
    leader2Title: string
    leader2Bio: string
    leader3Photo: string
    leader3Name: string
    leader3Title: string
    leader3Bio: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionFounderProfile: {
    eyebrow: string
    heading: string
    person1MemberId: string
    person1Photo: string
    person1Name: string
    person1Role: string
    person1Quote: string
    person1Bio: string
    person1Facts: { icon: string; label: string; value: string }[]
    person1LinkLabel: string
    person1LinkHref: string
    person1Variant: 'dark' | 'light'
    person2MemberId: string
    person2Photo: string
    person2Name: string
    person2Role: string
    person2Bio: string
    person2Ctas: { label: string; href: string }[]
    person2LinkLabel: string
    person2LinkHref: string
    person2Variant: 'orange' | 'light'
    person2Facts: { icon: string; label: string; value: string }[]
    person2MembershipLabel: string
    person2Memberships: { image: string; alt: string }[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionMissionVision: {
    variant: '1' | '2' | '3' | '4'
    visionHeading: string
    visionParagraph1: string
    visionParagraph2: string
    missionHeading: string
    missionParagraph1: string
    missionParagraph2: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionVideo: {
    sectionTitle: string
    sectionSubtitle: string
    thumbnail: string
    videoUrl: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionVideoGrid: {
    heading: string
    video1Thumbnail: string
    video1Title: string
    video1Duration: string
    video2Thumbnail: string
    video2Title: string
    video2Duration: string
    video3Thumbnail: string
    video3Title: string
    video3Duration: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionVideoSplitStats: {
    thumbnail: string
    videoUrl: string
    heading: string
    stat1Value: string
    stat1Label: string
    stat2Value: string
    stat2Label: string
    stat3Value: string
    stat3Label: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionVideoReel: {
    thumbnail: string
    videoUrl: string
    caption: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionBlogPosts: {
    sectionTitle: string
    post1Image: string
    post1Category: string
    post1Title: string
    post1Date: string
    post2Image: string
    post2Category: string
    post2Title: string
    post2Date: string
    post3Image: string
    post3Category: string
    post3Title: string
    post3Date: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionNewsTicker: {
    eyebrow: string
    heading: string
    news1Headline: string
    news1Date: string
    news2Headline: string
    news2Date: string
    news3Headline: string
    news3Date: string
    news4Headline: string
    news4Date: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionCaseStudyGrid: {
    eyebrow: string
    heading: string
    case1Image: string
    case1Client: string
    case1Stat: string
    case1Description: string
    case1LinkLabel: string
    case1LinkHref: string
    case2Image: string
    case2Client: string
    case2Stat: string
    case2Description: string
    case2LinkLabel: string
    case2LinkHref: string
    case3Image: string
    case3Client: string
    case3Stat: string
    case3Description: string
    case3LinkLabel: string
    case3LinkHref: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionSocialMedia: {
    sectionTitle: string
    sectionSubtitle: string
    facebookHandle: string
    instagramHandle: string
    linkedinHandle: string
    twitterHandle: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionSocialFeedGrid: {
    heading: string
    post1Image: string
    post1Caption: string
    post1Platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube'
    post2Image: string
    post2Caption: string
    post2Platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube'
    post3Image: string
    post3Caption: string
    post3Platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube'
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionSocialFollowBanner: {
    heading: string
    followerCount: string
    followerLabel: string
    facebookHandle: string
    instagramHandle: string
    linkedinHandle: string
    twitterHandle: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionSocialVideoHighlights: {
    heading: string
    highlight1Thumbnail: string
    highlight1Platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube'
    highlight1Caption: string
    highlight2Thumbnail: string
    highlight2Platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube'
    highlight2Caption: string
    highlight3Thumbnail: string
    highlight3Platform: 'instagram' | 'facebook' | 'linkedin' | 'youtube'
    highlight3Caption: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionFAQ: {
    sectionTitle: string
    faq1Question: string
    faq1Answer: string
    faq2Question: string
    faq2Answer: string
    faq3Question: string
    faq3Answer: string
    faq4Question: string
    faq4Answer: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionFAQAccordionCategories: {
    sectionTitle: string
    category1Label: string
    category1Faq1Question: string
    category1Faq1Answer: string
    category1Faq2Question: string
    category1Faq2Answer: string
    category1Faq3Question: string
    category1Faq3Answer: string
    category2Label: string
    category2Faq1Question: string
    category2Faq1Answer: string
    category2Faq2Question: string
    category2Faq2Answer: string
    category2Faq3Question: string
    category2Faq3Answer: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionFAQTwoColumn: {
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
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionFAQWithContact: {
    sectionTitle: string
    faq1Question: string
    faq1Answer: string
    faq2Question: string
    faq2Answer: string
    faq3Question: string
    faq3Answer: string
    contactHeading: string
    contactCtaLabel: string
    contactCtaHref: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionDisciplinesGrid: {
    sectionEyebrow: string
    sectionTitle: string
    sectionSubtitle: string
    items: {
      icon: IconKey
      image: string
      title: string
      description: string
      brands: string
      href: string
    }[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionOurBrands: {
    sectionTitle: string
    sectionSubtitle: string
    tab1Label: string
    tab1Groups: string
    tab2Label: string
    tab2Groups: string
    tab3Label: string
    tab3Groups: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionProjectsSlider: {
    sectionEyebrow: string
    sectionTitle: string
    slides: ProjectSlide[]
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionTestimonialsSlider: {
    sectionEyebrow: string
    sectionTitle: string
    slides: TestimonialSlide[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionSectorsTabbed: {
    heading: string
    tab1Label: string
    tab1Description: string
    tab2Label: string
    tab2Description: string
    tab3Label: string
    tab3Description: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionSectorsIconRow: {
    heading: string
    sector1Icon: IconKey
    sector1Label: string
    sector2Icon: IconKey
    sector2Label: string
    sector3Icon: IconKey
    sector3Label: string
    sector4Icon: IconKey
    sector4Label: string
    sector5Icon: IconKey
    sector5Label: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionSectorsRadial: {
    eyebrow: string
    heading: string
    description: string
    centerLogo: string
    centerTagline: string
    sectors: { label: string; href: string }[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionSectorsSplitFeature: {
    featuredImage: string
    featuredTitle: string
    featuredDescription: string
    otherSector1: string
    otherSector2: string
    otherSector3: string
    otherSector4: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionSectorDetailList: {
    variant: '1' | '2' | '3' | '4'
    sectionEyebrow: string
    sectionTitle: string
    sectionSubtitle: string
    sectors: {
      eyebrow: string
      name: string
      category: string
      description: string
      image: string
      ctaLabel: string
      ctaHref: string
    }[]
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionIconFeatureGrid: {
    sectionEyebrow: string
    sectionTitle: string
    items: { icon: IconKey | ''; biIcon?: string; title: string; description: string }[]
    variant?: '1' | '2'
    background: 'white' | 'dark'
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionDisciplineRows: {
    sectionEyebrow: string
    sectionTitle: string
    sectionSubtitle: string
    items: {
      icon: IconKey | ''
      eyebrow: string
      heading: string
      description: string
      checklist: string
      image: string
      images: { src: string; alt: string; caption: string }[]
      clients: { name: string; note: string; cities: string }[]
      brandTag: string
      brandLogos?: { src: string; alt: string }[]
      ctaLabel: string
      ctaHref: string
    }[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionApproachSplit: {
    eyebrow: string
    heading: string
    paragraph1: string
    paragraph2: string
    photo: string
    highlight1Icon: IconKey | ''
    highlight1BiIcon?: string
    highlight1Title: string
    highlight1Description: string
    highlight2Icon: IconKey | ''
    highlight2BiIcon?: string
    highlight2Title: string
    highlight2Description: string
    stat1Value: string
    stat1Label: string
    stat2Value: string
    stat2Label: string
    stat3Value: string
    stat3Label: string
    variant?: '1' | '2'
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionProcessSteps: {
    sectionEyebrow: string
    sectionTitle: string
    sectionSubtitle?: string
    items: { stepLabel: string; title: string; description: string }[]
    variant?: '1' | '2'
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionProjectPhotoSlider: {
    sectionEyebrow: string
    sectionTitle: string
    sectionSubtitle: string
    items: { image: string; title: string; subtitle: string }[]
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionBrandsLogoGrid: {
    heading: string
    logo1: string
    logo2: string
    logo3: string
    logo4: string
    logo5: string
    logo6: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionBrandsCarousel: {
    sectionTitle: string
    sectionEyebrow?: string
    anchorId?: string
    logos: (BrandLogoItem & { alt?: string })[]
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionBrandsSpotlight: {
    spotlightLogo: string
    spotlightDescription: string
    otherLogo1: string
    otherLogo2: string
    otherLogo3: string
    otherLogo4: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
}

interface BrandLogoItem {
  logo: string
}

interface CarouselTestimonialSlide {
  photo: string
  quote: string
  name: string
  role: string
}

interface ProjectSlide {
  eyebrow: string
  image: string
  title: string
  description: string
  tags: string
  linkLabel: string
  linkHref: string
  ctaLabel: string
  ctaHref: string
}

interface TestimonialSlide {
  photo: string
  quote: string
  name: string
  role: string
  videoLabel: string
}

interface CarouselTestimonialSlide {
  photo: string
  quote: string
  name: string
  role: string
}

// ── shared icon SVGs (inline, no external deps) ───────────────────────────────

function HardHatIcon() {
  return (
    <svg
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2a8 8 0 0 1 8 8v1H4V10a8 8 0 0 1 8-8zM3 13h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2z"
      />
    </svg>
  )
}

function CheckShieldIcon() {
  return (
    <svg
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l7 3v5c0 5-3.5 9.74-7 11C8.5 20.74 5 16 5 11V6l7-3z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  )
}

function GraduationCapIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10L12 5 2 10l10 5 10-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" />
    </svg>
  )
}

function BriefcaseIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="7"
        width="20"
        height="13"
        rx="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}

function AwardIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="6" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 13.5L7 22l5-3 5 3-1.5-8.5" />
    </svg>
  )
}

function EnvelopeIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 6.5l8.5 6 8.5-6" />
    </svg>
  )
}

function ShopIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 10v10h16V10M2 6l2-4h16l2 4M2 6l1 4a2.5 2.5 0 005 0 2.5 2.5 0 005 0 2.5 2.5 0 005 0 2.5 2.5 0 005 0l1-4"
      />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="2"
        width="16"
        height="20"
        rx="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 6h1M8 10h1M8 14h1M15 6h1M15 10h1M15 14h1M9 22v-4h6v4"
      />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg className="w-5 h-5 fill-yellow-400 text-yellow-400" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.955a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.364 1.118l1.287 3.955c.3.921-.755 1.688-1.54 1.118l-3.368-2.447a1 1 0 00-1.175 0l-3.368 2.447c-.784.57-1.838-.197-1.539-1.118l1.286-3.955a1 1 0 00-.364-1.118L2.063 9.382c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69L9.05 2.927z" />
    </svg>
  )
}

function SnowflakeIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2v20M4.2 6.5l15.6 11M4.2 17.5l15.6-11M8 3.5l4 2 4-2M8 20.5l4-2 4 2M2.5 8.5l1.7 4-1.7 4M21.5 8.5l-1.7 4 1.7 4"
      />
    </svg>
  )
}

function HouseGearIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" />
      <circle cx="12" cy="17" r="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TvIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="12"
        rx="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4" />
    </svg>
  )
}

function PlugIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 3v5M15 3v5M7 8h10l-1 5a4 4 0 01-4 3.5v3.5"
      />
    </svg>
  )
}

function FireIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3c1 3-3 4-3 7a3 3 0 006 0c0-1-.5-1.7-1-2.3.8.3 3 1.7 3 5.3a5 5 0 01-10 0c0-4 3-6 5-10z"
      />
    </svg>
  )
}

function LightbulbIcon() {
  return (
    <svg
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.9v.2h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0012 3z"
      />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"
      />
      <circle cx="12" cy="9.5" r="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Address 1 in the Logo & Contact Details form is one free-text line
// (street/building/landmark/city/PIN all together) — full-length it wraps
// the topbar onto two lines and buries the links/socials. Display-only
// shrink to "area, city" (last two comma segments, trailing 6-digit PIN
// stripped off the city) — the underlying d1Address value/source is
// untouched, this only changes what Design 1 renders it as.
function shortAddress(full: string): string {
  if (!full) return full
  const parts = full
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  return parts
    .slice(-2)
    .map((p) => p.replace(/\s*-\s*\d[\d\s]*\d\s*$/, '').trim())
    .filter(Boolean)
    .join(', ')
}

function MegaphoneIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 11v2a2 2 0 0 0 2 2h1l3 5V9l-3-1H5a2 2 0 0 0-2 2z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8l9-4v16l-9-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 10.5v3" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="7"
        width="12"
        height="10"
        rx="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4l4 3.5V17h-8z" />
      <circle cx="7" cy="18.5" r="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="18.5" r="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5c0-.6.4-1 1-1h2.6c.5 0 .9.3 1 .8l.9 3.5c.1.4 0 .9-.3 1.2L7.8 10.9a12 12 0 0 0 5.3 5.3l1.4-1.4c.3-.3.8-.4 1.2-.3l3.5.9c.5.1.8.5.8 1V19c0 .6-.4 1-1 1h-1C10.6 20 4 13.4 4 6V5z"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
    </svg>
  )
}

function GiftIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect x="3" y="9" width="18" height="4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13h14v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7zM12 9v12"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9c-2 0-3.5-1.2-3.5-3S10 3 12 5c2-2 3.5-.8 3.5 1S14 9 12 9z"
      />
    </svg>
  )
}

function HeadsetIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect
        x="3"
        y="13"
        width="4"
        height="6"
        rx="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="17"
        y="13"
        width="4"
        height="6"
        rx="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 19v1a2 2 0 0 1-2 2h-3" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.5 22v-8.4h2.8l.4-3.3h-3.2V8.1c0-1 .3-1.6 1.7-1.6h1.6V3.5c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.5H7.3v3.3h2.8V22h3.4z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3.5 9.5h3V20h-3V9.5zM9.5 9.5h2.9v1.4h.04c.4-.75 1.4-1.55 2.9-1.55 3.1 0 3.66 2 3.66 4.7V20h-3v-4.9c0-1.17-.02-2.68-1.63-2.68-1.64 0-1.9 1.28-1.9 2.6V20h-3V9.5z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.9 3H22l-7.6 8.7L23 21h-6.9l-5.4-6.6L4.5 21H1.4l8.1-9.3L1 3h7l4.9 6.1L18.9 3zm-1.2 16.1h1.7L7.4 4.8H5.6l12.1 14.3z" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.4 4.5 6 4c2.1-.3 4 .8 6 3 2-2.2 3.9-3.3 6-3 3.6.5 5.5 4 4 7.7-2.5 4.7-10 9.3-10 9.3z" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="5" r="2" />
      <circle cx="12" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="12" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12s0-3.2-.4-4.7c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.5c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.7c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.5c.9-.2 1.6-.9 1.8-1.8.4-1.5.4-4.7.4-4.7zM10 15V9l5.2 3-5.2 3z" />
    </svg>
  )
}

type IconKey =
  | 'hardhat'
  | 'shield'
  | 'star'
  | 'snowflake'
  | 'housegear'
  | 'tv'
  | 'plug'
  | 'fire'
  | 'lightbulb'
  | 'graduationcap'
  | 'briefcase'
  | 'award'
  | 'phone'
  | 'envelope'
  | 'shop'
  | 'building'

const ICON_BY_KEY: Record<IconKey, () => JSX.Element> = {
  hardhat: HardHatIcon,
  shield: CheckShieldIcon,
  star: StarIcon,
  snowflake: SnowflakeIcon,
  housegear: HouseGearIcon,
  tv: TvIcon,
  plug: PlugIcon,
  fire: FireIcon,
  lightbulb: LightbulbIcon,
  graduationcap: GraduationCapIcon,
  briefcase: BriefcaseIcon,
  award: AwardIcon,
  phone: PhoneIcon,
  envelope: EnvelopeIcon,
  shop: ShopIcon,
  building: BuildingIcon,
}

const FOUNDER_FACT_ICON_FIELD = {
  type: 'select',
  options: [
    { label: 'Graduation Cap (Qualification)', value: 'graduationcap' },
    { label: 'Briefcase (Experience)', value: 'briefcase' },
    { label: 'Award (Recognition)', value: 'award' },
  ],
} as const

const DISCIPLINE_ICON_FIELD = {
  type: 'select',
  options: [
    { label: 'Snowflake (AC)', value: 'snowflake' },
    { label: 'House + Gear (Automation)', value: 'housegear' },
    { label: 'TV (Theater)', value: 'tv' },
    { label: 'Plug (Electrical)', value: 'plug' },
    { label: 'Fire', value: 'fire' },
    { label: 'Lightbulb', value: 'lightbulb' },
    { label: 'Shield', value: 'shield' },
    { label: 'Star', value: 'star' },
    { label: 'Hard Hat', value: 'hardhat' },
  ],
} as const

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
        if (entry?.isIntersecting) {
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

// Per-item scroll reveal for a long, stacked list (used by
// ConstructionSectorDetailList) — `useScrollReveal`'s 0.15 intersection
// threshold is checked against the OBSERVED ELEMENT's own height, so a
// single ref wrapping an entire tall list (several thousand px, well over
// any viewport) can never reach 15% visible and never reveals at all.
// Reveals each row independently instead, same as the approved reference's
// own per-`<article>` `data-aos="fade-up"`.
function SectorRevealItem({
  id,
  className,
  children,
}: {
  id?: string
  className?: string
  children: React.ReactNode
}) {
  const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
  return (
    <div ref={ref} id={id} className={`${revealCls} ${className ?? ''}`}>
      {children}
    </div>
  )
}

// One discipline row's media: a dot-nav slider when `images` has entries
// (bottom-left caption overlay on the active slide, same hand-rolled dot
// pattern as ConstructionTestimonialsSlider), falling back to the single
// legacy `image` prop so existing rows (Sectors' pages) render unchanged.
function DisciplineRowMedia({
  images,
  image,
  heading,
}: {
  images?: { src: string; alt?: string; caption?: string }[]
  image?: string
  heading?: string
}) {
  const slides = (images ?? []).filter((s) => s.src)
  const [index, setIndex] = useState(0)
  if (slides.length === 0) {
    if (!image) return null
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={heading}
        loading="lazy"
        className="rounded-2xl w-full h-full min-h-72 md:min-h-80 object-cover md:[direction:ltr]"
      />
    )
  }
  const current = slides[index] ?? slides[0]!
  return (
    <div className="relative rounded-2xl w-full h-full min-h-72 md:min-h-80 overflow-hidden md:[direction:ltr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.src}
        alt={current.alt || heading}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      {current.caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
          <span className="font-semibold text-white">{current.caption}</span>
        </div>
      )}
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show image ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition ${i === index ? 'w-5 bg-white' : 'w-2 bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── components ────────────────────────────────────────────────────────────────

const typedComponents: Config<ConstructionProps>['components'] = {
  // Top bar — 4 selectable designs (Insert-a-block picker shows one card per
  // design, same "Design 1-4" convention as e.g. general pack's Hero).
  ConstructionTopBar: {
    label: 'Top Bar',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Contact + links + socials', value: '1' },
          { label: 'Design 2 — Announcement + social + language', value: '2' },
          { label: 'Design 3 — Tagline + CTA button', value: '3' },
          { label: 'Design 4 — Support items + login/signup', value: '4' },
        ],
      },
      visible: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      d1Address: { type: 'text' },
      d1Phone: { type: 'text' },
      d1Email: { type: 'text' },
      d1Link1Label: { type: 'text' },
      d1Link1Href: { type: 'text' },
      d1Link2Label: { type: 'text' },
      d1Link2Href: { type: 'text' },
      d1Link3Label: { type: 'text' },
      d1Link3Href: { type: 'text' },
      d1Social1Href: { type: 'text' },
      d1Social2Href: { type: 'text' },
      d1Social3Href: { type: 'text' },
      d1Social4Href: { type: 'text' },
      d2Item1Text: { type: 'text' },
      d2Item2Text: { type: 'text' },
      d2Item3Text: { type: 'text' },
      d2TrackLabel: { type: 'text' },
      d2Language: { type: 'text' },
      d3Tagline: { type: 'text' },
      d3Phone: { type: 'text' },
      d3Email: { type: 'text' },
      d3CtaLabel: { type: 'text' },
      d3CtaHref: { type: 'text' },
      d4Tagline: { type: 'text' },
      d4Social1Href: { type: 'text' },
      d4Social2Href: { type: 'text' },
      d4Social3Href: { type: 'text' },
      d4Social4Href: { type: 'text' },
      d4HelpLabel: { type: 'text' },
      d4HelpHref: { type: 'text' },
      d4FaqLabel: { type: 'text' },
      d4FaqHref: { type: 'text' },
      d4Language: { type: 'text' },
      primaryColor: { type: 'text' },
      secondaryColor: { type: 'text' },
      tertiaryColor: { type: 'text' },
      quaternaryColor: { type: 'text' },
    },
    resolveFields: (data, { fields }) =>
      variantFields(fields, data.props?.variant) as typeof fields,
    defaultProps: {
      variant: '1',
      visible: true,
      primaryColor: '',
      secondaryColor: '',
      tertiaryColor: '',
      quaternaryColor: '',
      d1Address: '123 Business Street, Mumbai, India',
      d1Phone: '+91 98765 43210',
      d1Email: 'hello@yourdomain.com',
      d1Link1Label: 'Careers',
      d1Link1Href: '#careers',
      d1Link2Label: 'Support',
      d1Link2Href: '#support',
      d1Link3Label: 'Blog',
      d1Link3Href: '#blog',
      d1Social1Href: '#',
      d1Social2Href: '#',
      d1Social3Href: '#',
      d1Social4Href: '#',
      // Design 2's own text ("announcement" + short tagline) — d4Tagline/
      // d2Item1Text names don't line up with what's rendered under
      // variant==='2' below; fields are shared across all 4 designs (Puck
      // has no per-variant field scoping) and got reassigned by content fit
      // rather than renamed, to avoid a much bigger mechanical diff across
      // the type/fields/defaultProps/destructure blocks for a purely
      // cosmetic key name. See the variant==='2' and variant==='4' render
      // comments below for the full reassignment.
      d2Item1Text: "Let's build something amazing together!",
      d2Item2Text: '24/7 Support',
      d2Item3Text: 'On-Time Delivery',
      d2TrackLabel: 'Secure & Trusted',
      d2Language: 'EN',
      d3Tagline: 'We help businesses grow digitally.',
      d3Phone: '+91 98765 43210',
      d3Email: 'hello@yourdomain.com',
      d3CtaLabel: 'Start Your Project',
      d3CtaHref: '#consultation',
      d4Tagline: 'Transforming Ideas into Digital Solutions',
      d4Social1Href: '#',
      d4Social2Href: '#',
      d4Social3Href: '#',
      d4Social4Href: '#',
      d4HelpLabel: 'Login',
      d4HelpHref: '#login',
      d4FaqLabel: 'Sign Up',
      d4FaqHref: '#signup',
      d4Language: 'Get 10% Off on Your First Project!',
    },
    render: function ConstructionTopBarRender({
      variant,
      visible,
      primaryColor,
      secondaryColor,
      tertiaryColor,
      quaternaryColor,
      d1Address,
      d1Phone,
      d1Email,
      d1Link1Label,
      d1Link1Href,
      d1Link2Label,
      d1Link2Href,
      d1Link3Label,
      d1Link3Href,
      d1Social1Href,
      d1Social2Href,
      d1Social3Href,
      d1Social4Href,
      d2Item1Text,
      d2Item2Text,
      d2Item3Text,
      d2TrackLabel,
      d2Language,
      d3Tagline,
      d3Phone,
      d3Email,
      d3CtaLabel,
      d3CtaHref,
      d4Tagline,
      d4Social1Href,
      d4Social2Href,
      d4Social3Href,
      d4Social4Href,
      d4HelpLabel,
      d4HelpHref,
      d4FaqLabel,
      d4FaqHref,
      d4Language,
    }) {
      if (visible === false) return <></>

      if (variant === '2') {
        // Dark announcement bar. Field reuse note (see defaultProps comment
        // above): d4Tagline carries the announcement text and d2Item1Text
        // the short tagline that follows it; d4Social1-4Href/d2Language
        // carry the socials + language dropdown on the right.
        // Dark bar mixes secondary→tertiary (not a neutral slate) so it
        // still reads as "this brand's colors" even at its darkest point;
        // hover accent uses primaryColor via a CSS var so Tailwind's
        // hover: pseudo-class still works with a value that isn't known
        // until render time.
        return (
          <div
            style={{
              backgroundImage: themeGradient(
                secondaryColor || '#12142a',
                tertiaryColor || '#000000'
              ),
              ['--tb-accent' as string]: primaryColor || '#f5a623',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-200 md:px-8">
              <div className="flex flex-wrap items-center gap-3 divide-x divide-white/20">
                {d4Tagline && (
                  <span className="flex items-center gap-2 pr-3 first:pl-0">
                    <MegaphoneIcon />
                    {d4Tagline}
                  </span>
                )}
                {d2Item1Text && <span className="pl-3">{d2Item1Text}</span>}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400">Follow us:</span>
                <div className="flex items-center gap-3">
                  {d4Social1Href && (
                    <a
                      href={d4Social1Href}
                      aria-label="Facebook"
                      className="hover:text-[var(--tb-accent)] transition"
                    >
                      <FacebookIcon />
                    </a>
                  )}
                  {d4Social2Href && (
                    <a
                      href={d4Social2Href}
                      aria-label="Instagram"
                      className="hover:text-[var(--tb-accent)] transition"
                    >
                      <InstagramIcon />
                    </a>
                  )}
                  {d4Social3Href && (
                    <a
                      href={d4Social3Href}
                      aria-label="LinkedIn"
                      className="hover:text-[var(--tb-accent)] transition"
                    >
                      <LinkedInIcon />
                    </a>
                  )}
                  {d4Social4Href && (
                    <a
                      href={d4Social4Href}
                      aria-label="YouTube"
                      className="hover:text-[var(--tb-accent)] transition"
                    >
                      <YoutubeIcon />
                    </a>
                  )}
                </div>
                {d2Language && (
                  <span className="flex items-center gap-1 border-l border-white/20 pl-4">
                    {d2Language}
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      }

      if (variant === '3') {
        // Was a hardcoded purple/pink gradient unrelated to the brand's
        // own palette — now primary→secondary, this component's own theme
        // colors (falls back to the same generic orange/near-black the
        // rest of the pack uses when a project hasn't set a brand kit yet).
        const barAccent = primaryColor || '#ff5a36'
        return (
          <div
            style={{
              backgroundImage: themeGradient(barAccent, secondaryColor || '#12142a'),
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm text-white md:px-8">
              {d3Tagline && <p className="font-medium text-white">{d3Tagline}</p>}
              <div className="flex items-center gap-4 divide-x divide-white/30">
                {d3Phone && (
                  <span className="flex items-center gap-2 pr-4">
                    <PhoneIcon />
                    {d3Phone}
                  </span>
                )}
                {d3Email && (
                  <span className="flex items-center gap-2 pl-4">
                    <MailIcon />
                    {d3Email}
                  </span>
                )}
              </div>
              {d3CtaLabel && (
                <a
                  href={d3CtaHref}
                  style={{ color: barAccent }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold hover:bg-white/90 transition"
                >
                  {d3CtaLabel}
                  <span aria-hidden="true">→</span>
                </a>
              )}
            </div>
          </div>
        )
      }

      if (variant === '4') {
        // Support/trust items + Login/Sign Up. Field reuse note (see
        // defaultProps comment above): d2Item2Text/d2Item3Text/d2TrackLabel
        // carry the first three items and d4Language the fourth (promo);
        // d4HelpLabel/Href and d4FaqLabel/Href carry Login and Sign Up.
        const itemBorder = 'border-l border-slate-200 pl-6 first:border-l-0 first:pl-0'
        return (
          <div
            className="bg-white border-b"
            style={{
              ['--tb-accent' as string]: primaryColor || '#f5a623',
              borderColor: quaternaryColor || '#e2e8f0',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-2.5 text-sm text-slate-600 md:px-8">
              <div className="flex flex-wrap items-center">
                {d2Item2Text && (
                  <span className={`flex items-center gap-2 pr-6 ${itemBorder}`}>
                    <HeadsetIcon />
                    {d2Item2Text}
                  </span>
                )}
                {d2Item3Text && (
                  <span className={`flex items-center gap-2 pr-6 ${itemBorder}`}>
                    <TruckIcon />
                    {d2Item3Text}
                  </span>
                )}
                {d2TrackLabel && (
                  <span className={`flex items-center gap-2 pr-6 ${itemBorder}`}>
                    <CheckShieldIcon />
                    {d2TrackLabel}
                  </span>
                )}
                {d4Language && (
                  <span className={`flex items-center gap-2 ${itemBorder}`}>
                    <GiftIcon />
                    {d4Language}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                {d4HelpLabel && (
                  <a href={d4HelpHref} className="hover:text-[var(--tb-accent)] transition">
                    {d4HelpLabel}
                  </a>
                )}
                {d4FaqLabel && (
                  <a
                    href={d4FaqHref}
                    className="border-l border-slate-200 pl-4 hover:text-[var(--tb-accent)] transition"
                  >
                    {d4FaqLabel}
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      }

      // Design 1 (default) — edge-to-edge (not the shared `wrap` max-w-6xl
      // column other designs use): contact info sits flush against the
      // bar's true left edge and links/socials flush against its true
      // right edge, not just the edges of a centered column with dead
      // margin outside it on wide screens.
      return (
        <div
          className="bg-white border-b"
          style={{
            ['--tb-accent' as string]: primaryColor || '#f5a623',
            borderColor: quaternaryColor || '#e2e8f0',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm text-slate-600 md:px-8">
            <div className="flex items-center gap-4 divide-x divide-slate-200">
              {d1Email && (
                <span className="flex items-center gap-2 pr-4 first:pl-0">
                  <MailIcon />
                  {d1Email}
                </span>
              )}
              {d1Phone && (
                <span className="flex items-center gap-2 px-4">
                  <PhoneIcon />
                  {d1Phone}
                </span>
              )}
              {d1Address && (
                <span className="flex items-center gap-2 pl-4 whitespace-nowrap">
                  <PinIcon />
                  {shortAddress(d1Address)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-5">
              {[
                { label: d1Link1Label, href: d1Link1Href },
                { label: d1Link2Label, href: d1Link2Href },
                { label: d1Link3Label, href: d1Link3Href },
              ]
                .filter((l) => l.label)
                .map((l, i) => (
                  <a key={i} href={l.href} className="hover:text-[var(--tb-accent)] transition">
                    {l.label}
                  </a>
                ))}
              <div className="flex items-center gap-3 border-l border-slate-200 pl-5">
                {d1Social1Href && (
                  <a
                    href={d1Social1Href}
                    aria-label="Facebook"
                    className="hover:text-[var(--tb-accent)] transition"
                  >
                    <FacebookIcon />
                  </a>
                )}
                {d1Social2Href && (
                  <a
                    href={d1Social2Href}
                    aria-label="LinkedIn"
                    className="hover:text-[var(--tb-accent)] transition"
                  >
                    <LinkedInIcon />
                  </a>
                )}
                {d1Social3Href && (
                  <a
                    href={d1Social3Href}
                    aria-label="Instagram"
                    className="hover:text-[var(--tb-accent)] transition"
                  >
                    <InstagramIcon />
                  </a>
                )}
                {d1Social4Href && (
                  <a
                    href={d1Social4Href}
                    aria-label="X"
                    className="hover:text-[var(--tb-accent)] transition"
                  >
                    <XIcon />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    },
  },

  // 0. Sticky header
  ConstructionHeader: {
    label: 'Construction Header',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Classic (logo, centered nav, Login + CTA)', value: '1' },
          { label: 'Design 2 — Diagonal banner (socials) + phone badge', value: '2' },
          { label: 'Design 3 — Solid color bar, login + grid menu', value: '3' },
          { label: 'Design 4 — Phone/email badges, search + CTA', value: '4' },
        ],
      },
      visible: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      brand: { type: 'text' },
      logoUrl: { type: 'text' },
      links: { type: 'textarea' },
      loginLabel: { type: 'text' },
      loginHref: { type: 'text' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      phoneNumber: { type: 'text' },
      email: { type: 'text' },
      primaryColor: { type: 'text' },
      secondaryColor: { type: 'text' },
      tertiaryColor: { type: 'text' },
      quaternaryColor: { type: 'text' },
      // Design 1 only, for now — floats the header over the section below
      // instead of occupying its own row (matches
      // subhadra.cloudhostingcompany.in). Text colour is a separate toggle,
      // not implied by transparency — a transparent header only reads over a
      // dark/photo hero with light text, but over a light hero the header
      // needs to stay dark-on-transparent, so both need to be independently
      // choosable.
      transparent: {
        type: 'radio',
        label: 'Transparent header (Design 1)',
        options: [
          { label: 'Off', value: false },
          { label: 'On', value: true },
        ],
      },
      lightText: {
        type: 'radio',
        label: 'Light text (Design 1 — for a dark/photo hero underneath)',
        options: [
          { label: 'Off', value: false },
          { label: 'On', value: true },
        ],
      },
      // Design 2's banner strip (Facebook/LinkedIn/Instagram/X) — a flat,
      // variant-agnostic field set like phoneNumber/primaryColor above
      // (this component doesn't use TopBar/Footer's per-design d1-d4 prefix
      // convention), so it's just "the 4 social links", available to
      // whichever design wants them.
      social1Href: { type: 'text' },
      social2Href: { type: 'text' },
      social3Href: { type: 'text' },
      social4Href: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      visible: true,
      brand: 'Your Brand',
      logoUrl: '',
      links: 'Home|#\nAbout|#\nProducts & Services|#\nSectors|#\nContact|#',
      loginLabel: '',
      loginHref: '#login',
      ctaLabel: 'Download Brochure ↓',
      ctaHref: '#brochure',
      phoneNumber: '+91 98765 43210',
      email: 'hello@yourdomain.com',
      primaryColor: '',
      secondaryColor: '',
      tertiaryColor: '',
      quaternaryColor: '',
      transparent: true,
      lightText: true,
      social1Href: '#',
      social2Href: '#',
      social3Href: '#',
      social4Href: '#',
    },
    render: function ConstructionHeaderRender({
      id,
      variant,
      visible,
      brand,
      logoUrl,
      links,
      loginLabel,
      loginHref,
      ctaLabel,
      ctaHref,
      phoneNumber,
      email,
      primaryColor,
      secondaryColor,
      tertiaryColor,
      quaternaryColor,
      transparent,
      lightText,
      social1Href,
      social2Href,
      social3Href,
      social4Href,
      puck,
    }) {
      const [mobileOpen, setMobileOpen] = useState(false)
      // This admin canvas renders the page directly (no iframe), so a truly
      // `fixed` header escapes the canvas and overlaps the editor's own
      // toolbar (Back/Insert block/Publish) instead of just the hero below
      // it — only float it on the real public page; stay `sticky` (still
      // transparent-colored) while editing so the layout can't break.
      const isEditingInPuck = puck?.isEditing ?? false
      // Menus module (backend/src/modules/menus/) is the source of truth
      // once a project has a configured "header" menu — enables real
      // dropdown/flyout submenus. `links` below is the fallback for a
      // project that hasn't set one up, and stays the only source for
      // designs 2-4 and the mobile panel for now (phase 1: Design 1's
      // desktop nav only, not yet extended to the rest).
      const menuTree = useHeaderMenuTree(puck?.metadata?.projectId as string | undefined)
      const navItems = (links || '')
        .split('\n')
        .map((line) => line.split('|'))
        .filter(([label]) => label)
      const ctaStyle = primaryColor ? { backgroundColor: primaryColor } : undefined

      const mobilePanel = mobileOpen && typeof document !== 'undefined' && (
        <>
          {createPortal(
            <div className="fixed inset-0 z-50 bg-white flex flex-col p-6 md:hidden">
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-slate-900">{brand}</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 -mr-2 text-slate-700"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
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
            </div>,
            document.body
          )}
        </>
      )

      const hamburgerBtn = (colorClass?: string, colorStyle?: string) => (
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen(true)}
          className={`md:hidden p-2 -mr-2 ${colorClass ?? ''}`}
          style={colorStyle ? { color: colorStyle } : undefined}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )

      if (visible === false) return <></>

      if (variant === '2') {
        // Diagonal orange banner (social icons) between the logo and the
        // phone badge, nav row underneath with the first item highlighted
        // as active — no CTA button in this design, just the phone badge.
        return (
          <>
            <header
              className="sticky top-0 z-40 bg-white text-slate-900"
              style={{ ['--hdr-accent' as string]: primaryColor || '#f5a623' }}
            >
              <div className="flex items-stretch">
                <Link href="/" className="flex shrink-0 items-center px-4 py-3 md:px-8">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-9 w-auto" />
                  ) : (
                    <span className="font-bold">{brand}</span>
                  )}
                </Link>
                <div className="relative hidden flex-1 items-center md:flex">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: themeGradient(
                        primaryColor || '#f5a623',
                        tertiaryColor || secondaryColor || '#12142a'
                      ),
                      clipPath: 'polygon(8% 0, 100% 0, 100% 100%, 0 100%)',
                    }}
                  />
                  <div className="relative z-10 flex flex-1 items-center justify-center gap-5 py-3 pl-10">
                    {social1Href && (
                      <a
                        href={social1Href}
                        aria-label="Facebook"
                        className="text-white/90 hover:text-white transition"
                      >
                        <FacebookIcon />
                      </a>
                    )}
                    {social2Href && (
                      <a
                        href={social2Href}
                        aria-label="LinkedIn"
                        className="text-white/90 hover:text-white transition"
                      >
                        <LinkedInIcon />
                      </a>
                    )}
                    {social3Href && (
                      <a
                        href={social3Href}
                        aria-label="Instagram"
                        className="text-white/90 hover:text-white transition"
                      >
                        <InstagramIcon />
                      </a>
                    )}
                    {social4Href && (
                      <a
                        href={social4Href}
                        aria-label="X"
                        className="text-white/90 hover:text-white transition"
                      >
                        <XIcon />
                      </a>
                    )}
                  </div>
                </div>
                {phoneNumber && (
                  <a
                    href={`tel:${phoneNumber.replace(/[^\d+]/g, '')}`}
                    style={ctaStyle}
                    className="hidden shrink-0 items-center gap-2 bg-slate-900 px-6 text-sm font-semibold text-white md:flex"
                  >
                    <PhoneIcon />
                    {phoneNumber}
                  </a>
                )}
                {hamburgerBtn('text-slate-700 ml-auto md:hidden')}
              </div>
              <div className="hidden py-3 text-sm font-bold uppercase tracking-wide md:flex md:justify-center">
                {menuTree ? (
                  <HeaderNavMenu
                    items={menuTree}
                    linkClassName="text-slate-800 hover:text-[var(--hdr-accent)] transition"
                    activeClassName="text-[var(--hdr-accent)]"
                  />
                ) : (
                  <nav className="flex items-center gap-8">
                    {navItems.map(([label, href], i) => (
                      <a
                        key={i}
                        href={href || '#'}
                        className={
                          i === 0
                            ? 'text-[var(--hdr-accent)]'
                            : 'text-slate-800 hover:text-[var(--hdr-accent)] transition'
                        }
                      >
                        {label}
                      </a>
                    ))}
                  </nav>
                )}
              </div>
            </header>
            {mobilePanel}
          </>
        )
      }

      if (variant === '3') {
        // Solid-color bar (brand primaryColor, falling back to amber) under
        // an accent strip. Bar text/icon color and the strip's color are
        // both computed from the actual bar color (readableTextColor/
        // accentColorFor above) instead of hardcoded dark text + a fixed
        // red strip — those broke down into an unreadable single-color
        // block whenever a project's primaryColor happened to be red too
        // (reported: "why look like this?? ... not visable"). "Login /
        // Signup" and the grid icon are this design's own fixed chrome,
        // not brand-editable fields — same convention as Design 2's
        // hardcoded "Follow us:" label. No dropdown-chevron affordance on
        // nav items: `links` is a flat label|href list with no submenu
        // data to back one.
        const barBg = primaryColor || '#f5a623'
        const barText = readableTextColor(barBg)
        const stripBg = accentColorFor(barBg, secondaryColor)
        return (
          <>
            <div className="h-1.5" style={{ backgroundColor: stripBg }} />
            <header
              className="sticky top-0 z-40"
              style={{ backgroundColor: barBg, color: barText }}
            >
              <div className="flex items-center justify-between px-4 py-3 md:px-8">
                <Link href="/" className="flex items-center">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-14 w-auto" />
                  ) : (
                    <span className="font-bold">{brand}</span>
                  )}
                </Link>
                <div className="hidden text-sm font-bold uppercase tracking-wide md:flex">
                  {menuTree ? (
                    <HeaderNavMenu
                      items={menuTree}
                      linkClassName="hover:opacity-70 transition px-2"
                      activeClassName="hover:opacity-70 transition px-2"
                    />
                  ) : (
                    <nav className="flex items-center gap-8">
                      {navItems.map(([label, href], i) => (
                        <a key={i} href={href || '#'} className="hover:opacity-70 transition">
                          {label}
                        </a>
                      ))}
                    </nav>
                  )}
                </div>
                <div className="hidden items-center gap-4 md:flex">
                  {loginHref && (
                    <a
                      href={loginHref}
                      className="text-sm font-bold hover:opacity-80 transition"
                      style={{ color: stripBg }}
                    >
                      Login / Signup
                    </a>
                  )}
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${barText}1a`, color: barText }}
                  >
                    <GridIcon />
                  </span>
                </div>
                {hamburgerBtn(undefined, barText)}
              </div>
            </header>
            {mobilePanel}
          </>
        )
      }

      if (variant === '4') {
        // Two-row: contact-badge row (phone/email, search, CTA) over a
        // left-aligned nav row. "Get Involved" and the search box are this
        // design's own fixed chrome (like Design 2's "Follow us:" and
        // Design 3's "Login / Signup") — search has nothing to actually
        // search here, it's decorative UI matching the reference. Chevron
        // on the first nav item only: decorative (no submenu data to back
        // a real dropdown), matching the reference's one dropdown-looking
        // item without implying every item has one.
        const accent = primaryColor || '#c9a227'
        const accentText = readableTextColor(accent)
        return (
          <>
            <header
              className="sticky top-0 z-40 bg-white text-slate-900"
              style={{ ['--hdr-accent' as string]: primaryColor || '#f5a623' }}
            >
              <div className="flex flex-wrap items-center gap-4 px-4 py-3 md:px-8">
                <Link href="/" className="flex shrink-0 items-center">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-14 w-auto" />
                  ) : (
                    <span className="font-bold">{brand}</span>
                  )}
                </Link>
                <div className="hidden flex-1 items-center gap-6 md:flex">
                  {phoneNumber && (
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: accent, color: accentText }}
                      >
                        <PhoneIcon />
                      </span>
                      <div className="leading-tight">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Make a call
                        </p>
                        <p className="text-sm font-bold text-slate-900">{phoneNumber}</p>
                      </div>
                    </div>
                  )}
                  {phoneNumber && email && <span className="h-9 border-l border-slate-200" />}
                  {email && (
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: accent, color: accentText }}
                      >
                        <MailIcon />
                      </span>
                      <div className="leading-tight">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Send email
                        </p>
                        <p className="text-sm font-bold text-slate-900">{email}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="hidden shrink-0 items-center gap-3 md:flex">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
                    <span>Type &amp; Hit Enter...</span>
                    <SearchIcon />
                  </div>
                  <a
                    href={ctaHref}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                    style={{ backgroundColor: accent, color: accentText }}
                  >
                    Get Involved
                    <HeartIcon />
                  </a>
                </div>
                {hamburgerBtn('text-slate-700')}
              </div>
              <div className="hidden border-t border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 md:flex md:px-8">
                {menuTree ? (
                  <HeaderNavMenu
                    items={menuTree}
                    linkClassName="flex items-center gap-1 hover:text-[var(--hdr-accent)] transition"
                    activeClassName="flex items-center gap-1 hover:text-[var(--hdr-accent)] transition"
                  />
                ) : (
                  <nav className="flex items-center gap-8">
                    {navItems.map(([label, href], i) => (
                      <a
                        key={i}
                        href={href || '#'}
                        className="flex items-center gap-1 hover:text-[var(--hdr-accent)] transition"
                      >
                        {label}
                        {i === 0 && <ChevronDownIcon />}
                      </a>
                    ))}
                  </nav>
                )}
              </div>
            </header>
            {mobilePanel}
          </>
        )
      }

      // Design 1 (default) — classic. `transparent` floats the header over
      // whatever's below (position: fixed removes it from flow, so the
      // next block naturally starts at y=0 underneath it) with
      // light-on-dark text. Nav is grouped with the CTA/login on the right
      // (not with the logo) — logo sits alone on the far left, the
      // nav+actions cluster sits together on the far right, matching the
      // reference exactly (reported: "not beside logo ... need beside
      // button" — an earlier `navAlign` toggle put nav next to the logo
      // instead, which never actually matched either reference layout, so
      // it's gone rather than kept as a second dead option).
      {
        const headerPositionClass = transparent
          ? isEditingInPuck
            ? // Sticky (not fixed) here means this header sits in normal flow
              // instead of floating over the hero below it — a `bg-transparent`
              // background would just show the plain white canvas behind it,
              // making `lightText`'s white nav invisible (reported: nav links
              // "missing" — they were rendering, just white-on-white). Give it
              // a solid dark backing only in this editing path so text stays
              // legible; the real public page still gets a true transparent
              // float via the `fixed` branch below.
              'sticky top-0 z-40 bg-slate-900/95 backdrop-blur'
            : 'fixed top-0 inset-x-0 z-40 bg-transparent'
          : 'sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100'
        const brandTextClass = lightText ? 'text-white' : 'text-slate-900'
        const navLinkClass = lightText
          ? 'text-sm font-medium text-white/90 hover:text-[var(--hdr-accent)] transition'
          : 'text-sm font-medium text-slate-700 hover:text-[var(--hdr-accent)] transition'
        const loginBtnClass = lightText
          ? 'inline-flex items-center rounded-lg border-2 border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition'
          : 'inline-flex items-center rounded-lg border-2 border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition'
        const hamburgerColorClass = lightText ? 'text-white' : 'text-slate-700'

        // Active-tab pill on the first nav item (e.g. "Home") — this
        // component has no routing context to know the real current page,
        // so the first link is treated as "active", matching the reference
        // design's single highlighted pill among otherwise-plain links.
        const activeNavLinkClass = lightText
          ? 'rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white transition'
          : 'rounded-full bg-slate-900/10 px-4 py-2 text-sm font-medium text-slate-900 transition'

        return (
          <>
            <header
              className={headerPositionClass}
              style={{ ['--hdr-accent' as string]: primaryColor || '#f5a623' }}
            >
              <div className="flex items-center justify-between px-4 h-16 md:px-8">
                <Link href="/" className={`flex items-center gap-2 font-bold ${brandTextClass}`}>
                  {logoUrl ? (
                    // Logo image already carries the brand name/mark — no
                    // separate text label next to it (was duplicating it).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-8 w-auto" />
                  ) : (
                    <span>{brand}</span>
                  )}
                </Link>
                <div className="hidden md:flex items-center gap-7">
                  {menuTree ? (
                    <HeaderNavMenu
                      items={menuTree}
                      linkClassName={navLinkClass}
                      activeClassName={activeNavLinkClass}
                    />
                  ) : (
                    <nav className="flex items-center gap-2">
                      {navItems.map(([label, href], i) => (
                        <a
                          key={i}
                          href={href || '#'}
                          className={i === 0 ? activeNavLinkClass : `${navLinkClass} px-2`}
                        >
                          {label}
                        </a>
                      ))}
                    </nav>
                  )}
                  <div className="flex items-center gap-3">
                    {(isEditingInPuck || loginLabel) && (
                      <a
                        href={loginHref}
                        onClick={isEditingInPuck ? (e) => e.preventDefault() : undefined}
                        className={loginBtnClass}
                      >
                        <InlineEditableText
                          id={id}
                          path={['loginLabel']}
                          value={loginLabel ?? ''}
                          isEditing={isEditingInPuck}
                        />
                      </a>
                    )}
                    {(isEditingInPuck || ctaLabel) && (
                      <a
                        href={ctaHref}
                        onClick={isEditingInPuck ? (e) => e.preventDefault() : undefined}
                        // A hardcoded `bg-gradient-to-r from-orange-500
                        // to-red-500` class previously painted over
                        // `ctaStyle`'s inline backgroundColor unconditionally
                        // (a CSS background-image always draws over
                        // background-color) — primaryColor never actually
                        // showed here. Now the gradient itself is built from
                        // the brand's own colors.
                        style={{
                          backgroundColor: primaryColor || '#f5a623',
                          backgroundImage: themeGradient(
                            primaryColor || '#f5a623',
                            quaternaryColor || secondaryColor || '#12142a'
                          ),
                        }}
                        className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
                      >
                        <InlineEditableText
                          id={id}
                          path={['ctaLabel']}
                          value={ctaLabel ?? ''}
                          isEditing={isEditingInPuck}
                        />
                      </a>
                    )}
                  </div>
                </div>
                {hamburgerBtn(hamburgerColorClass)}
              </div>
            </header>
            {mobilePanel}
          </>
        )
      }
    },
  },

  // 1. Hero section — 4 selectable designs, each a real 3-slide slider
  ConstructionHero: {
    label: 'Construction Hero',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Full-bleed photo slider', value: '1' },
          { label: 'Design 2 — Dark split hero, slide-driven headline', value: '2' },
          { label: 'Design 3 — Centered rotating quote', value: '3' },
          { label: 'Design 4 — Fixed headline + feature slider', value: '4' },
        ],
      },
      visible: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      primaryColor: { type: 'text' },
      secondaryColor: { type: 'text' },
      d1Slides: {
        type: 'array',
        min: 0,
        max: 8,
        getItemSummary: (item, index) => item.headline || `Slide ${(index ?? 0) + 1}`,
        defaultItemProps: {
          image: '',
          badge: '',
          headline: 'New slide',
          subheadline: '',
          ctaLabel: '',
          ctaHref: '#quote',
        },
        arrayFields: {
          image: imageField('Image'),
          badge: { type: 'text' },
          headline: { type: 'text' },
          subheadline: { type: 'textarea' },
          ctaLabel: { type: 'text' },
          ctaHref: { type: 'text' },
        },
      },
      d2Slides: {
        type: 'array',
        min: 0,
        max: 8,
        getItemSummary: (item, index) => item.dotLabel || `Slide ${(index ?? 0) + 1}`,
        defaultItemProps: {
          dotLabel: 'New slide',
          image: '',
          lead: '',
          highlight: '',
          description: '',
          brands: [],
          workHref: '',
        },
        arrayFields: {
          dotLabel: { type: 'text' },
          image: imageField('Image'),
          lead: { type: 'text' },
          highlight: { type: 'text' },
          description: { type: 'textarea' },
          // Per-slide "See Our Work" target — leave blank to hide the
          // button on that slide (e.g. Electrical & Switchgear has no
          // matching work page in the reference site).
          workHref: { type: 'text' },
          brands: {
            type: 'array',
            min: 0,
            max: 10,
            getItemSummary: (item, index) => item.name || `Brand ${(index ?? 0) + 1}`,
            defaultItemProps: { name: 'New brand', logo: '' },
            arrayFields: {
              name: { type: 'text' },
              logo: imageField('Logo'),
            },
          },
        },
      },
      d2BadgeText: { type: 'text' },
      d2BrandsLabel: { type: 'text' },
      d2CtaLabel: { type: 'text' },
      d2CtaHref: { type: 'text' },
      d2SecondaryLabel: { type: 'text' },
      d2Avatar1: { type: 'text' },
      d2Avatar2: { type: 'text' },
      d2Avatar3: { type: 'text' },
      d2TrustText: { type: 'text' },
      d2Stat1Value: { type: 'text' },
      d2Stat1Label: { type: 'text' },
      d2Stat2Value: { type: 'text' },
      d2Stat2Label: { type: 'text' },
      d2Stat3Value: { type: 'text' },
      d2Stat3Label: { type: 'text' },
      d3Slides: {
        type: 'array',
        min: 0,
        max: 6,
        getItemSummary: (item, index) => item.author || `Slide ${(index ?? 0) + 1}`,
        defaultItemProps: {
          image: '',
          quote: '',
          author: 'New quote',
          role: '',
        },
        arrayFields: {
          image: imageField('Photo'),
          quote: { type: 'textarea' },
          author: { type: 'text' },
          role: { type: 'text' },
        },
      },
      d3Eyebrow: { type: 'text' },
      d3Headline: { type: 'text' },
      d3Subheadline: { type: 'textarea' },
      d3CtaLabel: { type: 'text' },
      d3CtaHref: { type: 'text' },
      d4Slides: {
        type: 'array',
        min: 0,
        max: 6,
        getItemSummary: (item, index) => item.title || `Slide ${(index ?? 0) + 1}`,
        defaultItemProps: {
          icon: 'hardhat',
          title: 'New feature',
          description: '',
        },
        arrayFields: {
          icon: DISCIPLINE_ICON_FIELD,
          title: { type: 'text' },
          description: { type: 'textarea' },
        },
      },
      d4Headline: { type: 'text' },
      d4Subheadline: { type: 'textarea' },
      d4CtaLabel: { type: 'text' },
      d4CtaHref: { type: 'text' },
      sliderShowArrows: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      sliderShowDots: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      sliderAutoplay: {
        type: 'radio',
        options: [
          { label: 'On', value: true },
          { label: 'Off', value: false },
        ],
      },
      sliderAutoplaySpeed: { type: 'number' },
      sliderLoop: {
        type: 'radio',
        options: [
          { label: 'On', value: true },
          { label: 'Off', value: false },
        ],
      },
      sliderTransition: {
        type: 'select',
        options: [
          { label: 'Slide', value: 'slide' },
          { label: 'Fade', value: 'fade' },
        ],
      },
      typoTitleSize: { type: 'select', options: FONT_SIZE_OPTIONS },
      typoTitleWeight: { type: 'select', options: FONT_WEIGHT_OPTIONS },
      typoTitleColor: { type: 'text' },
      typoTaglineSize: { type: 'select', options: FONT_SIZE_OPTIONS },
      typoTaglineWeight: { type: 'select', options: FONT_WEIGHT_OPTIONS },
      typoTaglineColor: { type: 'text' },
      typoParaSize: { type: 'select', options: FONT_SIZE_OPTIONS },
      typoParaWeight: { type: 'select', options: FONT_WEIGHT_OPTIONS },
      typoParaColor: { type: 'text' },
      typoButtonSize: { type: 'select', options: FONT_SIZE_OPTIONS },
      typoButtonWeight: { type: 'select', options: FONT_WEIGHT_OPTIONS },
      typoButtonColor: { type: 'text' },
      // No UI control of its own — the Fields panel's slide picker
      // (blocks-panel.tsx's SlidePreviewPicker) writes this directly to
      // jump the canvas preview to a specific slide.
      activeSlideIndex: { type: 'number', visible: false },
    },
    resolveFields: (data, { fields }) =>
      variantFields(fields, data.props?.variant) as typeof fields,
    defaultProps: {
      variant: '1',
      activeSlideIndex: 0,
      visible: true,
      primaryColor: '',
      secondaryColor: '',
      d1Slides: [
        {
          image: '/seed/subhadra/hero-slider/center-ac.jpeg',
          badge: 'Central AC',
          headline: 'Cool comfort, engineered precisely.',
          subheadline:
            'Centralized air-conditioning sized, supplied and installed by our own engineers — from single rooms to full commercial buildings, backed by annual maintenance and genuine spares on call.',
          ctaLabel: 'Get a Quote',
          ctaHref: '#quote',
        },
        {
          image: '/seed/subhadra/hero-slider/complete-electrical.jpg',
          badge: 'Electrical & Switchgear',
          headline: 'Electrical products, engineered to last.',
          subheadline:
            'We supply Switches, Wires, MCBs, Distribution Boards, Cables, Switchgear, Panel Boards, Generators, Transformers, UPS, Stabilizers.',
          ctaLabel: 'Get a Quote',
          ctaHref: '#quote',
        },
        {
          image: '/seed/subhadra/hero-slider/safety-security.jpg',
          badge: 'Safety and Security',
          headline: 'Safety and security systems, engineered to protect.',
          subheadline:
            'CCTV, video analytics, access control, fire alarm, detection and fire-fighting systems designed and installed by our own team — so every entry point is covered and safety never waits.',
          ctaLabel: 'See Our Work',
          ctaHref: 'work-safety-security.html',
        },
      ],
      d2BadgeText: '',
      d2BrandsLabel: 'Brands',
      d2CtaLabel: 'Get a Quote →',
      d2CtaHref: '#quote',
      d2SecondaryLabel: 'See Our Work',
      d2Avatar1: '/seed/subhadra/clients/client-01.png',
      d2Avatar2: '/seed/subhadra/clients/client-14.png',
      d2Avatar3: '/seed/subhadra/clients/client-21.png',
      d2TrustText: '1000+ businesses across Andhra Pradesh trust us',
      d2Stat1Value: '30+',
      d2Stat1Label: 'Years of Trust',
      d2Stat2Value: '1 Lakh+',
      d2Stat2Label: 'Trusted Clients',
      d2Stat3Value: '24×7',
      d2Stat3Label: 'Support On Installations',
      d2Slides: [
        {
          dotLabel: 'Central AC',
          image: '/seed/subhadra/hero-slider/center-ac.jpeg',
          lead: 'Cool comfort,',
          highlight: 'engineered precisely.',
          description:
            'Centralized air-conditioning sized, supplied and installed by our own engineers — from single rooms to full commercial buildings, backed by annual maintenance and genuine spares on call.',
          brands: [
            {
              name: 'Blue Star',
              logo: '/seed/subhadra/ourbrands/design-execution-maintenance/Blue_Star_primary_logo.png',
            },
          ],
          workHref: 'work-central-ac.html',
        },
        {
          dotLabel: 'Electrical & Switchgear',
          image: '/seed/subhadra/hero-slider/complete-electrical.jpg',
          lead: 'Electrical products,',
          highlight: 'engineered to last.',
          description:
            'We supply Switches, Wires, MCBs, Distribution Boards, Cables, Switchgear, Panel Boards, Generators, Transformers, UPS, Stabilizers.',
          brands: [
            {
              name: 'Schneider Electric',
              logo: '/seed/subhadra/ourbrands/electrical-products/schneider-electric-logo-png_seeklogo-123510.png',
            },
            { name: 'RR Kabel', logo: '/seed/subhadra/ourbrands/electrical-products/RRKabel.jpg' },
            {
              name: 'Crompton',
              logo: '/seed/subhadra/ourbrands/electrical-products/Crompton.avif',
            },
            { name: 'Norisys', logo: '/seed/subhadra/ourbrands/electrical-products/Norisys.png' },
            { name: 'Cummins', logo: '/seed/subhadra/ourbrands/electrical-products/Cunnins.png' },
            { name: 'APC', logo: '/seed/subhadra/ourbrands/electrical-products/LogoAPC.svg' },
          ],
          // No matching work page in the reference site for this slide —
          // blank hides the "See Our Work" button (data-hide-cta="work").
          workHref: '',
        },
        {
          dotLabel: 'Safety and Security',
          image: '/seed/subhadra/hero-slider/safety-security.jpg',
          lead: 'Safety and security systems,',
          highlight: 'engineered to protect.',
          description:
            'CCTV, video analytics, access control, fire alarm, detection and fire-fighting systems designed and installed by our own team — so every entry point is covered and safety never waits.',
          brands: [
            {
              name: 'CP Plus',
              logo: '/seed/subhadra/ourbrands/design-execution-maintenance/CP%20Plus.jpg',
            },
            {
              name: 'Honeywell',
              logo: '/seed/subhadra/ourbrands/design-execution-maintenance/Honeywell%20CCTV.jpg',
            },
            {
              name: 'Ravel',
              logo: '/seed/subhadra/ourbrands/design-execution-maintenance/Ravel.png',
            },
            {
              name: 'Bosch',
              logo: '/seed/subhadra/ourbrands/design-execution-maintenance/Bosch.jpg',
            },
            {
              name: 'Ajax',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/Ajax%20logo.jpg',
            },
            {
              name: 'Matrix',
              logo: '/seed/subhadra/ourbrands/design-execution-maintenance/Matrix.jpg',
            },
          ],
          workHref: 'work-safety-security.html',
        },
        {
          dotLabel: 'Home Automation',
          image: '/seed/subhadra/hero-slider/home-automation.jpg',
          lead: 'Smart homes,',
          highlight: 'engineered as one.',
          description:
            'Lighting, AC, curtains and appliances — retrofit or centralized, all on one interface you control from anywhere, with voice control and scheduled scenes for everyday comfort.',
          brands: [
            {
              name: 'Schneider Electric',
              logo: '/seed/subhadra/ourbrands/electrical-products/schneider-electric-logo-png_seeklogo-123510.png',
            },
            {
              name: 'Bticino',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/BTicino-IME.jpg',
            },
            {
              name: 'RTI',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/RTI.png',
            },
            {
              name: 'Toyama',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/Toyama%20logo-768.webp',
            },
            {
              name: 'eelectron',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/eelectron.png',
            },
          ],
          workHref: 'work-home-automation.html',
        },
        {
          dotLabel: 'Home Theater',
          image: '/seed/subhadra/hero-slider/home-theater.jpg',
          lead: 'Home theaters,',
          highlight: 'engineered for sound.',
          description:
            'Dolby Atmos rooms, 4K projection and multiroom audio — custom-built and installed by our own team, with acoustic treatment and calibration for true cinema-grade sound.',
          brands: [
            {
              name: 'M&K Sound',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/M%26K%20Sound%20logo.png',
            },
            {
              name: 'Focal',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/focal-logo.png',
            },
            {
              name: 'Sony',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/Sony%20logo.png',
            },
            {
              name: 'Optoma',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/Optoma%20logo.jpeg',
            },
            {
              name: 'SVS',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/SVS%20sub%20logo.png',
            },
            {
              name: 'Marantz',
              logo: '/seed/subhadra/ourbrands/lifestyle-residential-products/Marantz%20logo.svg',
            },
          ],
          workHref: 'work-home-theater.html',
        },
        {
          dotLabel: 'Premium Lighting',
          image: '/seed/subhadra/hero-slider/premium-lighting.jpg',
          lead: 'Premium lighting,',
          highlight: 'engineered to impress.',
          description:
            'Designer, architectural and smart-dimmable lighting — specified, supplied and installed to elevate every room, with layered scenes for ambience, task and accent lighting.',
          brands: [
            {
              name: 'Futura',
              logo: '/seed/subhadra/ourbrands/electrical-products/Futura%20-1.svg',
            },
            { name: 'Wipro', logo: '/seed/subhadra/ourbrands/electrical-products/Wipro.png' },
          ],
          workHref: 'work-premium-lighting.html',
        },
      ],
      d3Eyebrow: 'Happy Clients',
      d3Headline: 'Engineered Once, Trusted For 30 Years.',
      d3Subheadline:
        'All building-related engineering products & services under one roof — residential, commercial and industrial, since 1996.',
      d3CtaLabel: 'Get a Quote',
      d3CtaHref: '#quote',
      d3Slides: [
        {
          image:
            'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces&q=80&auto=format',
          quote:
            'One team handled our entire HVAC and electrical fit-out — no coordination headaches between contractors, and the AMC support since handover has been excellent.',
          author: 'Operations Manager',
          role: 'Hospitality group, Visakhapatnam',
        },
        {
          image:
            'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=faces&q=80&auto=format',
          quote:
            'Critical-area AC and fire safety were sized and installed to code without a single delay to our opening date. Their service manager still checks in every quarter.',
          author: 'Facilities Head',
          role: 'Healthcare facility, Andhra Pradesh',
        },
        {
          image:
            'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&h=200&fit=crop&crop=faces&q=80&auto=format',
          quote:
            "We compared three vendors for our showroom's cooling and CCTV — Subhadra Group was the only one that could design, supply and install everything themselves.",
          author: 'Retail Operations Lead',
          role: 'Shopping mall, Visakhapatnam',
        },
      ],
      d4Headline: 'Six Disciplines, Engineered As One System',
      d4Subheadline:
        'Designed, supplied, installed and maintained by one accountable team — with a dedicated service manager for every discipline.',
      d4CtaLabel: 'Get a Quote',
      d4CtaHref: '#quote',
      d4Slides: [
        {
          icon: 'snowflake',
          title: 'Central AC',
          description:
            'Premium centralized air-conditioning providing consistent comfort, efficient climate control and a refined indoor environment — sized and installed by our own engineers.',
        },
        {
          icon: 'housegear',
          title: 'Home Automation',
          description:
            'Complete integration of lighting, A/V, curtains, AC and appliances — retrofit or centralized, all on one interface you control from anywhere.',
        },
        {
          icon: 'tv',
          title: 'Home Theater',
          description:
            'Customized rooms with Dolby Atmos, 4K projection, acoustic design and recliners — plus multiroom audio across the rest of the home.',
        },
      ],
      sliderShowArrows: true,
      sliderShowDots: true,
      sliderAutoplay: false,
      sliderAutoplaySpeed: 5000,
      sliderLoop: true,
      sliderTransition: 'fade',
      typoTitleSize: '',
      typoTitleWeight: '',
      typoTitleColor: '',
      typoTaglineSize: '',
      typoTaglineWeight: '',
      typoTaglineColor: '',
      typoParaSize: '',
      typoParaWeight: '',
      typoParaColor: '',
      typoButtonSize: '',
      typoButtonWeight: '',
      typoButtonColor: '',
    },
    render: function ConstructionHeroRender({
      id,
      puck,
      variant,
      visible,
      primaryColor,
      secondaryColor,
      d1Slides,
      d2BadgeText,
      d2BrandsLabel,
      d2CtaLabel,
      d2CtaHref,
      d2SecondaryLabel,
      d2Avatar1,
      d2Avatar2,
      d2Avatar3,
      d2TrustText,
      d2Stat1Value,
      d2Stat1Label,
      d2Stat2Value,
      d2Stat2Label,
      d2Stat3Value,
      d2Stat3Label,
      d2Slides: d2SlidesRaw,
      d3Eyebrow,
      d3Headline,
      d3Subheadline,
      d3CtaLabel,
      d3CtaHref,
      d3Slides,
      d4Headline,
      d4Subheadline,
      d4CtaLabel,
      d4CtaHref,
      d4Slides,
      sliderShowArrows,
      sliderShowDots,
      sliderAutoplay,
      sliderAutoplaySpeed,
      sliderLoop,
      sliderTransition,
      typoTitleSize,
      typoTitleWeight,
      typoTitleColor,
      typoTaglineSize,
      typoTaglineWeight,
      typoTaglineColor,
      typoParaSize,
      typoParaWeight,
      typoParaColor,
      typoButtonSize,
      typoButtonWeight,
      typoButtonColor,
      activeSlideIndex,
    }) {
      const [activeSlide, setActiveSlide] = useState(activeSlideIndex ?? 0)
      // Lets the Fields panel's slide picker (blocks-panel.tsx) jump the
      // canvas preview to a specific slide by writing this prop — the
      // canvas's own prev/next/dot clicks stay local-only (no dispatch),
      // this only reacts to an external change.
      useEffect(() => {
        if (typeof activeSlideIndex === 'number') setActiveSlide(activeSlideIndex)
      }, [activeSlideIndex])
      const d1SlidesList = (d1Slides ?? []).filter((s) => s.image)
      const d2SlidesList = (d2SlidesRaw ?? []).filter((s) => s.image)
      const d3SlidesList = (d3Slides ?? []).filter((s) => s.quote)
      const d4SlidesList = (d4Slides ?? []).filter((s) => s.title)
      const heroTotal =
        variant === '1'
          ? d1SlidesList.length
          : variant === '3'
            ? d3SlidesList.length
            : variant === '4'
              ? d4SlidesList.length
              : d2SlidesList.length
      useEffect(() => {
        if (!sliderAutoplay || heroTotal <= 1) return
        const ms = Math.max(1000, Number(sliderAutoplaySpeed) || 5000)
        const id = setInterval(() => {
          setActiveSlide((i) => {
            const next = i + 1
            if (next >= heroTotal) return sliderLoop ? 0 : i
            return next
          })
        }, ms)
        return () => clearInterval(id)
      }, [sliderAutoplay, sliderAutoplaySpeed, sliderLoop, heroTotal])
      const heroTitleStyle = typoStyle(typoTitleSize, typoTitleWeight, typoTitleColor)
      const heroTaglineStyle = typoStyle(typoTaglineSize, typoTaglineWeight, typoTaglineColor)
      const heroParaStyle = typoStyle(typoParaSize, typoParaWeight, typoParaColor)
      const heroButtonStyle = typoStyle(typoButtonSize, typoButtonWeight, typoButtonColor)
      const heroTransitionClass =
        sliderTransition === 'slide' ? 'animate-hero-slide-in' : 'animate-hero-fade-in'
      const isEditing = puck?.isEditing ?? false
      if (visible === false) return <></>

      if (variant === '1') {
        const slides = d1SlidesList
        const total = slides.length
        const idx = Math.min(activeSlide, Math.max(total - 1, 0))
        const s = slides[idx]
        const canPrev = sliderLoop || idx > 0
        const canNext = sliderLoop || idx < total - 1
        return (
          <section className="relative h-[560px] md:h-[640px] overflow-hidden bg-slate-900">
            {s && (
              <div key={idx} className={`absolute inset-0 ${heroTransitionClass}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image}
                  alt={s.headline}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10" />
                <div
                  className={`${wrap} relative z-10 h-full flex flex-col justify-center max-w-2xl`}
                >
                  {s.badge && (
                    <span
                      className="inline-flex w-fit items-center rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white mb-5"
                      style={heroTaglineStyle}
                    >
                      {s.badge}
                    </span>
                  )}
                  <h1
                    className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4"
                    style={heroTitleStyle}
                  >
                    {s.headline}
                  </h1>
                  <p
                    className="text-slate-200 text-base md:text-lg mb-7 max-w-lg"
                    style={heroParaStyle}
                  >
                    {s.subheadline}
                  </p>
                  {s.ctaLabel && (
                    <a
                      href={s.ctaHref}
                      className="inline-flex w-fit items-center rounded-lg bg-orange-500 px-7 py-3.5 text-white font-semibold hover:bg-orange-600 transition text-base"
                      style={heroButtonStyle}
                    >
                      {s.ctaLabel}
                    </a>
                  )}
                </div>
              </div>
            )}
            {total > 1 && sliderShowArrows && (
              <>
                <button
                  type="button"
                  aria-label="Previous slide"
                  disabled={!canPrev}
                  onClick={() => canPrev && setActiveSlide((i) => (i - 1 + total) % total)}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition backdrop-blur ${canPrev ? '' : 'opacity-30 cursor-not-allowed'}`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Next slide"
                  disabled={!canNext}
                  onClick={() => canNext && setActiveSlide((i) => (i + 1) % total)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition backdrop-blur ${canNext ? '' : 'opacity-30 cursor-not-allowed'}`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </>
            )}
            {total > 1 && sliderShowDots && (
              <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Show slide ${i + 1}`}
                    onClick={() => setActiveSlide(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === idx ? 'w-7 bg-orange-500' : 'w-2 bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </section>
        )
      }

      if (variant === '3') {
        const slides = d3SlidesList
        const total = slides.length
        const idx = Math.min(activeSlide, Math.max(total - 1, 0))
        const slide = slides[idx]
        const canPrev = sliderLoop || idx > 0
        const canNext = sliderLoop || idx < total - 1
        return (
          <section className="bg-slate-50 py-16 md:py-24">
            <div className={`${wrap} text-center`}>
              {d3Eyebrow && (
                <p
                  className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-3"
                  style={heroTaglineStyle}
                >
                  {d3Eyebrow}
                </p>
              )}
              <h1
                className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4 max-w-3xl mx-auto"
                style={heroTitleStyle}
              >
                {d3Headline}
              </h1>
              <p
                className="text-slate-600 text-base md:text-lg mb-10 max-w-xl mx-auto"
                style={heroParaStyle}
              >
                {d3Subheadline}
              </p>
              {d3CtaLabel && (
                <a
                  href={d3CtaHref}
                  className="inline-flex items-center rounded-lg bg-orange-500 px-7 py-3.5 text-white font-semibold hover:bg-orange-600 transition text-base mb-12"
                  style={heroButtonStyle}
                >
                  {d3CtaLabel}
                </a>
              )}
              {slide && (
                <div
                  key={idx}
                  className={`relative max-w-2xl mx-auto rounded-2xl bg-white border border-slate-200 shadow-sm p-8 md:p-10 ${heroTransitionClass}`}
                >
                  <div className="flex flex-col items-center gap-4">
                    {slide.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slide.image}
                        alt={slide.author}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    <p className="text-slate-700 text-lg leading-relaxed">
                      &#8220;{slide.quote}&#8221;
                    </p>
                    <div>
                      <p className="font-semibold text-slate-900">{slide.author}</p>
                      <p className="text-sm text-slate-500">{slide.role}</p>
                    </div>
                  </div>
                  {total > 1 && sliderShowArrows && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous"
                        disabled={!canPrev}
                        onClick={() => canPrev && setActiveSlide((i) => (i - 1 + total) % total)}
                        className={`absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-50 text-slate-700 flex items-center justify-center hover:bg-slate-100 transition ${canPrev ? '' : 'opacity-30 cursor-not-allowed'}`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Next"
                        disabled={!canNext}
                        onClick={() => canNext && setActiveSlide((i) => (i + 1) % total)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-50 text-slate-700 flex items-center justify-center hover:bg-slate-100 transition ${canNext ? '' : 'opacity-30 cursor-not-allowed'}`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
              {total > 1 && sliderShowDots && (
                <div className="flex justify-center gap-2 mt-6">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setActiveSlide(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === idx ? 'w-6 bg-orange-500' : 'w-2 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      }

      if (variant === '4') {
        const slides = d4SlidesList
        const total = slides.length
        const idx = Math.min(activeSlide, Math.max(total - 1, 0))
        const slide = slides[idx]
        const Icon = slide ? (ICON_BY_KEY[slide.icon] ?? HardHatIcon) : HardHatIcon
        const canPrev = sliderLoop || idx > 0
        const canNext = sliderLoop || idx < total - 1
        return (
          <section className="bg-white py-16 md:py-24 border-b border-slate-100">
            <div className={`${wrap} text-center`}>
              <h1
                className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4 max-w-3xl mx-auto"
                style={heroTitleStyle}
              >
                {d4Headline}
              </h1>
              <p
                className="text-slate-600 text-base md:text-lg mb-4 max-w-xl mx-auto"
                style={heroParaStyle}
              >
                {d4Subheadline}
              </p>
              {d4CtaLabel && (
                <a
                  href={d4CtaHref}
                  className="inline-flex items-center rounded-lg bg-orange-500 px-7 py-3.5 text-white font-semibold hover:bg-orange-600 transition text-base mb-12"
                  style={heroButtonStyle}
                >
                  {d4CtaLabel}
                </a>
              )}
              {slide && (
                <div key={idx} className={`relative max-w-md mx-auto ${heroTransitionClass}`}>
                  <div className="rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition">
                    <div className="text-orange-500 mb-4 flex justify-center [&>svg]:w-9 [&>svg]:h-9">
                      <Icon />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{slide.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{slide.description}</p>
                  </div>
                  {total > 1 && sliderShowArrows && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous"
                        disabled={!canPrev}
                        onClick={() => canPrev && setActiveSlide((i) => (i - 1 + total) % total)}
                        className={`absolute -left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition shadow-sm ${canPrev ? '' : 'opacity-30 cursor-not-allowed'}`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Next"
                        disabled={!canNext}
                        onClick={() => canNext && setActiveSlide((i) => (i + 1) % total)}
                        className={`absolute -right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition shadow-sm ${canNext ? '' : 'opacity-30 cursor-not-allowed'}`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
              {total > 1 && sliderShowDots && (
                <div className="flex justify-center gap-2 mt-6">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setActiveSlide(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === idx ? 'w-6 bg-orange-500' : 'w-2 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      }

      // Design 2 (default) — dark split hero whose headline/lede/image/
      // brand logo all swap per active dot, matching the reference site's
      // real hero (data-headline/data-desc swapped by JS there; here it's
      // just React state, `activeSlide`, shared with the other designs'
      // sliders). Up to 6 slides, matching the reference's 6 dots.
      const d2Slides = d2SlidesList
      const d2Total = d2Slides.length
      const d2Idx = Math.min(activeSlide, Math.max(d2Total - 1, 0))
      const d2Slide = d2Slides[d2Idx]
      const avatars = [d2Avatar1, d2Avatar2, d2Avatar3].filter(Boolean)
      const heroBg = secondaryColor || '#0a0c18'
      const heroAccent = primaryColor || '#ff5a36'
      const heroText = readableTextColor(heroBg)
      const heroMuted = heroText === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(17,24,39,0.65)'
      const stats = [
        {
          value: d2Stat1Value,
          label: d2Stat1Label,
          valuePath: 'd2Stat1Value',
          labelPath: 'd2Stat1Label',
        },
        {
          value: d2Stat2Value,
          label: d2Stat2Label,
          valuePath: 'd2Stat2Value',
          labelPath: 'd2Stat2Label',
        },
        {
          value: d2Stat3Value,
          label: d2Stat3Label,
          valuePath: 'd2Stat3Value',
          labelPath: 'd2Stat3Label',
        },
      ].filter((s) => s.value)
      const d2CanPrev = sliderLoop || d2Idx > 0
      const d2CanNext = sliderLoop || d2Idx < d2Total - 1
      return (
        <section className="py-14 md:py-20" style={{ backgroundColor: heroBg, color: heroText }}>
          {/* Reference markup wraps this in `container-fluid` (full-width,
              gutter padding only), not the capped `.container` most other
              sections use — a full-bleed banner, not a centered column with
              large side margins. `wrap` (mx-auto max-w-6xl) is deliberately
              not used here. */}
          <div
            key={d2Idx}
            className={`grid grid-cols-1 gap-10 px-4 items-center md:grid-cols-2 md:px-8 ${heroTransitionClass}`}
          >
            <div className="order-2 md:order-2">
              {d2BadgeText && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold mb-5"
                  style={{ borderColor: heroAccent, color: heroAccent, ...heroTaglineStyle }}
                >
                  {d2BadgeText}
                </span>
              )}
              <h1
                className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-5"
                style={heroTitleStyle}
              >
                <InlineEditableText
                  id={id}
                  path={['d2Slides', d2Idx, 'lead']}
                  value={d2Slide?.lead ?? ''}
                  isEditing={isEditing}
                />{' '}
                {(isEditing || d2Slide?.highlight) && (
                  <InlineEditableText
                    id={id}
                    path={['d2Slides', d2Idx, 'highlight']}
                    value={d2Slide?.highlight ?? ''}
                    style={{ color: heroAccent, ...heroTitleStyle }}
                    isEditing={isEditing}
                  />
                )}
              </h1>
              {(isEditing || d2Slide?.description) && (
                <p
                  className="text-base md:text-lg mb-8 max-w-lg"
                  style={{ color: heroMuted, ...heroParaStyle }}
                >
                  <InlineEditableText
                    id={id}
                    path={['d2Slides', d2Idx, 'description']}
                    value={d2Slide?.description ?? ''}
                    isEditing={isEditing}
                    multiline
                  />
                </p>
              )}
              {d2Slide?.brands && d2Slide.brands.length > 0 && (
                <div className="mb-8">
                  <p
                    className="text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: heroMuted }}
                  >
                    <InlineEditableText
                      id={id}
                      path={['d2BrandsLabel']}
                      value={d2BrandsLabel ?? ''}
                      isEditing={isEditing}
                    />
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {d2Slide.brands.map((b, i) =>
                      b.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={b.logo}
                          alt={b.name}
                          title={b.name}
                          className="h-10 max-w-[110px] rounded-lg bg-white object-contain px-3 py-2"
                        />
                      ) : (
                        <span
                          key={i}
                          className="text-sm font-semibold"
                          style={{ color: heroMuted }}
                        >
                          {b.name}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                {(isEditing || d2CtaLabel) && (
                  <a
                    href={d2CtaHref}
                    onClick={isEditing ? (e) => e.preventDefault() : undefined}
                    style={{
                      backgroundColor: heroAccent,
                      color: readableTextColor(heroAccent),
                      ...heroButtonStyle,
                    }}
                    className="inline-flex items-center justify-center rounded-lg px-7 py-3.5 font-semibold hover:opacity-90 transition text-base"
                  >
                    <InlineEditableText
                      id={id}
                      path={['d2CtaLabel']}
                      value={d2CtaLabel ?? ''}
                      isEditing={isEditing}
                    />
                  </a>
                )}
                {/* Per-slide link (Fields panel → this slide's own
                    "workHref") — blank hides the button on that slide,
                    matching the reference's Electrical & Switchgear slide
                    which has no matching work page. */}
                {(isEditing || d2Slide?.workHref) && (
                  <a
                    href={d2Slide?.workHref || '#'}
                    onClick={isEditing ? (e) => e.preventDefault() : undefined}
                    className="inline-flex items-center justify-center rounded-lg border-2 px-7 py-3.5 font-semibold hover:bg-white/10 transition text-base"
                    style={{ borderColor: heroMuted, color: heroText, ...heroButtonStyle }}
                  >
                    <InlineEditableText
                      id={id}
                      path={['d2SecondaryLabel']}
                      value={d2SecondaryLabel ?? ''}
                      isEditing={isEditing}
                    />
                  </a>
                )}
              </div>
              {avatars.length > 0 && (
                <div className="flex items-center gap-3 mb-8">
                  <div className="flex -space-x-3">
                    {avatars.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="w-9 h-9 rounded-full border-2 object-cover"
                        style={{ borderColor: heroBg }}
                      />
                    ))}
                  </div>
                  {(isEditing || d2TrustText) && (
                    <p className="text-sm" style={{ color: heroMuted }}>
                      <InlineEditableText
                        id={id}
                        path={['d2TrustText']}
                        value={d2TrustText ?? ''}
                        isEditing={isEditing}
                      />
                    </p>
                  )}
                </div>
              )}
              {stats.length > 0 && (
                <div
                  className="flex flex-wrap gap-8 border-t pt-6"
                  style={{ borderColor: heroMuted }}
                >
                  {stats.map((s, i) => (
                    <div key={i}>
                      <p className="text-2xl md:text-3xl font-extrabold">
                        <InlineEditableText
                          id={id}
                          path={[s.valuePath]}
                          value={s.value ?? ''}
                          isEditing={isEditing}
                        />
                      </p>
                      <p className="text-xs mt-1" style={{ color: heroMuted }}>
                        <InlineEditableText
                          id={id}
                          path={[s.labelPath]}
                          value={s.label ?? ''}
                          isEditing={isEditing}
                        />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Image column comes first (left) — matches the reference's
                actual visual order (its "copy" div is first in the DOM but
                CSS reorders it visually right of the image). */}
            <div className="order-1 md:order-1">
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-800">
                {d2Slide?.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d2Slide.image}
                    alt={d2Slide.dotLabel || ''}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {d2Total > 1 && sliderShowArrows && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous slide"
                      disabled={!d2CanPrev}
                      onClick={() =>
                        d2CanPrev && setActiveSlide((i) => (i - 1 + d2Total) % d2Total)
                      }
                      className={`absolute left-3 top-3 w-8 h-8 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow hover:bg-white transition ${d2CanPrev ? '' : 'opacity-30 cursor-not-allowed'}`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Next slide"
                      disabled={!d2CanNext}
                      onClick={() => d2CanNext && setActiveSlide((i) => (i + 1) % d2Total)}
                      className={`absolute right-3 top-3 w-8 h-8 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow hover:bg-white transition ${d2CanNext ? '' : 'opacity-30 cursor-not-allowed'}`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </>
                )}
                {d2Total > 1 && sliderShowDots && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                    {d2Slides.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={s.dotLabel || `Show slide ${i + 1}`}
                        onClick={() => setActiveSlide(i)}
                        className={`h-2 rounded-full transition-all ${
                          i === d2Idx ? 'w-6 bg-white' : 'w-2 bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  ConstructionInnerBanner: {
    label: 'Inner Banner',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Full-bleed photo', value: '1' },
          { label: 'Design 2 — Split card', value: '2' },
          { label: 'Design 3 — Compact centered strip', value: '3' },
          { label: 'Design 4 — Frosted glass over photo', value: '4' },
        ],
      },
      visible: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      backgroundImage: imageField('Background image'),
      imageAlt: { type: 'text' },
      subtitle: { type: 'textarea' },
      // This site's public pages are served at generated `/p/<slug>` paths,
      // not a clean `/` root — so the breadcrumb's "Home" link can't be
      // hardcoded (see docs/superpowers/plans/2026-09-26-inner-banner.md for
      // the pre-existing hardcoded version this replaces).
      homeHref: { type: 'text' },
      // All optional — a page whose stored content predates these fields
      // just renders the same as before (no eyebrow, no 3rd breadcrumb
      // level, no CTA row). Design 1 only; other variants unaffected.
      eyebrow: { type: 'text' },
      parentLabel: { type: 'text' },
      parentHref: { type: 'text' },
      ctaPrimaryLabel: { type: 'text' },
      ctaPrimaryHref: { type: 'text' },
      ctaSecondaryLabel: { type: 'text' },
      ctaSecondaryHref: { type: 'text' },
      // Optional H1 override — when set, replaces the page-title H1 (the
      // breadcrumb still shows the page title).
      headline: { type: 'text' },
      // Optional last-breadcrumb label (defaults to the page title).
      currentLabel: { type: 'text' },
      ctaTertiaryLabel: { type: 'text' },
      ctaTertiaryHref: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      visible: true,
      backgroundImage: '/seed/subhadra/brand/shop.webp',
      imageAlt: 'Subhadra Group showroom building exterior',
      subtitle:
        'Your one-stop solution for building engineering products & services — 30 years of trust, one accountable team.',
      homeHref: '/',
      eyebrow: '',
      parentLabel: '',
      parentHref: '',
      ctaPrimaryLabel: '',
      ctaPrimaryHref: '',
      ctaSecondaryLabel: '',
      ctaSecondaryHref: '',
    },
    render: function ConstructionInnerBannerRender({
      id,
      puck,
      variant,
      visible,
      backgroundImage,
      imageAlt,
      subtitle,
      homeHref,
      eyebrow,
      parentLabel,
      parentHref,
      ctaPrimaryLabel,
      ctaPrimaryHref,
      ctaSecondaryLabel,
      ctaSecondaryHref,
      headline,
      currentLabel,
      ctaTertiaryLabel,
      ctaTertiaryHref,
    }) {
      if (visible === false) return <></>
      const title = (puck?.metadata?.pageTitle as string | undefined) || 'Page Title'
      const isEditing = puck?.isEditing ?? false
      const hasCta = Boolean(ctaPrimaryLabel || ctaSecondaryLabel || ctaTertiaryLabel)

      const ctaRow = hasCta ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {ctaPrimaryLabel && (
            <a
              href={ctaPrimaryHref || '#'}
              className="rounded bg-[#e8622c] px-6 py-3 text-sm font-semibold text-white hover:bg-[#c94f1d]"
            >
              {ctaPrimaryLabel}
            </a>
          )}
          {ctaSecondaryLabel && (
            <a
              href={ctaSecondaryHref || '#'}
              className="rounded border border-white/50 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              {ctaSecondaryLabel}
            </a>
          )}
          {ctaTertiaryLabel && (
            <a
              href={ctaTertiaryHref || '#'}
              className="rounded border border-white/50 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              {ctaTertiaryLabel}
            </a>
          )}
        </div>
      ) : null

      const breadcrumb = (
        <nav
          className="mb-3 flex items-center gap-2 text-[13px] text-white/80"
          aria-label="Breadcrumb"
        >
          <Link href={homeHref || '/'} className="hover:text-white">
            Home
          </Link>
          <span>/</span>
          {parentLabel && (
            <>
              <Link href={parentHref || '#'} className="hover:text-white">
                {parentLabel}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="font-semibold text-white">{currentLabel || title}</span>
        </nav>
      )

      const subtitleNode = (
        <InlineEditableText
          id={id}
          path={['subtitle']}
          value={subtitle}
          as="p"
          isEditing={isEditing}
          multiline
        />
      )

      if (variant === '2') {
        return (
          <section className="grid overflow-hidden bg-slate-900 md:grid-cols-2">
            <div className="flex flex-col justify-center gap-3 px-8 py-16 md:px-14">
              {breadcrumb}
              <h1 className="text-3xl font-extrabold text-white md:text-4xl">{title}</h1>
              <div className="max-w-md text-[15px] text-white/75">{subtitleNode}</div>
              <span className="mt-4 h-1 w-16 rounded bg-orange-500" />
            </div>
            <div className="relative min-h-[280px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={backgroundImage}
                alt={imageAlt}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </section>
        )
      }

      if (variant === '3') {
        return (
          <section className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-14 text-center">
            <div className="mx-auto flex max-w-2xl flex-col items-center">
              {breadcrumb}
              <h1 className="text-3xl font-extrabold text-white md:text-4xl">{title}</h1>
              <div className="mt-2 max-w-lg text-[15px] text-white/75">{subtitleNode}</div>
            </div>
          </section>
        )
      }

      if (variant === '4') {
        return (
          <section className="relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backgroundImage} alt={imageAlt} className="h-[380px] w-full object-cover" />
            <div className="absolute bottom-6 left-6 max-w-md rounded-2xl border border-white/30 bg-white/15 p-6 backdrop-blur-md">
              {breadcrumb}
              <h1 className="text-2xl font-extrabold text-white md:text-3xl">{title}</h1>
              <div className="mt-2 text-[14px] text-white/85">{subtitleNode}</div>
            </div>
          </section>
        )
      }

      // Design 1 — pixel clone of the reference site's .page-banner
      // (after-delete-folder/about.html and every other inner page): CSS
      // is `.page-banner{padding-block:96px}` (150px on lg), a 3-stop
      // `linear-gradient(180deg, rgba(10,11,13,.72) 0%, rgba(10,11,13,.8)
      // 60%, rgba(10,11,13,.92) 100%)` overlay, and fully centered text —
      // not the bottom-left-anchored, fixed-height treatment this used to
      // have (see after-delete-folder/assets/css/style.css `.page-banner`).
      return (
        <section className="relative overflow-hidden py-24 text-center text-white lg:py-[150px]">
          <div className="absolute inset-0 z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backgroundImage} alt={imageAlt} className="h-full w-full object-cover" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(10,11,13,.72) 0%, rgba(10,11,13,.8) 60%, rgba(10,11,13,.92) 100%)',
              }}
            />
          </div>
          <div className="relative z-10 px-6 md:px-14">
            <nav
              className="mb-4 flex items-center justify-center gap-2 text-[13px] font-semibold text-white/60"
              aria-label="Breadcrumb"
            >
              <Link href={homeHref || '/'} className="text-white/85 hover:text-white">
                Home
              </Link>
              <span className="opacity-50">/</span>
              {parentLabel && (
                <>
                  <Link href={parentHref || '#'} className="text-white/85 hover:text-white">
                    {parentLabel}
                  </Link>
                  <span className="opacity-50">/</span>
                </>
              )}
              <span className="text-[#e8622c]">{currentLabel || title}</span>
            </nav>
            {eyebrow && (
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#e8622c]">
                {eyebrow}
              </p>
            )}
            <h1 className="text-[clamp(2rem,6vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.02em]">
              {headline || title}
            </h1>
            <div className="mx-auto mt-4 max-w-[640px] text-base leading-[1.65] text-white/80">
              {subtitleNode}
            </div>
            {ctaRow}
          </div>
        </section>
      )
    },
  },

  // 2. Services grid
  ConstructionServicesGrid: {
    label: 'Services Grid',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      service1Title: { type: 'text' },
      service1Description: { type: 'textarea' },
      service2Title: { type: 'text' },
      service2Description: { type: 'textarea' },
      service3Title: { type: 'text' },
      service3Description: { type: 'textarea' },
      service4Title: { type: 'text' },
      service4Description: { type: 'textarea' },
      service5Title: { type: 'text' },
      service5Description: { type: 'textarea' },
      service6Title: { type: 'text' },
      service6Description: { type: 'textarea' },
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
      sectionTitle: 'Our Services',
      sectionSubtitle:
        'From foundations to finishes — we handle every phase of your construction project.',
      service1Title: 'New Construction',
      service1Description:
        'Ground-up residential and commercial builds to your specifications and local codes.',
      service2Title: 'Renovations & Remodeling',
      service2Description:
        'Transform existing spaces with structural updates, expansions, and interior upgrades.',
      service3Title: 'Roofing & Waterproofing',
      service3Description:
        'Durable roofing installations, repairs, and waterproofing systems for all climates.',
      service4Title: 'Concrete & Foundations',
      service4Description:
        'Footings, slabs, retaining walls, and structural concrete poured to spec.',
      service5Title: 'Electrical & MEP',
      service5Description:
        'Full mechanical, electrical, and plumbing coordination with licensed subcontractors.',
      service6Title: 'Project Management',
      service6Description:
        'End-to-end oversight, scheduling, procurement, and quality control on every site.',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      service1Title,
      service1Description,
      service2Title,
      service2Description,
      service3Title,
      service3Description,
      service4Title,
      service4Description,
      service5Title,
      service5Description,
      service6Title,
      service6Description,
      padding,
      background,
    }) => {
      const services = [
        { title: service1Title, description: service1Description },
        { title: service2Title, description: service2Description },
        { title: service3Title, description: service3Description },
        { title: service4Title, description: service4Description },
        { title: service5Title, description: service5Description },
        { title: service6Title, description: service6Description },
      ].filter((s) => s.title)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto text-base md:text-lg">
                  {sectionSubtitle}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 p-6 hover:shadow-md transition bg-white"
                >
                  <div className="text-orange-500 mb-3">
                    <HardHatIcon />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg mb-2">{s.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

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
      offering1Image:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=700&h=500&fit=crop&auto=format',
      offering1Heading: 'Structural Construction',
      offering1Description:
        'End-to-end structural builds engineered to code, from footings to rooftop.',
      offering1BrandNames: 'Brand One · Brand Two',
      offering1Href: '#',
      offering2NumberTag: '02',
      offering2Image:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=700&h=500&fit=crop&auto=format',
      offering2Heading: 'MEP & Systems Integration',
      offering2Description:
        'Mechanical, electrical, and plumbing systems coordinated under one schedule.',
      offering2BrandNames: 'Brand Three · Brand Four',
      offering2Href: '#',
      offering3NumberTag: '03',
      offering3Image:
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?w=700&h=500&fit=crop&auto=format',
      offering3Heading: 'Finishing & Interiors',
      offering3Description:
        'Precision finishing work that turns a shell into a move-in-ready space.',
      offering3BrandNames: 'Brand Five · Brand Six',
      offering3Href: '#',
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionOfferingsRowsRender({
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
    }) {
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
      const iconFor = (i: number) => icons[i % icons.length] ?? HardHatIcon
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
                const Icon = iconFor(i)
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
                      {o.brandNames && (
                        <p className="text-xs text-slate-400 mb-4">{o.brandNames}</p>
                      )}
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

  // About — split with badge overlay
  ConstructionAboutSplit: {
    label: 'About (Split with Badge)',
    fields: {
      // false = use this block's own eyebrow/heading/paragraph even when the
      // Settings → Fields values exist.
      useSettings: {
        type: 'radio',
        options: [
          { label: 'Use Settings text', value: true },
          { label: 'Use this block only', value: false },
        ],
      },
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      paragraph: { type: 'textarea' },
      photo: imageField('Photo'),
      badgeNumber: { type: 'text' },
      badgeLabel: { type: 'text' },
      check1Text: { type: 'text' },
      check2Text: { type: 'text' },
      check3Text: { type: 'text' },
      brochureLabel: { type: 'text' },
      brochureHref: { type: 'text' },
      membershipLabel: { type: 'text' },
      members: {
        type: 'array',
        min: 0,
        max: 20,
        getItemSummary: (item, index) => item.title || `Logo ${(index ?? 0) + 1}`,
        defaultItemProps: { title: '', logo: '' },
        arrayFields: {
          logo: imageField('Logo'),
          // Optional — leave blank to show just the logo with no caption.
          title: { type: 'text' },
        },
      },
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
      heading: 'Your one-stop solution for building engineering',
      paragraph:
        'Subhadra Group was founded in 1996 to provide all building-related engineering products & services under one roof for residential, commercial buildings and industries. With 30+ years of technical expertise across HVAC, Electricals and ELV systems, our team delivers perfect-engineered solutions for every application.',
      photo: '/seed/subhadra/about.webp',
      badgeNumber: '30',
      badgeLabel: 'Years of Trust',
      check1Text: 'World-class, pioneer brands only',
      check2Text: 'Our own trained engineers, no sub-contracting',
      check3Text: 'A dedicated service manager per discipline, 24×7',
      brochureLabel: 'Read More →',
      brochureHref: 'about.html',
      membershipLabel: 'Proud member of',
      members: [
        { title: '', logo: '/seed/subhadra/member/fsai.jpeg' },
        { title: '', logo: '/seed/subhadra/member/IIID.jpeg' },
        { title: '', logo: '/seed/subhadra/member/IGBC.png' },
        { title: '', logo: '/seed/subhadra/member/IPA.png' },
        { title: '', logo: '/seed/subhadra/member/ASHRAE.webp' },
        { title: '', logo: '/seed/subhadra/member/bni.svg' },
        { title: '', logo: '/seed/subhadra/member/cii.svg' },
        { title: '', logo: '/seed/subhadra/member/VCCI.png' },
      ],
      padding: 'md',
      background: 'muted',
    },
    render: function ConstructionAboutSplitRender({
      id,
      puck,
      eyebrow: eyebrowProp,
      heading: headingProp,
      paragraph: paragraphProp,
      useSettings,
      photo,
      badgeNumber,
      badgeLabel,
      check1Text,
      check2Text,
      check3Text,
      brochureLabel,
      brochureHref,
      membershipLabel,
      members,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const isEditing = puck?.isEditing ?? false
      // About copy is simple website text, managed through Settings → Fields
      // (/admin/settings/view/website-content) once it has a value there —
      // eyebrow/heading/paragraph props are only the fallback for an install
      // that hasn't set those fields yet. Disable inline-editing on whichever
      // of the 3 currently comes from Settings, so a canvas click can't
      // silently edit the now-unused static prop instead.
      const sfAll = useSettingsFieldValues(['about-eyebrow', 'about-heading', 'about-paragraph'])
      const sf = useSettings === false ? ({} as typeof sfAll) : sfAll
      const eyebrow = sf['about-eyebrow'] || eyebrowProp
      const heading = sf['about-heading'] || headingProp
      const paragraph = sf['about-paragraph'] || paragraphProp
      const eyebrowIsEditing = isEditing && !sf['about-eyebrow']
      const headingIsEditing = isEditing && !sf['about-heading']
      const paragraphIsEditing = isEditing && !sf['about-paragraph']
      const checks = [
        { text: check1Text, path: 'check1Text' },
        { text: check2Text, path: 'check2Text' },
        { text: check3Text, path: 'check3Text' },
      ].filter((c) => c.text)
      const memberLogos = (members ?? []).filter((m) => m.logo)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className="w-full px-6 md:px-10 lg:px-16 md:flex gap-14 items-center">
            <div className="md:w-2/5 relative mb-10 md:mb-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={heading} className="rounded-2xl w-full h-96 object-cover" />
              {(isEditing || badgeNumber || badgeLabel) && (
                <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-orange-500 text-white flex flex-col items-center justify-center text-center shadow-lg">
                  <span className="text-2xl font-extrabold leading-none">
                    <InlineEditableText
                      id={id}
                      path={['badgeNumber']}
                      value={badgeNumber ?? ''}
                      isEditing={isEditing}
                    />
                  </span>
                  <span className="text-[11px] font-medium mt-1 px-2">
                    <InlineEditableText
                      id={id}
                      path={['badgeLabel']}
                      value={badgeLabel ?? ''}
                      isEditing={isEditing}
                    />
                  </span>
                </div>
              )}
            </div>
            <div className="md:w-3/5">
              {(isEditing || eyebrow) && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  <InlineEditableText
                    id={id}
                    path={['eyebrow']}
                    value={eyebrow ?? ''}
                    isEditing={eyebrowIsEditing}
                  />
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">
                <InlineEditableText
                  id={id}
                  path={['heading']}
                  value={heading ?? ''}
                  isEditing={headingIsEditing}
                />
              </h2>
              {(isEditing || paragraph) && (
                <p className="text-slate-600 leading-relaxed mb-6">
                  <InlineEditableText
                    id={id}
                    path={['paragraph']}
                    value={paragraph ?? ''}
                    isEditing={paragraphIsEditing}
                    multiline
                  />
                </p>
              )}
              {checks.length > 0 && (
                <ul className="flex flex-col gap-3 mb-8">
                  {checks.map((c, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700">
                      <span className="text-green-600 flex-shrink-0">
                        <CheckShieldIcon />
                      </span>
                      <InlineEditableText
                        id={id}
                        path={[c.path]}
                        value={c.text ?? ''}
                        isEditing={isEditing}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {(isEditing || brochureLabel) && (
                <a
                  href={brochureHref}
                  onClick={isEditing ? (e) => e.preventDefault() : undefined}
                  className="inline-flex items-center rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                >
                  <InlineEditableText
                    id={id}
                    path={['brochureLabel']}
                    value={brochureLabel ?? ''}
                    isEditing={isEditing}
                  />
                </a>
              )}
              {memberLogos.length > 0 && (
                <div className="mt-8">
                  {(isEditing || membershipLabel) && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                      <InlineEditableText
                        id={id}
                        path={['membershipLabel']}
                        value={membershipLabel ?? ''}
                        isEditing={isEditing}
                      />
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-4">
                    {memberLogos.map((m, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.logo}
                          alt={m.title || ''}
                          title={m.title || undefined}
                          className="h-9 w-auto object-contain opacity-90"
                        />
                        {m.title && (
                          <span className="text-[10px] text-slate-500 text-center leading-tight max-w-[80px]">
                            {m.title}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )
    },
  },

  // 3. Project / Portfolio gallery → repurposed as Sectors grid
  ConstructionProjectGallery: {
    label: 'Project Gallery (Sectors Grid)',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      items: {
        type: 'array',
        min: 0,
        max: 30,
        getItemSummary: (item, index) => item.title || `Project ${(index ?? 0) + 1}`,
        defaultItemProps: {
          title: '',
          category: '',
          image: '',
          numberTag: '',
          description: '',
          href: '',
        },
        arrayFields: {
          title: { type: 'text' },
          category: { type: 'text' },
          image: imageField('Image'),
          numberTag: { type: 'text' },
          description: { type: 'textarea' },
          href: { type: 'text' },
        },
      },
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
      sectionTitle: 'Solutions for every space',
      sectionSubtitle:
        'From luxury residences to hotels, hospitals, showrooms and industrial plants — scroll to explore.',
      items: [
        {
          title: 'Villa',
          category: 'Residential',
          image: '/seed/subhadra/sectors/villa.jpg',
          numberTag: '01',
          description: 'Comfort, control and cinema for private residences.',
          href: '#villa',
        },
        {
          title: 'Hotel',
          category: 'Hospitality',
          image: '/seed/subhadra/sectors/hotel.jpg',
          numberTag: '02',
          description: 'Guest-room comfort that runs all day, every day.',
          href: '#hotel',
        },
        {
          title: 'Hospital',
          category: 'Healthcare',
          image:
            'https://images.unsplash.com/photo-1626315869436-d6781ba69d6e?w=600&h=800&fit=crop&q=75&auto=format',
          numberTag: '03',
          description: 'Critical-area AC, fire safety and power backup, built to compliance.',
          href: '#hospital',
        },
        {
          title: 'Showrooms',
          category: 'Retail',
          image: '/seed/subhadra/sectors/showrooms.jpg',
          numberTag: '04',
          description: 'Cooling, lighting and access control for retail floors.',
          href: '#showrooms',
        },
        {
          title: 'Convention Center',
          category: 'Events',
          image: '/seed/subhadra/sectors/convention-center.jpg',
          numberTag: '05',
          description: 'High-load cooling and professional audio.',
          href: '#convention-center',
        },
        {
          title: 'Education',
          category: 'Institutional',
          image: '/seed/subhadra/sectors/educational-institute.jpg',
          numberTag: '06',
          description: 'Campus electrical, networking and safety.',
          href: '#educational-institute',
        },
        {
          title: 'Builder',
          category: 'Construction',
          image: '/seed/subhadra/sectors/builder.jpg',
          numberTag: '07',
          description: 'Turnkey MEP packages, block after block, on schedule.',
          href: '#builder',
        },
        {
          title: 'Industry',
          category: 'Industrial',
          image: '/seed/subhadra/sectors/industry.jpg',
          numberTag: '08',
          description: 'Transformers, switchgear and plant maintenance.',
          href: '#industry',
        },
        {
          title: 'Government',
          category: 'Public',
          image:
            'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&h=800&fit=crop&q=75&auto=format',
          numberTag: '09',
          description: 'Compliant electrical, safety and power backup for public buildings.',
          href: '#government',
        },
        {
          title: 'Premium Flats',
          category: 'Residential',
          image:
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=800&fit=crop&q=75&auto=format',
          numberTag: '10',
          description: 'Snag-free AC, electrical and automation fit-outs for apartments.',
          href: '#premium-flats',
        },
        {
          title: 'Gated Communities',
          category: 'Township',
          image:
            'https://images.unsplash.com/photo-1580216643062-cf460548a66a?w=600&h=800&fit=crop&q=75&auto=format',
          numberTag: '11',
          description: 'Gate automation, security and electrical for entire townships.',
          href: '#gated-communities',
        },
      ],
      padding: 'md',
    },
    render: function ConstructionProjectGalleryRender({
      id,
      puck,
      sectionEyebrow,
      sectionTitle,
      sectionSubtitle,
      items,
      padding,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const isEditing = puck?.isEditing ?? false
      const projects = (items ?? []).map((p, n) => ({ ...p, n })).filter((p) => p.title)
      return (
        <section ref={ref} className={`${revealCls} ${padY[padding]} bg-white`}>
          {/* Reference (v2-sectors) wraps this section in container-fluid, not
              a max-width container — full width so the rail can show more
              cards edge-to-edge, unlike every other section on the page. */}
          <div className="w-full px-4 md:px-8">
            <div className="text-center mb-10">
              {sectionEyebrow && (
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#4b5058]">
                  {sectionEyebrow}
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">
                <InlineEditableText
                  id={id}
                  path={['sectionTitle']}
                  value={sectionTitle ?? ''}
                  isEditing={isEditing}
                />
              </h2>
              {(isEditing || sectionSubtitle) && (
                <p className="text-slate-600 max-w-2xl mx-auto">
                  <InlineEditableText
                    id={id}
                    path={['sectionSubtitle']}
                    value={sectionSubtitle ?? ''}
                    isEditing={isEditing}
                    multiline
                  />
                </p>
              )}
            </div>
            {/* Reference (.v2-sector-rail) breaks at 640/900/1200px → 2/3/4
                columns — Tailwind's stock `lg` (1024px) would skip straight
                from 2 to 4, so 900/1200 need arbitrary-value breakpoints. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4 gap-4">
              {projects.map((p, i) => (
                <a
                  key={i}
                  href={p.href || '#'}
                  onClick={isEditing ? (e) => e.preventDefault() : undefined}
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
                    {(isEditing || p.category) && (
                      <span className="text-xs font-medium text-orange-300 uppercase tracking-wide">
                        <InlineEditableText
                          id={id}
                          path={['items', p.n, 'category']}
                          value={p.category ?? ''}
                          isEditing={isEditing}
                        />
                      </span>
                    )}
                    <p className="font-semibold">
                      <InlineEditableText
                        id={id}
                        path={['items', p.n, 'title']}
                        value={p.title ?? ''}
                        isEditing={isEditing}
                      />
                    </p>
                    {(isEditing || p.description) && (
                      <p className="text-xs text-white/80 mt-0.5">
                        <InlineEditableText
                          id={id}
                          path={['items', p.n, 'description']}
                          value={p.description ?? ''}
                          isEditing={isEditing}
                        />
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 4. Quote request CTA
  ConstructionQuoteCTA: {
    label: 'Quote Request CTA',
    fields: {
      eyebrow: { type: 'text' },
      headline: { type: 'text' },
      subtext: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      // Optional — a page whose stored content predates this field just
      // shows the single primary CTA as before.
      secondaryCtaLabel: { type: 'text' },
      secondaryCtaHref: { type: 'text' },
      phoneNumber: { type: 'text' },
      phoneLabel: { type: 'text' },
      background: {
        type: 'select',
        options: [
          { label: 'Dark', value: 'dark' },
          { label: 'Accent (Orange)', value: 'accent' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      headline: 'Ready to Start Your Project?',
      subtext:
        'Get a detailed, no-obligation quote within 48 hours. Our estimators will assess your site and deliver a comprehensive scope of work.',
      ctaLabel: 'Request a Free Quote',
      ctaHref: '#contact',
      secondaryCtaLabel: '',
      secondaryCtaHref: '',
      phoneNumber: '+91-98765-43210',
      phoneLabel: 'Or call us directly',
      background: 'dark',
    },
    render: ({
      eyebrow,
      headline,
      subtext,
      ctaLabel,
      ctaHref,
      secondaryCtaLabel,
      secondaryCtaHref,
      phoneNumber,
      phoneLabel,
      background,
    }) => {
      const bgCls =
        background === 'dark'
          ? 'bg-slate-900 text-white'
          : background === 'accent'
            ? 'bg-orange-500 text-white'
            : 'bg-slate-100 text-slate-900'
      const btnCls =
        background === 'muted'
          ? 'bg-orange-500 text-white hover:bg-orange-600'
          : 'bg-white text-slate-900 hover:bg-slate-100'
      return (
        <section className={`${bgCls} py-16`}>
          <div className="mx-auto max-w-3xl px-4 md:px-8 text-center">
            {eyebrow && (
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] opacity-70">
                {eyebrow}
              </p>
            )}
            {headline && <h2 className="text-2xl md:text-4xl font-bold mb-4">{headline}</h2>}
            {subtext && (
              <p
                className={`mb-8 text-base md:text-lg ${background === 'muted' ? 'text-slate-600' : 'opacity-90'}`}
              >
                {subtext}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {ctaLabel && (
                <a
                  href={ctaHref}
                  className={`inline-flex rounded-lg px-8 py-3.5 font-semibold transition ${btnCls}`}
                >
                  {ctaLabel}
                </a>
              )}
              {secondaryCtaLabel && (
                <a
                  href={secondaryCtaHref || '#'}
                  className="inline-flex rounded-lg border border-current px-8 py-3.5 font-semibold transition hover:bg-white/10"
                >
                  {secondaryCtaLabel}
                </a>
              )}
              {phoneNumber && (
                <div
                  className={`text-sm ${background === 'muted' ? 'text-slate-600' : 'opacity-80'}`}
                >
                  <span className="block text-xs mb-0.5">{phoneLabel}</span>
                  <a
                    href={`tel:${phoneNumber}`}
                    className="font-semibold text-base hover:underline"
                  >
                    {phoneNumber}
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      )
    },
  },

  // Thin single-row urgency banner CTA
  ConstructionUrgencyBanner: {
    label: 'Urgency Banner',
    fields: {
      headline: { type: 'text' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      phoneNumber: { type: 'text' },
      phoneLabel: { type: 'text' },
      background: {
        type: 'select',
        options: [
          { label: 'Accent (Orange)', value: 'accent' },
          { label: 'Dark', value: 'dark' },
        ],
      },
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
      headline: 'Only 3 install slots left this month — book your site survey today',
      ctaLabel: 'Book a Survey',
      ctaHref: '#quote',
      phoneNumber: '+91-98765-43210',
      phoneLabel: 'Call now',
      background: 'accent',
      padding: 'sm',
    },
    render: ({ headline, ctaLabel, ctaHref, phoneNumber, phoneLabel, background, padding }) => {
      const bgCls = background === 'dark' ? 'bg-slate-900 text-white' : 'bg-orange-500 text-white'
      const btnCls =
        background === 'dark'
          ? 'bg-orange-500 text-white hover:bg-orange-600'
          : 'bg-white text-slate-900 hover:bg-slate-100'
      return (
        <section className={`${bgCls} ${padY[padding]}`}>
          <div className={wrap}>
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
              {headline && (
                <p className="text-base md:text-lg font-bold text-center sm:text-left">
                  {headline}
                </p>
              )}
              <div className="flex items-center gap-4 shrink-0">
                {ctaLabel && (
                  <a
                    href={ctaHref}
                    className={`inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold transition whitespace-nowrap ${btnCls}`}
                  >
                    {ctaLabel}
                  </a>
                )}
                {phoneNumber && (
                  <a
                    href={`tel:${phoneNumber}`}
                    className="text-sm font-semibold hover:underline whitespace-nowrap"
                  >
                    {phoneLabel ? `${phoneLabel}: ` : ''}
                    {phoneNumber}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

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
      image:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900&h=650&fit=crop&auto=format',
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
    render: function ConstructionFeaturedProjectRender({
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
    }) {
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
                <img
                  src={image}
                  alt={sectionTitle}
                  className="rounded-2xl w-full h-80 object-cover"
                />
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
                    <a
                      href={linkHref}
                      className="text-orange-600 font-semibold text-sm hover:underline"
                    >
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

  // Static 3-project grid — image, category tag, one stat per card
  ConstructionProjectsGridCards: {
    label: 'Projects Grid',
    fields: {
      heading: { type: 'text' },
      project1Image: imageField('Image'),
      project1Title: { type: 'text' },
      project1Category: { type: 'text' },
      project1Stat: { type: 'text' },
      project2Image: imageField('Image'),
      project2Title: { type: 'text' },
      project2Category: { type: 'text' },
      project2Stat: { type: 'text' },
      project3Image: imageField('Image'),
      project3Title: { type: 'text' },
      project3Category: { type: 'text' },
      project3Stat: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      heading: 'Selected Projects',
      project1Image:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=480&h=360&fit=crop&auto=format',
      project1Title: 'Riverside Villas',
      project1Category: 'Residential',
      project1Stat: '48 units · 2024',
      project2Image:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=480&h=360&fit=crop&auto=format',
      project2Title: 'Coastal Business Park',
      project2Category: 'Commercial',
      project2Stat: '6.5 lakh sq ft',
      project3Image:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=480&h=360&fit=crop&auto=format',
      project3Title: 'Greenfield Logistics Hub',
      project3Category: 'Industrial',
      project3Stat: '8.2 lakh sq ft',
      padding: 'md',
      background: 'white',
    },
    render: ({
      heading,
      project1Image,
      project1Title,
      project1Category,
      project1Stat,
      project2Image,
      project2Title,
      project2Category,
      project2Stat,
      project3Image,
      project3Title,
      project3Category,
      project3Stat,
      padding,
      background,
    }) => {
      const projects = [
        {
          image: project1Image,
          title: project1Title,
          category: project1Category,
          stat: project1Stat,
        },
        {
          image: project2Image,
          title: project2Title,
          category: project2Category,
          stat: project2Stat,
        },
        {
          image: project3Image,
          title: project3Title,
          category: project3Category,
          stat: project3Stat,
        },
      ].filter((p) => p.title)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {heading}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {projects.map((p, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={p.title} className="w-full aspect-[4/3] object-cover" />
                  <div className="p-5">
                    <span className="inline-block rounded-full bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1 mb-3">
                      {p.category}
                    </span>
                    <p className="font-semibold text-slate-900">{p.title}</p>
                    <p className="text-sm text-slate-500 mt-1">{p.stat}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // One large featured project — image split, description, 2 stats
  ConstructionProjectShowcaseSplit: {
    label: 'Project Showcase Split',
    fields: {
      image: imageField('Image'),
      title: { type: 'text' },
      description: { type: 'textarea' },
      stat1Value: { type: 'text' },
      stat1Label: { type: 'text' },
      stat2Value: { type: 'text' },
      stat2Label: { type: 'text' },
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
      image:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=960&h=720&fit=crop&auto=format',
      title: 'Meridian Corporate Towers',
      description:
        'A 12-lakh sq ft twin-tower commercial complex in Vijayawada, delivered end-to-end — structural design, MEP, and interiors — under a single Subhadra Group contract.',
      stat1Value: '12 Lakh sq ft',
      stat1Label: 'Built-up Area',
      stat2Value: '22 Months',
      stat2Label: 'Design to Handover',
      padding: 'md',
      background: 'white',
    },
    render: ({
      image,
      title,
      description,
      stat1Value,
      stat1Label,
      stat2Value,
      stat2Label,
      padding,
      background,
    }) => {
      const stats = [
        { value: stat1Value, label: stat1Label },
        { value: stat2Value, label: stat2Label },
      ].filter((s) => s.value)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={`${wrap} grid grid-cols-1 md:grid-cols-2 gap-10 items-center`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={title}
              className="rounded-2xl w-full aspect-[4/3] object-cover shadow-lg"
            />
            <div>
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">{title}</h2>
              {description && <p className="text-slate-600 leading-relaxed mb-8">{description}</p>}
              <div className="grid grid-cols-2 gap-6">
                {stats.map((s, i) => (
                  <div key={i}>
                    <p className="text-2xl md:text-3xl font-bold text-orange-600">{s.value}</p>
                    <p className="text-xs md:text-sm text-slate-600 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Horizontal strip of project-location pins — thumbnail + city tag
  ConstructionProjectMapStrip: {
    label: 'Project Locations Strip',
    fields: {
      heading: { type: 'text' },
      location1Thumbnail: imageField('Thumbnail'),
      location1City: { type: 'text' },
      location2Thumbnail: imageField('Thumbnail'),
      location2City: { type: 'text' },
      location3Thumbnail: imageField('Thumbnail'),
      location3City: { type: 'text' },
      location4Thumbnail: imageField('Thumbnail'),
      location4City: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      heading: 'Where We Build',
      location1Thumbnail:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&h=200&fit=crop&auto=format',
      location1City: 'Vijayawada',
      location2Thumbnail:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&h=200&fit=crop&auto=format',
      location2City: 'Visakhapatnam',
      location3Thumbnail:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=200&fit=crop&auto=format',
      location3City: 'Guntur',
      location4Thumbnail:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&h=200&fit=crop&auto=format',
      location4City: 'Tirupati',
      padding: 'md',
      background: 'white',
    },
    render: ({
      heading,
      location1Thumbnail,
      location1City,
      location2Thumbnail,
      location2City,
      location3Thumbnail,
      location3City,
      location4Thumbnail,
      location4City,
      padding,
      background,
    }) => {
      const locations = [
        { thumbnail: location1Thumbnail, city: location1City },
        { thumbnail: location2Thumbnail, city: location2City },
        { thumbnail: location3Thumbnail, city: location3City },
        { thumbnail: location4Thumbnail, city: location4City },
      ].filter((l) => l.city)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            {heading && (
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
                {heading}
              </h2>
            )}
            <div className="flex flex-wrap justify-center gap-6">
              {locations.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-full border border-slate-200 pl-1.5 pr-5 py-1.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={l.thumbnail}
                    alt={l.city}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <span className="font-semibold text-slate-900 text-sm">{l.city}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Products showcase — tab filtered
  ConstructionProductsShowcase: {
    label: 'Products Showcase (Tabbed)',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      category1Label: { type: 'text' },
      category2Label: { type: 'text' },
      category3Label: { type: 'text' },
      category4Label: { type: 'text' },
      items: {
        type: 'array',
        min: 0,
        max: 40,
        getItemSummary: (item, index) => item.title || `Product ${(index ?? 0) + 1}`,
        defaultItemProps: {
          category: '',
          icon: 'hardhat',
          image: '',
          title: '',
          description: '',
          brands: '',
          href: '',
          linkLabel: '',
        },
        arrayFields: {
          category: { type: 'text' },
          icon: {
            type: 'select',
            options: [
              { label: 'Hard Hat', value: 'hardhat' },
              { label: 'Shield', value: 'shield' },
              { label: 'Star', value: 'star' },
            ],
          },
          image: imageField('Image'),
          title: { type: 'text' },
          description: { type: 'textarea' },
          brands: { type: 'text' },
          // Optional link under the card (e.g. "View details →" to its page).
          href: { type: 'text' },
          linkLabel: { type: 'text' },
        },
      },
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
      sectionEyebrow: 'In our showroom',
      sectionTitle: 'Everything for your building, in stock',
      sectionSubtitle:
        'We deal only in world-class brands that are pioneers in their fields — Schneider Electric, Blue Star, Polycab, RR Kabel, Crompton, Cummins and more.',
      category1Label: 'Electrical',
      category2Label: 'Climate & refrigeration',
      category3Label: 'Safety & systems',
      category4Label: 'Automation',
      items: [
        {
          category: 'Electrical',
          icon: 'hardhat',
          image:
            'https://images.unsplash.com/photo-1623707430101-9e74cefe05e2?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Switches & wiring devices',
          description: 'Livia, Zencelo, Unica Pure, Clipsal X, Avatar On, Cube Series.',
          brands: 'Schneider Electric · Norisys',
        },
        {
          category: 'Electrical',
          icon: 'shield',
          image:
            'https://images.unsplash.com/photo-1753272691001-4d68806ac590?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'MCB, DB & switchgear',
          description: 'Distribution boards, MCB/MCCB, ACB and panel boards.',
          brands: 'Schneider Electric',
        },
        {
          category: 'Climate & refrigeration',
          icon: 'star',
          image:
            'https://images.unsplash.com/photo-1718203862467-c33159fdc504?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Central & VRF AC',
          description:
            'Centralized AC, chillers, VRF and cassette units for offices, hotels and retail.',
          brands: 'Blue Star',
        },
        {
          category: 'Climate & refrigeration',
          icon: 'hardhat',
          image:
            'https://images.unsplash.com/photo-1564998115952-368e7d4969ea?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Refrigeration',
          description: 'Visi coolers, deep freezers, water coolers and ice-cube machines.',
          brands: 'Blue Star',
        },
        {
          category: 'Safety & systems',
          icon: 'shield',
          image:
            'https://images.unsplash.com/photo-1643123182527-3bd30840e7ed?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'CCTV',
          description: 'Dome, bullet, PTZ, number-plate and face-recognition cameras.',
          brands: 'CP Plus · Honeywell · Matrix',
        },
        {
          category: 'Safety & systems',
          icon: 'star',
          image:
            'https://images.unsplash.com/photo-1508817172652-4be4be2795cb?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Fire alarm & fighting',
          description: 'Panels, detectors, sprinklers, booster pumps and extinguishers.',
          brands: 'Honeywell · Minimax · Tyco',
        },
        {
          category: 'Automation',
          icon: 'hardhat',
          image: '/seed/subhadra/products/home-automation.jpg',
          title: 'Home automation',
          description: 'Retrofit and centralized control of lighting, curtains and AC.',
          brands: 'Schneider · Toyama · Bticino',
        },
        {
          category: 'Automation',
          icon: 'shield',
          image:
            'https://images.unsplash.com/photo-1773867567872-3ad1fa481082?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Home theater',
          description: 'Dolby Atmos rooms, 4K projection, acoustic design and multiroom audio.',
          brands: 'Focal · Sony · Denon',
        },
        {
          category: 'Electrical',
          icon: 'star',
          image:
            'https://images.unsplash.com/photo-1775714351784-51e93e4c12a7?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Cables & wires',
          description: 'Flexible LT/HT cables and FR/FR-LSH/LSOH house wiring, all sizes.',
          brands: 'Polycab · RR Kabel',
        },
        {
          category: 'Electrical',
          icon: 'hardhat',
          image:
            'https://images.unsplash.com/photo-1780445392484-38a4852a1fd8?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Generators & UPS',
          description: '15 KVA to 3750 KVA silent diesel generators, online UPS from 1 KVA.',
          brands: 'Cummins · APC',
        },
        {
          category: 'Electrical',
          icon: 'shield',
          image:
            'https://images.unsplash.com/photo-1758448755856-01d3add0177b?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Lights',
          description: 'COB spots, panels, street and flood lighting.',
          brands: 'Wipro · Crompton · Halonix',
        },
        {
          category: 'Electrical',
          icon: 'star',
          image:
            'https://images.unsplash.com/photo-1698653223542-3319103c425b?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Fans & ventilation',
          description: 'Designer ceiling fans, ventilation and fresh-air fans.',
          brands: 'Crompton · WadBros',
        },
        {
          category: 'Safety & systems',
          icon: 'hardhat',
          image:
            'https://images.unsplash.com/photo-1585079374502-415f8516dcc3?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Access control',
          description: 'Biometric & proximity access, attendance systems.',
          brands: 'Matrix',
        },
        {
          category: 'Safety & systems',
          icon: 'shield',
          image:
            'https://images.unsplash.com/photo-1630965764686-159c575031b3?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'PA system',
          description: 'Public address for showrooms, malls, hotels, hospitals and industries.',
          brands: 'Ahuja · Honeywell · Bosch',
        },
        {
          category: 'Automation',
          icon: 'star',
          image:
            'https://images.unsplash.com/photo-1682559736721-c2e77ff4c650?w=700&h=525&fit=crop&q=75&auto=format',
          title: 'Networking solutions',
          description:
            'Structured cabling, switches and enterprise Wi-Fi for offices and campuses.',
          brands: 'Matrix',
        },
      ],
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionProductsShowcaseRender({
      id,
      puck,
      sectionEyebrow,
      sectionTitle,
      sectionSubtitle,
      category1Label,
      category2Label,
      category3Label,
      category4Label,
      items,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const categories = [category1Label, category2Label, category3Label, category4Label].filter(
        Boolean
      )
      const products = (items ?? []).map((p, n) => ({ ...p, n })).filter((p) => p.title)
      const [activeTab, setActiveTab] = useState(categories[0] ?? '')
      const visible = products.filter((p) => p.category === activeTab)
      const isEditing = puck?.isEditing ?? false
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-8">
              {(isEditing || sectionEyebrow) && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  <InlineEditableText
                    id={id}
                    path={['sectionEyebrow']}
                    value={sectionEyebrow ?? ''}
                    isEditing={isEditing}
                  />
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">
                <InlineEditableText
                  id={id}
                  path={['sectionTitle']}
                  value={sectionTitle ?? ''}
                  isEditing={isEditing}
                />
              </h2>
              {(isEditing || sectionSubtitle) && (
                <p className="text-slate-600 max-w-2xl mx-auto">
                  <InlineEditableText
                    id={id}
                    path={['sectionSubtitle']}
                    value={sectionSubtitle ?? ''}
                    isEditing={isEditing}
                    multiline
                  />
                </p>
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
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white hover:shadow-md transition"
                  >
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.title} className="h-40 w-full object-cover" />
                    )}
                    <div className="p-5">
                      {!p.image && (
                        <div className="text-orange-500 mb-3">
                          <Icon />
                        </div>
                      )}
                      <h3 className="font-semibold text-slate-900 mb-1">
                        <InlineEditableText
                          id={id}
                          path={['items', p.n, 'title']}
                          value={p.title ?? ''}
                          isEditing={isEditing}
                        />
                      </h3>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        <InlineEditableText
                          id={id}
                          path={['items', p.n, 'description']}
                          value={p.description ?? ''}
                          isEditing={isEditing}
                          multiline
                        />
                      </p>
                      {(isEditing || p.brands) && (
                        <p className="mt-2 text-xs font-medium text-orange-600">
                          <InlineEditableText
                            id={id}
                            path={['items', p.n, 'brands']}
                            value={p.brands ?? ''}
                            isEditing={isEditing}
                          />
                        </p>
                      )}
                      {p.href && p.linkLabel && (
                        <a
                          href={p.href}
                          className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
                        >
                          {p.linkLabel}
                        </a>
                      )}
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

  // 5. Stats / experience strip
  ConstructionStatsStrip: {
    label: 'Stats & Experience Strip',
    fields: {
      stat1Value: { type: 'text' },
      stat1Label: { type: 'text' },
      stat2Value: { type: 'text' },
      stat2Label: { type: 'text' },
      stat3Value: { type: 'text' },
      stat3Label: { type: 'text' },
      stat4Value: { type: 'text' },
      stat4Label: { type: 'text' },
      background: {
        type: 'select',
        options: [
          { label: 'Dark', value: 'dark' },
          { label: 'Accent (Orange)', value: 'accent' },
          { label: 'Muted', value: 'muted' },
        ],
      },
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
    },
    render: ({
      stat1Value,
      stat1Label,
      stat2Value,
      stat2Label,
      stat3Value,
      stat3Label,
      stat4Value,
      stat4Label,
      background,
      padding,
    }) => {
      const bgCls =
        background === 'dark'
          ? 'bg-slate-900 text-white'
          : background === 'accent'
            ? 'bg-orange-500 text-white'
            : 'bg-slate-100 text-slate-900'
      const stats = [
        { value: stat1Value, label: stat1Label },
        { value: stat2Value, label: stat2Label },
        { value: stat3Value, label: stat3Label },
        { value: stat4Value, label: stat4Label },
      ].filter((s) => s.value)
      return (
        <section className={`${bgCls} ${padY[padding]}`}>
          <div className={`${wrap} grid grid-cols-2 md:grid-cols-4 gap-8 text-center`}>
            {stats.map((s, i) => (
              <div key={i}>
                <p
                  className={`text-3xl md:text-4xl font-extrabold mb-1 ${background === 'muted' ? 'text-orange-500' : 'text-orange-400'}`}
                >
                  {s.value}
                </p>
                <p
                  className={`text-sm font-medium ${background === 'muted' ? 'text-slate-600' : 'opacity-80'}`}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      )
    },
  },

  // 6. Team / crew
  ConstructionTeamCrew: {
    label: 'Team & Crew',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      member1Name: { type: 'text' },
      member1Role: { type: 'text' },
      member1Image: { type: 'text' },
      member2Name: { type: 'text' },
      member2Role: { type: 'text' },
      member2Image: { type: 'text' },
      member3Name: { type: 'text' },
      member3Role: { type: 'text' },
      member3Image: { type: 'text' },
      member4Name: { type: 'text' },
      member4Role: { type: 'text' },
      member4Image: { type: 'text' },
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
      sectionTitle: 'Meet Our Team',
      sectionSubtitle:
        'Experienced professionals committed to delivering quality on every project.',
      member1Name: 'Ramesh Kapoor',
      member1Role: 'Director & Project Head',
      member1Image:
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?w=400&h=400&fit=crop&auto=format',
      member2Name: 'Sunita Joshi',
      member2Role: 'Senior Site Engineer',
      member2Image:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=400&fit=crop&auto=format',
      member3Name: 'Arun Mehta',
      member3Role: 'Safety & Compliance Officer',
      member3Image:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&h=400&fit=crop&auto=format',
      member4Name: 'Priya Nair',
      member4Role: 'Estimation & Contracts',
      member4Image:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=400&fit=crop&auto=format',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      member1Name,
      member1Role,
      member1Image,
      member2Name,
      member2Role,
      member2Image,
      member3Name,
      member3Role,
      member3Image,
      member4Name,
      member4Role,
      member4Image,
      padding,
      background,
    }) => {
      const members = [
        { name: member1Name, role: member1Role, image: member1Image },
        { name: member2Name, role: member2Role, image: member2Image },
        { name: member3Name, role: member3Role, image: member3Image },
        { name: member4Name, role: member4Role, image: member4Image },
      ].filter((m) => m.name)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {members.map((m, i) => (
                <div key={i} className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.image}
                    alt={m.name}
                    className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border-4 border-orange-100"
                  />
                  <h3 className="font-semibold text-slate-900">{m.name}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{m.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 7. Certifications & safety badges
  ConstructionCertificationsBadges: {
    label: 'Certifications & Safety Badges',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      badge1Label: { type: 'text' },
      badge1Detail: { type: 'text' },
      badge2Label: { type: 'text' },
      badge2Detail: { type: 'text' },
      badge3Label: { type: 'text' },
      badge3Detail: { type: 'text' },
      badge4Label: { type: 'text' },
      badge4Detail: { type: 'text' },
      badge5Label: { type: 'text' },
      badge5Detail: { type: 'text' },
      badge6Label: { type: 'text' },
      badge6Detail: { type: 'text' },
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
      sectionTitle: 'Certified & Compliant',
      sectionSubtitle:
        'Our credentials reflect our commitment to quality, safety, and professionalism.',
      badge1Label: 'ISO 9001:2015',
      badge1Detail: 'Quality Management System',
      badge2Label: 'OHSAS 18001',
      badge2Detail: 'Occupational Health & Safety',
      badge3Label: 'ISO 14001',
      badge3Detail: 'Environmental Management',
      badge4Label: 'CPWD Empanelled',
      badge4Detail: 'Central Public Works Dept.',
      badge5Label: 'Class-A Contractor',
      badge5Detail: 'PWD Karnataka',
      badge6Label: 'NSIC Registered',
      badge6Detail: 'National Small Industries Corp.',
      padding: 'md',
      background: 'muted',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      badge1Label,
      badge1Detail,
      badge2Label,
      badge2Detail,
      badge3Label,
      badge3Detail,
      badge4Label,
      badge4Detail,
      badge5Label,
      badge5Detail,
      badge6Label,
      badge6Detail,
      padding,
      background,
    }) => {
      const badges = [
        { label: badge1Label, detail: badge1Detail },
        { label: badge2Label, detail: badge2Detail },
        { label: badge3Label, detail: badge3Detail },
        { label: badge4Label, detail: badge4Detail },
        { label: badge5Label, detail: badge5Detail },
        { label: badge6Label, detail: badge6Detail },
      ].filter((b) => b.label)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {badges.map((b, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition"
                >
                  <div className="text-green-600 mb-3">
                    <CheckShieldIcon />
                  </div>
                  <p className="font-semibold text-slate-900 text-sm leading-tight">{b.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{b.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 8. Org chart — 2-tier leadership hierarchy
  ConstructionOrgChart: {
    label: 'Org Chart',
    fields: {
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
      heading: { type: 'text' },
      topName: { type: 'text' },
      topRole: { type: 'text' },
      topPhoto: imageField('Photo'),
      report1Name: { type: 'text' },
      report1Role: { type: 'text' },
      report1Photo: imageField('Photo'),
      report2Name: { type: 'text' },
      report2Role: { type: 'text' },
      report2Photo: imageField('Photo'),
      report3Name: { type: 'text' },
      report3Role: { type: 'text' },
      report3Photo: imageField('Photo'),
    },
    defaultProps: {
      padding: 'md',
      background: 'white',
      heading: 'Our Organization',
      topName: 'Ramesh Kumar',
      topRole: 'Managing Director',
      topPhoto:
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop&crop=faces&auto=format',
      report1Name: 'Priya Nair',
      report1Role: 'Head of Engineering',
      report1Photo:
        'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=300&h=300&fit=crop&crop=faces&auto=format',
      report2Name: 'Suresh Reddy',
      report2Role: 'Head of Operations',
      report2Photo:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop&crop=faces&auto=format',
      report3Name: 'Arun Mehta',
      report3Role: 'Head of Safety & Compliance',
      report3Photo:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=300&h=300&fit=crop&crop=faces&auto=format',
    },
    render: ({
      padding,
      background,
      heading,
      topName,
      topRole,
      topPhoto,
      report1Name,
      report1Role,
      report1Photo,
      report2Name,
      report2Role,
      report2Photo,
      report3Name,
      report3Role,
      report3Photo,
    }) => {
      const reports = [
        { name: report1Name, role: report1Role, photo: report1Photo },
        { name: report2Name, role: report2Role, photo: report2Photo },
        { name: report3Name, role: report3Role, photo: report3Photo },
      ].filter((r) => r.name)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {heading}
            </h2>
            <div className="flex justify-center">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={topPhoto} alt={topName} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{topName}</p>
                  <p className="text-xs text-orange-600">{topRole}</p>
                </div>
              </div>
            </div>
            <div className="w-px h-4 bg-slate-300 mx-auto" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {reports.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.photo} alt={r.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 9. Team stats — stat row + highlighted crew cards
  ConstructionTeamStats: {
    label: 'Team Stats',
    fields: {
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
      stat1Value: { type: 'text' },
      stat1Label: { type: 'text' },
      stat2Value: { type: 'text' },
      stat2Label: { type: 'text' },
      stat3Value: { type: 'text' },
      stat3Label: { type: 'text' },
      crew1Photo: imageField('Photo'),
      crew1Name: { type: 'text' },
      crew1YearsWithUs: { type: 'text' },
      crew2Photo: imageField('Photo'),
      crew2Name: { type: 'text' },
      crew2YearsWithUs: { type: 'text' },
      crew3Photo: imageField('Photo'),
      crew3Name: { type: 'text' },
      crew3YearsWithUs: { type: 'text' },
    },
    defaultProps: {
      padding: 'md',
      background: 'muted',
      stat1Value: '45+',
      stat1Label: 'Team Members',
      stat2Value: '300+',
      stat2Label: 'Combined Years of Experience',
      stat3Value: '12',
      stat3Label: 'Certifications Held',
      crew1Photo:
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?w=400&h=400&fit=crop&auto=format',
      crew1Name: 'Ramesh Kapoor',
      crew1YearsWithUs: '14 years with us',
      crew2Photo:
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=400&fit=crop&auto=format',
      crew2Name: 'Sunita Joshi',
      crew2YearsWithUs: '9 years with us',
      crew3Photo:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&h=400&fit=crop&auto=format',
      crew3Name: 'Arun Mehta',
      crew3YearsWithUs: '7 years with us',
    },
    render: ({
      padding,
      background,
      stat1Value,
      stat1Label,
      stat2Value,
      stat2Label,
      stat3Value,
      stat3Label,
      crew1Photo,
      crew1Name,
      crew1YearsWithUs,
      crew2Photo,
      crew2Name,
      crew2YearsWithUs,
      crew3Photo,
      crew3Name,
      crew3YearsWithUs,
    }) => {
      const stats = [
        { value: stat1Value, label: stat1Label },
        { value: stat2Value, label: stat2Label },
        { value: stat3Value, label: stat3Label },
      ].filter((s) => s.value)
      const crew = [
        { photo: crew1Photo, name: crew1Name, years: crew1YearsWithUs },
        { photo: crew2Photo, name: crew2Name, years: crew2YearsWithUs },
        { photo: crew3Photo, name: crew3Name, years: crew3YearsWithUs },
      ].filter((c) => c.name)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="grid grid-cols-3 gap-4 mb-12">
              {stats.map((s, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl md:text-4xl font-bold text-orange-600">{s.value}</p>
                  <p className="text-xs md:text-sm text-slate-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {crew.map((c, i) => (
                <div
                  key={i}
                  className="text-center rounded-xl border border-slate-200 bg-white p-6"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.photo}
                    alt={c.name}
                    className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-orange-100"
                  />
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{c.years}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Clients — paginated logo grid
  ConstructionClientsGrid: {
    label: 'Clients (Paginated Grid)',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      items: {
        type: 'array',
        min: 0,
        max: 60,
        getItemSummary: (item, index) => item.name || `Client ${(index ?? 0) + 1}`,
        defaultItemProps: { logo: '', name: '' },
        arrayFields: {
          logo: imageField('Logo'),
          name: { type: 'text' },
        },
      },
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
      sectionEyebrow: 'Our Clients',
      sectionTitle: 'Trusted by businesses & institutions',
      sectionSubtitle:
        'From retail malls to hospitality and healthcare — brands across Andhra Pradesh trust us to keep their buildings running.',
      items: [
        { logo: '/seed/subhadra/clients/client-01.png', name: 'Marriott' },
        { logo: '/seed/subhadra/clients/client-02.png', name: 'Novotel Hotels' },
        { logo: '/seed/subhadra/clients/client-03.png', name: 'Best Western' },
        {
          logo: '/seed/subhadra/clients/client-04.png',
          name: "Fortune \u2014 Member ITC's Hotel Group",
        },
        { logo: '/seed/subhadra/clients/client-05.png', name: 'Radisson Blu' },
        { logo: '/seed/subhadra/clients/client-06.png', name: 'ABC Hospitals' },
        { logo: '/seed/subhadra/clients/client-07.png', name: 'Medicover' },
        { logo: '/seed/subhadra/clients/client-08.png', name: 'Apollo Hospitals' },
        { logo: '/seed/subhadra/clients/client-09.png', name: 'Lotus Multispeciality Hospital' },
        { logo: '/seed/subhadra/clients/client-10.png', name: 'Ikya Hospital' },
        { logo: '/seed/subhadra/clients/client-11.png', name: 'Vaibhav Jewellers' },
        { logo: '/seed/subhadra/clients/client-12.png', name: 'Lifestyle' },
        { logo: '/seed/subhadra/clients/client-13.png', name: 'Kankatala' },
        { logo: '/seed/subhadra/clients/client-14.png', name: 'South India Shopping Mall' },
        { logo: '/seed/subhadra/clients/client-15.png', name: 'KLM Fashion Mall' },
        { logo: '/seed/subhadra/clients/client-16.png', name: 'Lucky Shopping Mall' },
        { logo: '/seed/subhadra/clients/client-17.png', name: 'Kalamandir' },
        { logo: '/seed/subhadra/clients/client-18.png', name: 'SR Shopping Mall' },
        { logo: '/seed/subhadra/clients/client-19.png', name: 'Bothra Group' },
        { logo: '/seed/subhadra/clients/client-20.png', name: 'Visakha Dairy' },
        { logo: '/seed/subhadra/clients/client-21.png', name: 'Varun Group' },
        { logo: '/seed/subhadra/clients/client-22.png', name: 'Lakshmi Group' },
        { logo: '/seed/subhadra/clients/client-23.png', name: 'PVR' },
        { logo: '/seed/subhadra/clients/client-24.png', name: 'Cin\u00e9polis' },
        { logo: '/seed/subhadra/clients/client-25.png', name: 'Vizag Steel (RINL)' },
        { logo: '/seed/subhadra/clients/client-26.png', name: 'ANITS' },
        { logo: '/seed/subhadra/clients/client-27.png', name: 'GITAM' },
        { logo: '/seed/subhadra/clients/client-28.png', name: 'Vizag Conventions' },
        { logo: '/seed/subhadra/clients/client-29.png', name: "Chenna's The Convention" },
        { logo: '/seed/subhadra/clients/client-30.png', name: 'A1 Grand \u2014 The Convention' },
        { logo: '/seed/subhadra/clients/client-31.png', name: 'Laurus Labs' },
        { logo: '/seed/subhadra/clients/client-32.png', name: 'Asian Paints' },
        { logo: '/seed/subhadra/clients/client-33.png', name: 'Yokohama' },
        { logo: '/seed/subhadra/clients/client-34.png', name: 'NCL Group' },
        { logo: '/seed/subhadra/clients/client-35.png', name: 'GVMC' },
        { logo: '/seed/subhadra/clients/client-36.png', name: 'Visakhapatnam Port Authority' },
        { logo: '/seed/subhadra/clients/client-37.png', name: 'Lansum Properties LLP' },
        { logo: '/seed/subhadra/clients/client-38.png', name: 'MK Builders & Developers' },
        { logo: '/seed/subhadra/clients/client-39.png', name: 'FAME Realty' },
      ],
      padding: 'md',
      background: 'muted',
    },
    render: function ConstructionClientsGridRender({
      id,
      puck,
      sectionEyebrow,
      sectionTitle,
      sectionSubtitle,
      items,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const clients = (items ?? []).filter((c) => c.logo)
      const isEditing = puck?.isEditing ?? false
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              {(isEditing || sectionEyebrow) && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  <InlineEditableText
                    id={id}
                    path={['sectionEyebrow']}
                    value={sectionEyebrow ?? ''}
                    isEditing={isEditing}
                  />
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">
                <InlineEditableText
                  id={id}
                  path={['sectionTitle']}
                  value={sectionTitle ?? ''}
                  isEditing={isEditing}
                />
              </h2>
              {(isEditing || sectionSubtitle) && (
                <p className="text-slate-600 max-w-2xl mx-auto">
                  <InlineEditableText
                    id={id}
                    path={['sectionSubtitle']}
                    value={sectionSubtitle ?? ''}
                    isEditing={isEditing}
                    multiline
                  />
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {clients.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 h-24"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.logo} alt={c.name} className="max-h-10 max-w-full object-contain" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Clients — client-logo + one-line-quote pairs (bridges Clients and
  // Testimonials themes, but stays registered under 'clients').
  ConstructionClientsTestimonialStrip: {
    label: 'Clients Testimonial Strip',
    fields: {
      sectionTitle: { type: 'text' },
      client1Logo: imageField('Client 1 Logo'),
      client1Quote: { type: 'textarea' },
      client2Logo: imageField('Client 2 Logo'),
      client2Quote: { type: 'textarea' },
      client3Logo: imageField('Client 3 Logo'),
      client3Quote: { type: 'textarea' },
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
      sectionTitle: 'Clients Who Trust Subhadra Group',
      client1Logo: dummyLogo(140, 70, 'Client 1'),
      client1Quote: 'Subhadra Group turned our HVAC overhaul around three weeks ahead of schedule.',
      client2Logo: dummyLogo(140, 70, 'Client 2'),
      client2Quote:
        'Zero safety incidents across an 18-month build — their site discipline is unmatched.',
      client3Logo: dummyLogo(140, 70, 'Client 3'),
      client3Quote:
        'One team owned design, supply and install for our entire fit-out. No coordination headaches.',
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionClientsTestimonialStripRender({
      sectionTitle,
      client1Logo,
      client1Quote,
      client2Logo,
      client2Quote,
      client3Logo,
      client3Quote,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const clients = [
        { logo: client1Logo, quote: client1Quote },
        { logo: client2Logo, quote: client2Quote },
        { logo: client3Logo, quote: client3Quote },
      ].filter((c) => c.quote)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            {sectionTitle && (
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
                {sectionTitle}
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {clients.map((c, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col gap-4"
                >
                  {c.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo} alt="" className="h-8 max-w-[140px] object-contain" />
                  )}
                  <p className="text-slate-700 text-sm leading-relaxed">&#8220;{c.quote}&#8221;</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Clients — longer static logo row (6 logos), no scroll JS — matches this
  // file's static-slider-render convention.
  ConstructionClientsMarquee: {
    label: 'Clients Marquee',
    fields: {
      sectionTitle: { type: 'text' },
      logo1: imageField('Logo 1'),
      logo2: imageField('Logo 2'),
      logo3: imageField('Logo 3'),
      logo4: imageField('Logo 4'),
      logo5: imageField('Logo 5'),
      logo6: imageField('Logo 6'),
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
      sectionTitle: 'Trusted by Businesses Across Andhra Pradesh',
      logo1: dummyLogo(140, 70, 'Client 1'),
      logo2: dummyLogo(140, 70, 'Client 2'),
      logo3: dummyLogo(140, 70, 'Client 3'),
      logo4: dummyLogo(140, 70, 'Client 4'),
      logo5: dummyLogo(140, 70, 'Client 5'),
      logo6: dummyLogo(140, 70, 'Client 6'),
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionClientsMarqueeRender({
      sectionTitle,
      logo1,
      logo2,
      logo3,
      logo4,
      logo5,
      logo6,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const logos = [logo1, logo2, logo3, logo4, logo5, logo6].filter(Boolean)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            {sectionTitle && (
              <h2 className="text-center text-2xl md:text-3xl font-bold text-slate-900 mb-10">
                {sectionTitle}
              </h2>
            )}
            <div className="flex flex-wrap justify-center gap-8">
              {logos.map((logo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={logo} alt="" className="h-10 max-w-[140px] object-contain" />
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Clients — one client spotlight (logo + result stat + quote) plus a
  // smaller row of other client logos below (mirrors ConstructionBrandsSpotlight).
  ConstructionClientsCaseHighlight: {
    label: 'Clients Case Highlight',
    fields: {
      spotlightLogo: imageField('Spotlight Logo'),
      spotlightStat: { type: 'text' },
      spotlightQuote: { type: 'textarea' },
      otherLogo1: imageField('Other Logo 1'),
      otherLogo2: imageField('Other Logo 2'),
      otherLogo3: imageField('Other Logo 3'),
      otherLogo4: imageField('Other Logo 4'),
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
      spotlightLogo: dummyLogo(240, 120, 'Reddy Builders'),
      spotlightStat: '40% faster handover',
      spotlightQuote:
        'Subhadra Group delivered our 12-unit residential complex three weeks ahead of schedule, without a single quality defect.',
      otherLogo1: dummyLogo(140, 70, 'Client 1'),
      otherLogo2: dummyLogo(140, 70, 'Client 2'),
      otherLogo3: dummyLogo(140, 70, 'Client 3'),
      otherLogo4: dummyLogo(140, 70, 'Client 4'),
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionClientsCaseHighlightRender({
      spotlightLogo,
      spotlightStat,
      spotlightQuote,
      otherLogo1,
      otherLogo2,
      otherLogo3,
      otherLogo4,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const otherLogos = [otherLogo1, otherLogo2, otherLogo3, otherLogo4].filter(Boolean)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={`${wrap} text-center`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-6">
              Client Spotlight
            </p>
            {spotlightLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={spotlightLogo}
                alt=""
                className="mx-auto h-16 md:h-20 max-w-[280px] object-contain mb-6"
              />
            )}
            {spotlightStat && (
              <p className="text-3xl md:text-4xl font-bold text-orange-600 mb-4">{spotlightStat}</p>
            )}
            {spotlightQuote && (
              <p className="max-w-2xl mx-auto text-slate-600 leading-relaxed mb-10">
                &#8220;{spotlightQuote}&#8221;
              </p>
            )}
            {otherLogos.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-8 pt-8 border-t border-slate-100">
                {otherLogos.map((logo, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={logo}
                    alt=""
                    className="h-8 max-w-[110px] object-contain opacity-80"
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )
    },
  },

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
        {
          text: quote1Text,
          author: quote1Author,
          company: quote1Company,
          initials: quote1Initials,
        },
        {
          text: quote2Text,
          author: quote2Author,
          company: quote2Company,
          initials: quote2Initials,
        },
        {
          text: quote3Text,
          author: quote3Author,
          company: quote3Company,
          initials: quote3Initials,
        },
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

  ConstructionTestimonialsCarousel: {
    label: 'Testimonials Carousel',
    fields: {
      sectionTitle: { type: 'text' },
      slides: {
        type: 'array',
        min: 0,
        max: 8,
        getItemSummary: (item) => item.name || 'New testimonial',
        defaultItemProps: {
          photo: '',
          quote: '',
          name: 'New testimonial',
          role: '',
        },
        arrayFields: {
          photo: imageField('Photo'),
          quote: { type: 'textarea' },
          name: { type: 'text' },
          role: { type: 'text' },
        },
      },
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
      sectionTitle: 'In Their Own Words',
      slides: [
        {
          photo:
            'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=440&h=440&fit=crop&crop=faces&q=80&auto=format',
          quote:
            'Subhadra Group ran our entire HVAC and electrical fit-out as one coordinated scope — no chasing three contractors, no finger-pointing when something needed adjusting.',
          name: 'Venkat Reddy',
          role: 'Reddy Builders Pvt Ltd',
        },
        {
          photo:
            'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=440&h=440&fit=crop&crop=faces&q=80&auto=format',
          quote:
            'Zero lost-time incidents across an 18-month build. Their site team treated our compliance checklist like it was their own.',
          name: 'Anita Sharma',
          role: 'National Highways Authority (Vendor)',
        },
        {
          photo:
            'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=440&h=440&fit=crop&crop=faces&q=80&auto=format',
          quote:
            'Weekly reporting and transparent budgeting meant no surprises at handover. We knew exactly where every rupee went.',
          name: 'Mohan Das',
          role: 'Das Commercial Properties',
        },
        {
          photo:
            'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=440&h=440&fit=crop&crop=faces&q=80&auto=format',
          quote:
            'From design to supply to install, one team owned the whole showroom fit-out. The AMC support since handover has been excellent.',
          name: 'Priya Nair',
          role: 'Operations Lead, CMR Shopping Mall',
        },
      ],
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionTestimonialsCarouselRender({
      sectionTitle,
      slides: rawSlides,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const slides = (rawSlides ?? []).filter((s) => s.quote)
      const current = slides[0]
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            {current && (
              <div className="max-w-3xl mx-auto text-center">
                {current.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.photo}
                    alt={current.name}
                    className="w-24 h-24 rounded-full object-cover mx-auto mb-6"
                  />
                )}
                <p className="text-xl md:text-2xl font-medium text-slate-800 leading-relaxed mb-6">
                  &#8220;{current.quote}&#8221;
                </p>
                <p className="font-semibold text-slate-900">{current.name}</p>
                {current.role && <p className="text-sm text-slate-500">{current.role}</p>}
              </div>
            )}
            {slides.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 rounded-full ${
                      i === 0 ? 'w-6 bg-orange-500' : 'w-2.5 bg-slate-300'
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

  ConstructionVideoTestimonials: {
    label: 'Video Testimonials',
    fields: {
      sectionTitle: { type: 'text' },
      testimonial1Thumbnail: imageField('Thumbnail'),
      testimonial1Name: { type: 'text' },
      testimonial1Quote: { type: 'textarea' },
      testimonial2Thumbnail: imageField('Thumbnail'),
      testimonial2Name: { type: 'text' },
      testimonial2Quote: { type: 'textarea' },
      testimonial3Thumbnail: imageField('Thumbnail'),
      testimonial3Name: { type: 'text' },
      testimonial3Quote: { type: 'textarea' },
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
      sectionTitle: 'Hear It From Our Clients',
      testimonial1Thumbnail:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=640&h=360&fit=crop&auto=format',
      testimonial1Name: 'Operations Manager, Hospitality Group',
      testimonial1Quote:
        'One team handled our entire HVAC and electrical fit-out, start to finish, with no coordination headaches.',
      testimonial2Thumbnail:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=640&h=360&fit=crop&auto=format',
      testimonial2Name: 'Facilities Head, Healthcare Facility',
      testimonial2Quote:
        'Critical-area AC and fire safety were sized and installed to code without a single delay to our opening date.',
      testimonial3Thumbnail:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=640&h=360&fit=crop&auto=format',
      testimonial3Name: 'Retail Operations Lead, Shopping Mall',
      testimonial3Quote:
        'We compared three vendors for our showroom fit-out — Subhadra Group was the only one that could design, supply and install everything themselves.',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      testimonial1Thumbnail,
      testimonial1Name,
      testimonial1Quote,
      testimonial2Thumbnail,
      testimonial2Name,
      testimonial2Quote,
      testimonial3Thumbnail,
      testimonial3Name,
      testimonial3Quote,
      padding,
      background,
    }) => {
      const testimonials = [
        { thumbnail: testimonial1Thumbnail, name: testimonial1Name, quote: testimonial1Quote },
        { thumbnail: testimonial2Thumbnail, name: testimonial2Name, quote: testimonial2Quote },
        { thumbnail: testimonial3Thumbnail, name: testimonial3Name, quote: testimonial3Quote },
      ].filter((t) => t.thumbnail)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden border border-slate-200 bg-white"
                >
                  <div className="relative aspect-video bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.thumbnail}
                      alt=""
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-20 h-20 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                        <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
                          <path d="M0 0L26 15L0 30V0Z" fill="#ea580c" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-slate-700 text-sm leading-relaxed mb-3">
                      &#8220;{t.quote}&#8221;
                    </p>
                    <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 9. Process / timeline
  ConstructionProcessTimeline: {
    label: 'Process Timeline',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      step1Title: { type: 'text' },
      step1Description: { type: 'textarea' },
      step2Title: { type: 'text' },
      step2Description: { type: 'textarea' },
      step3Title: { type: 'text' },
      step3Description: { type: 'textarea' },
      step4Title: { type: 'text' },
      step4Description: { type: 'textarea' },
      step5Title: { type: 'text' },
      step5Description: { type: 'textarea' },
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
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      step1Title,
      step1Description,
      step2Title,
      step2Description,
      step3Title,
      step3Description,
      step4Title,
      step4Description,
      step5Title,
      step5Description,
      padding,
      background,
    }) => {
      const steps = [
        { title: step1Title, description: step1Description },
        { title: step2Title, description: step2Description },
        { title: step3Title, description: step3Description },
        { title: step4Title, description: step4Description },
        { title: step5Title, description: step5Description },
      ].filter((s) => s.title)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-orange-200 hidden md:block" />
              <div className="flex flex-col gap-8">
                {steps.map((s, i) => (
                  <div key={i} className="md:flex gap-6 items-start">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-orange-500 text-white font-bold text-lg shadow relative z-10">
                      {i + 1}
                    </div>
                    <div className="mt-3 md:mt-0">
                      <h3 className="font-semibold text-slate-900 text-lg mb-1">{s.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // 10. Why Choose Us
  ConstructionWhyChooseUs: {
    label: 'Why Choose Us',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      point1Title: { type: 'text' },
      point1Description: { type: 'textarea' },
      point2Title: { type: 'text' },
      point2Description: { type: 'textarea' },
      point3Title: { type: 'text' },
      point3Description: { type: 'textarea' },
      point4Title: { type: 'text' },
      point4Description: { type: 'textarea' },
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
      sectionTitle: 'Why Choose Us',
      sectionSubtitle:
        'We combine deep technical expertise with a relentless focus on timelines, budget, and safety.',
      point1Title: 'Fixed-Price Contracts',
      point1Description:
        'No surprises. We absorb cost overruns within scope — your budget stays intact.',
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
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      point1Title,
      point1Description,
      point2Title,
      point2Description,
      point3Title,
      point3Description,
      point4Title,
      point4Description,
      ctaLabel,
      ctaHref,
      padding,
      background,
    }) => {
      const points = [
        { title: point1Title, description: point1Description },
        { title: point2Title, description: point2Description },
        { title: point3Title, description: point3Description },
        { title: point4Title, description: point4Description },
      ].filter((p) => p.title)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="md:flex gap-12 items-start">
              <div className="md:w-1/3 mb-8 md:mb-0">
                <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">
                  {sectionTitle}
                </h2>
                {sectionSubtitle && (
                  <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6">
                    {sectionSubtitle}
                  </p>
                )}
                {ctaLabel && (
                  <a
                    href={ctaHref}
                    className="inline-flex rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                  >
                    {ctaLabel}
                  </a>
                )}
              </div>
              <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {points.map((p, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="text-orange-500 mb-3">
                      <CheckShieldIcon />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">{p.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // 11. Safety record
  ConstructionSafetyRecord: {
    label: 'Safety Record',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      incidentFreeDays: { type: 'text' },
      safetyRating: { type: 'text' },
      trainedWorkers: { type: 'text' },
      complianceNote: { type: 'textarea' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'Dark', value: 'dark' },
          { label: 'Accent (Orange)', value: 'accent' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Safety is Non-Negotiable',
      sectionSubtitle:
        'Our zero-harm culture is embedded in every phase of construction — from induction to handover.',
      incidentFreeDays: '1,460+',
      safetyRating: '5 / 5',
      trainedWorkers: '320+',
      complianceNote:
        'All workers undergo OSHA-aligned safety induction before site entry. PPE strictly enforced. Monthly third-party safety audits on all active sites.',
      padding: 'md',
      background: 'dark',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      incidentFreeDays,
      safetyRating,
      trainedWorkers,
      complianceNote,
      padding,
      background,
    }) => {
      const bgCls =
        background === 'dark'
          ? 'bg-slate-900 text-white'
          : background === 'accent'
            ? 'bg-orange-600 text-white'
            : 'bg-slate-100 text-slate-900'
      const labelCls = background === 'muted' ? 'text-slate-600' : 'opacity-75'
      const valueCls = background === 'muted' ? 'text-orange-500' : 'text-orange-400'
      const noteCls = background === 'muted' ? 'text-slate-600' : 'opacity-80'
      return (
        <section className={`${bgCls} ${padY[padding]}`}>
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className={`max-w-2xl mx-auto text-base ${labelCls}`}>{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mb-8">
              <div>
                <p className={`text-4xl font-extrabold mb-1 ${valueCls}`}>{incidentFreeDays}</p>
                <p className={`text-sm ${labelCls}`}>Incident-Free Days</p>
              </div>
              <div>
                <p className={`text-4xl font-extrabold mb-1 ${valueCls}`}>{safetyRating}</p>
                <p className={`text-sm ${labelCls}`}>Safety Rating (Client Audits)</p>
              </div>
              <div>
                <p className={`text-4xl font-extrabold mb-1 ${valueCls}`}>{trainedWorkers}</p>
                <p className={`text-sm ${labelCls}`}>Safety-Trained Workers</p>
              </div>
            </div>
            {complianceNote && (
              <p className={`text-center text-sm max-w-2xl mx-auto ${noteCls}`}>{complianceNote}</p>
            )}
          </div>
        </section>
      )
    },
  },

  // Milestone timeline — horizontal "our journey" strip
  ConstructionMilestoneTimeline: {
    label: 'Milestone Timeline',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      milestone1Year: { type: 'text' },
      milestone1Label: { type: 'text' },
      milestone2Year: { type: 'text' },
      milestone2Label: { type: 'text' },
      milestone3Year: { type: 'text' },
      milestone3Label: { type: 'text' },
      milestone4Year: { type: 'text' },
      milestone4Label: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      eyebrow: 'Our Journey',
      heading: 'Two Decades of Growth',
      milestone1Year: '1996',
      milestone1Label: 'Founded in Vijayawada',
      milestone2Year: '2008',
      milestone2Label: 'First commercial VRF installation',
      milestone3Year: '2015',
      milestone3Label: '500+ projects delivered',
      milestone4Year: '2024',
      milestone4Label: "Andhra Pradesh's trusted engineering partner",
      padding: 'md',
      background: 'white',
    },
    render: ({
      eyebrow,
      heading,
      milestone1Year,
      milestone1Label,
      milestone2Year,
      milestone2Label,
      milestone3Year,
      milestone3Label,
      milestone4Year,
      milestone4Label,
      padding,
      background,
    }) => {
      const milestones = [
        { year: milestone1Year, label: milestone1Label },
        { year: milestone2Year, label: milestone2Label },
        { year: milestone3Year, label: milestone3Label },
        { year: milestone4Year, label: milestone4Label },
      ].filter((m) => m.year || m.label)
      return (
        <section
          className={`${background === 'muted' ? 'bg-slate-50' : 'bg-white'} ${padY[padding]}`}
        >
          <div className={wrap}>
            <div className="text-center mb-12">
              {eyebrow && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{heading}</h2>
            </div>
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-y-10">
              <div className="hidden md:block absolute top-1.5 left-0 right-0 h-px bg-slate-200" />
              {milestones.map((m, i) => (
                <div key={i} className="relative flex flex-col items-center text-center px-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500 mb-4" />
                  <p className="text-lg font-bold text-slate-900">{m.year}</p>
                  <p className="text-sm text-slate-600 mt-1">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Lead form + FAQ
  ConstructionLeadFormFAQ: {
    label: 'Lead Form + FAQ',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      sectionIntroLinkLabel: { type: 'text' },
      sectionIntroLinkHref: { type: 'text' },
      faqs: {
        type: 'array',
        min: 0,
        max: 20,
        getItemSummary: (item, index) => item.question || `FAQ ${(index ?? 0) + 1}`,
        defaultItemProps: { question: '', answer: '' },
        arrayFields: {
          question: { type: 'text' },
          answer: { type: 'textarea' },
        },
      },
      introText: { type: 'textarea' },
      // 'module' (default): the project-wide FAQ module wins once it has
      // entries. 'block': always show this block's own FAQs (page-specific).
      faqSource: {
        type: 'radio',
        options: [
          { label: 'FAQ module', value: 'module' },
          { label: 'This block', value: 'block' },
        ],
      },
      showFaqs: {
        type: 'radio',
        options: [
          { label: 'Show FAQs', value: true },
          { label: 'Hide FAQs', value: false },
        ],
      },
      checklistItems: { type: 'textarea' },
      trustStats: {
        type: 'array',
        min: 0,
        max: 6,
        getItemSummary: (item) => item.label || 'Stat',
        defaultItemProps: { number: '', label: '' },
        arrayFields: {
          number: { type: 'text' },
          label: { type: 'text' },
        },
      },
      formHeading: { type: 'text' },
      formSubtext: { type: 'textarea' },
      interestOptions: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      formPrivacyNote: { type: 'text' },
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
      sectionEyebrow: 'FAQ',
      sectionTitle: 'Questions, answered',
      sectionIntroLinkLabel: 'Get in touch',
      sectionIntroLinkHref: '#quote',
      faqs: [
        {
          question: 'Do you only work in Visakhapatnam, or across Andhra Pradesh?',
          answer:
            "We're based in Visakhapatnam, but our engineering teams design, install and maintain systems for clients across Andhra Pradesh — including plants, hospitals and retail groups outside the city.",
        },
        {
          question: 'How fast can I get a quote?',
          answer:
            'Share your requirement through the quote form on this page or visit our showroom — our engineers typically respond with a sized solution and quote within 24 hours.',
        },
        {
          question: 'Do you only sell products, or also install and maintain them?',
          answer:
            'Both, always. Every product we stock is designed, supplied, installed and maintained by our own trained engineers — never subcontracted — with a dedicated service manager for ongoing support.',
        },
        {
          question: 'What brands do you deal in?',
          answer:
            'Only world-class, pioneer brands in each category — Schneider Electric, Blue Star, Polycab, RR Kabel, Crompton, Cummins, Honeywell and more — so spares and service are never a problem.',
        },
        {
          question: 'Can I see products in person before buying?',
          answer:
            'Yes — walk into our Visakhapatnam showroom to compare products on the shelf before you decide, or have our engineers visit your site directly for a free assessment.',
        },
        {
          question: 'What kind of after-sales support do you offer?',
          answer:
            '24×7 support with a dedicated service manager for every discipline we install in — from AMC contracts to emergency call-outs.',
        },
      ],
      checklistItems: '',
      trustStats: [],
      formHeading: 'Request a free quote',
      formSubtext: "Fill this in and we'll call you back.",
      interestOptions:
        'Central AC\nHome Automation\nHome Theater\nCCTV & Security\nFire Safety\nElectrical\nSomething else',
      ctaLabel: 'Get My Free Quote →',
      formPrivacyNote: "We'll only use these details to respond to your enquiry.",
      padding: 'md',
    },
    render: function ConstructionLeadFormFAQRender({
      id,
      puck,
      sectionEyebrow,
      sectionTitle,
      sectionIntroLinkLabel,
      sectionIntroLinkHref,
      faqs: faqsRaw,
      showFaqs,
      faqSource: faqSourceMode,
      introText,
      checklistItems,
      trustStats,
      formHeading,
      formSubtext,
      interestOptions,
      ctaLabel,
      formPrivacyNote,
      padding,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const [openIndex, setOpenIndex] = useState<number | null>(null)
      const [contactPref, setContactPref] = useState<'whatsapp' | 'phone'>('whatsapp')
      const isEditing = puck?.isEditing ?? false
      const projectId = puck?.metadata?.projectId as string | undefined
      const options = (interestOptions ?? '')
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean)
      // FAQ module is the source of truth once a project has any entries —
      // the block's own `faqs` field is only a fallback for a project that
      // hasn't been given real FAQ content yet.
      const { data: dbFaqs } = useQuery({
        queryKey: ['faq-entries-public', projectId],
        queryFn: () =>
          fetch(`/api/faq/public${projectId ? `?project_id=${projectId}` : ''}`)
            .then((r) => r.json())
            .then((json) => (json?.data?.items ?? []) as { question: string; answer: string }[]),
        enabled: Boolean(projectId),
      })
      const faqSource =
        showFaqs === false
          ? []
          : faqSourceMode === 'block'
            ? (faqsRaw ?? [])
            : dbFaqs && dbFaqs.length > 0
              ? dbFaqs
              : (faqsRaw ?? [])
      const faqs = faqSource.map((f, n) => ({ ...f, n })).filter((f) => f.question)
      return (
        <section ref={ref} className={`${revealCls} ${padY[padding]} bg-slate-950`}>
          {/* Reference (v2-lead) wraps this in container-fluid, not a
              max-width container. */}
          <div className="w-full px-4 md:px-8 md:flex gap-12">
            <div className="md:w-1/2 mb-14 md:mb-0">
              {(isEditing || sectionEyebrow) && (
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-orange-500">
                  <InlineEditableText
                    id={id}
                    path={['sectionEyebrow']}
                    value={sectionEyebrow ?? ''}
                    isEditing={isEditing}
                  />
                </p>
              )}
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                <InlineEditableText
                  id={id}
                  path={['sectionTitle']}
                  value={sectionTitle ?? ''}
                  isEditing={isEditing}
                />
              </h2>
              {introText && <p className="text-slate-400 mb-6">{introText}</p>}
              {(isEditing || sectionIntroLinkLabel) && (
                <p className="text-slate-400 mb-6">
                  Can&apos;t find what you&apos;re looking for?{' '}
                  <a
                    href={sectionIntroLinkHref}
                    onClick={isEditing ? (e) => e.preventDefault() : undefined}
                    className="text-orange-500 font-semibold hover:text-orange-400"
                  >
                    <InlineEditableText
                      id={id}
                      path={['sectionIntroLinkLabel']}
                      value={sectionIntroLinkLabel ?? ''}
                      isEditing={isEditing}
                    />
                  </a>{' '}
                  and our engineers will help directly.
                </p>
              )}
              {checklistItems?.trim() && (
                <ul className="mb-6 space-y-2">
                  {checklistItems
                    .split('\n')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-slate-300">
                        <svg
                          className="h-4 w-4 shrink-0 text-orange-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {t}
                      </li>
                    ))}
                </ul>
              )}
              {trustStats && trustStats.filter((s) => s.number || s.label).length > 0 && (
                <div className="mb-8 flex flex-wrap gap-6 border-t border-slate-800 pt-6">
                  {trustStats
                    .filter((s) => s.number || s.label)
                    .map((s, i) => (
                      <div key={i}>
                        <b className="block text-2xl font-bold text-white">{s.number}</b>
                        <span className="text-xs text-slate-400">{s.label}</span>
                      </div>
                    ))}
                </div>
              )}
              <div className="flex flex-col">
                {faqs.map((f, i) => {
                  const isOpen = openIndex === i
                  return (
                    <div key={i} className="border-b border-slate-800">
                      <button
                        type="button"
                        onClick={() => setOpenIndex(isOpen ? null : i)}
                        className="w-full flex items-center justify-between gap-4 py-4 text-left font-semibold text-white"
                      >
                        <InlineEditableText
                          id={id}
                          path={['faqs', f.n, 'question']}
                          value={f.question ?? ''}
                          isEditing={isEditing}
                        />
                        <span
                          className={`flex-shrink-0 text-orange-500 text-xl leading-none transition-transform ${isOpen ? 'rotate-45' : ''}`}
                        >
                          +
                        </span>
                      </button>
                      {isOpen && (
                        <p className="pb-4 text-sm text-slate-400 leading-relaxed">
                          <InlineEditableText
                            id={id}
                            path={['faqs', f.n, 'answer']}
                            value={f.answer ?? ''}
                            isEditing={isEditing}
                            multiline
                          />
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="relative rounded-2xl bg-white p-6 md:p-8 shadow-2xl">
                <h3 className="mb-2 inline-block rounded bg-orange-500 px-2 py-1 text-lg font-bold text-white">
                  <InlineEditableText
                    id={id}
                    path={['formHeading']}
                    value={formHeading ?? ''}
                    isEditing={isEditing}
                  />
                </h3>
                {(isEditing || formSubtext) && (
                  <p className="text-sm text-slate-600 mb-6">
                    <InlineEditableText
                      id={id}
                      path={['formSubtext']}
                      value={formSubtext ?? ''}
                      isEditing={isEditing}
                    />
                  </p>
                )}
                {/*
                  Display-only: no lead-capture endpoint exists in this app
                  yet. Plain div (not <form>) + type="button" submit so
                  nothing navigates or posts on click — deliberate, not an
                  oversight.
                */}
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                        Name
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                        Phone
                      </label>
                      <input
                        type="tel"
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm"
                    />
                  </div>
                  {options.length > 0 && (
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                        What are you looking for?
                      </label>
                      <select className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                        {options.map((o, i) => (
                          <option key={i}>{o}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                      Preferred Contact
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setContactPref('whatsapp')}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          contactPref === 'whatsapp'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-slate-300 text-slate-700'
                        }`}
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactPref('phone')}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          contactPref === 'phone'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-slate-300 text-slate-700'
                        }`}
                      >
                        Phone Call
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-900">
                      Message (optional)
                    </label>
                    <textarea
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-gradient-to-r from-orange-600 to-orange-400 px-6 py-3.5 text-white font-semibold hover:opacity-90 transition text-sm"
                  >
                    <InlineEditableText
                      id={id}
                      path={['ctaLabel']}
                      value={ctaLabel ?? ''}
                      isEditing={isEditing}
                    />
                  </button>
                  {(isEditing || formPrivacyNote) && (
                    <p className="text-center text-xs text-slate-400">
                      <InlineEditableText
                        id={id}
                        path={['formPrivacyNote']}
                        value={formPrivacyNote ?? ''}
                        isEditing={isEditing}
                      />
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Simple contact form — no FAQ, just the form
  ConstructionSimpleContactForm: {
    label: 'Simple Contact Form',
    fields: {
      heading: { type: 'text' },
      submitLabel: { type: 'text' },
    },
    defaultProps: {
      heading: 'Get in Touch',
      submitLabel: 'Send Message',
    },
    render: function ConstructionSimpleContactFormRender({ heading, submitLabel }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      return (
        <section ref={ref} className={`${revealCls} ${padY.md} bg-white`}>
          <div className={`${wrap} max-w-xl`}>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 text-center">
              {heading}
            </h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
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
                  type="email"
                  placeholder="Email"
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                />
                <textarea
                  placeholder="Message"
                  rows={4}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                />
                <button
                  type="button"
                  className="rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                >
                  {submitLabel}
                </button>
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Quote request form — project-type + budget selects, trust badges row
  ConstructionQuoteRequestForm: {
    label: 'Quote Request Form',
    fields: {
      heading: { type: 'text' },
      submitLabel: { type: 'text' },
      trustText: { type: 'text' },
    },
    defaultProps: {
      heading: 'Request a Quote',
      submitLabel: 'Get My Quote',
      trustText: '1000+ businesses across Andhra Pradesh trust us',
    },
    render: function ConstructionQuoteRequestFormRender({ heading, submitLabel, trustText }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      return (
        <section ref={ref} className={`${revealCls} ${padY.md} bg-slate-50`}>
          <div className={`${wrap} max-w-xl`}>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 text-center">
              {heading}
            </h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
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
                  type="email"
                  placeholder="Email"
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                />
                <select className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700">
                  <option>Residential</option>
                  <option>Commercial</option>
                  <option>Industrial</option>
                </select>
                <select className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700">
                  <option>Under ₹10 Lakh</option>
                  <option>₹10–50 Lakh</option>
                  <option>₹50 Lakh – 1 Crore</option>
                  <option>Above ₹1 Crore</option>
                </select>
                <textarea
                  placeholder="Tell us about your project"
                  rows={3}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                />
                <button
                  type="button"
                  className="rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                >
                  {submitLabel}
                </button>
                {trustText && <p className="text-center text-sm text-slate-600">{trustText}</p>}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Contact info + real map (left) and a real mailto form (right) —
  // matches the approved contact.html layout. No consumers of the old
  // shape existed in this project, so this is a full rewrite rather than
  // an additive extension.
  ConstructionContactSplitMap: {
    label: 'Contact + Map Split',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      subcopy: { type: 'textarea' },
      infoItems: {
        type: 'array',
        min: 0,
        max: 6,
        getItemSummary: (item) => item.label || 'Info item',
        defaultItemProps: {
          icon: 'phone',
          label: '',
          lines: '',
          linkPrefix: '',
        },
        arrayFields: {
          icon: {
            type: 'select',
            options: [
              { label: 'Phone', value: 'phone' },
              { label: 'Envelope', value: 'envelope' },
              { label: 'Shop', value: 'shop' },
              { label: 'Building', value: 'building' },
            ],
          },
          label: { type: 'text' },
          lines: { type: 'textarea' },
          linkPrefix: {
            type: 'select',
            options: [
              { label: 'None (plain text)', value: '' },
              { label: 'tel:', value: 'tel:' },
              { label: 'mailto:', value: 'mailto:' },
            ],
          },
        },
      },
      mapEmbedUrl: { type: 'text' },
      formEyebrow: { type: 'text' },
      formHeading: { type: 'text' },
      formAction: { type: 'text' },
      submitLabel: { type: 'text' },
    },
    defaultProps: {
      eyebrow: 'Get in touch',
      heading: "We're here to help",
      subcopy:
        'Have a project in mind, or just want to see the products in person? Reach us any of these ways.',
      infoItems: [
        {
          icon: 'phone',
          label: 'Phone',
          lines: '0891-2722552\n0891-2540676',
          linkPrefix: 'tel:',
        },
        {
          icon: 'envelope',
          label: 'Email',
          lines: 'sepl@subhadragroup.in\ninfo@subhadragroup.in',
          linkPrefix: 'mailto:',
        },
        {
          icon: 'shop',
          label: 'Showroom',
          lines:
            '49-52-1/16, 1st Floor, Adusha Towers, Opp. Income Tax Office, Sankaramattam Road, Shanthipuram, Visakhapatnam - 530 016',
          linkPrefix: '',
        },
        {
          icon: 'building',
          label: 'Registered Office',
          lines: '50-58-15, Rajendra Nagar, Visakhapatnam - 530 016',
          linkPrefix: '',
        },
      ],
      mapEmbedUrl:
        'https://www.google.com/maps?q=49-52-1/16%20Sankaramattam%20Road%20Shanthipuram%20Visakhapatnam%20530016&output=embed',
      formEyebrow: 'Send a message',
      formHeading: 'Tell us what you need',
      formAction: 'mailto:sepl@subhadragroup.in',
      submitLabel: 'Send Message →',
    },
    render: function ConstructionContactSplitMapRender({
      eyebrow,
      heading,
      subcopy,
      infoItems,
      mapEmbedUrl,
      formEyebrow,
      formHeading,
      formAction,
      submitLabel,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      return (
        <section ref={ref} className={`${revealCls} ${padY.md} bg-white`}>
          <div className={wrap}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                {eyebrow && (
                  <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                    {eyebrow}
                  </p>
                )}
                {heading && (
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">{heading}</h2>
                )}
                {subcopy && <p className="text-slate-600 leading-relaxed mb-6">{subcopy}</p>}
                <div className="flex flex-col gap-5 mb-6">
                  {(infoItems ?? []).map((item, i) => {
                    const Icon = item.icon ? ICON_BY_KEY[item.icon as IconKey] : PhoneIcon
                    const lines = (item.lines ?? '').split('\n').filter(Boolean)
                    return (
                      <div key={i} className="flex gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                          <Icon />
                        </span>
                        <div>
                          {item.label && (
                            <h4 className="font-semibold text-slate-900">{item.label}</h4>
                          )}
                          {lines.map((line, li) =>
                            item.linkPrefix ? (
                              <a
                                key={li}
                                href={`${item.linkPrefix}${line.replace(/\s+/g, '')}`}
                                className="block text-sm text-slate-600 hover:text-orange-600 transition"
                              >
                                {line}
                              </a>
                            ) : (
                              <p key={li} className="text-sm text-slate-600 leading-relaxed">
                                {line}
                              </p>
                            )
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {mapEmbedUrl && (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 h-64">
                    <iframe
                      src={mapEmbedUrl}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Location"
                      className="w-full h-full border-0"
                    />
                  </div>
                )}
              </div>

              <form
                action={formAction}
                method="get"
                encType="text/plain"
                className="flex flex-col gap-4"
              >
                {formEyebrow && (
                  <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide">
                    {formEyebrow}
                  </p>
                )}
                {formHeading && (
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 -mt-2">
                    {formHeading}
                  </h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cf-name" className="text-sm font-medium text-slate-700">
                      Name
                    </label>
                    <input
                      id="cf-name"
                      name="Name"
                      type="text"
                      required
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cf-phone" className="text-sm font-medium text-slate-700">
                      Phone
                    </label>
                    <input
                      id="cf-phone"
                      name="Phone"
                      type="tel"
                      required
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cf-email" className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    id="cf-email"
                    name="Email"
                    type="email"
                    required
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cf-subject" className="text-sm font-medium text-slate-700">
                    What do you need?
                  </label>
                  <input
                    id="cf-subject"
                    name="Subject"
                    type="text"
                    placeholder="e.g. Central AC for a 3BHK villa"
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cf-message" className="text-sm font-medium text-slate-700">
                    Message
                  </label>
                  <textarea
                    id="cf-message"
                    name="Message"
                    required
                    rows={4}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm w-fit"
                >
                  {submitLabel}
                </button>
              </form>
            </div>
          </div>
        </section>
      )
    },
  },

  // Tagline strip
  ConstructionTaglineStrip: {
    label: 'Tagline Strip',
    fields: {
      logoUrl: imageField('Logo'),
      brand: { type: 'text' },
      tagline: { type: 'text' },
    },
    defaultProps: {
      logoUrl: '/seed/subhadra/brand/logo.png',
      brand: 'Subhadra Group',
      tagline: 'Your one-stop solution for building engineering products & services.',
    },
    render: function ConstructionTaglineStripRender({ logoUrl, brand, tagline: taglineProp }) {
      // Simple website text, managed through Settings → Fields
      // (/admin/settings/view/website-content) once it has a value there.
      const sf = useSettingsFieldValues(['tagline-text'])
      const tagline = sf['tagline-text'] || taglineProp
      return (
        <div className="bg-slate-900 text-white py-6">
          <div className={`${wrap} flex items-center justify-center gap-3 text-center`}>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brand} className="h-7 w-auto" />
            )}
            <p className="text-sm font-medium opacity-90">{tagline}</p>
          </div>
        </div>
      )
    },
  },

  // Floating WhatsApp + back-to-top
  ConstructionFloatingActions: {
    label: 'Floating Actions (WhatsApp + Brochure + Trust Badge)',
    fields: {
      whatsappHref: { type: 'text' },
      brochureHref: { type: 'text' },
      badgeYearLabel: { type: 'text' },
      badgeNumber: { type: 'text' },
      badgeLabel: { type: 'text' },
    },
    defaultProps: {
      whatsappHref:
        'https://wa.me/918897224466?text=Hi%20Subhadra%20Group%2C%20I%27d%20like%20to%20know%20more%20about%20your%20services.',
      brochureHref: '/seed/subhadra/Subhadra-Group-30-Years-Brochure.pdf',
      badgeYearLabel: 'Estd. 1996',
      badgeNumber: '30',
      badgeLabel: 'years of Trust',
    },
    render: ({ id, whatsappHref, brochureHref, badgeYearLabel, badgeNumber, badgeLabel, puck }) => {
      const isEditing = puck?.isEditing ?? false
      return (
        <>
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
            {brochureHref && (
              <a
                href={brochureHref}
                download
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download brochure"
                className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-slate-800 transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"
                  />
                </svg>
              </a>
            )}
          </div>
          {badgeNumber && (
            <div
              className="fixed bottom-6 left-6 z-40 hidden md:flex h-24 w-24 items-center justify-center rounded-full bg-slate-950 shadow-lg"
              aria-hidden="true"
            >
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 200">
                <defs>
                  <linearGradient id="fabGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f6d876" />
                    <stop offset="50%" stopColor="#c9971f" />
                    <stop offset="100%" stopColor="#f6d876" />
                  </linearGradient>
                </defs>
                <circle
                  cx="100"
                  cy="100"
                  r="94"
                  fill="none"
                  stroke="url(#fabGoldGrad)"
                  strokeWidth="9"
                  strokeDasharray="4 9"
                  strokeLinecap="round"
                />
              </svg>
              <div className="relative flex flex-col items-center text-center text-white">
                {(isEditing || badgeYearLabel) && (
                  <span className="text-[9px] tracking-wide">
                    <InlineEditableText
                      id={id}
                      path={['badgeYearLabel']}
                      value={badgeYearLabel ?? ''}
                      isEditing={isEditing}
                    />
                  </span>
                )}
                <span className="text-2xl font-extrabold leading-none">
                  <InlineEditableText
                    id={id}
                    path={['badgeNumber']}
                    value={badgeNumber ?? ''}
                    isEditing={isEditing}
                  />
                </span>
                {(isEditing || badgeLabel) && (
                  <span className="text-[9px] leading-tight">
                    <InlineEditableText
                      id={id}
                      path={['badgeLabel']}
                      value={badgeLabel ?? ''}
                      isEditing={isEditing}
                    />
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )
    },
  },

  // 4-column footer
  ConstructionFooter: {
    label: 'Construction Footer (4 Column)',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — 4-column, showroom + regd. office', value: '1' },
          { label: 'Design 2 — colorful blocks, about + quick links + contact', value: '2' },
          { label: 'Design 3 — white logo bar, dark link columns + big phone', value: '3' },
          { label: 'Design 4 — dark curve, 4 link columns + newsletter signup', value: '4' },
        ],
      },
      logoUrl: { type: 'text' },
      brand: { type: 'text' },
      tagline: { type: 'textarea' },
      aboutTitle: { type: 'text' },
      aboutText: { type: 'textarea' },
      aboutLinkLabel: { type: 'text' },
      aboutLinkHref: { type: 'text' },
      primaryColor: { type: 'text' },
      secondaryColor: { type: 'text' },
      tertiaryColor: { type: 'text' },
      quaternaryColor: { type: 'text' },
      social1Label: { type: 'text' },
      social1Href: { type: 'text' },
      social2Label: { type: 'text' },
      social2Href: { type: 'text' },
      social3Label: { type: 'text' },
      social3Href: { type: 'text' },
      social4Label: { type: 'text' },
      social4Href: { type: 'text' },
      companyLinksTitle: { type: 'text' },
      links: { type: 'textarea' },
      group2Title: { type: 'text' },
      group2Links: { type: 'textarea' },
      group3Title: { type: 'text' },
      group3Links: { type: 'textarea' },
      partnerLogo1Url: { type: 'text' },
      partnerLogo2Url: { type: 'text' },
      partnerLogo3Url: { type: 'text' },
      partnerLogo4Url: { type: 'text' },
      badge1Url: { type: 'text' },
      badge1Label: { type: 'text' },
      badge2Url: { type: 'text' },
      badge2Label: { type: 'text' },
      policyLinks: { type: 'textarea' },
      group4Links: { type: 'textarea' },
      newsletterTitle: { type: 'text' },
      newsletterPlaceholder: { type: 'text' },
      newsletterButtonLabel: { type: 'text' },
      contactTitle: { type: 'text' },
      contactPhone: { type: 'text' },
      contactPhone2: { type: 'text' },
      contactEmail: { type: 'text' },
      contactEmail2: { type: 'text' },
      contactAddress: { type: 'textarea' },
      showroomTitle: { type: 'text' },
      showroomAddress: { type: 'textarea' },
      regdOfficeTitle: { type: 'text' },
      regdOfficeAddress: { type: 'textarea' },
      qrImage: { type: 'text' },
      qrCaption: { type: 'text' },
      estdYear: { type: 'text' },
      copyright: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      logoUrl: '',
      brand: 'Your Brand',
      tagline: 'Building with integrity, delivering with precision.',
      aboutTitle: 'Who We Are',
      aboutText: 'A trusted name delivering quality projects on time, every time.',
      aboutLinkLabel: '',
      aboutLinkHref: '',
      primaryColor: '',
      secondaryColor: '',
      tertiaryColor: '',
      quaternaryColor: '',
      social1Label: 'f',
      social1Href: '#',
      social2Label: 'in',
      social2Href: '#',
      social3Label: 'ig',
      social3Href: '#',
      social4Label: 'x',
      social4Href: '#',
      companyLinksTitle: 'Company',
      links: 'Home|#\nAbout|#\nContact|#',
      group2Title: 'Solutions',
      group2Links: 'CRM|#\nAssociation Management|#',
      group3Title: 'Quick Links',
      group3Links: 'Open Source|#\nCMS|#\nSupport|#',
      partnerLogo1Url: dummyLogo(80, 40, 'Partner'),
      partnerLogo2Url: dummyLogo(80, 40, 'Partner'),
      partnerLogo3Url: dummyLogo(80, 40, 'Partner'),
      partnerLogo4Url: dummyLogo(80, 40, 'Partner'),
      badge1Url: dummyLogo(120, 32, 'DMCA Protected'),
      badge1Label: 'DMCA Protected',
      badge2Url: dummyLogo(120, 32, 'Copyscape Protected'),
      badge2Label: 'Protected by Copyscape',
      policyLinks: 'Terms & Conditions|#\nPrivacy Policy|#\nSitemap|#\nBlogs|#',
      group4Links: 'My Account|#\nPress|#\nCareers|#\nAffiliate Program|#',
      newsletterTitle: 'Sign up to get 15% off your first order',
      newsletterPlaceholder: 'Your Email Address',
      newsletterButtonLabel: 'Subscribe',
      contactTitle: 'Contact',
      contactPhone: '+91-98765-43210',
      contactPhone2: '',
      contactEmail: 'info@yourbrand.com',
      contactEmail2: '',
      contactAddress: '123 Business Avenue\nCity, State 000000',
      showroomTitle: 'Showroom',
      showroomAddress: '456 Showroom Road\nCity, State 000000',
      regdOfficeTitle: 'Regd. Office',
      regdOfficeAddress: '',
      qrImage: dummyLogo(160, 160, 'QR Code'),
      qrCaption: 'Scan for directions',
      estdYear: '',
      copyright: '© Your Brand. All rights reserved.',
    },
    render: function ConstructionFooterRender({
      id,
      puck,
      variant,
      logoUrl,
      brand,
      tagline,
      aboutTitle,
      aboutText,
      aboutLinkLabel,
      aboutLinkHref,
      primaryColor,
      secondaryColor,
      tertiaryColor,
      quaternaryColor,
      social1Label,
      social1Href,
      social2Label,
      social2Href,
      social3Label,
      social3Href,
      social4Label,
      social4Href,
      companyLinksTitle,
      links,
      group2Title,
      group2Links,
      group3Title,
      group3Links,
      partnerLogo1Url,
      partnerLogo2Url,
      partnerLogo3Url,
      partnerLogo4Url,
      badge1Url,
      badge1Label,
      badge2Url,
      badge2Label,
      policyLinks,
      group4Links,
      newsletterTitle,
      newsletterPlaceholder,
      newsletterButtonLabel,
      contactTitle,
      contactPhone,
      contactPhone2,
      contactEmail,
      contactEmail2,
      contactAddress,
      showroomTitle,
      showroomAddress,
      regdOfficeTitle,
      regdOfficeAddress,
      qrImage,
      qrCaption,
      estdYear,
      copyright,
    }) {
      const parseLinkList = (text: string) =>
        (text || '')
          .split('\n')
          .map((line) => line.split('|'))
          .filter(([label]) => label)
      // Menus module is the source of truth once a project has a real
      // "footer" menu — its own independent Menu row, not a mirror of
      // Header's (Header and Footer are separately editable, /admin/menus
      // ?key=footer). `links` is only the fallback for a project with no
      // footer menu configured yet. Reading the live menu here (instead of
      // this static field) also keeps it immune to the template-engine
      // driver's `patchNavLinks` occasionally rewriting this stored field
      // with a stale snapshot.
      const footerProjectId = puck?.metadata?.projectId as string | undefined
      const footerMenuTree = useHeaderMenuTree(footerProjectId, 'footer')
      const companyLinks = footerMenuTree
        ? footerMenuTree.map((m): [string, string] => [m.label, m.url || '#'])
        : parseLinkList(links)
      const socials = [
        { label: social1Label, href: social1Href, Icon: FacebookIcon },
        { label: social2Label, href: social2Href, Icon: LinkedInIcon },
        { label: social3Label, href: social3Href, Icon: InstagramIcon },
        { label: social4Label, href: social4Href, Icon: XIcon },
      ].filter((s) => s.href)
      // Badge is purely decorative and only shows once there's a founding
      // year to compute "years of trust" from — no fake number without
      // real data behind it.
      const yearsOfTrust =
        estdYear && /^\d{4}$/.test(estdYear) ? new Date().getFullYear() - Number(estdYear) : null
      const isEditing = puck?.isEditing ?? false

      // Design 2 — colorful blocks driven by the brand kit's own
      // primary/secondary colors (same accentColorFor/readableTextColor
      // contrast helpers Header already uses) instead of hardcoded
      // yellow/red, so it reskins to whatever brand is active.
      if (variant === '2') {
        const mainBg = primaryColor || '#dc2626'
        // Reference design pairs a clearly distinct accent color for the
        // logo block, not a shade/tint of the same hue. A plain lightness
        // fallback (or a fixed amber) still reads as "the same color" when
        // the brand's own secondary is an unsaturated placeholder gray or
        // sits in the same warm family as the primary (reported: "still
        // not change" on an orange-brand project) — hueShiftAccent
        // guarantees a genuinely different color family regardless of the
        // brand's actual primary hue.
        const accentBg = isVividAccent(secondaryColor, mainBg)
          ? (secondaryColor as string)
          : hueShiftAccent(mainBg)
        const mainText = readableTextColor(mainBg)
        const accentText = readableTextColor(accentBg)
        const contactLines = [contactPhone, contactPhone2, contactEmail, contactEmail2].filter(
          Boolean
        )
        return (
          <footer>
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Left half — one flat accent color, like the reference (not
                  a 25%-wide strip) — logo panel + About share the same bg. */}
              <div
                style={{ backgroundColor: accentBg, color: accentText }}
                className="grid grid-cols-1 sm:grid-cols-[220px_1fr]"
              >
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-14 w-auto rounded bg-white p-1" />
                  ) : (
                    <span className="text-lg font-bold">{brand}</span>
                  )}
                  {tagline && (
                    <p className="text-xs font-semibold uppercase tracking-wide whitespace-pre-line">
                      {tagline}
                    </p>
                  )}
                </div>
                <div className="p-8">
                  {aboutTitle && <h4 className="mb-3 text-lg font-bold uppercase">{aboutTitle}</h4>}
                  {aboutText && (
                    <p className="text-sm opacity-90 whitespace-pre-line">{aboutText}</p>
                  )}
                  {aboutLinkHref && (
                    <a
                      href={aboutLinkHref}
                      className="mt-2 inline-block text-sm font-bold underline"
                    >
                      {aboutLinkLabel || 'Read More...'}
                    </a>
                  )}
                </div>
              </div>
              {/* Right half — one flat main color — Quick Links + Contact
                  share the same bg. */}
              <div
                style={{ backgroundColor: mainBg, color: mainText }}
                className="grid grid-cols-1 sm:grid-cols-2"
              >
                <div className="p-8">
                  {companyLinksTitle && (
                    <h4 className="mb-3 text-lg font-bold uppercase">{companyLinksTitle}</h4>
                  )}
                  <ul className="flex flex-col gap-2 text-sm">
                    {companyLinks.map(([label, href], i) => (
                      <li key={i}>
                        <a href={href || '#'} className="opacity-90 transition hover:opacity-100">
                          → {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-8">
                  {contactTitle && (
                    <h4 className="mb-3 text-lg font-bold uppercase">{contactTitle}</h4>
                  )}
                  {contactAddress && (
                    <p className="mb-2 text-sm opacity-90 whitespace-pre-line">{contactAddress}</p>
                  )}
                  {contactLines.length > 0 && (
                    <ul className="mb-3 flex flex-col gap-1 text-sm opacity-90">
                      {contactLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  )}
                  {socials.length > 0 && (
                    <div className="flex gap-2">
                      {socials.map((s, i) => (
                        <a
                          key={i}
                          href={s.href}
                          aria-label={s.label || 'Social link'}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
                        >
                          <s.Icon />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div
              className="flex flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-white/50 sm:flex-row md:px-8"
              style={{ backgroundColor: secondaryColor || '#12142a' }}
            >
              <p>{copyright}</p>
              <a href="https://f9tech.com" className="transition hover:text-white">
                Design by f9tech.com
              </a>
            </div>
          </footer>
        )
      }

      // Design 3 — white logo/social bar over a solid dark band (the band
      // uses the brand's own primaryColor, falling back to navy) with 3
      // link columns + a phone/email/address column, matching the F9
      // reference. Only 4 social icon slots exist on this component
      // (reused as-is from Designs 1/2) — the reference shows 5 platforms,
      // but adding a 5th icon type purely to match icon *count* isn't worth
      // a new field + new SVG when the existing 4-icon row already matches
      // the reference's structure (a row of circular icon buttons).
      if (variant === '3') {
        const bandBg = primaryColor || '#10275c'
        const bandText = readableTextColor(bandBg)
        const bandGradient = themeGradient(bandBg, tertiaryColor || '#000000', 145)
        const groups = [
          { title: companyLinksTitle, links: companyLinks, showPartners: true },
          { title: group2Title, links: parseLinkList(group2Links), showPartners: false },
          { title: group3Title, links: parseLinkList(group3Links), showPartners: false },
        ].filter((g) => g.title || g.links.length > 0)
        const partnerLogos = [
          partnerLogo1Url,
          partnerLogo2Url,
          partnerLogo3Url,
          partnerLogo4Url,
        ].filter(Boolean)
        const badges = [
          { url: badge1Url, label: badge1Label },
          { url: badge2Url, label: badge2Label },
        ].filter((b) => b.url)
        const policyItems = parseLinkList(policyLinks)

        return (
          <footer>
            <div className="relative overflow-hidden bg-white py-6">
              <div
                className={`${wrap} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}
              >
                {logoUrl ? (
                  <span
                    className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-dashed p-2"
                    style={{ borderColor: bandBg }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt={brand} className="h-full w-full object-contain" />
                  </span>
                ) : (
                  <span className="text-2xl font-bold" style={{ color: bandBg }}>
                    {brand}
                  </span>
                )}
                {socials.length > 0 && (
                  <div className="flex gap-3">
                    {socials.map((s, i) => (
                      <a
                        key={i}
                        href={s.href}
                        aria-label={s.label || 'Social link'}
                        style={{ color: bandBg }}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md transition hover:shadow-lg [&_svg]:h-5 [&_svg]:w-5"
                      >
                        <s.Icon />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {/* Curved seam into the dark band below, instead of a flat
                  edge — a straight `border-t` read as "flat/missing" next
                  to the reference's wave transition. */}
              <svg
                className="pointer-events-none absolute inset-x-0 bottom-0 h-6 w-full translate-y-1/2"
                viewBox="0 0 1440 60"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M0 60 Q 720 0 1440 60 L1440 60 L0 60 Z" fill={bandBg} />
              </svg>
            </div>
            <div
              style={{ backgroundColor: bandBg, backgroundImage: bandGradient, color: bandText }}
              className="relative overflow-hidden"
            >
              {/* Faint concentric dashed rings in the corner, matching the
                  reference's decorative background — purely ornamental so
                  it's drawn in a translucent neutral (not a brand color)
                  and stays subtle against any bandBg. */}
              <svg
                className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 opacity-[0.08]"
                viewBox="0 0 200 200"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="100" cy="100" r="40" stroke="white" strokeDasharray="3 4" />
                <circle cx="100" cy="100" r="70" stroke="white" strokeDasharray="3 4" />
                <circle cx="100" cy="100" r="100" stroke="white" strokeDasharray="3 4" />
              </svg>
              <div
                className={`${wrap} relative grid grid-cols-1 gap-8 pb-10 pt-12 sm:grid-cols-2 lg:grid-cols-4`}
              >
                {groups.map((g, i) => (
                  <div key={i}>
                    {g.title && (
                      <h4 className="mb-4 text-sm font-bold uppercase tracking-wide">{g.title}</h4>
                    )}
                    <ul className="flex flex-col gap-2.5 text-sm">
                      {g.links.map(([label, href], j) => (
                        <li key={j}>
                          <a
                            href={href || '#'}
                            className="uppercase tracking-wide opacity-90 transition hover:opacity-100"
                          >
                            {label}
                          </a>
                        </li>
                      ))}
                    </ul>
                    {g.showPartners && partnerLogos.length > 0 && (
                      <div className="mt-6 flex flex-wrap gap-2">
                        {partnerLogos.map((url, k) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={k}
                            src={url}
                            alt=""
                            className="h-10 w-auto rounded bg-white p-1"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div>
                  {contactPhone && <p className="mb-2 text-2xl font-extrabold">{contactPhone}</p>}
                  {contactEmail && <p className="mb-4 text-lg font-semibold">{contactEmail}</p>}
                  {contactAddress && (
                    <p className="mb-4 text-sm opacity-90 whitespace-pre-line">{contactAddress}</p>
                  )}
                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {badges.map((b, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={b.url}
                          alt={b.label || ''}
                          className="h-8 w-auto rounded bg-white p-1"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div
                className={`${wrap} relative flex flex-col items-center justify-between gap-3 border-t border-white/10 pb-6 text-xs opacity-80 sm:flex-row`}
              >
                <p>{copyright}</p>
                {policyItems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {policyItems.map(([label, href], i) => (
                      <span key={i} className="flex items-center gap-2">
                        {i > 0 && <span className="opacity-50">|</span>}
                        <a
                          href={href || '#'}
                          className="uppercase tracking-wide transition hover:opacity-100"
                        >
                          {label}
                        </a>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </footer>
        )
      }

      // Design 4 — dark curved band, 4 link columns + a newsletter signup
      // column, matching the reference. The 4th column's heading reuses
      // `brand` (already dynamic) instead of a new title field, since the
      // reference's 4th column is titled with the brand name itself.
      if (variant === '4') {
        const bandBg = primaryColor || '#0b3d2e'
        const bandText = readableTextColor(bandBg)
        // primary→secondary here, distinct from Design 1's secondary→
        // tertiary and Design 3's primary→tertiary — each footer design
        // mixes a different pair from the same 4-color palette.
        const bandGradient = themeGradient(bandBg, secondaryColor || '#12142a', 150)
        const accentBg = isVividAccent(secondaryColor, bandBg)
          ? (secondaryColor as string)
          : hueShiftAccent(bandBg)
        const accentText = readableTextColor(accentBg)
        const groups = [
          { title: companyLinksTitle, links: companyLinks },
          { title: group2Title, links: parseLinkList(group2Links) },
          { title: group3Title, links: parseLinkList(group3Links) },
          { title: brand, links: parseLinkList(group4Links) },
        ].filter((g) => g.title || g.links.length > 0)
        const badges = [
          { url: badge1Url, label: badge1Label },
          { url: badge2Url, label: badge2Label },
        ].filter((b) => b.url)
        const policyItems = parseLinkList(policyLinks)

        return (
          <footer
            className="relative overflow-hidden"
            style={{ backgroundColor: bandBg, backgroundImage: bandGradient, color: bandText }}
          >
            {/* White page bleeds into the band via a curve, not a flat top
                edge — matches the reference's rounded top seam. Drawn
                fully inside the footer's own box (no negative-translate +
                overflow-hidden combo) — that combo previously clipped
                almost the entire shape, leaving nothing visible. */}
            <svg
              className="pointer-events-none absolute inset-x-0 top-0 h-16 w-full"
              viewBox="0 0 1440 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0 0 H1440 V40 Q 720 100 0 40 Z" fill="white" />
            </svg>
            <div
              className={`${wrap} relative grid grid-cols-1 gap-10 pb-10 pt-16 sm:grid-cols-2 lg:grid-cols-5`}
            >
              {groups.map((g, i) => (
                <div key={i}>
                  {g.title && <h4 className="mb-4 text-sm font-semibold">{g.title}</h4>}
                  <ul className="flex flex-col gap-2 text-sm opacity-90">
                    {g.links.map(([label, href], j) => (
                      <li key={j}>
                        <a href={href || '#'} className="transition hover:opacity-100">
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="sm:col-span-2 lg:col-span-1">
                {newsletterTitle && <p className="mb-3 text-sm font-medium">{newsletterTitle}</p>}
                <div className="flex overflow-hidden rounded-full border border-white/30">
                  <input
                    type="email"
                    placeholder={newsletterPlaceholder}
                    disabled
                    className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm placeholder:opacity-60 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled
                    style={{ backgroundColor: accentBg, color: accentText }}
                    className="px-5 py-2 text-sm font-semibold"
                  >
                    {newsletterButtonLabel}
                  </button>
                </div>
                {socials.length > 0 && (
                  <div className="mt-5 flex gap-2">
                    {socials.map((s, i) => (
                      <a
                        key={i}
                        href={s.href}
                        aria-label={s.label || 'Social link'}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-current opacity-80 transition hover:opacity-100 [&_svg]:h-3.5 [&_svg]:w-3.5"
                      >
                        <s.Icon />
                      </a>
                    ))}
                  </div>
                )}
                {badges.length > 0 && (
                  <div className="mt-5 flex gap-2">
                    {badges.map((b, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={b.url}
                        alt={b.label || ''}
                        className="h-12 w-12 rounded-full bg-white p-1"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div
              className={`${wrap} relative flex flex-col items-center justify-between gap-2 border-t border-white/10 pb-6 pt-4 text-xs opacity-70 sm:flex-row`}
            >
              <p>{copyright}</p>
              {policyItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {policyItems.map(([label, href], i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i > 0 && <span className="opacity-50">|</span>}
                      <a href={href || '#'} className="transition hover:opacity-100">
                        {label}
                      </a>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </footer>
        )
      }

      // Design 1's own background: the brand's secondary color, not a
      // flat neutral slate-950 — requested explicitly ("first footer
      // background color need secondary color"). tertiaryColor blends in
      // so it's a gradient, not a flat fill, matching the rest of the pack's
      // "mix two palette colors, vary the pair per section" rule.
      const design1Bg = secondaryColor || '#12142a'
      return (
        <footer
          className="relative text-white pt-16 pb-8"
          style={{
            backgroundColor: design1Bg,
            backgroundImage: themeGradient(design1Bg, tertiaryColor || '#000000', 160),
          }}
        >
          {/* Reference (v2-footer) wraps this in .container, not
              container-fluid — constrained width like every other footer
              on the page, unlike the full-bleed Header/Hero/Sectors. */}
          <div className={wrap}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
              <div>
                <div className="flex items-center gap-2 font-bold text-lg mb-3">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-8 w-auto" />
                  ) : (
                    <span>{brand}</span>
                  )}
                </div>
                {(isEditing || tagline) && (
                  <p className="text-sm text-white/70 mb-5 whitespace-pre-line">
                    <InlineEditableText
                      id={id}
                      path={['tagline']}
                      value={tagline ?? ''}
                      isEditing={isEditing}
                      multiline
                    />
                  </p>
                )}
                {socials.length > 0 && (
                  <div className="flex gap-2">
                    {socials.map((s, i) => (
                      <a
                        key={i}
                        href={s.href}
                        aria-label={s.label || 'Social link'}
                        className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
                      >
                        <s.Icon />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">
                  <InlineEditableText
                    id={id}
                    path={['companyLinksTitle']}
                    value={companyLinksTitle ?? ''}
                    isEditing={isEditing}
                  />
                </h4>
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
                <h4 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">
                  <InlineEditableText
                    id={id}
                    path={['contactTitle']}
                    value={contactTitle ?? ''}
                    isEditing={isEditing}
                  />
                </h4>
                <ul className="flex flex-col gap-2.5 text-sm text-white/70">
                  {(isEditing || contactPhone) && (
                    <li>
                      <InlineEditableText
                        id={id}
                        path={['contactPhone']}
                        value={contactPhone ?? ''}
                        isEditing={isEditing}
                      />
                    </li>
                  )}
                  {(isEditing || contactPhone2) && (
                    <li>
                      <InlineEditableText
                        id={id}
                        path={['contactPhone2']}
                        value={contactPhone2 ?? ''}
                        isEditing={isEditing}
                      />
                    </li>
                  )}
                  {(isEditing || contactEmail) && (
                    <li>
                      <InlineEditableText
                        id={id}
                        path={['contactEmail']}
                        value={contactEmail ?? ''}
                        isEditing={isEditing}
                      />
                    </li>
                  )}
                  {(isEditing || contactEmail2) && (
                    <li>
                      <InlineEditableText
                        id={id}
                        path={['contactEmail2']}
                        value={contactEmail2 ?? ''}
                        isEditing={isEditing}
                      />
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">
                  <InlineEditableText
                    id={id}
                    path={['showroomTitle']}
                    value={showroomTitle ?? ''}
                    isEditing={isEditing}
                  />
                </h4>
                <div className="flex items-start gap-4">
                  {(isEditing || showroomAddress) && (
                    <p className="text-sm text-white/70 whitespace-pre-line">
                      <InlineEditableText
                        id={id}
                        path={['showroomAddress']}
                        value={showroomAddress ?? ''}
                        isEditing={isEditing}
                        multiline
                      />
                    </p>
                  )}
                  {qrImage && (
                    <div className="shrink-0 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrImage}
                        alt={qrCaption}
                        className="w-16 h-16 rounded-lg bg-white p-1"
                      />
                      {(isEditing || qrCaption) && (
                        <p className="text-[11px] text-white/50 mt-1.5 max-w-[80px]">
                          <InlineEditableText
                            id={id}
                            path={['qrCaption']}
                            value={qrCaption ?? ''}
                            isEditing={isEditing}
                          />
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {(isEditing || regdOfficeAddress) && (
                  <>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-2 mt-5">
                      <InlineEditableText
                        id={id}
                        path={['regdOfficeTitle']}
                        value={regdOfficeTitle ?? ''}
                        isEditing={isEditing}
                      />
                    </h4>
                    <p className="text-sm text-white/70 whitespace-pre-line">
                      <InlineEditableText
                        id={id}
                        path={['regdOfficeAddress']}
                        value={regdOfficeAddress ?? ''}
                        isEditing={isEditing}
                        multiline
                      />
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
              <p>
                <InlineEditableText
                  id={id}
                  path={['copyright']}
                  value={copyright ?? ''}
                  isEditing={isEditing}
                />
              </p>
              <a href="https://f9tech.com" className="hover:text-white transition">
                Design by f9tech.com
              </a>
            </div>
          </div>
          {yearsOfTrust !== null && (
            <div className="absolute right-4 bottom-8 hidden md:flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-amber-400/70 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                  Estd. {estdYear}
                </p>
                <p className="text-2xl font-extrabold leading-none text-amber-400">
                  {yearsOfTrust}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                  Years of Trust
                </p>
              </div>
            </div>
          )}
        </footer>
      )
    },
  },

  // ── Founder / CEO spotlight ────────────────────────────────────────────────
  ConstructionFounder: {
    label: 'Founder',
    fields: {
      sectionTitle: { type: 'text' },
      photo: { type: 'text' },
      quoteText: { type: 'textarea' },
      founderName: { type: 'text' },
      founderTitle: { type: 'text' },
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
      sectionTitle: 'From Our Founder',
      photo:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=480&h=480&fit=crop&auto=format',
      quoteText:
        'We started this company on one promise: build it right, on time, every time. Twenty years later, that promise still guides every project we take on.',
      founderName: 'Ramesh Kumar',
      founderTitle: 'Founder & Managing Director',
      padding: 'md',
    },
    render: ({ sectionTitle, photo, quoteText, founderName, founderTitle, padding }) => (
      <section className={`${padY[padding]} bg-white`}>
        <div className={wrap}>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
            {sectionTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 md:gap-12 items-center max-w-4xl mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={founderName}
              className="w-full aspect-square object-cover rounded-2xl"
            />
            <div>
              <svg
                width="36"
                height="28"
                viewBox="0 0 36 28"
                fill="none"
                className="text-orange-300 mb-4"
              >
                <path
                  d="M14.5 0C6.5 3 0 9.5 0 17.5 0 23.3 4.2 28 9.8 28c4.9 0 8.7-3.7 8.7-8.4 0-4.4-3.1-7.7-7.2-7.7-.6 0-1.2.1-1.7.2C10.6 7.4 13.4 4 17.5 1.8L14.5 0zm18 0c-8 3-14.5 9.5-14.5 17.5 0 5.8 4.2 10.5 9.8 10.5 4.9 0 8.7-3.7 8.7-8.4 0-4.4-3.1-7.7-7.2-7.7-.6 0-1.2.1-1.7.2C28.6 7.4 31.4 4 35.5 1.8L32.5 0z"
                  fill="currentColor"
                />
              </svg>
              <p className="text-lg md:text-xl text-slate-800 leading-relaxed mb-6">{quoteText}</p>
              <p className="font-semibold text-slate-900">{founderName}</p>
              <p className="text-sm text-slate-500">{founderTitle}</p>
            </div>
          </div>
        </div>
      </section>
    ),
  },

  // ── Timeline History — vertical "our history" timeline for About ──────────
  ConstructionTimelineHistory: {
    label: 'Timeline History',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      subtitle: { type: 'textarea' },
      entry1Year: { type: 'text' },
      entry1Title: { type: 'text' },
      entry1Text: { type: 'textarea' },
      entry1Image: imageField('Image'),
      entry2Year: { type: 'text' },
      entry2Title: { type: 'text' },
      entry2Text: { type: 'textarea' },
      entry2Image: imageField('Image'),
      entry3Year: { type: 'text' },
      entry3Title: { type: 'text' },
      entry3Text: { type: 'textarea' },
      entry3Image: imageField('Image'),
      entry4Year: { type: 'text' },
      entry4Title: { type: 'text' },
      entry4Text: { type: 'textarea' },
      entry4Image: imageField('Image'),
      entry5Year: { type: 'text' },
      entry5Title: { type: 'text' },
      entry5Text: { type: 'textarea' },
      entry5Image: imageField('Image'),
      entry6Year: { type: 'text' },
      entry6Title: { type: 'text' },
      entry6Text: { type: 'textarea' },
      entry6Image: imageField('Image'),
      entry7Year: { type: 'text' },
      entry7Title: { type: 'text' },
      entry7Text: { type: 'textarea' },
      entry7Image: imageField('Image'),
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      eyebrow: 'Our Journey',
      heading: 'From 1996 to today',
      entry1Year: '1996',
      entry1Text:
        'Subhadra Group is established in Visakhapatnam to bring every building-related engineering product & service under one roof — for residential, commercial and industrial customers.',
      entry1Image: '/seed/subhadra/brand/shop.webp',
      entry2Year: '2001',
      entry2Text:
        'Added electrical wiring, MCB/DB and switchgear installations to the roof, backed by world-class brands like Schneider Electric.',
      entry2Image:
        'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=700&h=525&fit=crop&q=80&auto=format',
      entry3Year: '2006',
      entry3Text:
        'Brought fire & life safety, CCTV and access control fully in-house — completing our ELV systems capability.',
      entry3Image:
        'https://images.unsplash.com/photo-1643123182527-3bd30840e7ed?w=700&h=525&fit=crop&q=80&auto=format',
      entry4Year: '2011',
      entry4Text:
        'Started designing home automation and home theater systems for premium residences across the city.',
      entry4Image: '/seed/subhadra/products/home-automation.jpg',
      entry5Year: '2016',
      entry5Text:
        'Began delivering HVAC, electrical and automation as one coordinated scope for hotels, malls and hospitals — including landmark properties like Novotel Visakhapatnam.',
      entry5Image: '/seed/subhadra/case-studies/novotel.jpg',
      entry6Year: '2021',
      entry6Text:
        'Reached 25 years of technical expertise, with a dedicated service manager assigned to every discipline we install in.',
      entry6Image:
        'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=700&h=525&fit=crop&q=80&auto=format',
      entry7Year: 'Today',
      entry7Text:
        '15 services under one roof, 1 Lakh+ trusted clients across Andhra Pradesh, and one accountable team behind every installation.',
      entry7Image: '/seed/subhadra/inside.webp',
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionTimelineHistoryRender({
      eyebrow,
      heading,
      subtitle,
      entry1Year,
      entry1Title,
      entry1Text,
      entry1Image,
      entry2Year,
      entry2Title,
      entry2Text,
      entry2Image,
      entry3Year,
      entry3Title,
      entry3Text,
      entry3Image,
      entry4Year,
      entry4Title,
      entry4Text,
      entry4Image,
      entry5Year,
      entry5Title,
      entry5Text,
      entry5Image,
      entry6Year,
      entry6Title,
      entry6Text,
      entry6Image,
      entry7Year,
      entry7Title,
      entry7Text,
      entry7Image,
      padding,
      background,
    }) {
      const entries = [
        { year: entry1Year, title: entry1Title, text: entry1Text, image: entry1Image },
        { year: entry2Year, title: entry2Title, text: entry2Text, image: entry2Image },
        { year: entry3Year, title: entry3Title, text: entry3Text, image: entry3Image },
        { year: entry4Year, title: entry4Title, text: entry4Text, image: entry4Image },
        { year: entry5Year, title: entry5Title, text: entry5Text, image: entry5Image },
        { year: entry6Year, title: entry6Title, text: entry6Text, image: entry6Image },
        { year: entry7Year, title: entry7Title, text: entry7Text, image: entry7Image },
      ].filter((e) => e.year || e.text)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="mx-auto mb-12 max-w-2xl text-center">
              {eyebrow && (
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-600">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">{heading}</h2>
              {subtitle && <p className="mt-4 text-slate-600">{subtitle}</p>}
            </div>
            <div className="mx-auto max-w-2xl border-l-2 border-slate-200 pl-8">
              {entries.map((e, i) => (
                <div key={i} className="relative pb-10 last:pb-0">
                  <span className="absolute -left-[41px] top-0 flex items-center justify-center rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">
                    {e.year}
                  </span>
                  {e.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.image}
                      alt=""
                      className="mb-3 h-40 w-full rounded-xl object-cover"
                    />
                  )}
                  {e.title && <h4 className="pt-1 font-bold text-slate-900">{e.title}</h4>}
                  <p className="pt-1 leading-relaxed text-slate-600">{e.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // ── Leadership Grid — 3 leadership photo cards for About ───────────────────
  ConstructionLeadershipGrid: {
    label: 'Leadership Grid',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      leader1Photo: imageField('Photo'),
      leader1Name: { type: 'text' },
      leader1Title: { type: 'text' },
      leader1Bio: { type: 'textarea' },
      leader2Photo: imageField('Photo'),
      leader2Name: { type: 'text' },
      leader2Title: { type: 'text' },
      leader2Bio: { type: 'textarea' },
      leader3Photo: imageField('Photo'),
      leader3Name: { type: 'text' },
      leader3Title: { type: 'text' },
      leader3Bio: { type: 'textarea' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      eyebrow: 'Leadership',
      heading: 'The Team Behind Every Project',
      leader1Photo:
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=480&h=480&fit=crop&crop=faces&auto=format',
      leader1Name: 'Ramesh Kumar',
      leader1Title: 'Managing Director',
      leader1Bio:
        'Founded Subhadra Group in 1996; sets the technical standard for every project we take on.',
      leader2Photo:
        'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=480&h=480&fit=crop&crop=faces&auto=format',
      leader2Name: 'Priya Nair',
      leader2Title: 'Head of Engineering',
      leader2Bio: 'Leads design and QA across HVAC, Electricals and ELV for every active site.',
      leader3Photo:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=480&h=480&fit=crop&crop=faces&auto=format',
      leader3Name: 'Suresh Reddy',
      leader3Title: 'Operations Director',
      leader3Bio: 'Runs day-to-day site delivery, scheduling and our 24×7 service desk.',
      padding: 'md',
      background: 'white',
    },
    render: ({
      eyebrow,
      heading,
      leader1Photo,
      leader1Name,
      leader1Title,
      leader1Bio,
      leader2Photo,
      leader2Name,
      leader2Title,
      leader2Bio,
      leader3Photo,
      leader3Name,
      leader3Title,
      leader3Bio,
      padding,
      background,
    }) => {
      const leaders = [
        { photo: leader1Photo, name: leader1Name, title: leader1Title, bio: leader1Bio },
        { photo: leader2Photo, name: leader2Name, title: leader2Title, bio: leader2Bio },
        { photo: leader3Photo, name: leader3Name, title: leader3Title, bio: leader3Bio },
      ].filter((l) => l.name)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-12">
              {eyebrow && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900">{heading}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {leaders.map((l, i) => (
                <div key={i} className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={l.photo}
                    alt={l.name}
                    className="w-32 h-32 mx-auto rounded-full object-cover mb-4"
                  />
                  <p className="font-semibold text-slate-900">{l.name}</p>
                  <p className="text-sm text-orange-600 mb-2">{l.title}</p>
                  <p className="text-sm text-slate-600">{l.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // ── Founder Profile — 2-person alternating photo/bio cards for About ───────
  ConstructionFounderProfile: {
    label: 'Founder Profile',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      // Pick a Team-module member to pull name/role/bio/photo from — leave
      // unset to use this block's own text/photo fields below instead.
      person1MemberId: teamMemberField('Person 1 — Team member (optional)'),
      person1Photo: imageField('Person 1 — Photo (if no team member picked)'),
      person1Name: { type: 'text' },
      person1Role: { type: 'text' },
      person1Quote: { type: 'textarea' },
      person1Bio: { type: 'textarea' },
      person1Facts: {
        type: 'array',
        min: 0,
        max: 6,
        getItemSummary: (item) => item.label || 'Fact',
        defaultItemProps: { icon: 'graduationcap', label: '', value: '' },
        arrayFields: {
          icon: FOUNDER_FACT_ICON_FIELD,
          label: { type: 'text' },
          value: { type: 'text' },
        },
      },
      person1LinkLabel: { type: 'text' },
      person1LinkHref: { type: 'text' },
      person1Variant: {
        type: 'select',
        options: [
          { label: 'Dark', value: 'dark' },
          { label: 'Light', value: 'light' },
        ],
      },
      person2MemberId: teamMemberField('Person 2 — Team member (optional)'),
      person2Photo: imageField('Person 2 — Photo (if no team member picked)'),
      person2Name: { type: 'text' },
      person2Role: { type: 'text' },
      person2Bio: { type: 'textarea' },
      person2Ctas: {
        type: 'array',
        min: 0,
        max: 4,
        getItemSummary: (item) => item.label || 'Button',
        defaultItemProps: { label: '', href: '' },
        arrayFields: { label: { type: 'text' }, href: { type: 'text' } },
      },
      person2LinkLabel: { type: 'text' },
      person2LinkHref: { type: 'text' },
      person2Variant: {
        type: 'select',
        options: [
          { label: 'Orange', value: 'orange' },
          { label: 'Light', value: 'light' },
        ],
      },
      // Separate credentials panel below both heroes — matches the approved
      // reference's "#uday-kumar-detail" section (facts + membership logos).
      person2Facts: {
        type: 'array',
        min: 0,
        max: 6,
        getItemSummary: (item) => item.label || 'Fact',
        defaultItemProps: { icon: 'graduationcap', label: '', value: '' },
        arrayFields: {
          icon: FOUNDER_FACT_ICON_FIELD,
          label: { type: 'text' },
          value: { type: 'text' },
        },
      },
      person2MembershipLabel: { type: 'text' },
      person2Memberships: {
        type: 'array',
        min: 0,
        max: 12,
        getItemSummary: (item) => item.alt || 'Logo',
        defaultItemProps: { image: '', alt: '' },
        arrayFields: { image: imageField('Logo'), alt: { type: 'text' } },
      },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      // Approved reference goes straight into the leader heroes, no intro
      // heading — left blank rather than removing the (still-useful-
      // elsewhere) eyebrow/heading fields.
      eyebrow: '',
      heading: '',
      person1MemberId: '',
      person1Photo: '/seed/subhadra/founder.png',
      person1Name: 'K Leela Prasad',
      person1Role: 'Founder, Subhadra Group',
      person1Quote: 'Every building deserves one accountable team — not five contractors to chase.',
      person1Bio:
        "A practicing MEP consultant since 1983, K Leela Prasad has planned electrical installations, air conditioning & refrigeration systems, building services, IBMS, plumbing and fire-fighting solutions across Visakhapatnam for over four decades — associated with most of the region's major projects, including Swarnabharathi Indoor Stadium, Fairfield by Marriott, Novotel Visakhapatnam and Pradhama Hospital (now Medicover, MVP). In 1996, the same year he founded Subhadra Group, he also set up the Bureau of Electrical Energy Conservation.",
      person1Facts: [
        {
          icon: 'graduationcap',
          label: 'Qualification:',
          value: 'B.E. Electrical, Andhra University, Waltair',
        },
        {
          icon: 'briefcase',
          label: 'Experience:',
          value: 'MEP Consultant since 1983 — 40+ years in Electrical, HVAC & Building Services',
        },
        {
          icon: 'award',
          label: 'Recognition:',
          value:
            'Founder President, ISHRAE, FSAI & IPA Visakhapatnam · Life Member, Institution of Engineers',
        },
      ],
      person1LinkLabel: '',
      person1LinkHref: '/leadership#leela-prasad',
      person1Variant: 'dark',
      person2MemberId: '',
      person2Photo: '/seed/subhadra/products/director.png',
      person2Name: 'K N V Uday Kumar',
      person2Role: 'Director, Subhadra Group',
      person2Bio:
        'A gold medalist engineering graduate from REC Warangal (now NIT Warangal), K N V Uday Kumar brings international experience across leading MNCs to Subhadra Group. He leads the design of air conditioning for comfort & industrial applications, surveillance and fire alarm, intrusion alarm systems, audio-video solutions, and automation for residences, offices and commercial establishments, along with networking solutions.',
      person2Ctas: [
        { label: 'View Credentials ↓', href: '#uday-kumar-credentials' },
        { label: 'Get in Touch', href: '/contact' },
      ],
      person2LinkLabel: '',
      person2LinkHref: '/leadership#uday-kumar',
      person2Variant: 'orange',
      person2Facts: [
        {
          icon: 'graduationcap',
          label: 'Qualification:',
          value: 'Gold Medalist, B.Tech Engineering, REC Warangal',
        },
        {
          icon: 'briefcase',
          label: 'Experience:',
          value: '15+ years experience in HVAC, automation, AV & networking design',
        },
        {
          icon: 'award',
          label: 'Affiliations:',
          value: 'ISHRAE, FSAI, IIID, IGBC & IPA Visakhapatnam · BNI, CII & VCCI Visakhapatnam',
        },
      ],
      person2MembershipLabel: 'Proud member of',
      person2Memberships: [
        { image: '/seed/subhadra/member/fsai.jpeg', alt: 'FSAI Visakhapatnam' },
        { image: '/seed/subhadra/member/IIID.jpeg', alt: 'IIID Visakhapatnam' },
        { image: '/seed/subhadra/member/IGBC.png', alt: 'IGBC Visakhapatnam' },
        { image: '/seed/subhadra/member/IPA.png', alt: 'IPA Visakhapatnam' },
        { image: '/seed/subhadra/member/ASHRAE.webp', alt: 'ASHRAE Deccan' },
        { image: '/seed/subhadra/member/bni.svg', alt: 'BNI Visakhapatnam' },
        { image: '/seed/subhadra/member/cii.svg', alt: 'CII Visakhapatnam' },
        { image: '/seed/subhadra/member/VCCI.png', alt: 'VCCI Visakhapatnam' },
      ],
      padding: 'md',
      background: 'muted',
    },
    render: function ConstructionFounderProfileRender({
      puck,
      eyebrow,
      heading,
      person1MemberId,
      person1Photo,
      person1Name,
      person1Role,
      person1Quote,
      person1Bio,
      person1Facts,
      person1LinkLabel,
      person1LinkHref,
      person1Variant,
      person2MemberId,
      person2Photo,
      person2Name,
      person2Role,
      person2Bio,
      person2Ctas,
      person2LinkLabel,
      person2LinkHref,
      person2Variant,
      person2Facts,
      person2MembershipLabel,
      person2Memberships,
      padding,
    }) {
      const projectId = puck?.metadata?.projectId as string | undefined
      const needsLookup = Boolean(person1MemberId || person2MemberId)
      // Public read (no auth) — same endpoint the Team admin page's picker
      // reads via the authenticated one; this is the render-time path used
      // by both the editor canvas and the real public /p/[slug] page.
      const { data: members } = useQuery({
        queryKey: ['team-members-public', projectId],
        queryFn: () =>
          fetch(`/api/team/public${projectId ? `?project_id=${projectId}` : ''}`)
            .then((r) => r.json())
            .then(
              (json) =>
                (json?.data?.items ?? []) as {
                  id: string
                  name: string
                  role: string
                  bio: string | null
                  photo_url: string | null
                }[]
            ),
        enabled: needsLookup,
      })

      const resolve = (
        memberId: string,
        fallback: { photo: string; name: string; role: string; bio: string }
      ) => {
        const member = memberId ? members?.find((m) => m.id === memberId) : undefined
        if (!member) return fallback
        return {
          photo: member.photo_url || fallback.photo,
          name: member.name,
          role: member.role,
          bio: member.bio || fallback.bio,
        }
      }

      const p1 = resolve(person1MemberId, {
        photo: person1Photo,
        name: person1Name,
        role: person1Role,
        bio: person1Bio,
      })
      const p2 = resolve(person2MemberId, {
        photo: person2Photo,
        name: person2Name,
        role: person2Role,
        bio: person2Bio,
      })

      const factRow = (
        fact: { icon: string; label: string; value: string },
        i: number,
        light: boolean
      ) => {
        const Icon = fact.icon ? ICON_BY_KEY[fact.icon as IconKey] : GraduationCapIcon
        return (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                light ? 'bg-slate-100 text-slate-700' : 'bg-white/15 text-white'
              }`}
            >
              <Icon />
            </span>
            <span className={light ? 'text-slate-700' : 'text-white/85'}>
              <b className={light ? 'text-slate-900' : 'text-white'}>{fact.label}</b> {fact.value}
            </span>
          </li>
        )
      }

      return (
        <section className={eyebrow || heading ? padY[padding] : ''}>
          {(eyebrow || heading) && (
            <div className={wrap}>
              <div className="mx-auto mb-10 max-w-2xl text-center">
                {eyebrow && (
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-600">
                    {eyebrow}
                  </p>
                )}
                {heading && (
                  <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">{heading}</h2>
                )}
              </div>
            </div>
          )}

          {/* Leader 1 — dark hero with quote + facts, photo right */}
          <div
            id="leela-prasad"
            className={`relative overflow-hidden py-16 md:py-24 ${
              person1Variant === 'light' ? 'bg-white' : 'bg-slate-950'
            }`}
          >
            {person1Variant !== 'light' && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 0% 100%, rgba(210,90,30,.55), transparent 60%), radial-gradient(circle at 88% 82%, rgba(255,255,255,.07), transparent 50%)',
                }}
              />
            )}
            <div
              className={`${wrap} relative grid grid-cols-1 items-center gap-10 md:grid-cols-[1.05fr_.95fr] md:gap-16`}
            >
              <div>
                <h3
                  className={`text-2xl font-extrabold md:text-4xl ${
                    person1Variant === 'light' ? 'text-slate-900' : 'text-orange-500'
                  }`}
                >
                  {p1.name}
                </h3>
                <span
                  className={`mt-2 inline-block rounded-full px-4 py-1.5 text-sm font-bold ${
                    person1Variant === 'light'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-white/15 text-white'
                  }`}
                >
                  {p1.role}
                </span>
                {person1Quote && (
                  <blockquote
                    className={`mt-5 border-l-[3px] pl-4 text-lg font-bold italic leading-snug ${
                      person1Variant === 'light'
                        ? 'border-slate-300 text-slate-800'
                        : 'border-white/55 text-white'
                    }`}
                  >
                    &quot;{person1Quote}&quot;
                  </blockquote>
                )}
                <p
                  className={`mt-4 ${person1Variant === 'light' ? 'text-slate-600' : 'text-white/80'}`}
                >
                  {p1.bio}
                </p>
                {(person1Facts ?? []).length > 0 && (
                  <ul className="mt-6 flex max-w-lg flex-col gap-3">
                    {person1Facts.map((f, i) => factRow(f, i, person1Variant === 'light'))}
                  </ul>
                )}
                {person1LinkLabel && (
                  <Link
                    href={person1LinkHref || '#'}
                    className={`mt-6 inline-block text-sm font-semibold ${
                      person1Variant === 'light'
                        ? 'text-slate-900 hover:text-orange-600'
                        : 'text-white hover:text-orange-400'
                    }`}
                  >
                    {person1LinkLabel}
                  </Link>
                )}
              </div>
              <div className="relative mx-auto w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p1.photo}
                  alt={p1.name}
                  className="aspect-[4/4.6] w-full rounded-3xl object-cover object-top shadow-2xl"
                />
              </div>
            </div>
          </div>

          {/* Leader 2 — orange hero, CTAs, photo left (reversed) */}
          <div
            id="uday-kumar"
            className={`relative py-16 md:py-24 ${
              person2Variant === 'light'
                ? 'bg-white'
                : 'bg-gradient-to-br from-[#f0895d] via-orange-600 to-orange-800'
            }`}
          >
            <div
              className={`${wrap} grid grid-cols-1 items-center gap-10 md:grid-cols-[.95fr_1.05fr] md:gap-16`}
            >
              <div className="relative order-2 mx-auto w-full max-w-[420px] md:order-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p2.photo}
                  alt={p2.name}
                  className="aspect-[4/4.6] w-full rounded-3xl object-cover shadow-2xl"
                />
              </div>
              <div className="order-1 md:order-2">
                <span
                  className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${
                    person2Variant === 'light'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-white/15 text-white'
                  }`}
                >
                  {p2.role}
                </span>
                <h3
                  className={`mt-4 text-2xl font-extrabold md:text-4xl ${
                    person2Variant === 'light' ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  {p2.name}
                </h3>
                <p
                  className={`mt-4 ${person2Variant === 'light' ? 'text-slate-600' : 'text-white/85'}`}
                >
                  {p2.bio}
                </p>
                {(person2Ctas ?? []).length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {person2Ctas.map((cta, i) => (
                      <Link
                        key={i}
                        href={cta.href || '#'}
                        className={`inline-block rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                          person2Variant === 'light'
                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                            : 'border border-white/50 text-white hover:bg-white/10'
                        }`}
                      >
                        {cta.label}
                      </Link>
                    ))}
                  </div>
                )}
                {person2LinkLabel && (
                  <Link
                    href={person2LinkHref || '#'}
                    className={`mt-6 inline-block text-sm font-semibold ${
                      person2Variant === 'light'
                        ? 'text-slate-900 hover:text-orange-600'
                        : 'text-white hover:text-slate-900'
                    }`}
                  >
                    {person2LinkLabel}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Credentials panel — person 2's facts + membership logos */}
          {((person2Facts ?? []).length > 0 || (person2Memberships ?? []).length > 0) && (
            <div id="uday-kumar-credentials" className={`${wrap} py-12 md:py-16`}>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
                {(person2Facts ?? []).length > 0 && (
                  <ul className="flex flex-col gap-3">
                    {person2Facts.map((f, i) => factRow(f, i, true))}
                  </ul>
                )}
                {(person2Memberships ?? []).length > 0 && (
                  <div
                    className={
                      (person2Facts ?? []).length > 0 ? 'mt-7 border-t border-slate-100 pt-7' : ''
                    }
                  >
                    {person2MembershipLabel && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {person2MembershipLabel}
                      </span>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4">
                      {person2Memberships.map((logo, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={logo.image}
                          alt={logo.alt}
                          className="h-10 w-auto object-contain"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )
    },
  },

  // ── Mission & Vision — 2 alternating text/badge cards ──────────────────────
  // ponytail: badge is a plain icon circle, not the reference's decorative
  // ring SVG (dashed dots + partial arc) — upgrade if the plain version reads
  // as too bare next to the rest of the page.
  ConstructionMissionVision: {
    label: 'Mission & Vision',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Alternating badge cards', value: '1' },
          { label: 'Design 2 — Side-by-side cards', value: '2' },
          { label: 'Design 3 — Centered minimal', value: '3' },
          { label: 'Design 4 — Dark split band', value: '4' },
        ],
      },
      visionHeading: { type: 'text' },
      visionParagraph1: { type: 'textarea' },
      visionParagraph2: { type: 'textarea' },
      missionHeading: { type: 'text' },
      missionParagraph1: { type: 'textarea' },
      missionParagraph2: { type: 'textarea' },
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
      variant: '1',
      visionHeading: 'The most trusted name in building engineering across Andhra Pradesh',
      visionParagraph1:
        'To become the most trusted & complete solution provider for Electrical, Air Conditioning, Security & Safety, Automation and Entertainment systems — for homes, commercial buildings, industries & departments across entire Andhra Pradesh.',
      visionParagraph2:
        'That means every new sector we enter — hospitality, healthcare, retail, education, industry — gets the same one-team accountability that built our reputation in Visakhapatnam, backed by brands and engineers our clients can rely on for decades, not just for the installation date.',
      missionHeading: 'All building engineering, under one accountable roof',
      missionParagraph1:
        'To provide all building-related engineering products & services under one roof for residential, commercial buildings and industries — with perfect-engineered solutions, quality execution and on-time delivery, every single time.',
      missionParagraph2:
        'We do this by employing and training our own engineers rather than sub-contracting, by dealing only in world-class pioneer brands, and by assigning a dedicated service manager to every discipline we install — so support never falls through the cracks.',
      padding: 'md',
    },
    render: function ConstructionMissionVisionRender({
      variant,
      visionHeading: visionHeadingProp,
      visionParagraph1: visionParagraph1Prop,
      visionParagraph2: visionParagraph2Prop,
      missionHeading: missionHeadingProp,
      missionParagraph1: missionParagraph1Prop,
      missionParagraph2: missionParagraph2Prop,
      padding,
    }) {
      // Vision/Mission copy is simple website text, managed through
      // Settings → Fields (/admin/settings/view/website-content) once it has
      // a value there — these props are only the fallback for an install
      // that hasn't set those fields yet.
      const sf = useSettingsFieldValues([
        'vision-heading',
        'vision-paragraph-1',
        'vision-paragraph-2',
        'mission-heading',
        'mission-paragraph-1',
        'mission-paragraph-2',
      ])
      const visionHeading = sf['vision-heading'] || visionHeadingProp
      const visionParagraph1 = sf['vision-paragraph-1'] || visionParagraph1Prop
      const visionParagraph2 = sf['vision-paragraph-2'] || visionParagraph2Prop
      const missionHeading = sf['mission-heading'] || missionHeadingProp
      const missionParagraph1 = sf['mission-paragraph-1'] || missionParagraph1Prop
      const missionParagraph2 = sf['mission-paragraph-2'] || missionParagraph2Prop

      if (variant === '2') {
        return (
          <section className={`${padY[padding]} bg-white`}>
            <div className={wrap}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
                    <Eye className="h-7 w-7 text-orange-600" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{visionHeading}</h3>
                  <p className="mt-3 text-sm text-slate-600">{visionParagraph1}</p>
                  <p className="mt-2 text-sm text-slate-600">{visionParagraph2}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
                    <Rocket className="h-7 w-7 text-orange-600" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{missionHeading}</h3>
                  <p className="mt-3 text-sm text-slate-600">{missionParagraph1}</p>
                  <p className="mt-2 text-sm text-slate-600">{missionParagraph2}</p>
                </div>
              </div>
            </div>
          </section>
        )
      }

      if (variant === '3') {
        return (
          <section className={`${padY[padding]} bg-white`}>
            <div className={`${wrap} mx-auto flex max-w-3xl flex-col gap-12`}>
              <div className="text-center">
                <div className="mb-3 flex items-center justify-center gap-2 text-orange-600">
                  <Eye className="h-5 w-5" strokeWidth={1.75} />
                  <span className="text-xs font-bold uppercase tracking-wide">Our Vision</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 md:text-2xl">{visionHeading}</h3>
                <p className="mx-auto mt-4 max-w-xl text-slate-600">{visionParagraph1}</p>
                <p className="mx-auto mt-3 max-w-xl text-slate-600">{visionParagraph2}</p>
              </div>
              <div className="text-center">
                <div className="mb-3 flex items-center justify-center gap-2 text-orange-600">
                  <Rocket className="h-5 w-5" strokeWidth={1.75} />
                  <span className="text-xs font-bold uppercase tracking-wide">Our Mission</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 md:text-2xl">{missionHeading}</h3>
                <p className="mx-auto mt-4 max-w-xl text-slate-600">{missionParagraph1}</p>
                <p className="mx-auto mt-3 max-w-xl text-slate-600">{missionParagraph2}</p>
              </div>
            </div>
          </section>
        )
      }

      if (variant === '4') {
        return (
          <section className={`${padY[padding]} bg-slate-900 text-white`}>
            <div className={wrap}>
              <div className="grid grid-cols-1 divide-y divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
                <div className="pb-8 pr-0 md:pb-0 md:pr-10">
                  <Eye className="h-8 w-8 text-orange-400" strokeWidth={1.5} />
                  <h3 className="mt-4 text-xl font-bold md:text-2xl">{visionHeading}</h3>
                  <p className="mt-4 text-white/70">{visionParagraph1}</p>
                  <p className="mt-3 text-white/70">{visionParagraph2}</p>
                </div>
                <div className="pl-0 pt-8 md:pl-10 md:pt-0">
                  <Rocket className="h-8 w-8 text-orange-400" strokeWidth={1.5} />
                  <h3 className="mt-4 text-xl font-bold md:text-2xl">{missionHeading}</h3>
                  <p className="mt-4 text-white/70">{missionParagraph1}</p>
                  <p className="mt-3 text-white/70">{missionParagraph2}</p>
                </div>
              </div>
            </div>
          </section>
        )
      }

      // Design 1 — reference clone (about.html Mission & Vision cards)
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={`${wrap} flex flex-col gap-10`}>
            <div className="grid grid-cols-1 items-center gap-8 rounded-2xl bg-slate-50 p-8 md:grid-cols-[1fr_180px] md:p-12">
              <div>
                <h3 className="text-xl font-bold text-slate-900 md:text-2xl">{visionHeading}</h3>
                <p className="mt-4 text-slate-600">{visionParagraph1}</p>
                <p className="mt-3 text-slate-600">{visionParagraph2}</p>
              </div>
              <div className="mx-auto flex h-36 w-36 flex-col items-center justify-center gap-2 rounded-full border-2 border-orange-200 bg-white text-center">
                <Eye className="h-7 w-7 text-orange-600" strokeWidth={1.75} />
                <span className="text-xs font-bold text-slate-700">Our Vision</span>
              </div>
            </div>
            <div className="grid grid-cols-1 items-center gap-8 rounded-2xl bg-slate-50 p-8 md:grid-cols-[180px_1fr] md:p-12">
              <div className="order-2 mx-auto flex h-36 w-36 flex-col items-center justify-center gap-2 rounded-full border-2 border-orange-200 bg-white text-center md:order-1">
                <Rocket className="h-7 w-7 text-orange-600" strokeWidth={1.75} />
                <span className="text-xs font-bold text-slate-700">Our Mission</span>
              </div>
              <div className="order-1 md:order-2">
                <h3 className="text-xl font-bold text-slate-900 md:text-2xl">{missionHeading}</h3>
                <p className="mt-4 text-slate-600">{missionParagraph1}</p>
                <p className="mt-3 text-slate-600">{missionParagraph2}</p>
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // ── Video showcase ─────────────────────────────────────────────────────────
  ConstructionVideo: {
    label: 'Video',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      thumbnail: { type: 'text' },
      videoUrl: { type: 'text' },
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
      sectionTitle: 'See Us in Action',
      sectionSubtitle: 'A walkthrough of our current build sites and how we work.',
      thumbnail:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1280&h=720&fit=crop&auto=format',
      videoUrl: '',
      padding: 'md',
    },
    render: ({ sectionTitle, sectionSubtitle, thumbnail, padding }) => (
      <section className={`${padY[padding]} bg-slate-50`}>
        <div className={wrap}>
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
            {sectionSubtitle && (
              <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
            )}
          </div>
          <div className="relative max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-lg aspect-video bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-20 h-20 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
                  <path d="M0 0L26 15L0 30V0Z" fill="#ea580c" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </section>
    ),
  },

  ConstructionVideoGrid: {
    label: 'Video Grid',
    fields: {
      heading: { type: 'text' },
      video1Thumbnail: imageField('Thumbnail'),
      video1Title: { type: 'text' },
      video1Duration: { type: 'text' },
      video2Thumbnail: imageField('Thumbnail'),
      video2Title: { type: 'text' },
      video2Duration: { type: 'text' },
      video3Thumbnail: imageField('Thumbnail'),
      video3Title: { type: 'text' },
      video3Duration: { type: 'text' },
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
      heading: 'Watch Our Work',
      video1Thumbnail:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=640&h=360&fit=crop&auto=format',
      video1Title: 'Site Walkthrough: Riverside Villas',
      video1Duration: '3:42',
      video2Thumbnail:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=640&h=360&fit=crop&auto=format',
      video2Title: 'Safety Training on Site',
      video2Duration: '5:10',
      video3Thumbnail:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=640&h=360&fit=crop&auto=format',
      video3Title: 'Client Testimonial: Riverside Villas',
      video3Duration: '2:15',
      padding: 'md',
      background: 'white',
    },
    render: ({
      heading,
      video1Thumbnail,
      video1Title,
      video1Duration,
      video2Thumbnail,
      video2Title,
      video2Duration,
      video3Thumbnail,
      video3Title,
      video3Duration,
      padding,
      background,
    }) => {
      const videos = [
        { thumbnail: video1Thumbnail, title: video1Title, duration: video1Duration },
        { thumbnail: video2Thumbnail, title: video2Title, duration: video2Duration },
        { thumbnail: video3Thumbnail, title: video3Title, duration: video3Duration },
      ].filter((v) => v.thumbnail)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {heading}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {videos.map((v, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden border border-slate-200 bg-white"
                >
                  <div className="relative aspect-video bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.thumbnail}
                      alt=""
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                        <svg width="16" height="18" viewBox="0 0 26 30" fill="none">
                          <path d="M0 0L26 15L0 30V0Z" fill="#ea580c" />
                        </svg>
                      </span>
                    </div>
                    {v.duration && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">
                        {v.duration}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-slate-900 text-sm">{v.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  ConstructionVideoSplitStats: {
    label: 'Video + Stats Split',
    fields: {
      thumbnail: imageField('Thumbnail'),
      videoUrl: { type: 'text' },
      heading: { type: 'text' },
      stat1Value: { type: 'text' },
      stat1Label: { type: 'text' },
      stat2Value: { type: 'text' },
      stat2Label: { type: 'text' },
      stat3Value: { type: 'text' },
      stat3Label: { type: 'text' },
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
      thumbnail:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=960&h=720&fit=crop&auto=format',
      videoUrl: '',
      heading: 'Why Watch This Video',
      stat1Value: '500+',
      stat1Label: 'Projects Shown',
      stat2Value: '15 min',
      stat2Label: 'Full Walkthrough',
      stat3Value: '4K',
      stat3Label: 'Site Footage Quality',
      padding: 'md',
      background: 'white',
    },
    render: ({
      thumbnail,
      heading,
      stat1Value,
      stat1Label,
      stat2Value,
      stat2Label,
      stat3Value,
      stat3Label,
      padding,
      background,
    }) => {
      const stats = [
        { value: stat1Value, label: stat1Label },
        { value: stat2Value, label: stat2Label },
        { value: stat3Value, label: stat3Label },
      ].filter((s) => s.value)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={`${wrap} grid grid-cols-1 md:grid-cols-2 gap-10 items-center`}>
            <div className="relative rounded-2xl overflow-hidden shadow-lg aspect-video bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                  <svg width="20" height="23" viewBox="0 0 26 30" fill="none">
                    <path d="M0 0L26 15L0 30V0Z" fill="#ea580c" />
                  </svg>
                </span>
              </div>
            </div>
            <div>
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-8">{heading}</h2>
              <div className="grid grid-cols-3 gap-4">
                {stats.map((s, i) => (
                  <div key={i}>
                    <p className="text-2xl md:text-3xl font-bold text-orange-600">{s.value}</p>
                    <p className="text-xs md:text-sm text-slate-600 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  ConstructionVideoReel: {
    label: 'Video Reel',
    fields: {
      thumbnail: imageField('Thumbnail'),
      videoUrl: { type: 'text' },
      caption: { type: 'text' },
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
      thumbnail:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=540&h=960&fit=crop&auto=format',
      videoUrl: '',
      caption: 'A day on site with our engineering team',
      padding: 'md',
      background: 'white',
    },
    render: ({ thumbnail, caption, padding, background }) => (
      <section
        className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
      >
        <div className={wrap}>
          <div className="relative mx-auto max-w-xs rounded-2xl overflow-hidden shadow-lg aspect-[9/16] bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                <svg width="18" height="21" viewBox="0 0 26 30" fill="none">
                  <path d="M0 0L26 15L0 30V0Z" fill="#ea580c" />
                </svg>
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
              <p className="text-white text-sm font-medium">{caption}</p>
            </div>
          </div>
        </div>
      </section>
    ),
  },

  // ── Blog / news posts ───────────────────────────────────────────────────────
  ConstructionBlogPosts: {
    label: 'Blog Posts',
    fields: {
      sectionTitle: { type: 'text' },
      post1Image: { type: 'text' },
      post1Category: { type: 'text' },
      post1Title: { type: 'text' },
      post1Date: { type: 'text' },
      post2Image: { type: 'text' },
      post2Category: { type: 'text' },
      post2Title: { type: 'text' },
      post2Date: { type: 'text' },
      post3Image: { type: 'text' },
      post3Category: { type: 'text' },
      post3Title: { type: 'text' },
      post3Date: { type: 'text' },
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
      sectionTitle: 'Latest From the Site',
      post1Image:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=480&h=300&fit=crop&auto=format',
      post1Category: 'Project Update',
      post1Title: 'Riverside Villas reaches structural completion',
      post1Date: 'Mar 12, 2026',
      post2Image:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=480&h=300&fit=crop&auto=format',
      post2Category: 'Safety',
      post2Title: 'How we hit 400 days without a lost-time incident',
      post2Date: 'Feb 28, 2026',
      post3Image:
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?w=480&h=300&fit=crop&auto=format',
      post3Category: 'Company News',
      post3Title: 'We are hiring: site engineers and project managers',
      post3Date: 'Feb 10, 2026',
      padding: 'md',
    },
    render: ({
      sectionTitle,
      post1Image,
      post1Category,
      post1Title,
      post1Date,
      post2Image,
      post2Category,
      post2Title,
      post2Date,
      post3Image,
      post3Category,
      post3Title,
      post3Date,
      padding,
    }) => {
      const posts = [
        { image: post1Image, category: post1Category, title: post1Title, date: post1Date },
        { image: post2Image, category: post2Category, title: post2Title, date: post2Date },
        { image: post3Image, category: post3Category, title: post3Title, date: post3Date },
      ]
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map((post, i) => (
                <article
                  key={i}
                  className="rounded-xl overflow-hidden border border-slate-200 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image}
                    alt=""
                    className="w-full aspect-[16/10] object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="p-5">
                    <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
                      {post.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5 mb-2 leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-xs text-slate-500">{post.date}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // ── Compact news ticker list ────────────────────────────────────────────────
  ConstructionNewsTicker: {
    label: 'News Ticker',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      news1Headline: { type: 'text' },
      news1Date: { type: 'text' },
      news2Headline: { type: 'text' },
      news2Date: { type: 'text' },
      news3Headline: { type: 'text' },
      news3Date: { type: 'text' },
      news4Headline: { type: 'text' },
      news4Date: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      eyebrow: 'Latest News',
      heading: 'From the Newsroom',
      news1Headline: 'Riverside Villas handed over three weeks ahead of schedule',
      news1Date: 'Mar 18, 2026',
      news2Headline: 'Subhadra Group wins Regional Contractor of the Year',
      news2Date: 'Feb 22, 2026',
      news3Headline: 'New Vijayawada office opens to serve growing project pipeline',
      news3Date: 'Jan 30, 2026',
      news4Headline: 'Crossed 500 residential units delivered across Andhra Pradesh',
      news4Date: 'Jan 05, 2026',
      padding: 'md',
      background: 'white',
    },
    render: ({
      eyebrow,
      heading,
      news1Headline,
      news1Date,
      news2Headline,
      news2Date,
      news3Headline,
      news3Date,
      news4Headline,
      news4Date,
      padding,
      background,
    }) => {
      const items = [
        { headline: news1Headline, date: news1Date },
        { headline: news2Headline, date: news2Date },
        { headline: news3Headline, date: news3Date },
        { headline: news4Headline, date: news4Date },
      ].filter((n) => n.headline)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={`${wrap} max-w-3xl`}>
            {eyebrow && (
              <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                {eyebrow}
              </p>
            )}
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-8">{heading}</h2>
            <div className="divide-y divide-slate-200">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between items-baseline gap-4 py-3">
                  <span className="font-medium text-slate-900">{item.headline}</span>
                  <span className="text-sm text-slate-500 shrink-0">{item.date}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // ── Case-study result cards ─────────────────────────────────────────────────
  ConstructionCaseStudyGrid: {
    label: 'Case Study Grid',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      case1Image: imageField('Image'),
      case1Client: { type: 'text' },
      case1Stat: { type: 'text' },
      case1Description: { type: 'textarea' },
      case1LinkLabel: { type: 'text' },
      case1LinkHref: { type: 'text' },
      case2Image: imageField('Image'),
      case2Client: { type: 'text' },
      case2Stat: { type: 'text' },
      case2Description: { type: 'textarea' },
      case2LinkLabel: { type: 'text' },
      case2LinkHref: { type: 'text' },
      case3Image: imageField('Image'),
      case3Client: { type: 'text' },
      case3Stat: { type: 'text' },
      case3Description: { type: 'textarea' },
      case3LinkLabel: { type: 'text' },
      case3LinkHref: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      eyebrow: 'Case Studies',
      heading: 'Results Our Clients Can Measure',
      case1Image:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=480&h=320&fit=crop&auto=format',
      case1Client: 'Riverside Villas',
      case1Stat: '40% faster completion',
      case1Description:
        'A 48-unit residential build delivered ahead of schedule with zero safety incidents.',
      case1LinkLabel: 'View Case Study',
      case1LinkHref: '#',
      case2Image:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=480&h=320&fit=crop&auto=format',
      case2Client: 'Coastal Business Park',
      case2Stat: '₹1.2Cr saved on MEP',
      case2Description:
        'Redesigned MEP coordination cut material waste and rework across three towers.',
      case2LinkLabel: 'View Case Study',
      case2LinkHref: '#',
      case3Image:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=480&h=320&fit=crop&auto=format',
      case3Client: 'Greenfield Logistics Hub',
      case3Stat: '18-month turnaround',
      case3Description:
        'Full site development and warehouse fit-out handed over in a single dry season.',
      case3LinkLabel: 'View Case Study',
      case3LinkHref: '#',
      padding: 'md',
      background: 'white',
    },
    render: ({
      eyebrow,
      heading,
      case1Image,
      case1Client,
      case1Stat,
      case1Description,
      case1LinkLabel,
      case1LinkHref,
      case2Image,
      case2Client,
      case2Stat,
      case2Description,
      case2LinkLabel,
      case2LinkHref,
      case3Image,
      case3Client,
      case3Stat,
      case3Description,
      case3LinkLabel,
      case3LinkHref,
      padding,
      background,
    }) => {
      const cases = [
        {
          image: case1Image,
          client: case1Client,
          stat: case1Stat,
          description: case1Description,
          linkLabel: case1LinkLabel,
          linkHref: case1LinkHref,
        },
        {
          image: case2Image,
          client: case2Client,
          stat: case2Stat,
          description: case2Description,
          linkLabel: case2LinkLabel,
          linkHref: case2LinkHref,
        },
        {
          image: case3Image,
          client: case3Client,
          stat: case3Stat,
          description: case3Description,
          linkLabel: case3LinkLabel,
          linkHref: case3LinkHref,
        },
      ].filter((c) => c.client)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-12">
              {eyebrow && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900">{heading}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cases.map((c, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image} alt={c.client} className="w-full aspect-[3/2] object-cover" />
                  <div className="p-5">
                    <p className="text-lg font-bold text-orange-600 mb-2">{c.stat}</p>
                    <p className="font-semibold text-slate-900">{c.client}</p>
                    <p className="text-sm text-slate-600 leading-relaxed mt-1 mb-4">
                      {c.description}
                    </p>
                    {c.linkLabel && (
                      <a
                        href={c.linkHref}
                        className="inline-flex items-center gap-1 text-orange-600 font-semibold text-sm hover:gap-2 transition-all"
                      >
                        {c.linkLabel} <span aria-hidden="true">→</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // ── Social media strip ──────────────────────────────────────────────────────
  ConstructionSocialMedia: {
    label: 'Social Media',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'text' },
      facebookHandle: { type: 'text' },
      instagramHandle: { type: 'text' },
      linkedinHandle: { type: 'text' },
      twitterHandle: { type: 'text' },
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
      sectionTitle: 'Follow Our Progress',
      sectionSubtitle: '@yourcompany',
      facebookHandle: 'facebook.com/yourcompany',
      instagramHandle: 'instagram.com/yourcompany',
      linkedinHandle: 'linkedin.com/company/yourcompany',
      twitterHandle: 'x.com/yourcompany',
      padding: 'sm',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      facebookHandle,
      instagramHandle,
      linkedinHandle,
      twitterHandle,
      padding,
    }) => {
      const links = [
        ['f', facebookHandle],
        ['ig', instagramHandle],
        ['in', linkedinHandle],
        ['X', twitterHandle],
      ].filter(([, href]) => href)
      return (
        <section className={`${padY[padding]} bg-slate-900`}>
          <div className={`${wrap} flex flex-col sm:flex-row items-center justify-between gap-6`}>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">{sectionTitle}</h2>
              {sectionSubtitle && <p className="text-sm text-white/50 mt-1">{sectionSubtitle}</p>}
            </div>
            <div className="flex gap-3">
              {links.map(([label, href], i) => (
                <a
                  key={i}
                  href={href ? `https://${href}` : '#'}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-orange-600 text-white flex items-center justify-center font-semibold text-sm transition"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  ConstructionSocialFeedGrid: {
    label: 'Social Feed Grid',
    fields: {
      heading: { type: 'text' },
      post1Image: imageField('Image'),
      post1Caption: { type: 'text' },
      post1Platform: {
        type: 'select',
        options: [
          { label: 'Instagram', value: 'instagram' },
          { label: 'Facebook', value: 'facebook' },
          { label: 'LinkedIn', value: 'linkedin' },
          { label: 'YouTube', value: 'youtube' },
        ],
      },
      post2Image: imageField('Image'),
      post2Caption: { type: 'text' },
      post2Platform: {
        type: 'select',
        options: [
          { label: 'Instagram', value: 'instagram' },
          { label: 'Facebook', value: 'facebook' },
          { label: 'LinkedIn', value: 'linkedin' },
          { label: 'YouTube', value: 'youtube' },
        ],
      },
      post3Image: imageField('Image'),
      post3Caption: { type: 'text' },
      post3Platform: {
        type: 'select',
        options: [
          { label: 'Instagram', value: 'instagram' },
          { label: 'Facebook', value: 'facebook' },
          { label: 'LinkedIn', value: 'linkedin' },
          { label: 'YouTube', value: 'youtube' },
        ],
      },
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
      heading: 'From Our Feed',
      post1Image:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=500&h=500&fit=crop&auto=format',
      post1Caption: 'Foundation pour complete at our Vijayawada twin-tower site 🏗️',
      post1Platform: 'instagram',
      post2Image:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&h=500&fit=crop&auto=format',
      post2Caption: 'Safety briefing before today’s crane lift.',
      post2Platform: 'facebook',
      post3Image:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=500&h=500&fit=crop&auto=format',
      post3Caption: 'Behind the scenes: our MEP coordination walkthrough.',
      post3Platform: 'linkedin',
      padding: 'md',
      background: 'white',
    },
    render: ({
      heading,
      post1Image,
      post1Caption,
      post1Platform,
      post2Image,
      post2Caption,
      post2Platform,
      post3Image,
      post3Caption,
      post3Platform,
      padding,
      background,
    }) => {
      const posts = [
        { image: post1Image, caption: post1Caption, platform: post1Platform },
        { image: post2Image, caption: post2Caption, platform: post2Platform },
        { image: post3Image, caption: post3Caption, platform: post3Platform },
      ].filter((p) => p.image)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {heading}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map((p, i) => {
                const badge = socialPlatformBadge[p.platform]
                return (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden border border-slate-200 bg-white"
                  >
                    <div className="relative aspect-square bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt="" className="w-full h-full object-cover" />
                      {badge && (
                        <span
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-slate-700">{p.caption}</p>
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

  ConstructionSocialFollowBanner: {
    label: 'Social Follow Banner',
    fields: {
      heading: { type: 'text' },
      followerCount: { type: 'text' },
      followerLabel: { type: 'text' },
      facebookHandle: { type: 'text' },
      instagramHandle: { type: 'text' },
      linkedinHandle: { type: 'text' },
      twitterHandle: { type: 'text' },
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
      heading: 'Follow Our Journey',
      followerCount: '25K+',
      followerLabel: 'Followers across platforms',
      facebookHandle: 'facebook.com/subhadragroup',
      instagramHandle: 'instagram.com/subhadragroup',
      linkedinHandle: 'linkedin.com/company/subhadragroup',
      twitterHandle: 'x.com/subhadragroup',
      padding: 'md',
    },
    render: ({
      heading,
      followerCount,
      followerLabel,
      facebookHandle,
      instagramHandle,
      linkedinHandle,
      twitterHandle,
      padding,
    }) => {
      const links = [
        ['f', facebookHandle],
        ['ig', instagramHandle],
        ['in', linkedinHandle],
        ['X', twitterHandle],
      ].filter(([, href]) => href)
      return (
        <section className={`${padY[padding]} bg-orange-500`}>
          <div className={`${wrap} flex flex-col sm:flex-row items-center justify-between gap-8`}>
            <div className="text-center sm:text-left">
              <h2 className="text-2xl md:text-3xl font-bold text-white">{heading}</h2>
              <p className="mt-1 text-lg font-semibold text-white/90">
                {followerCount}{' '}
                <span className="text-sm font-normal text-white/70">{followerLabel}</span>
              </p>
            </div>
            <div className="flex gap-3">
              {links.map(([label, href], i) => (
                <a
                  key={i}
                  href={href ? `https://${href}` : '#'}
                  className="w-14 h-14 rounded-full bg-white text-orange-600 flex items-center justify-center font-bold text-base shadow-lg hover:bg-slate-900 hover:text-white transition"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  ConstructionSocialVideoHighlights: {
    label: 'Social Video Highlights',
    fields: {
      heading: { type: 'text' },
      highlight1Thumbnail: imageField('Thumbnail'),
      highlight1Platform: {
        type: 'select',
        options: [
          { label: 'Instagram', value: 'instagram' },
          { label: 'Facebook', value: 'facebook' },
          { label: 'LinkedIn', value: 'linkedin' },
          { label: 'YouTube', value: 'youtube' },
        ],
      },
      highlight1Caption: { type: 'text' },
      highlight2Thumbnail: imageField('Thumbnail'),
      highlight2Platform: {
        type: 'select',
        options: [
          { label: 'Instagram', value: 'instagram' },
          { label: 'Facebook', value: 'facebook' },
          { label: 'LinkedIn', value: 'linkedin' },
          { label: 'YouTube', value: 'youtube' },
        ],
      },
      highlight2Caption: { type: 'text' },
      highlight3Thumbnail: imageField('Thumbnail'),
      highlight3Platform: {
        type: 'select',
        options: [
          { label: 'Instagram', value: 'instagram' },
          { label: 'Facebook', value: 'facebook' },
          { label: 'LinkedIn', value: 'linkedin' },
          { label: 'YouTube', value: 'youtube' },
        ],
      },
      highlight3Caption: { type: 'text' },
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
      heading: 'Reels & Highlights',
      highlight1Thumbnail:
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&h=700&fit=crop&auto=format',
      highlight1Platform: 'youtube',
      highlight1Caption: 'Site walkthrough: Riverside Villas, week 12',
      highlight2Thumbnail:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=700&fit=crop&auto=format',
      highlight2Platform: 'instagram',
      highlight2Caption: 'Meet the team behind our MEP crew',
      highlight3Thumbnail:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=700&fit=crop&auto=format',
      highlight3Platform: 'facebook',
      highlight3Caption: 'Client shoutout: on-time handover in Vijayawada',
      padding: 'md',
      background: 'white',
    },
    render: ({
      heading,
      highlight1Thumbnail,
      highlight1Platform,
      highlight1Caption,
      highlight2Thumbnail,
      highlight2Platform,
      highlight2Caption,
      highlight3Thumbnail,
      highlight3Platform,
      highlight3Caption,
      padding,
      background,
    }) => {
      const highlights = [
        {
          thumbnail: highlight1Thumbnail,
          platform: highlight1Platform,
          caption: highlight1Caption,
        },
        {
          thumbnail: highlight2Thumbnail,
          platform: highlight2Platform,
          caption: highlight2Caption,
        },
        {
          thumbnail: highlight3Thumbnail,
          platform: highlight3Platform,
          caption: highlight3Caption,
        },
      ].filter((h) => h.thumbnail)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {heading}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {highlights.map((h, i) => {
                const badge = socialPlatformBadge[h.platform]
                return (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden border border-slate-200 bg-white"
                  >
                    <div className="relative aspect-[9/16] bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={h.thumbnail}
                        alt=""
                        className="w-full h-full object-cover opacity-80"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                          <svg width="14" height="16" viewBox="0 0 26 30" fill="none">
                            <path d="M0 0L26 15L0 30V0Z" fill="#ea580c" />
                          </svg>
                        </span>
                      </div>
                      {badge && (
                        <span
                          className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-slate-700">{h.caption}</p>
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

  // ── Standalone FAQ accordion ────────────────────────────────────────────────
  ConstructionFAQ: {
    label: 'FAQ',
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
      sectionTitle: 'Frequently Asked Questions',
      faq1Question: 'How long does a typical project take?',
      faq1Answer:
        'Most residential projects run 4-8 months from groundbreaking to handover, depending on scope. We share a detailed schedule before work begins.',
      faq2Question: 'Do you provide fixed-price contracts?',
      faq2Answer: 'Yes, most projects are quoted and contracted on a fixed-price basis.',
      faq3Question: 'Are you licensed and insured?',
      faq3Answer: 'Yes, we are fully licensed and carry comprehensive insurance cover.',
      faq4Question: 'Can I make changes once construction starts?',
      faq4Answer:
        'Minor changes are usually possible — we log every change order with its cost and schedule impact before proceeding.',
      padding: 'md',
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
      padding,
    }) => {
      const items = [
        { q: faq1Question, a: faq1Answer },
        { q: faq2Question, a: faq2Answer },
        { q: faq3Question, a: faq3Answer },
        { q: faq4Question, a: faq4Answer },
      ].filter((f) => f.q)
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={`${wrap} max-w-3xl`}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="flex flex-col gap-3">
              {items.map((item, i) => (
                <details
                  key={i}
                  className="rounded-xl border border-slate-200 p-5 group"
                  {...(i === 0 ? { open: true } : {})}
                >
                  <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-orange-600 group-open:rotate-45 transition shrink-0">
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-slate-600 leading-relaxed mt-3">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // FAQ grouped into 2 labeled categories, 3 Q/A pairs each — same static
  // <details> convention as ConstructionFAQ (first item per category open).
  ConstructionFAQAccordionCategories: {
    label: 'FAQ Accordion Categories',
    fields: {
      sectionTitle: { type: 'text' },
      category1Label: { type: 'text' },
      category1Faq1Question: { type: 'text' },
      category1Faq1Answer: { type: 'textarea' },
      category1Faq2Question: { type: 'text' },
      category1Faq2Answer: { type: 'textarea' },
      category1Faq3Question: { type: 'text' },
      category1Faq3Answer: { type: 'textarea' },
      category2Label: { type: 'text' },
      category2Faq1Question: { type: 'text' },
      category2Faq1Answer: { type: 'textarea' },
      category2Faq2Question: { type: 'text' },
      category2Faq2Answer: { type: 'textarea' },
      category2Faq3Question: { type: 'text' },
      category2Faq3Answer: { type: 'textarea' },
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
      sectionTitle: 'Frequently Asked Questions',
      category1Label: 'Pricing',
      category1Faq1Question: 'How do you put together a cost estimate?',
      category1Faq1Answer:
        'We walk the site, review drawings, and return a itemized estimate covering labor, materials, and permits within a few business days.',
      category1Faq2Question: 'What are your payment terms?',
      category1Faq2Answer:
        'Payments are milestone-based — a deposit to start, then draws tied to completed phases, with a final payment on handover.',
      category1Faq3Question: 'Are there ever hidden fees?',
      category1Faq3Answer:
        'No. Any cost outside the original scope is documented as a change order and approved by you before we proceed.',
      category2Label: 'Process',
      category2Faq1Question: 'What is the typical project timeline?',
      category2Faq1Answer:
        'Most projects run 4-8 months from groundbreaking to handover, depending on scope and site conditions.',
      category2Faq2Question: 'Who handles permits and approvals?',
      category2Faq2Answer:
        'We manage the full permitting process, from application through inspections, so you don’t have to deal with the paperwork.',
      category2Faq3Question: 'How often will you visit the site?',
      category2Faq3Answer:
        'Our site supervisor visits daily during active construction, with the project manager checking in weekly with progress photos.',
      padding: 'md',
    },
    render: ({
      sectionTitle,
      category1Label,
      category1Faq1Question,
      category1Faq1Answer,
      category1Faq2Question,
      category1Faq2Answer,
      category1Faq3Question,
      category1Faq3Answer,
      category2Label,
      category2Faq1Question,
      category2Faq1Answer,
      category2Faq2Question,
      category2Faq2Answer,
      category2Faq3Question,
      category2Faq3Answer,
      padding,
    }) => {
      const categories = [
        {
          label: category1Label,
          items: [
            { q: category1Faq1Question, a: category1Faq1Answer },
            { q: category1Faq2Question, a: category1Faq2Answer },
            { q: category1Faq3Question, a: category1Faq3Answer },
          ].filter((f) => f.q),
        },
        {
          label: category2Label,
          items: [
            { q: category2Faq1Question, a: category2Faq1Answer },
            { q: category2Faq2Question, a: category2Faq2Answer },
            { q: category2Faq3Question, a: category2Faq3Answer },
          ].filter((f) => f.q),
        },
      ].filter((c) => c.items.length > 0)
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="grid md:grid-cols-2 gap-10">
              {categories.map((cat, ci) => (
                <div key={ci}>
                  <h3 className="text-lg font-semibold text-orange-600 mb-4">{cat.label}</h3>
                  <div className="flex flex-col gap-3">
                    {cat.items.map((item, i) => (
                      <details
                        key={i}
                        className="rounded-xl border border-slate-200 p-5 group"
                        {...(i === 0 ? { open: true } : {})}
                      >
                        <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between gap-4">
                          {item.q}
                          <span className="text-orange-600 group-open:rotate-45 transition shrink-0">
                            +
                          </span>
                        </summary>
                        <p className="text-sm text-slate-600 leading-relaxed mt-3">{item.a}</p>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 6 Q/A pairs laid out two columns (3 per column) — denser than the
  // flat-4 ConstructionFAQ. Same static <details> convention.
  ConstructionFAQTwoColumn: {
    label: 'FAQ Two Column',
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
      sectionTitle: 'Frequently Asked Questions',
      faq1Question: 'How long does a typical project take?',
      faq1Answer:
        'Most residential projects run 4-8 months from groundbreaking to handover, depending on scope.',
      faq2Question: 'Do you provide fixed-price contracts?',
      faq2Answer: 'Yes, most projects are quoted and contracted on a fixed-price basis.',
      faq3Question: 'Are you licensed and insured?',
      faq3Answer: 'Yes, we are fully licensed and carry comprehensive insurance cover.',
      faq4Question: 'Can I make changes once construction starts?',
      faq4Answer:
        'Minor changes are usually possible — we log every change order with its cost and schedule impact before proceeding.',
      faq5Question: 'Do you handle permits and inspections?',
      faq5Answer: 'Yes, we manage the full permitting process and coordinate every inspection.',
      faq6Question: 'What happens if the weather delays work?',
      faq6Answer:
        'Weather days are built into the schedule; if a delay is significant we notify you and adjust the timeline together.',
      padding: 'md',
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
      padding,
    }) => {
      const columns = [
        [
          { q: faq1Question, a: faq1Answer },
          { q: faq2Question, a: faq2Answer },
          { q: faq3Question, a: faq3Answer },
        ].filter((f) => f.q),
        [
          { q: faq4Question, a: faq4Answer },
          { q: faq5Question, a: faq5Answer },
          { q: faq6Question, a: faq6Answer },
        ].filter((f) => f.q),
      ]
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-3">
                  {col.map((item, i) => (
                    <details
                      key={i}
                      className="rounded-xl border border-slate-200 p-5 group"
                      {...(ci === 0 && i === 0 ? { open: true } : {})}
                    >
                      <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between gap-4">
                        {item.q}
                        <span className="text-orange-600 group-open:rotate-45 transition shrink-0">
                          +
                        </span>
                      </summary>
                      <p className="text-sm text-slate-600 leading-relaxed mt-3">{item.a}</p>
                    </details>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 3 Q/A pairs beside a "still have questions?" contact CTA panel.
  ConstructionFAQWithContact: {
    label: 'FAQ with Contact',
    fields: {
      sectionTitle: { type: 'text' },
      faq1Question: { type: 'text' },
      faq1Answer: { type: 'textarea' },
      faq2Question: { type: 'text' },
      faq2Answer: { type: 'textarea' },
      faq3Question: { type: 'text' },
      faq3Answer: { type: 'textarea' },
      contactHeading: { type: 'text' },
      contactCtaLabel: { type: 'text' },
      contactCtaHref: { type: 'text' },
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
      sectionTitle: 'Frequently Asked Questions',
      faq1Question: 'How long does a typical project take?',
      faq1Answer:
        'Most residential projects run 4-8 months from groundbreaking to handover, depending on scope.',
      faq2Question: 'Do you provide fixed-price contracts?',
      faq2Answer: 'Yes, most projects are quoted and contracted on a fixed-price basis.',
      faq3Question: 'Are you licensed and insured?',
      faq3Answer: 'Yes, we are fully licensed and carry comprehensive insurance cover.',
      contactHeading: 'Still have questions?',
      contactCtaLabel: 'Talk to Us',
      contactCtaHref: '#contact',
      padding: 'md',
    },
    render: ({
      sectionTitle,
      faq1Question,
      faq1Answer,
      faq2Question,
      faq2Answer,
      faq3Question,
      faq3Answer,
      contactHeading,
      contactCtaLabel,
      contactCtaHref,
      padding,
    }) => {
      const items = [
        { q: faq1Question, a: faq1Answer },
        { q: faq2Question, a: faq2Answer },
        { q: faq3Question, a: faq3Answer },
      ].filter((f) => f.q)
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="grid md:grid-cols-3 gap-8 items-start">
              <div className="md:col-span-2 flex flex-col gap-3">
                {items.map((item, i) => (
                  <details
                    key={i}
                    className="rounded-xl border border-slate-200 p-5 group"
                    {...(i === 0 ? { open: true } : {})}
                  >
                    <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between gap-4">
                      {item.q}
                      <span className="text-orange-600 group-open:rotate-45 transition shrink-0">
                        +
                      </span>
                    </summary>
                    <p className="text-sm text-slate-600 leading-relaxed mt-3">{item.a}</p>
                  </details>
                ))}
              </div>
              <div className="rounded-xl bg-slate-900 p-8 text-center">
                <h3 className="text-xl font-semibold text-white mb-4">{contactHeading}</h3>
                <a
                  href={contactCtaHref}
                  className="inline-block rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-500 transition"
                >
                  {contactCtaLabel}
                </a>
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Disciplines grid — 6 cards: image + title + description + brand + link
  ConstructionDisciplinesGrid: {
    label: 'Disciplines Grid',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      items: {
        type: 'array',
        min: 0,
        max: 20,
        getItemSummary: (item, index) => item.title || `Discipline ${(index ?? 0) + 1}`,
        defaultItemProps: {
          icon: 'snowflake',
          image: '',
          title: '',
          description: '',
          brands: '',
          href: '',
        },
        arrayFields: {
          icon: DISCIPLINE_ICON_FIELD,
          image: imageField('Image'),
          title: { type: 'text' },
          description: { type: 'textarea' },
          brands: { type: 'text' },
          href: { type: 'text' },
        },
      },
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
      sectionEyebrow: "What we're known for",
      sectionTitle: 'Six disciplines, engineered as one system',
      sectionSubtitle:
        'Designed, supplied, installed and maintained by one accountable team — with a dedicated service manager for every discipline.',
      items: [
        {
          icon: 'snowflake',
          image:
            'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&h=600&fit=crop&q=80&auto=format',
          title: 'Central AC',
          description:
            'Centralized air-conditioning sized, supplied and installed by our own engineers — from single rooms to full commercial buildings, backed by annual maintenance and genuine spares on call.',
          brands: 'Blue Star',
          href: '#products',
        },
        {
          icon: 'plug',
          image: '/seed/subhadra/products/mcb1.jpg',
          title: 'Electrical & Switchgear',
          description:
            'We supply complete range of Switches, Wires, MCBs, Distribution Boards, Cables, Switchgear, Panel Boards, Generators, Transformers, UPS, Stabilizers.',
          brands: 'Schneider Electric',
          href: '#products',
        },
        {
          icon: 'shield',
          image:
            'https://images.unsplash.com/photo-1643123182527-3bd30840e7ed?w=900&h=675&fit=crop&q=80&auto=format',
          title: 'Safety and Security Solutions',
          description:
            'CCTV, video analytics, access control, fire alarm, intrusion alarm and fire-fighting systems designed and installed by our own team — so every entry point is covered and safety never waits.',
          brands: 'Honeywell · Minimax · Tyco',
          href: '#products',
        },
        {
          icon: 'housegear',
          image: '/seed/subhadra/products/home-automation.jpg',
          title: 'Home Automation',
          description:
            'Lighting, AC, curtains and appliances — retrofit or centralized, all on one interface you control from anywhere, with voice control and scheduled scenes for everyday comfort.',
          brands: 'Schneider · RTI · Bticino',
          href: '#products',
        },
        {
          icon: 'tv',
          image:
            'https://images.unsplash.com/photo-1631702825172-a9a848c473ad?w=900&h=675&fit=crop&q=80&auto=format',
          title: 'Home Theater',
          description:
            'Dolby Atmos rooms, 4K projection and multiroom audio — custom-built and installed by our own team, with acoustic treatment and calibration for true cinema-grade sound.',
          brands: 'Focal · Sony · Denon',
          href: '#products',
        },
        {
          icon: 'lightbulb',
          image:
            'https://images.unsplash.com/photo-1524634126442-357e0eac3c14?w=900&h=675&fit=crop&q=80&auto=format',
          title: 'Premium Lighting',
          description:
            'Designer, architectural and smart-dimmable lighting — specified, supplied and installed to elevate every room, with layered scenes for ambience, task and accent lighting.',
          brands: 'Wipro · Crompton · Philips',
          href: '#products',
        },
      ],
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionDisciplinesGridRender({
      id,
      puck,
      sectionEyebrow,
      sectionTitle,
      sectionSubtitle,
      items,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const isEditing = puck?.isEditing ?? false
      const disciplines = (items ?? []).map((d, n) => ({ ...d, n })).filter((d) => d.title)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              {(isEditing || sectionEyebrow) && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  <InlineEditableText
                    id={id}
                    path={['sectionEyebrow']}
                    value={sectionEyebrow ?? ''}
                    isEditing={isEditing}
                  />
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">
                <InlineEditableText
                  id={id}
                  path={['sectionTitle']}
                  value={sectionTitle ?? ''}
                  isEditing={isEditing}
                />
              </h2>
              {(isEditing || sectionSubtitle) && (
                <p className="text-slate-600 max-w-2xl mx-auto">
                  <InlineEditableText
                    id={id}
                    path={['sectionSubtitle']}
                    value={sectionSubtitle ?? ''}
                    isEditing={isEditing}
                    multiline
                  />
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {disciplines.map((d, i) => {
                const Icon = ICON_BY_KEY[d.icon] ?? HardHatIcon
                return (
                  <article
                    key={i}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white hover:shadow-md transition"
                  >
                    {d.image && (
                      <div className="relative">
                        <span
                          className={`absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow ${
                            i % 2 === 0 ? 'bg-orange-500' : 'bg-slate-900'
                          }`}
                        >
                          <Icon />
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.image} alt={d.title} className="h-44 w-full object-cover" />
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-semibold text-lg text-slate-900 mb-2">
                        <InlineEditableText
                          id={id}
                          path={['items', d.n, 'title']}
                          value={d.title ?? ''}
                          isEditing={isEditing}
                        />
                      </h3>
                      {(isEditing || d.description) && (
                        <p className="text-slate-600 text-sm leading-relaxed mb-3">
                          <InlineEditableText
                            id={id}
                            path={['items', d.n, 'description']}
                            value={d.description ?? ''}
                            isEditing={isEditing}
                            multiline
                          />
                        </p>
                      )}
                      {d.href && (
                        <div className="border-t border-slate-100 pt-3 mt-1">
                          <a
                            href={d.href}
                            className="text-sm font-semibold text-orange-600 hover:text-orange-700 whitespace-nowrap"
                          >
                            Explore →
                          </a>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      )
    },
  },

  // Our Brands — 3 tabs, each a set of "heading|Brand A, Brand B" groups
  ConstructionOurBrands: {
    label: 'Our Brands (Tabbed Categories)',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      tab1Label: { type: 'text' },
      tab1Groups: { type: 'textarea' },
      tab2Label: { type: 'text' },
      tab2Groups: { type: 'textarea' },
      tab3Label: { type: 'text' },
      tab3Groups: { type: 'textarea' },
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
      sectionTitle: 'Backed by the names you already trust',
      sectionSubtitle:
        'Every discipline is built on certified, industry-leading brands — sourced, installed and serviced by our own engineers.',
      tab1Label: 'Design, Execution & Maintenance',
      tab1Groups:
        'Air Conditioning|Blue Star::/seed/subhadra/ourbrands/design-execution-maintenance/Blue_Star_primary_logo.png\n' +
        'Refrigeration|Blue Star::/seed/subhadra/ourbrands/design-execution-maintenance/Blue_Star_primary_logo.png\n' +
        'EPABX|Matrix::/seed/subhadra/ourbrands/design-execution-maintenance/Matrix.jpg\n' +
        'Fire Fighting|Newage::/seed/subhadra/ourbrands/design-execution-maintenance/Newage.jpg;Safex::/seed/subhadra/ourbrands/design-execution-maintenance/Safex.png;Tyco::/seed/subhadra/ourbrands/design-execution-maintenance/tyco_logo_v1.png\n' +
        'CCTV|CP Plus::/seed/subhadra/ourbrands/design-execution-maintenance/CP%20Plus.jpg;Matrix::/seed/subhadra/ourbrands/design-execution-maintenance/Matrix.jpg;Honeywell::/seed/subhadra/ourbrands/design-execution-maintenance/Honeywell%20CCTV.jpg;Prama::/seed/subhadra/ourbrands/design-execution-maintenance/Prama.jpg\n' +
        'Access Control|Matrix::/seed/subhadra/ourbrands/design-execution-maintenance/Matrix.jpg;Essl::/seed/subhadra/ourbrands/design-execution-maintenance/esslogo.png\n' +
        'Public Address System|JBL::/seed/subhadra/ourbrands/design-execution-maintenance/JBL.png;Bosch::/seed/subhadra/ourbrands/design-execution-maintenance/Bosch.jpg;Ahuja::/seed/subhadra/ourbrands/design-execution-maintenance/Ahuja.jpg;Studio Master::/seed/subhadra/ourbrands/design-execution-maintenance/Studio%20Master.jpg;Crown::/seed/subhadra/ourbrands/design-execution-maintenance/Crown.jpg;Sound Craft::/seed/subhadra/ourbrands/design-execution-maintenance/Sound%20Craft.svg\n' +
        'Fire Alarm|Ravel::/seed/subhadra/ourbrands/design-execution-maintenance/Ravel.png;Honeywell::/seed/subhadra/ourbrands/design-execution-maintenance/hon-honeywell-technologies-logo-full-horizontal.svg;Agni::/seed/subhadra/ourbrands/design-execution-maintenance/Agni.jpg;Bosch::/seed/subhadra/ourbrands/design-execution-maintenance/Bosch.jpg\n' +
        'Professional Audio|JBL::/seed/subhadra/ourbrands/design-execution-maintenance/JBL.png;Bose::/seed/subhadra/ourbrands/design-execution-maintenance/bose-logo.jpg;Electro-Voice::/seed/subhadra/ourbrands/design-execution-maintenance/Electro-Voice.png;QSC::/seed/subhadra/ourbrands/design-execution-maintenance/qsc.png\n' +
        'Network Solutions|TP-Link::/seed/subhadra/ourbrands/design-execution-maintenance/TP-Link-Logo.wine.svg;Grandstream::/seed/subhadra/ourbrands/design-execution-maintenance/logo-grandstream-low-web.webp;Netgear::/seed/subhadra/ourbrands/design-execution-maintenance/Net%20Gare%20brand-logo.svg;Netfox::/seed/subhadra/ourbrands/design-execution-maintenance/Netfox-logo-WO-TM.png;D-Link::/seed/subhadra/ourbrands/design-execution-maintenance/D-link.svg;Syrotech::/seed/subhadra/ourbrands/design-execution-maintenance/Syro%20Tech.png;Honeywell::/seed/subhadra/ourbrands/design-execution-maintenance/hon-honeywell-technologies-logo-full-horizontal.svg',
      tab2Label: 'Electrical Products',
      tab2Groups:
        'Fans|Crompton::/seed/subhadra/ourbrands/electrical-products/Crompton.avif\n' +
        'Designer Fans|WadBros::/seed/subhadra/ourbrands/electrical-products/Wadbros.png\n' +
        'Exhaust Fans|WadBros::/seed/subhadra/ourbrands/electrical-products/Wadbros.png\n' +
        'Wires|RR Kabel::/seed/subhadra/ourbrands/electrical-products/RRKabel.jpg\n' +
        'Fresh Air System|WadBros::/seed/subhadra/ourbrands/electrical-products/Wadbros.png\n' +
        'MCB, DB & Switchgear|Schneider Electric::/seed/subhadra/ourbrands/electrical-products/schneider-electric-logo-png_seeklogo-123510.png\n' +
        'Lighting|Futura::/seed/subhadra/ourbrands/electrical-products/Futura%20-1.svg;Wipro::/seed/subhadra/ourbrands/electrical-products/Wipro.png;Crompton::/seed/subhadra/ourbrands/electrical-products/Crompton.avif;Philips::/seed/subhadra/ourbrands/electrical-products/lighting-philips-logo.jpg\n' +
        'Switches|Schneider Electric::/seed/subhadra/ourbrands/electrical-products/schneider-electric-logo-png_seeklogo-123510.png;Norisys::/seed/subhadra/ourbrands/electrical-products/Norisys.png;Legrand::/seed/subhadra/ourbrands/electrical-products/Legrand-Logo.png\n' +
        'Panel Boards|Customized\n' +
        'Generators|Cummins::/seed/subhadra/ourbrands/electrical-products/Cunnins.png;Jackson::/seed/subhadra/ourbrands/electrical-products/Jakson.png;Mahindra::/seed/subhadra/ourbrands/electrical-products/Mahindra.png\n' +
        'Load Break Switch|Transgard::/seed/subhadra/ourbrands/electrical-products/Transguard-Logo-white.png;Megawin::/seed/subhadra/ourbrands/electrical-products/Megawin.jpg\n' +
        'Servo Stabilizer|Powertex::/seed/subhadra/ourbrands/electrical-products/Power%20Tex.jpg;Servomax::/seed/subhadra/ourbrands/electrical-products/Servomax-logo-2048x471.webp\n' +
        'UPS|APC::/seed/subhadra/ourbrands/electrical-products/LogoAPC.svg;Fuji Electric::/seed/subhadra/ourbrands/electrical-products/Fuji-Electric-Logo.jpg',
      tab3Label: 'Lifestyle Residential Products',
      tab3Groups:
        'Gate Automation|Beninca::/seed/subhadra/ourbrands/lifestyle-residential-products/beninca-logo.png;Veer::/seed/subhadra/ourbrands/lifestyle-residential-products/veer-logo-.png\n' +
        'Video Door Phone|One Touch::/seed/subhadra/ourbrands/lifestyle-residential-products/One%20Touch_logo.svg;Legrand Bticino::/seed/subhadra/ourbrands/lifestyle-residential-products/BTicino-IME.jpg\n' +
        'Smart Lock|Yale::/seed/subhadra/ourbrands/lifestyle-residential-products/yale_logo.avif;Onetouch::/seed/subhadra/ourbrands/lifestyle-residential-products/One%20Touch_logo.svg;Ezviz::/seed/subhadra/ourbrands/lifestyle-residential-products/ezviz-logo_.png\n' +
        'Home Automation — Retrofit|Schneider Electric::/seed/subhadra/ourbrands/electrical-products/schneider-electric-logo-png_seeklogo-123510.png;Legrand::/seed/subhadra/ourbrands/electrical-products/Legrand-Logo.png;Toyama::/seed/subhadra/ourbrands/lifestyle-residential-products/Toyama%20logo-768.webp\n' +
        'Home Automation — Centralized|Schneider Electric::/seed/subhadra/ourbrands/electrical-products/schneider-electric-logo-png_seeklogo-123510.png;Legrand::/seed/subhadra/ourbrands/electrical-products/Legrand-Logo.png;Moorgen::/seed/subhadra/ourbrands/lifestyle-residential-products/Moorgen.jpg;Eelectron::/seed/subhadra/ourbrands/lifestyle-residential-products/eelectron.png\n' +
        'Intrusion Alarm|Ajax::/seed/subhadra/ourbrands/lifestyle-residential-products/Ajax%20logo.jpg;Texecom::/seed/subhadra/ourbrands/lifestyle-residential-products/Texecom.png\n' +
        'Multi-Room Audio|Xscase::/seed/subhadra/ourbrands/lifestyle-residential-products/Xscase.png;Sonos::/seed/subhadra/ourbrands/lifestyle-residential-products/Sonos.png;RTI::/seed/subhadra/ourbrands/lifestyle-residential-products/RTI.png;Lithe Audio\n' +
        'Living Room Audio|Devialet::/seed/subhadra/ourbrands/lifestyle-residential-products/devialet-logo.png;Sonos::/seed/subhadra/ourbrands/lifestyle-residential-products/Sonos.png\n' +
        'Home Theater — Amplifiers|Denon::/seed/subhadra/ourbrands/lifestyle-residential-products/Denon%20logo.svg;Marantz::/seed/subhadra/ourbrands/lifestyle-residential-products/Marantz%20logo.svg;JBL::/seed/subhadra/ourbrands/lifestyle-residential-products/jbl-logo.svg;Integra::/seed/subhadra/ourbrands/lifestyle-residential-products/Integra-Logo-White.svg;Onkyo::/seed/subhadra/ourbrands/lifestyle-residential-products/Logo%20-%20Onkyo%20Med%20Wht.svg;Emotiva::/seed/subhadra/ourbrands/lifestyle-residential-products/emotiva%401x.svg\n' +
        'Home Theater — Speakers|Focal::/seed/subhadra/ourbrands/lifestyle-residential-products/focal-logo.png;M&K Sound::/seed/subhadra/ourbrands/lifestyle-residential-products/M%26K%20Sound%20logo.png;Artcoustic::/seed/subhadra/ourbrands/lifestyle-residential-products/Artcoustic-logo.webp;JBL::/seed/subhadra/ourbrands/lifestyle-residential-products/jbl-logo.svg;Klipsch::/seed/subhadra/ourbrands/lifestyle-residential-products/Klipsch_script_logo.svg;KEF::/seed/subhadra/ourbrands/lifestyle-residential-products/Kef%20logo.png;Polk::/seed/subhadra/ourbrands/lifestyle-residential-products/Polk-logo.webp;Dali::/seed/subhadra/ourbrands/lifestyle-residential-products/Dali.png\n' +
        'Home Theater — Subwoofers|Ascendo::/seed/subhadra/ourbrands/lifestyle-residential-products/Acendo%20Sub%20logo.jpeg;SVS::/seed/subhadra/ourbrands/lifestyle-residential-products/SVS%20sub%20logo.png\n' +
        'Home Theater — Projectors|Optoma::/seed/subhadra/ourbrands/lifestyle-residential-products/Optoma%20logo.jpeg;Sony::/seed/subhadra/ourbrands/lifestyle-residential-products/Sony%20logo.png;JVC::/seed/subhadra/ourbrands/lifestyle-residential-products/jvc_logo.svg;BenQ::/seed/subhadra/ourbrands/lifestyle-residential-products/benq-logo.png;Epson::/seed/subhadra/ourbrands/lifestyle-residential-products/Epson%20logo.png\n' +
        'Home Theater — Screens|Euroscreen::/seed/subhadra/ourbrands/lifestyle-residential-products/Eurros%20Screen.svg;Liberty Screen::/seed/subhadra/ourbrands/lifestyle-residential-products/Liberty%20-logo.gif;Elite Screen::/seed/subhadra/ourbrands/lifestyle-residential-products/Elite%20screen.jpeg;VU-Tech Screen\n' +
        'Heat Pump|A. O. Smith::/seed/subhadra/ourbrands/lifestyle-residential-products/Ao%20smith.jpeg',
      padding: 'md',
    },
    render: function ConstructionOurBrandsRender({
      id,
      puck,
      sectionTitle,
      sectionSubtitle,
      tab1Label,
      tab1Groups,
      tab2Label,
      tab2Groups,
      tab3Label,
      tab3Groups,
      padding,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const isEditing = puck?.isEditing ?? false
      const tabs = [
        { n: 1, label: tab1Label, groups: tab1Groups },
        { n: 2, label: tab2Label, groups: tab2Groups },
        { n: 3, label: tab3Label, groups: tab3Groups },
      ].filter((t) => t.label)
      const [activeTab, setActiveTab] = useState(tabs[0]?.label ?? '')
      const active = tabs.find((t) => t.label === activeTab) ?? tabs[0]
      const groups = (active?.groups ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [heading, brandsRaw] = line.split('|')
          return {
            heading: (heading ?? '').trim(),
            brands: (brandsRaw ?? '')
              .split(';')
              .map((b) => b.trim())
              .filter(Boolean)
              .map((entry) => {
                const [name, logo] = entry.split('::')
                return { name: (name ?? '').trim(), logo: (logo ?? '').trim() }
              })
              .filter((b) => b.name),
          }
        })
        .filter((g) => g.heading)
      return (
        <section ref={ref} className={`${revealCls} ${padY[padding]} bg-[#eef1f6]`}>
          <div className={wrap}>
            <div className="text-center mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">
                Our Brands
              </p>
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">
                <InlineEditableText
                  id={id}
                  path={['sectionTitle']}
                  value={sectionTitle ?? ''}
                  isEditing={isEditing}
                />
              </h2>
              {(isEditing || sectionSubtitle) && (
                <p className="text-slate-600 max-w-2xl mx-auto">
                  <InlineEditableText
                    id={id}
                    path={['sectionSubtitle']}
                    value={sectionSubtitle ?? ''}
                    isEditing={isEditing}
                    multiline
                  />
                </p>
              )}
            </div>
            {tabs.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {tabs.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setActiveTab(t.label)}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                      t.label === activeTab
                        ? 'bg-slate-950 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <InlineEditableText
                      id={id}
                      path={[`tab${t.n}Label`]}
                      value={t.label ?? ''}
                      isEditing={isEditing}
                    />
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {groups.map((g, i) => (
                <div key={i} className="rounded-xl bg-white p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 pb-3 mb-4 border-b border-slate-100">
                    {g.heading}
                  </h4>
                  <div className="flex flex-wrap items-center gap-5">
                    {g.brands.map((b, j) =>
                      b.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={j}
                          src={b.logo}
                          alt={b.name}
                          title={b.name}
                          className="h-6 max-w-[110px] object-contain"
                        />
                      ) : (
                        <span key={j} className="text-xs font-medium text-slate-500">
                          {b.name}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Featured Projects slider — 3 case-study slides, prev/next index switcher
  ConstructionProjectsSlider: {
    label: 'Featured Projects Slider',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      slides: {
        type: 'array',
        min: 0,
        max: 8,
        getItemSummary: (item) => item.title || 'New project',
        defaultItemProps: {
          eyebrow: '',
          image: '',
          title: 'New project',
          description: '',
          tags: '',
          linkLabel: '',
          linkHref: '#',
          ctaLabel: '',
          ctaHref: '#quote',
        },
        arrayFields: {
          eyebrow: { type: 'text' },
          image: imageField('Image'),
          title: { type: 'text' },
          description: { type: 'textarea' },
          tags: { type: 'text' },
          linkLabel: { type: 'text' },
          linkHref: { type: 'text' },
          ctaLabel: { type: 'text' },
          ctaHref: { type: 'text' },
        },
      },
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
      sectionEyebrow: 'Subhadra Group',
      sectionTitle: 'Real projects, every sector',
      slides: [
        {
          eyebrow: '09 · Residential',
          image: '/seed/subhadra/sectors/villa.jpg',
          title: 'The Amara Residency',
          description:
            'Private residences deserve comfort that stays out of sight until you need it. We size central or split AC room-by-room, wire the home from day one, and layer in automation, home theater, multi-room audio and CCTV — all on one interface, backed by one service team for the life of the home.',
          tags: 'Central & Split AC, Home Automation, Home Theater, CCTV',
          linkLabel: 'Read the full project scope →',
          linkHref: '#villa',
          ctaLabel: 'Get a Similar Quote →',
          ctaHref: '#quote',
        },
        {
          eyebrow: '02 · Hotel',
          image: '/seed/subhadra/case-studies/novotel.jpg',
          title: 'Novotel Visakhapatnam',
          description:
            'Advanced HVAC and automation solutions designed and delivered by Subhadra Group for a premium guest experience at Novotel Visakhapatnam — central AC across guest rooms and the banquet hall, electrical and switchgear, fire and life safety, guest-room automation and diesel power backup, all as one coordinated scope, by one team.',
          tags: 'Central AC, Electrical & Switchgear, Fire & Life Safety, Guest Room Automation, Power Backup',
          linkLabel: 'Read the full project scope →',
          linkHref: '#hotel',
          ctaLabel: 'Get a Similar Quote →',
          ctaHref: '#quote',
        },
        {
          eyebrow: '01 · Retail',
          image: '/seed/subhadra/sectors/showrooms.jpg',
          title: 'CMR Family Shopping Mall',
          description:
            'A showroom floor lives or dies on how it feels the moment someone walks in. We size central and VRF AC to footfall and display heat load, fit LED lighting tuned for retail, and layer in CCTV, PA and fire safety — built into the fit-out from day one, not added after.',
          tags: 'Central & VRF AC, LED Display Lighting, CCTV & Face Recognition, Fire Alarm & Fighting',
          linkLabel: 'Read the full project scope →',
          linkHref: '#showrooms',
          ctaLabel: 'Get a Similar Quote →',
          ctaHref: '#quote',
        },
      ],
      padding: 'md',
    },
    render: function ConstructionProjectsSliderRender({
      id,
      puck,
      sectionEyebrow,
      sectionTitle,
      slides: rawSlides,
      padding,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const isEditing = puck?.isEditing ?? false
      const projectId = puck?.metadata?.projectId as string | undefined
      // Projects Content module is the source of truth once a project has
      // any case studies — the block's own `slides` field is only a
      // fallback for a project that hasn't been given real content yet.
      const { data: dbCaseStudies } = useQuery({
        queryKey: ['project-case-studies-public', projectId],
        queryFn: () =>
          fetch(`/api/projects-content/public${projectId ? `?project_id=${projectId}` : ''}`)
            .then((r) => r.json())
            .then(
              (json) =>
                (json?.data?.items ?? []) as {
                  title: string
                  eyebrow: string | null
                  tags: string | null
                  image: string | null
                  description: string | null
                  cta_label: string | null
                  cta_href: string | null
                  link_label: string | null
                  link_href: string | null
                }[]
            ),
        enabled: Boolean(projectId),
      })
      const usingDb = Boolean(dbCaseStudies && dbCaseStudies.length > 0)
      const dbSlides: ProjectSlide[] = usingDb
        ? dbCaseStudies!.map((c) => ({
            eyebrow: c.eyebrow ?? '',
            image: c.image ?? '',
            title: c.title,
            description: c.description ?? '',
            tags: c.tags ?? '',
            linkLabel: c.link_label ?? '',
            linkHref: c.link_href ?? '',
            ctaLabel: c.cta_label ?? '',
            ctaHref: c.cta_href ?? '',
          }))
        : []
      // `origIndex` keeps each slide's real position in the stored `slides`
      // array (before filtering) so InlineEditableText's `path` addresses the
      // same slide it's visually showing, even when an earlier slide has no
      // title and gets filtered out. Meaningless (and unused, `slideIsEditing`
      // below is forced off) when sourced from the DB instead.
      const slides = (usingDb ? dbSlides : (rawSlides ?? []))
        .map((s, origIndex) => ({ ...s, origIndex }))
        .filter((s) => s.title)
      // DB-sourced content is managed at /admin/projects-content, not
      // inline on this canvas — never offer the inline-edit affordance for
      // it, so a click doesn't silently edit the now-unused static `slides`
      // prop instead of the case study actually on screen.
      const slideIsEditing = isEditing && !usingDb
      const [index, setIndex] = useState(0)
      const current = slides[index] ?? slides[0]
      const tags = (current?.tags ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      return (
        <section ref={ref} className={`${revealCls} ${padY[padding]} bg-slate-50`}>
          <div className={wrap}>
            <div className="text-center mb-10">
              {(isEditing || sectionEyebrow) && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  <InlineEditableText
                    id={id}
                    path={['sectionEyebrow']}
                    value={sectionEyebrow ?? ''}
                    isEditing={isEditing}
                  />
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900">
                <InlineEditableText
                  id={id}
                  path={['sectionTitle']}
                  value={sectionTitle ?? ''}
                  isEditing={isEditing}
                />
              </h2>
            </div>
            {current && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center rounded-2xl bg-white border border-slate-200 overflow-hidden">
                {current.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.image}
                    alt={current.title}
                    className="h-72 md:h-full w-full object-cover"
                  />
                )}
                <div className="p-8">
                  {(isEditing || current.eyebrow) && (
                    <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                      <InlineEditableText
                        id={id}
                        path={['slides', current.origIndex, 'eyebrow']}
                        value={current.eyebrow ?? ''}
                        isEditing={slideIsEditing}
                      />
                    </p>
                  )}
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    <InlineEditableText
                      id={id}
                      path={['slides', current.origIndex, 'title']}
                      value={current.title ?? ''}
                      isEditing={slideIsEditing}
                    />
                  </h3>
                  {(isEditing || current.description) && (
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      <InlineEditableText
                        id={id}
                        path={['slides', current.origIndex, 'description']}
                        value={current.description ?? ''}
                        isEditing={slideIsEditing}
                        multiline
                      />
                    </p>
                  )}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-5">
                      {tags.map((t, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-4">
                    {(isEditing || current.linkLabel) && (
                      <a
                        href={current.linkHref}
                        onClick={isEditing ? (e) => e.preventDefault() : undefined}
                        className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                      >
                        <InlineEditableText
                          id={id}
                          path={['slides', current.origIndex, 'linkLabel']}
                          value={current.linkLabel ?? ''}
                          isEditing={slideIsEditing}
                        />
                      </a>
                    )}
                    {(isEditing || current.ctaLabel) && (
                      <a
                        href={current.ctaHref}
                        onClick={isEditing ? (e) => e.preventDefault() : undefined}
                        className="inline-flex items-center rounded-lg bg-orange-500 px-5 py-2.5 text-white font-semibold hover:bg-orange-600 transition text-sm"
                      >
                        <InlineEditableText
                          id={id}
                          path={['slides', current.origIndex, 'ctaLabel']}
                          value={current.ctaLabel ?? ''}
                          isEditing={slideIsEditing}
                        />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
            {slides.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Show project ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={`h-2.5 rounded-full transition ${
                      i === index ? 'w-6 bg-orange-500' : 'w-2.5 bg-slate-300'
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

  // Testimonials slider — 3 quote slides, portrait + stars + video-testimonial note
  ConstructionTestimonialsSlider: {
    label: 'Testimonials Slider',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      slides: {
        type: 'array',
        min: 0,
        max: 8,
        getItemSummary: (item) => item.name || 'New testimonial',
        defaultItemProps: {
          photo: '',
          quote: '',
          name: 'New testimonial',
          role: '',
          videoLabel: '',
        },
        arrayFields: {
          photo: imageField('Photo'),
          quote: { type: 'textarea' },
          name: { type: 'text' },
          role: { type: 'text' },
          videoLabel: { type: 'text' },
        },
      },
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
      sectionEyebrow: 'Happy Clients',
      sectionTitle: 'What our clients say',
      slides: [
        {
          photo:
            'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=440&h=550&fit=crop&crop=faces&q=80&auto=format',
          quote:
            'One team handled our entire HVAC and electrical fit-out — no coordination headaches between contractors, and the AMC support since handover has been excellent.',
          name: 'Operations Manager',
          role: 'Hospitality group, Visakhapatnam',
          videoLabel: 'Video Testimonial',
        },
        {
          photo:
            'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=440&h=550&fit=crop&crop=faces&q=80&auto=format',
          quote:
            'Critical-area AC and fire safety were sized and installed to code without a single delay to our opening date. Their service manager still checks in every quarter.',
          name: 'Facilities Head',
          role: 'Healthcare facility, Andhra Pradesh',
          videoLabel: 'Video Testimonial',
        },
        {
          photo:
            'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=440&h=550&fit=crop&crop=faces&q=80&auto=format',
          quote:
            "We compared three vendors for our showroom's cooling and CCTV — Subhadra Group was the only one that could design, supply and install everything themselves.",
          name: 'Retail Operations Lead',
          role: 'Shopping mall, Visakhapatnam',
          videoLabel: 'Video Testimonial',
        },
      ],
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionTestimonialsSliderRender({
      id,
      puck,
      sectionEyebrow,
      sectionTitle,
      slides: rawSlides,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const isEditing = puck?.isEditing ?? false
      const slides = (rawSlides ?? [])
        .map((s, origIndex) => ({ ...s, origIndex }))
        .filter((s) => s.quote)
      const [index, setIndex] = useState(0)
      const [videoOpen, setVideoOpen] = useState(false)
      const current = slides[index] ?? slides[0]
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              {(isEditing || sectionEyebrow) && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  <InlineEditableText
                    id={id}
                    path={['sectionEyebrow']}
                    value={sectionEyebrow ?? ''}
                    isEditing={isEditing}
                  />
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900">
                <InlineEditableText
                  id={id}
                  path={['sectionTitle']}
                  value={sectionTitle ?? ''}
                  isEditing={isEditing}
                />
              </h2>
            </div>
            {current && (
              <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:gap-12">
                {current.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.photo}
                    alt={current.name}
                    className="h-64 w-56 flex-none rounded-2xl object-cover"
                  />
                )}
                <div className="flex-1 text-center md:text-left">
                  <div className="mb-4 flex justify-center gap-1 text-orange-500 md:justify-start">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <StarIcon key={i} />
                    ))}
                  </div>
                  <p className="mb-4 text-lg text-slate-700 leading-relaxed">
                    &quot;
                    <InlineEditableText
                      id={id}
                      path={['slides', current.origIndex, 'quote']}
                      value={current.quote ?? ''}
                      isEditing={isEditing}
                      multiline
                    />
                    &quot;
                  </p>
                  <p className="font-semibold text-slate-900">
                    <InlineEditableText
                      id={id}
                      path={['slides', current.origIndex, 'name']}
                      value={current.name ?? ''}
                      isEditing={isEditing}
                    />
                  </p>
                  {(isEditing || current.role) && (
                    <p className="mb-4 text-sm text-slate-500">
                      <InlineEditableText
                        id={id}
                        path={['slides', current.origIndex, 'role']}
                        value={current.role ?? ''}
                        isEditing={isEditing}
                      />
                    </p>
                  )}
                  {current.videoLabel && (
                    <button
                      type="button"
                      onClick={() => setVideoOpen(true)}
                      className="mt-2 inline-flex items-center gap-2 rounded-full border border-orange-500 px-5 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50 transition"
                    >
                      ▶ {current.videoLabel}
                    </button>
                  )}
                </div>
              </div>
            )}
            {slides.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Show testimonial ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={`h-2.5 rounded-full transition ${
                      i === index ? 'w-6 bg-orange-500' : 'w-2.5 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          {videoOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={() => setVideoOpen(false)}
            >
              <div
                className="max-w-md rounded-2xl bg-white p-8 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="font-semibold text-slate-900 mb-2">{current?.videoLabel}</h4>
                <p className="text-sm text-slate-600">
                  We&apos;re recording video testimonials with our clients — check back soon, or ask
                  us during your showroom visit to hear from them in person.
                </p>
                <button
                  type="button"
                  onClick={() => setVideoOpen(false)}
                  className="mt-5 inline-flex items-center rounded-lg bg-slate-900 px-5 py-2 text-white text-sm font-semibold hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </section>
      )
    },
  },

  // Our Brands — 3 tabs, each a set of "heading|Brand A, Brand B" groups
  ConstructionSectorsTabbed: {
    label: 'Sectors Tabbed',
    fields: {
      heading: { type: 'text' },
      tab1Label: { type: 'text' },
      tab1Description: { type: 'textarea' },
      tab2Label: { type: 'text' },
      tab2Description: { type: 'textarea' },
      tab3Label: { type: 'text' },
      tab3Description: { type: 'textarea' },
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
      heading: 'Sectors We Serve',
      tab1Label: 'Residential',
      tab1Description:
        'Villas, apartments and gated communities — AC, electrical, fire safety, home automation and security, designed and installed by one team from groundbreaking to move-in.',
      tab2Label: 'Commercial',
      tab2Description:
        'Offices, retail and hospitality fit-outs delivered on a fixed schedule — MEP, HVAC, networking and surveillance coordinated so tenants move in on day one.',
      tab3Label: 'Industrial',
      tab3Description:
        'Plants and warehouses with heavy-load electrical, fire detection and power backup built to compliance, plus scheduled maintenance to keep production running.',
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionSectorsTabbedRender({
      heading,
      tab1Label,
      tab1Description,
      tab2Label,
      tab2Description,
      tab3Label,
      tab3Description,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const tabs = [
        { label: tab1Label, description: tab1Description },
        { label: tab2Label, description: tab2Description },
        { label: tab3Label, description: tab3Description },
      ].filter((t) => t.label)
      const [activeTab, setActiveTab] = useState(tabs[0]?.label ?? '')
      const active = tabs.find((t) => t.label === activeTab) ?? tabs[0]
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {heading}
            </h2>
            {tabs.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mb-8">
                {tabs.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setActiveTab(t.label)}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                      t.label === activeTab
                        ? 'bg-slate-950 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            {active?.description && (
              <p className="max-w-2xl mx-auto text-center text-slate-600 leading-relaxed">
                {active.description}
              </p>
            )}
          </div>
        </section>
      )
    },
  },

  // Sectors — compact single-line icon row, 5 sectors, no images.
  ConstructionSectorsIconRow: {
    label: 'Sectors Icon Row',
    fields: {
      heading: { type: 'text' },
      sector1Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      sector1Label: { type: 'text' },
      sector2Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      sector2Label: { type: 'text' },
      sector3Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      sector3Label: { type: 'text' },
      sector4Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      sector4Label: { type: 'text' },
      sector5Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      sector5Label: { type: 'text' },
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
      heading: 'Sectors We Serve',
      sector1Icon: 'hardhat',
      sector1Label: 'Residential',
      sector2Icon: 'shield',
      sector2Label: 'Commercial',
      sector3Icon: 'star',
      sector3Label: 'Industrial',
      sector4Icon: 'hardhat',
      sector4Label: 'Institutional',
      sector5Icon: 'shield',
      sector5Label: 'Infrastructure',
      padding: 'sm',
    },
    render: function ConstructionSectorsIconRowRender({
      heading,
      sector1Icon,
      sector1Label,
      sector2Icon,
      sector2Label,
      sector3Icon,
      sector3Label,
      sector4Icon,
      sector4Label,
      sector5Icon,
      sector5Label,
      padding,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const sectors = [
        { icon: sector1Icon, label: sector1Label },
        { icon: sector2Icon, label: sector2Label },
        { icon: sector3Icon, label: sector3Label },
        { icon: sector4Icon, label: sector4Label },
        { icon: sector5Icon, label: sector5Label },
      ].filter((s) => s.label)
      return (
        <section ref={ref} className={`${revealCls} ${padY[padding]} bg-white`}>
          <div className={wrap}>
            {heading && (
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 text-center mb-6">
                {heading}
              </h2>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              {sectors.map((s, i) => {
                const Icon = ICON_BY_KEY[s.icon] ?? HardHatIcon
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"
                  >
                    <span className="text-orange-500 [&>svg]:w-5 [&>svg]:h-5">
                      <Icon />
                    </span>
                    {s.label}
                  </span>
                )
              })}
            </div>
          </div>
        </section>
      )
    },
  },

  // Sectors — radial center logo + numbered chevron list, matches
  // about.html's "One shop for all industries" section exactly.
  ConstructionSectorsRadial: {
    label: 'Sectors Radial',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      description: { type: 'textarea' },
      centerLogo: imageField('Center logo'),
      centerTagline: { type: 'text' },
      sectors: {
        type: 'array',
        min: 0,
        max: 14,
        getItemSummary: (item, index) => item.label || `Sector ${(index ?? 0) + 1}`,
        defaultItemProps: { label: '', href: '/sectors' },
        arrayFields: {
          label: { type: 'text' },
          href: { type: 'text' },
        },
      },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      eyebrow: 'One shop for all industries',
      heading: 'Every sector, one accountable team',
      description:
        'Villas to industrial plants — the same one-roof team designs, supplies, installs and maintains it all. Tap a sector to see the full scope.',
      centerLogo: '/seed/subhadra/brand/logo.png',
      centerTagline: 'One-Stop Solution',
      sectors: [
        { label: 'Showrooms', href: '/sectors' },
        { label: 'Hotel', href: '/sectors' },
        { label: 'Hospital', href: '/sectors' },
        { label: 'Convention Center', href: '/sectors' },
        { label: 'Industry', href: '/sectors' },
        { label: 'Education', href: '/sectors' },
        { label: 'Government', href: '/sectors' },
        { label: 'Builder', href: '/sectors' },
        { label: 'Villa', href: '/sectors' },
        { label: 'Premium Flats', href: '/sectors' },
        { label: 'Gated Communities', href: '/sectors' },
      ],
      padding: 'lg',
      background: 'white',
    },
    render: function ConstructionSectorsRadialRender({
      eyebrow,
      heading,
      description,
      centerLogo,
      centerTagline,
      sectors,
      padding,
      background,
    }) {
      const list = (sectors ?? []).filter((s) => s.label)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="mx-auto mb-12 max-w-2xl text-center">
              {eyebrow && (
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-orange-600">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">{heading}</h2>
              {description && <p className="mt-3 text-slate-600">{description}</p>}
            </div>
            <div className="flex flex-col items-center gap-10 md:flex-row md:justify-center">
              <div className="flex h-40 w-40 flex-none flex-col items-center justify-center gap-2 rounded-full border-2 border-orange-200 bg-orange-50 text-center md:h-48 md:w-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={centerLogo} alt="" className="h-10 w-auto object-contain" />
                <span className="text-xs font-semibold text-slate-600">{centerTagline}</span>
              </div>
              <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {list.map((s, i) => (
                  <Link
                    key={i}
                    href={s.href || '/sectors'}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-600"
                  >
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    {s.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Sectors — one large featured sector (image + description) beside a
  // plain-text list of the other sectors, mirrors ConstructionFeaturedProject's
  // image/text split layout.
  ConstructionSectorsSplitFeature: {
    label: 'Sectors Split Feature',
    fields: {
      featuredImage: imageField('Featured Image'),
      featuredTitle: { type: 'text' },
      featuredDescription: { type: 'textarea' },
      otherSector1: { type: 'text' },
      otherSector2: { type: 'text' },
      otherSector3: { type: 'text' },
      otherSector4: { type: 'text' },
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
      featuredImage:
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=900&h=650&fit=crop&auto=format',
      featuredTitle: 'Commercial Construction',
      featuredDescription:
        'Offices, retail and hospitality fit-outs delivered on a fixed schedule — MEP, HVAC, networking and surveillance coordinated so tenants move in on day one.',
      otherSector1: 'Residential',
      otherSector2: 'Industrial',
      otherSector3: 'Institutional',
      otherSector4: 'Infrastructure',
      padding: 'md',
    },
    render: function ConstructionSectorsSplitFeatureRender({
      featuredImage,
      featuredTitle,
      featuredDescription,
      otherSector1,
      otherSector2,
      otherSector3,
      otherSector4,
      padding,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const others = [otherSector1, otherSector2, otherSector3, otherSector4].filter(Boolean)
      return (
        <section ref={ref} className={`${revealCls} ${padY[padding]} bg-white`}>
          <div className={wrap}>
            <div className="md:flex gap-12 items-center">
              <div className="md:w-1/2 mb-8 md:mb-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredImage}
                  alt={featuredTitle}
                  className="rounded-2xl w-full h-80 object-cover"
                />
              </div>
              <div className="md:w-1/2">
                <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">
                  {featuredTitle}
                </h2>
                {featuredDescription && (
                  <p className="text-slate-600 leading-relaxed mb-8">{featuredDescription}</p>
                )}
                {others.length > 0 && (
                  <ul className="space-y-3">
                    {others.map((label, i) => (
                      <li key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Sector Detail List — the Sectors page's main body (approved sectors.html
  // clone as Design 1: jump-pills + 11 alternating image/text cards). Sectors
  // module (backend/src/modules/sectors/) is the source of truth once a
  // project has any real sectors — `sectors` below is only the generic
  // fallback for a fresh KDL install with none yet.
  ConstructionSectorDetailList: {
    label: 'Sector Detail List',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Alternating detail rows (reference)', value: '1' },
          { label: 'Design 2 — Card grid', value: '2' },
          { label: 'Design 3 — Centered numbered list', value: '3' },
          { label: 'Design 4 — Dark alternating bands', value: '4' },
        ],
      },
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      sectors: {
        type: 'array',
        getItemSummary: (item) => item.name || 'Sector',
        arrayFields: {
          eyebrow: { type: 'text' },
          name: { type: 'text' },
          category: { type: 'text' },
          description: { type: 'textarea' },
          image: imageField('Image'),
          ctaLabel: { type: 'text' },
          ctaHref: { type: 'text' },
        },
        defaultItemProps: {
          eyebrow: '',
          name: 'New Sector',
          category: '',
          description: '',
          image: '',
          ctaLabel: 'Read more →',
          ctaHref: '#',
        },
      },
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
      variant: '1',
      sectionEyebrow: '',
      sectionTitle: '',
      sectionSubtitle: '',
      sectors: [
        {
          eyebrow: '01 · Space',
          name: 'Sector One',
          category: 'Space',
          description:
            'A short description of what this sector needs and how the team delivers it.\n\nA second paragraph with more detail on scope and systems covered.',
          image:
            'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1000&h=750&fit=crop&auto=format',
          ctaLabel: 'Read more →',
          ctaHref: '#',
        },
        {
          eyebrow: '02 · Space',
          name: 'Sector Two',
          category: 'Space',
          description:
            'A short description of what this sector needs and how the team delivers it.\n\nA second paragraph with more detail on scope and systems covered.',
          image:
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&h=750&fit=crop&auto=format',
          ctaLabel: 'Read more →',
          ctaHref: '#',
        },
      ],
      padding: 'md',
    },
    render: function ConstructionSectorDetailListRender({
      id,
      puck,
      variant,
      sectionEyebrow,
      sectionTitle,
      sectionSubtitle,
      sectors: rawSectors,
      padding,
    }) {
      const projectId = puck?.metadata?.projectId as string | undefined
      const { data: dbSectors } = useQuery({
        queryKey: ['sectors-public', projectId],
        queryFn: () =>
          fetch(`/api/sectors/public${projectId ? `?project_id=${projectId}` : ''}`)
            .then((r) => r.json())
            .then(
              (json) =>
                (json?.data?.items ?? []) as {
                  slug: string
                  eyebrow: string | null
                  name: string
                  category: string | null
                  description: string | null
                  image: string | null
                  cta_label: string | null
                  cta_href: string | null
                }[]
            ),
        enabled: Boolean(projectId),
      })
      const usingDb = Boolean(dbSectors && dbSectors.length > 0)
      const list = (
        usingDb
          ? dbSectors!.map((s) => ({
              slug: s.slug,
              eyebrow: s.eyebrow ?? '',
              name: s.name,
              category: s.category ?? '',
              description: s.description ?? '',
              image: s.image ?? '',
              ctaLabel: s.cta_label || 'Read more →',
              // Always the real dynamic detail route for a DB-sourced
              // sector, not the stored `cta_href` — that field only still
              // exists for the static-fallback path below (a project with
              // no real sectors yet has no /sectors/[slug] to link to).
              ctaHref: `/sectors/${s.slug}${projectId ? `?projectId=${projectId}` : ''}`,
            }))
          : (rawSectors ?? []).map((s) => ({
              ...s,
              slug: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            }))
      ).filter((s) => s.name)

      if (list.length === 0) return <></>

      const sectionHead = (sectionEyebrow || sectionTitle || sectionSubtitle) && (
        <div className="mb-10 max-w-2xl">
          {sectionEyebrow && (
            <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
              {sectionEyebrow}
            </p>
          )}
          {sectionTitle && (
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
          )}
          {sectionSubtitle && <p className="text-slate-600 leading-relaxed">{sectionSubtitle}</p>}
        </div>
      )

      if (variant === '2') {
        return (
          <section className={`${padY[padding]} bg-white`}>
            <div className={wrap}>
              {sectionHead}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {list.map((s) => (
                  <SectorRevealItem
                    key={s.slug}
                    id={s.slug}
                    className="rounded-2xl border border-slate-200 overflow-hidden bg-white flex flex-col"
                  >
                    {s.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt={s.name} className="h-44 w-full object-cover" />
                    )}
                    <div className="p-5 flex flex-col flex-1">
                      {s.eyebrow && (
                        <p className="text-orange-600 text-xs font-semibold uppercase tracking-wide mb-1.5">
                          {s.eyebrow}
                        </p>
                      )}
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{s.name}</h3>
                      {s.description && (
                        <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3 flex-1">
                          {s.description.split('\n\n')[0]}
                        </p>
                      )}
                      {s.ctaLabel && (
                        <a
                          href={s.ctaHref || '#'}
                          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                        >
                          {s.ctaLabel}
                        </a>
                      )}
                    </div>
                  </SectorRevealItem>
                ))}
              </div>
            </div>
          </section>
        )
      }

      if (variant === '3') {
        return (
          <section className={`${padY[padding]} bg-slate-50`}>
            <div className={`${wrap} max-w-3xl`}>
              {sectionHead}
              <div className="space-y-10">
                {list.map((s, i) => (
                  <SectorRevealItem key={s.slug} id={s.slug} className="flex gap-5">
                    <span className="shrink-0 h-9 w-9 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      {s.eyebrow && (
                        <p className="text-orange-600 text-xs font-semibold uppercase tracking-wide mb-1">
                          {s.eyebrow}
                        </p>
                      )}
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{s.name}</h3>
                      {s.description
                        .split('\n\n')
                        .filter(Boolean)
                        .map((p, pi) => (
                          <p key={pi} className="text-slate-600 leading-relaxed mb-2 last:mb-0">
                            {p}
                          </p>
                        ))}
                      {s.ctaLabel && (
                        <a
                          href={s.ctaHref || '#'}
                          className="inline-block mt-3 text-sm font-semibold text-orange-600 hover:text-orange-700"
                        >
                          {s.ctaLabel}
                        </a>
                      )}
                    </div>
                  </SectorRevealItem>
                ))}
              </div>
            </div>
          </section>
        )
      }

      if (variant === '4') {
        return (
          <section className={padY[padding]}>
            {sectionHead && <div className={wrap}>{sectionHead}</div>}
            <div className="space-y-0">
              {list.map((s, i) => {
                const dark = i % 2 === 1
                return (
                  <SectorRevealItem
                    key={s.slug}
                    id={s.slug}
                    className={dark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}
                  >
                    <div
                      className={`${wrap} py-14 grid grid-cols-1 md:grid-cols-2 gap-10 items-center`}
                    >
                      {s.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.image}
                          alt={s.name}
                          className="rounded-2xl w-full h-72 object-cover"
                        />
                      )}
                      <div>
                        {s.eyebrow && (
                          <p
                            className={`text-sm font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-orange-400' : 'text-orange-600'}`}
                          >
                            {s.eyebrow}
                          </p>
                        )}
                        <h3 className="text-2xl font-bold mb-3">{s.name}</h3>
                        {s.description
                          .split('\n\n')
                          .filter(Boolean)
                          .map((p, pi) => (
                            <p
                              key={pi}
                              className={`leading-relaxed mb-3 last:mb-0 ${dark ? 'text-slate-300' : 'text-slate-600'}`}
                            >
                              {p}
                            </p>
                          ))}
                        {s.ctaLabel && (
                          <a
                            href={s.ctaHref || '#'}
                            className={`inline-block mt-2 text-sm font-semibold ${dark ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-700'}`}
                          >
                            {s.ctaLabel}
                          </a>
                        )}
                      </div>
                    </div>
                  </SectorRevealItem>
                )
              })}
            </div>
          </section>
        )
      }

      // Design 1 (default) — exact clone of the approved sectors.html:
      // jump-pills row + alternating full image/text article rows.
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={wrap}>
            {sectionHead}
            <div className="flex flex-wrap gap-2 mb-12">
              {list.map((s) => (
                <a
                  key={s.slug}
                  href={`#${s.slug}`}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-orange-500 hover:text-orange-600 transition"
                >
                  {s.name}
                </a>
              ))}
            </div>
            <div className="space-y-16">
              {list.map((s, i) => (
                <SectorRevealItem key={s.slug} id={s.slug}>
                  <div
                    data-id={id}
                    className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? 'md:[direction:rtl]' : ''}`}
                  >
                    {s.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image}
                        alt={s.name}
                        loading="lazy"
                        className="rounded-2xl w-full h-72 md:h-80 object-cover md:[direction:ltr]"
                      />
                    )}
                    <div className="md:[direction:ltr]">
                      {s.eyebrow && (
                        <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                          {s.eyebrow}
                        </p>
                      )}
                      <h2 className="text-2xl font-bold text-slate-900 mb-3">{s.name}</h2>
                      {s.description
                        .split('\n\n')
                        .filter(Boolean)
                        .map((p, pi) => (
                          <p key={pi} className="text-slate-600 leading-relaxed mb-3 last:mb-0">
                            {p}
                          </p>
                        ))}
                      {s.ctaLabel && (
                        <a
                          href={s.ctaHref || '#'}
                          className="inline-block mt-3 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition"
                        >
                          {s.ctaLabel}
                        </a>
                      )}
                    </div>
                  </div>
                </SectorRevealItem>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Plain N-card icon+title+paragraph grid — no images, no split layout.
  // Covers both a light "floating highlight bar" use (few cards, right
  // below a hero) and a dark "why choose us" use (more cards) via the same
  // component + a background toggle, matching the reference site's own
  // reuse of one `.why-grid` pattern in both places.
  ConstructionIconFeatureGrid: {
    label: 'Icon Feature Grid',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      items: {
        type: 'array',
        min: 0,
        max: 8,
        getItemSummary: (item, index) => item.title || `Feature ${(index ?? 0) + 1}`,
        defaultItemProps: { icon: 'star', biIcon: '', title: '', description: '' },
        arrayFields: {
          icon: DISCIPLINE_ICON_FIELD,
          // Optional Bootstrap Icons class (e.g. bi-house-heart-fill) —
          // wins over `icon` when set.
          biIcon: { type: 'text' },
          title: { type: 'text' },
          description: { type: 'textarea' },
        },
      },
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Round icons', value: '1' },
          { label: 'Design 2 — Square orange tiles', value: '2' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Dark', value: 'dark' },
        ],
      },
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
      sectionEyebrow: '',
      sectionTitle: '',
      items: [
        {
          icon: 'star',
          title: '25+ Years of Expertise',
          description: 'Deep technical experience across building engineering disciplines.',
        },
        {
          icon: 'shield',
          title: 'Complete Solutions',
          description: 'Every engineering requirement from one accountable partner.',
        },
        {
          icon: 'hardhat',
          title: 'Design • Execution • Maintenance',
          description: 'Engineered, installed and supported end-to-end.',
        },
      ],
      background: 'white',
      padding: 'md',
    },
    render: ({ sectionEyebrow, sectionTitle, items, background, padding, variant }) => {
      const dark = background === 'dark'
      const list = (items ?? []).filter((i) => i.title)
      if (list.length === 0) return <></>
      if (variant === '2') {
        return (
          <section className={padY[padding]} style={{ background: '#fcf7f8' }}>
            <div className="mx-auto max-w-[1240px] px-4 md:px-8">
              {(sectionEyebrow || sectionTitle) && (
                <div className="mb-11 text-center">
                  {sectionEyebrow && (
                    <p className="mb-3.5 text-xs font-bold uppercase tracking-[0.16em] text-[#4b5058]">
                      {sectionEyebrow}
                    </p>
                  )}
                  {sectionTitle && (
                    <h2 className="text-[clamp(1.8rem,5vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.02em] text-[#0d0f1c]">
                      {sectionTitle}
                    </h2>
                  )}
                </div>
              )}
              <div
                className="grid gap-5"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}
              >
                {list.map((item, i) => {
                  const Icon = ICON_BY_KEY[(item.icon as IconKey) || 'star']
                  return (
                    <article
                      key={i}
                      className="flex flex-col items-center gap-3.5 border border-[rgba(20,22,26,0.10)] px-[22px] py-[26px] text-center"
                    >
                      <div className="flex h-[46px] w-[46px] items-center justify-center rounded-lg bg-[#e8622c] text-xl text-white">
                        {item.biIcon ? <BiIcon name={item.biIcon} /> : <Icon />}
                      </div>
                      <h4 className="text-[1.05rem] font-extrabold text-[#14161a]">{item.title}</h4>
                      {item.description && (
                        <p className="text-sm leading-relaxed text-[#4b5058]">{item.description}</p>
                      )}
                    </article>
                  )
                })}
              </div>
            </div>
          </section>
        )
      }
      return (
        <section className={`${padY[padding]} ${dark ? 'bg-slate-900 text-white' : 'bg-white'}`}>
          <div className={wrap}>
            {(sectionEyebrow || sectionTitle) && (
              <div className="mb-10 text-center">
                {sectionEyebrow && (
                  <p
                    className={`text-sm font-semibold uppercase tracking-wide mb-2 ${dark ? 'text-orange-400' : 'text-orange-600'}`}
                  >
                    {sectionEyebrow}
                  </p>
                )}
                {sectionTitle && <h2 className="text-2xl md:text-4xl font-bold">{sectionTitle}</h2>}
              </div>
            )}
            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}
            >
              {list.map((item, i) => {
                const Icon = ICON_BY_KEY[(item.icon as IconKey) || 'star']
                return (
                  <article
                    key={i}
                    className={`rounded-2xl p-6 text-center ${dark ? 'bg-white/5' : 'border border-slate-200'}`}
                  >
                    <div
                      className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${dark ? 'bg-white/10 text-orange-400' : 'bg-orange-50 text-orange-600'}`}
                    >
                      <Icon />
                    </div>
                    <h4 className="font-semibold mb-1.5">{item.title}</h4>
                    {item.description && (
                      <p
                        className={`text-sm leading-relaxed ${dark ? 'text-white/70' : 'text-slate-600'}`}
                      >
                        {item.description}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      )
    },
  },

  // Alternating image/text discipline rows — icon-eyebrow, checklist, an
  // optional per-row brand tag and CTA. Distinct from
  // ConstructionSectorDetailList (DB-bound to the Sector model, no
  // checklist/brand-tag) — this is a static array for a single sector
  // detail page's own "what we cover" rows.
  ConstructionDisciplineRows: {
    label: 'Discipline Rows',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      items: {
        type: 'array',
        min: 0,
        max: 12,
        getItemSummary: (item, index) => item.heading || `Row ${(index ?? 0) + 1}`,
        defaultItemProps: {
          icon: '',
          eyebrow: '',
          heading: '',
          description: '',
          checklist: '',
          image: '',
          images: [],
          clients: [],
          brandTag: '',
          brandLogos: [],
          ctaLabel: '',
          ctaHref: '',
        },
        arrayFields: {
          // Left blank for a row with a plain-text eyebrow and no icon
          // (matches the reference's simpler "Areas We Serve" rows).
          icon: {
            type: 'select',
            options: [{ label: 'None', value: '' }, ...DISCIPLINE_ICON_FIELD.options],
          },
          eyebrow: { type: 'text' },
          heading: { type: 'text' },
          description: { type: 'textarea' },
          checklist: { type: 'textarea' },
          image: imageField('Image'),
          // Multiple client-showcase photos for this row, dot-nav slider —
          // used instead of `image` when a row needs more than one photo
          // (e.g. Work module's client-showcase cards). Empty by default so
          // existing single-`image` rows (Sectors) are unaffected.
          images: {
            type: 'array',
            min: 0,
            max: 12,
            getItemSummary: (item, index) => item.caption || `Image ${(index ?? 0) + 1}`,
            defaultItemProps: { src: '', alt: '', caption: '' },
            arrayFields: {
              src: imageField('Image'),
              alt: { type: 'text' },
              caption: { type: 'text' },
            },
          },
          // Structured client/city list (name + optional note + city pills) —
          // used instead of `checklist` when a row is showcasing named
          // clients across locations. Empty by default so existing plain
          // checklist rows (Sectors) are unaffected.
          clients: {
            type: 'array',
            min: 0,
            max: 20,
            getItemSummary: (item, index) => item.name || `Client ${(index ?? 0) + 1}`,
            defaultItemProps: { name: '', note: '', cities: '' },
            arrayFields: {
              name: { type: 'text' },
              note: { type: 'text' },
              cities: { type: 'text' },
            },
          },
          brandTag: { type: 'text' },
          // Brand logo images shown beside the CTA (instead of the plain
          // brandTag text) — empty by default so existing rows are unaffected.
          brandLogos: {
            type: 'array',
            min: 0,
            max: 8,
            getItemSummary: (item, index) => item.alt || `Logo ${(index ?? 0) + 1}`,
            defaultItemProps: { src: '', alt: '' },
            arrayFields: { src: imageField('Logo'), alt: { type: 'text' } },
          },
          ctaLabel: { type: 'text' },
          ctaHref: { type: 'text' },
        },
      },
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
      sectionEyebrow: '',
      sectionTitle: '',
      sectionSubtitle: '',
      items: [
        {
          icon: 'snowflake',
          eyebrow: 'HVAC & Air Conditioning',
          heading: 'Comfortable environments, engineered room by room',
          description: 'Professionally engineered air-conditioning solutions sized to your space.',
          checklist: 'Air Conditioning\nRefrigeration\nHeat Pump',
          image: '',
          images: [],
          clients: [],
          brandTag: 'Blue Star',
          ctaLabel: 'Enquire →',
          ctaHref: '#get-quote',
        },
      ],
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionDisciplineRowsRender({
      sectionEyebrow,
      sectionTitle,
      sectionSubtitle,
      items,
      padding,
      background,
    }) {
      const list = (items ?? []).filter((i) => i.heading)
      if (list.length === 0) return <></>
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            {(sectionEyebrow || sectionTitle || sectionSubtitle) && (
              <div className="mb-12 max-w-2xl mx-auto text-center">
                {sectionEyebrow && (
                  <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                    {sectionEyebrow}
                  </p>
                )}
                {sectionTitle && (
                  <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">
                    {sectionTitle}
                  </h2>
                )}
                {sectionSubtitle && (
                  <p className="text-slate-600 leading-relaxed">{sectionSubtitle}</p>
                )}
              </div>
            )}
            <div className="space-y-16">
              {list.map((row, i) => {
                const Icon = row.icon ? ICON_BY_KEY[row.icon as IconKey] : null
                const checklistItems = (row.checklist ?? '')
                  .split('\n')
                  .map((c) => c.trim())
                  .filter(Boolean)
                const clients = (row.clients ?? []).filter((c) => c.name)
                return (
                  <SectorRevealItem key={i}>
                    <div
                      className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch ${i % 2 === 1 ? 'md:[direction:rtl]' : ''}`}
                    >
                      <DisciplineRowMedia
                        images={row.images}
                        image={row.image}
                        heading={row.heading}
                      />
                      <div className="md:[direction:ltr]">
                        {row.eyebrow && (
                          <p className="flex items-center gap-2 text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                            {Icon && (
                              <span className="inline-flex h-5 w-5">
                                <Icon />
                              </span>
                            )}
                            {row.eyebrow}
                          </p>
                        )}
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">{row.heading}</h2>
                        {row.description && (
                          <p className="text-slate-600 leading-relaxed mb-3">{row.description}</p>
                        )}
                        {clients.length > 0 ? (
                          <div className="mb-4 divide-y divide-slate-100">
                            {clients.map((c, ci) => {
                              const cities = (c.cities ?? '')
                                .split(/[,\n]/)
                                .map((city) => city.trim())
                                .filter(Boolean)
                              return (
                                <div key={ci} className="py-3 first:pt-0 last:pb-0">
                                  <p className="font-semibold text-slate-900">{c.name}</p>
                                  {c.note && <p className="text-sm text-slate-500">{c.note}</p>}
                                  {cities.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {cities.map((city, cityI) => (
                                        <span
                                          key={cityI}
                                          className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700"
                                        >
                                          {city}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          checklistItems.length > 0 && (
                            <ul className="flex flex-col gap-2 mb-4">
                              {checklistItems.map((c, ci) => (
                                <li
                                  key={ci}
                                  className="flex items-center gap-2 text-slate-700 text-sm"
                                >
                                  <span className="text-green-600 flex-shrink-0">
                                    <CheckShieldIcon />
                                  </span>
                                  {c}
                                </li>
                              ))}
                            </ul>
                          )
                        )}
                        {(row.ctaLabel || row.brandTag || row.brandLogos?.length) && (
                          <div
                            className={
                              row.brandLogos?.length
                                ? 'mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4'
                                : 'flex flex-wrap items-center gap-3 mt-2'
                            }
                          >
                            {row.brandLogos?.length ? (
                              <div className="flex flex-wrap items-center gap-3">
                                {row.brandLogos.map((l, li) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={li}
                                    src={l.src}
                                    alt={l.alt}
                                    loading="lazy"
                                    className="h-9 w-auto max-w-[120px] object-contain"
                                  />
                                ))}
                              </div>
                            ) : (
                              row.brandTag && (
                                <span className="text-xs font-medium text-slate-500">
                                  {row.brandTag}
                                </span>
                              )
                            )}
                            {row.ctaLabel && (
                              <a
                                href={row.ctaHref || '#'}
                                className="inline-block rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition"
                              >
                                {row.ctaLabel}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </SectorRevealItem>
                )
              })}
            </div>
          </div>
        </section>
      )
    },
  },

  // Simple two-column approach section — photo, copy, a pair of
  // point-highlight cards (icon+title+paragraph) and a row of stat cards.
  // Deliberately NOT built on ConstructionAboutSplit, which reads its
  // eyebrow/heading/paragraph from the global Settings → Fields
  // `about-*` keys — reusing it here would show the About page's own
  // copy on every sector page instead of sector-specific content.
  ConstructionApproachSplit: {
    label: 'Approach Split (Highlights + Stats)',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      paragraph1: { type: 'textarea' },
      paragraph2: { type: 'textarea' },
      photo: imageField('Photo'),
      highlight1Icon: DISCIPLINE_ICON_FIELD,
      highlight1BiIcon: { type: 'text' },
      highlight1Title: { type: 'text' },
      highlight1Description: { type: 'textarea' },
      highlight2Icon: DISCIPLINE_ICON_FIELD,
      highlight2BiIcon: { type: 'text' },
      highlight2Title: { type: 'text' },
      highlight2Description: { type: 'textarea' },
      stat1Value: { type: 'text' },
      stat1Label: { type: 'text' },
      stat2Value: { type: 'text' },
      stat2Label: { type: 'text' },
      stat3Value: { type: 'text' },
      stat3Label: { type: 'text' },
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Split with stats', value: '1' },
          { label: 'Design 2 — Tall photo, highlight cards, stat cards', value: '2' },
        ],
      },
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
      eyebrow: 'How we handle it',
      heading: 'Expert engineering. One accountable team, start to finish.',
      paragraph1: '',
      paragraph2: '',
      photo: '/seed/subhadra/brand/shop.webp',
      highlight1Icon: 'star',
      highlight1Title: 'Engineering Expertise',
      highlight1Description: 'Every system is sized and specified by our own qualified engineers.',
      highlight2Icon: 'shield',
      highlight2Title: 'One Point of Accountability',
      highlight2Description:
        'A single Subhadra Group team owns the project — no subcontractors, no gaps.',
      stat1Value: '100%',
      stat1Label: 'Genuine, brand-sourced products',
      stat2Value: '0',
      stat2Label: 'Work outsourced to subcontractors',
      stat3Value: '30',
      stat3Label: 'Years of industry experience',
      padding: 'md',
      background: 'muted',
    },
    render: ({
      eyebrow,
      heading,
      paragraph1,
      paragraph2,
      photo,
      highlight1Icon,
      highlight1BiIcon,
      highlight1Title,
      highlight1Description,
      highlight2Icon,
      highlight2BiIcon,
      highlight2Title,
      highlight2Description,
      stat1Value,
      stat1Label,
      stat2Value,
      stat2Label,
      stat3Value,
      stat3Label,
      variant,
      padding,
      background,
    }) => {
      const highlights = [
        {
          icon: highlight1Icon,
          biIcon: highlight1BiIcon,
          title: highlight1Title,
          description: highlight1Description,
        },
        {
          icon: highlight2Icon,
          biIcon: highlight2BiIcon,
          title: highlight2Title,
          description: highlight2Description,
        },
      ].filter((h) => h.title)
      const stats = [
        { value: stat1Value, label: stat1Label },
        { value: stat2Value, label: stat2Label },
        { value: stat3Value, label: stat3Label },
      ].filter((s) => s.value)
      if (variant === '2') {
        return (
          <section className="bg-white py-24">
            <div className="grid w-full items-stretch gap-8 px-6 md:grid-cols-[4fr_8fr] md:gap-12 md:px-8">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={heading}
                  loading="lazy"
                  className="h-full min-h-[520px] w-full rounded-[20px] object-cover shadow-[0_44px_90px_-28px_rgba(13,15,28,0.32)]"
                />
              </div>
              <div className="flex flex-col justify-center">
                {eyebrow && (
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#e8622c]">
                    {eyebrow}
                  </p>
                )}
                <h2 className="mt-1 text-2xl font-bold leading-tight text-[#0d0f1c] md:text-[1.75rem]">
                  {heading}
                </h2>
                {paragraph1 && <p className="mt-4 leading-[1.7] text-[#4b5058]">{paragraph1}</p>}
                {paragraph2 && <p className="mt-3 leading-[1.7] text-[#4b5058]">{paragraph2}</p>}
                {highlights.length > 0 && (
                  <div className="mt-[18px] flex flex-col gap-6 md:flex-row">
                    {highlights.map((h, i) => {
                      const Icon = ICON_BY_KEY[(h.icon as IconKey) || 'star']
                      return (
                        <div
                          key={i}
                          className="flex flex-1 items-start gap-3.5 rounded border border-[rgba(20,22,26,0.10)] bg-[#f5f4f2] p-[18px]"
                        >
                          <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-lg bg-[#e8622c] text-xl text-white">
                            {h.biIcon ? <BiIcon name={h.biIcon} /> : <Icon />}
                          </span>
                          <div>
                            <h4 className="text-base font-extrabold text-[#14161a]">{h.title}</h4>
                            {h.description && (
                              <p className="mt-1 text-[0.88rem] leading-normal text-[#4b5058]">
                                {h.description}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {stats.length > 0 && (
                  <div className="mt-[30px] flex flex-wrap gap-8 pt-2">
                    {stats.map((st, i) => (
                      <div
                        key={i}
                        className="flex flex-[0_1_170px] flex-col items-center rounded-[14px] bg-white px-5 py-[22px] text-center shadow-[0_12px_32px_rgba(20,22,26,0.12)]"
                      >
                        <b className="block text-[2.1rem] font-extrabold leading-tight text-[#14161a]">
                          <StatValue value={st.value} />
                        </b>
                        <span className="text-[0.78rem] text-[#71767e]">{st.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )
      }
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className="w-full px-6 md:px-10 lg:px-16 md:flex gap-14 items-center">
            <div className="md:w-2/5 mb-10 md:mb-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={heading} className="rounded-2xl w-full h-96 object-cover" />
            </div>
            <div className="md:w-3/5">
              {eyebrow && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">{heading}</h2>
              {paragraph1 && <p className="text-slate-600 leading-relaxed mb-6">{paragraph1}</p>}
              {highlights.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-5 mb-6">
                  {highlights.map((h, i) => {
                    const Icon = ICON_BY_KEY[(h.icon as IconKey) || 'star']
                    return (
                      <div key={i} className="flex gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                          <Icon />
                        </span>
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-1">{h.title}</h4>
                          {h.description && (
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {h.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {paragraph2 && <p className="text-slate-600 leading-relaxed mb-6">{paragraph2}</p>}
              {stats.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {stats.map((s, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 p-4 text-center">
                      <b className="block text-2xl font-extrabold text-slate-900">{s.value}</b>
                      <span className="text-xs text-slate-500">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )
    },
  },

  // Simple horizontal N-step process — no per-step images, distinct from
  // ConstructionProcessTimeline (vertical, plain 1/2/3 numbering, used
  // elsewhere already).
  ConstructionProcessSteps: {
    label: 'Process Steps (Horizontal)',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      items: {
        type: 'array',
        min: 0,
        max: 6,
        getItemSummary: (item, index) => item.title || `Step ${(index ?? 0) + 1}`,
        defaultItemProps: { stepLabel: '', title: '', description: '' },
        arrayFields: {
          stepLabel: { type: 'text' },
          title: { type: 'text' },
          description: { type: 'textarea' },
        },
      },
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Plain columns', value: '1' },
          { label: 'Design 2 — Shadow cards with badge', value: '2' },
        ],
      },
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
      sectionEyebrow: 'How we work',
      sectionTitle: 'From design to maintenance',
      items: [
        {
          stepLabel: '01 — Design',
          title: 'Design',
          description: 'Understand the requirements and develop engineered solutions.',
        },
        {
          stepLabel: '02 — Supply',
          title: 'Supply',
          description: 'Provide products and systems from world-class brands.',
        },
        {
          stepLabel: '03 — Execution',
          title: 'Execution',
          description: 'Professional installation and project execution.',
        },
        {
          stepLabel: '04 — Maintenance',
          title: 'Maintenance',
          description: 'Ongoing service and support for installed systems.',
        },
      ],
      padding: 'md',
    },
    render: ({ sectionEyebrow, sectionTitle, sectionSubtitle, items, padding, variant }) => {
      const list = (items ?? []).filter((i) => i.title)
      if (list.length === 0) return <></>
      if (variant === '2') {
        return (
          <section className={`${padY[padding]} bg-white`}>
            <div className="mx-auto max-w-[1240px] px-4 md:px-8">
              {(sectionEyebrow || sectionTitle) && (
                <div className="mb-12 text-center">
                  {sectionEyebrow && (
                    <p className="mb-3.5 text-xs font-bold uppercase tracking-[0.16em] text-[#4b5058]">
                      {sectionEyebrow}
                    </p>
                  )}
                  {sectionTitle && (
                    <h2 className="text-[clamp(1.8rem,5vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.02em] text-[#0d0f1c]">
                      {sectionTitle}
                    </h2>
                  )}
                  {sectionSubtitle && (
                    <p className="mx-auto mt-4 max-w-2xl text-[#4b5058]">{sectionSubtitle}</p>
                  )}
                </div>
              )}
              <div
                className="grid gap-8"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}
              >
                {list.map((step, i) => (
                  <div
                    key={i}
                    className="bg-white p-[30px] text-center shadow-[0_12px_32px_rgba(20,22,26,0.12)]"
                  >
                    {step.stepLabel && (
                      <span className="inline-block rounded-full bg-[#fdf1ec] px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[#e8622c]">
                        {step.stepLabel}
                      </span>
                    )}
                    <h4 className="mt-2 text-lg font-extrabold text-[#14161a]">{step.title}</h4>
                    {step.description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-[#4b5058]">
                        {step.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      }
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={wrap}>
            {(sectionEyebrow || sectionTitle) && (
              <div className="mb-12 text-center">
                {sectionEyebrow && (
                  <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                    {sectionEyebrow}
                  </p>
                )}
                {sectionTitle && (
                  <h2 className="text-2xl md:text-4xl font-bold text-slate-900">{sectionTitle}</h2>
                )}
                {sectionSubtitle && (
                  <p className="mx-auto mt-4 max-w-2xl text-slate-600">{sectionSubtitle}</p>
                )}
              </div>
            )}
            <div
              className="grid gap-8"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))` }}
            >
              {list.map((step, i) => (
                <div key={i} className="text-center md:text-left">
                  <span className="text-xs font-bold uppercase tracking-wide text-orange-600">
                    {step.stepLabel}
                  </span>
                  <h4 className="mt-1 font-semibold text-slate-900 text-lg mb-1.5">{step.title}</h4>
                  {step.description && (
                    <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Simple photo + title + subtitle slide, static array — distinct from
  // ConstructionProjectsSlider (bound to the real projects-content module,
  // heavier story-card shape). For sector-specific project photos that
  // aren't necessarily real case-study rows.
  ConstructionProjectPhotoSlider: {
    label: 'Project Photo Slider',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      items: {
        type: 'array',
        min: 0,
        max: 10,
        getItemSummary: (item, index) => item.title || `Photo ${(index ?? 0) + 1}`,
        defaultItemProps: { image: '', title: '', subtitle: '' },
        arrayFields: {
          image: imageField('Image'),
          title: { type: 'text' },
          subtitle: { type: 'text' },
        },
      },
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
      sectionEyebrow: 'Our work',
      sectionTitle: 'Solutions Designed Around Your Project',
      sectionSubtitle: '',
      items: [],
      padding: 'md',
    },
    render: ({ sectionEyebrow, sectionTitle, sectionSubtitle, items, padding }) => {
      const list = (items ?? []).filter((i) => i.image)
      if (list.length === 0) return <></>
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={wrap}>
            {(sectionEyebrow || sectionTitle || sectionSubtitle) && (
              <div className="mb-10 max-w-2xl mx-auto text-center">
                {sectionEyebrow && (
                  <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                    {sectionEyebrow}
                  </p>
                )}
                {sectionTitle && (
                  <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">
                    {sectionTitle}
                  </h2>
                )}
                {sectionSubtitle && (
                  <p className="text-slate-600 leading-relaxed">{sectionSubtitle}</p>
                )}
              </div>
            )}
            <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-2">
              {list.map((p, i) => (
                <div
                  key={i}
                  className="snap-start shrink-0 w-72 rounded-2xl overflow-hidden border border-slate-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    className="h-48 w-full object-cover"
                  />
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900">{p.title}</h3>
                    {p.subtitle && <p className="text-sm text-slate-500">{p.subtitle}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Brands — 6-logo grid using real logo images (imageField), distinct
  // from ConstructionOurBrands' text-name tabbed groups.
  ConstructionBrandsLogoGrid: {
    label: 'Brands Logo Grid',
    fields: {
      heading: { type: 'text' },
      logo1: imageField('Logo 1'),
      logo2: imageField('Logo 2'),
      logo3: imageField('Logo 3'),
      logo4: imageField('Logo 4'),
      logo5: imageField('Logo 5'),
      logo6: imageField('Logo 6'),
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
      heading: 'Backed by the brands you already trust',
      logo1: dummyLogo(160, 80, 'Brand 1'),
      logo2: dummyLogo(160, 80, 'Brand 2'),
      logo3: dummyLogo(160, 80, 'Brand 3'),
      logo4: dummyLogo(160, 80, 'Brand 4'),
      logo5: dummyLogo(160, 80, 'Brand 5'),
      logo6: dummyLogo(160, 80, 'Brand 6'),
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionBrandsLogoGridRender({
      heading,
      logo1,
      logo2,
      logo3,
      logo4,
      logo5,
      logo6,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const logos = [logo1, logo2, logo3, logo4, logo5, logo6].filter(Boolean)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            {heading && (
              <h2 className="text-center text-2xl md:text-3xl font-bold text-slate-900 mb-10">
                {heading}
              </h2>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
              {logos.map((logo, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center rounded-xl border border-slate-100 bg-white p-5 h-24"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt="" className="max-h-12 max-w-full object-contain" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Brands — array-based horizontal logo strip (Puck 'array' field, mirrors
  // ConstructionTestimonialsCarousel's array pattern). Static flex row, no
  // scroll JS — matches how this file's other "slider"/"carousel" components
  // render statically in the admin preview.
  ConstructionBrandsCarousel: {
    label: 'Brands Carousel',
    fields: {
      sectionEyebrow: { type: 'text' },
      sectionTitle: { type: 'text' },
      // Optional DOM id so in-page links (e.g. "#brands") can scroll here.
      anchorId: { type: 'text' },
      logos: {
        type: 'array',
        min: 0,
        max: 24,
        getItemSummary: (item, index) => item.alt || `Logo ${(index ?? 0) + 1}`,
        defaultItemProps: {
          logo: '',
          alt: '',
        },
        arrayFields: {
          logo: imageField('Logo'),
          alt: { type: 'text' },
        },
      },
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
      sectionTitle: 'Brands we work with',
      logos: [
        { logo: dummyLogo(140, 70, 'Brand 1') },
        { logo: dummyLogo(140, 70, 'Brand 2') },
        { logo: dummyLogo(140, 70, 'Brand 3') },
        { logo: dummyLogo(140, 70, 'Brand 4') },
        { logo: dummyLogo(140, 70, 'Brand 5') },
      ],
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionBrandsCarouselRender({
      sectionTitle,
      sectionEyebrow,
      anchorId,
      logos,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      return (
        <section
          ref={ref}
          id={anchorId || undefined}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            {sectionEyebrow && (
              <p className="mb-2 text-center text-xs font-bold uppercase tracking-[0.16em] text-[#4b5058]">
                {sectionEyebrow}
              </p>
            )}
            {sectionTitle && (
              <h2 className="text-center text-2xl md:text-3xl font-bold text-slate-900 mb-10">
                {sectionTitle}
              </h2>
            )}
            <div className="flex flex-wrap items-center justify-center gap-8">
              {logos.map((item, i) =>
                item.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={item.logo}
                    alt={item.alt ?? ''}
                    className="h-10 max-w-[140px] object-contain"
                  />
                ) : null
              )}
            </div>
          </div>
        </section>
      )
    },
  },

  // Brands — one large "featured partner" logo + description, plus a
  // smaller row of other brand logos below.
  ConstructionBrandsSpotlight: {
    label: 'Brands Spotlight',
    fields: {
      spotlightLogo: imageField('Spotlight Logo'),
      spotlightDescription: { type: 'textarea' },
      otherLogo1: imageField('Other Logo 1'),
      otherLogo2: imageField('Other Logo 2'),
      otherLogo3: imageField('Other Logo 3'),
      otherLogo4: imageField('Other Logo 4'),
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
      spotlightLogo: dummyLogo(240, 120, 'Blue Star'),
      spotlightDescription:
        'Our long-standing partnership with Blue Star powers every HVAC and refrigeration installation we deliver — from residential VRF systems to large-scale commercial chillers.',
      otherLogo1: dummyLogo(140, 70, 'Brand 1'),
      otherLogo2: dummyLogo(140, 70, 'Brand 2'),
      otherLogo3: dummyLogo(140, 70, 'Brand 3'),
      otherLogo4: dummyLogo(140, 70, 'Brand 4'),
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionBrandsSpotlightRender({
      spotlightLogo,
      spotlightDescription,
      otherLogo1,
      otherLogo2,
      otherLogo3,
      otherLogo4,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const otherLogos = [otherLogo1, otherLogo2, otherLogo3, otherLogo4].filter(Boolean)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={`${wrap} text-center`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-6">
              Featured Brand Partner
            </p>
            {spotlightLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={spotlightLogo}
                alt=""
                className="mx-auto h-16 md:h-20 max-w-[280px] object-contain mb-6"
              />
            )}
            {spotlightDescription && (
              <p className="max-w-2xl mx-auto text-slate-600 leading-relaxed mb-10">
                {spotlightDescription}
              </p>
            )}
            {otherLogos.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-8 pt-8 border-t border-slate-100">
                {otherLogos.map((logo, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={logo}
                    alt=""
                    className="h-8 max-w-[110px] object-contain opacity-80"
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )
    },
  },
}

// ── categories ─────────────────────────────────────────────────────────────────

// ConstructionTopBar/Header/Hero each get their own top-level 'topbar'/'header'/
// 'heroslider' category (see puck.config.tsx) and General's Hero covers 'welcome'
// — the remaining 12 category names below complete the 16-category taxonomy from
// templateEnginesections.html. Every old 'construction-sections'/'construction-cta'/
// 'construction-homepage' grouping is gone; each component now lives under its
// section name, bundled with siblings where more than one fits so pickers have
// real design choices instead of a single card.
const typedCategories: NonNullable<Config<ConstructionProps>['categories']> = {
  innerbanner: {
    title: 'Inner Banner',
    components: ['ConstructionInnerBanner'],
  },
  counters: {
    title: 'Counters',
    components: [
      'ConstructionStatsStrip',
      'ConstructionSafetyRecord',
      'ConstructionMilestoneTimeline',
    ],
  },
  founder: {
    title: 'About',
    components: [
      'ConstructionFounder',
      'ConstructionAboutSplit',
      'ConstructionTimelineHistory',
      'ConstructionLeadershipGrid',
    ],
  },
  missionvision: {
    title: 'Mission & Vision',
    components: ['ConstructionMissionVision'],
  },
  video: {
    title: 'Video',
    components: [
      'ConstructionVideo',
      'ConstructionVideoGrid',
      'ConstructionVideoSplitStats',
      'ConstructionVideoReel',
    ],
  },
  blogpost: {
    title: 'Blog Posts',
    components: [
      'ConstructionBlogPosts',
      'ConstructionFeaturedProject',
      'ConstructionNewsTicker',
      'ConstructionCaseStudyGrid',
    ],
  },
  featuredprojects: {
    title: 'Featured Projects',
    components: [
      'ConstructionProjectsSlider',
      'ConstructionProjectsGridCards',
      'ConstructionProjectShowcaseSplit',
      'ConstructionProjectMapStrip',
    ],
  },
  sectors: {
    title: 'Sectors',
    components: [
      'ConstructionProjectGallery',
      'ConstructionSectorsTabbed',
      'ConstructionSectorsIconRow',
      'ConstructionSectorsSplitFeature',
      'ConstructionSectorsRadial',
      'ConstructionSectorDetailList',
      'ConstructionIconFeatureGrid',
      'ConstructionDisciplineRows',
      'ConstructionApproachSplit',
      'ConstructionProcessSteps',
      'ConstructionProjectPhotoSlider',
    ],
  },
  team: {
    title: 'Team',
    components: [
      'ConstructionFounderProfile',
      'ConstructionCertificationsBadges',
      'ConstructionOrgChart',
      'ConstructionTeamStats',
    ],
  },
  services: {
    title: 'Services',
    components: [
      'ConstructionServicesGrid',
      'ConstructionOfferingsRows',
      'ConstructionProductsShowcase',
      'ConstructionWhyChooseUs',
      'ConstructionProcessTimeline',
      'ConstructionDisciplinesGrid',
    ],
  },
  brands: {
    title: 'Brands',
    components: [
      'ConstructionOurBrands',
      'ConstructionBrandsLogoGrid',
      'ConstructionBrandsCarousel',
      'ConstructionBrandsSpotlight',
    ],
  },
  faq: {
    title: 'FAQ',
    components: [
      'ConstructionFAQ',
      'ConstructionFAQAccordionCategories',
      'ConstructionFAQTwoColumn',
      'ConstructionFAQWithContact',
    ],
  },
  testimonials: {
    title: 'Testimonials',
    components: [
      'ConstructionTestimonials',
      'ConstructionTestimonialsSlider',
      'ConstructionTestimonialsCarousel',
      'ConstructionVideoTestimonials',
    ],
  },
  clients: {
    title: 'Clients',
    components: [
      'ConstructionClientsGrid',
      'ConstructionClientsTestimonialStrip',
      'ConstructionClientsMarquee',
      'ConstructionClientsCaseHighlight',
    ],
  },
  contact: {
    title: 'Forms',
    components: [
      'ConstructionLeadFormFAQ',
      'ConstructionSimpleContactForm',
      'ConstructionQuoteRequestForm',
      'ConstructionContactSplitMap',
    ],
  },
  cta: {
    title: 'Call to Action',
    components: [
      'ConstructionQuoteCTA',
      'ConstructionUrgencyBanner',
      'ConstructionTaglineStrip',
      'ConstructionFloatingActions',
    ],
  },
  bottombar: {
    title: 'Footer',
    components: ['ConstructionFooter'],
  },
  socialmedia: {
    title: 'Social Media',
    components: [
      'ConstructionSocialMedia',
      'ConstructionSocialFeedGrid',
      'ConstructionSocialFollowBanner',
      'ConstructionSocialVideoHighlights',
    ],
  },
}

// ── pack export ───────────────────────────────────────────────────────────────

export const construction: ComponentPack = {
  key: 'construction',
  label: 'Construction',
  components: typedComponents as NonNullable<Config['components']>,
  categories: typedCategories,
  // ConstructionFooter and ConstructionSectorDetailList each have 4 real
  // render branches (see their `variant` field above — Footer's 4 options
  // are also confirmed structurally distinct by FOOTER_LABELS in
  // website/layout/page.tsx) but neither was ever registered here — same
  // class of bug general/index.tsx documents fixing for Hero/NavBar/
  // FeatureCards/Footer/TaglineStrip: the Insert-a-block modal's and
  // SectionPickerPopup's per-variant card grid read this map directly
  // (blockVariants[componentKey]), so without an entry a component silently
  // falls back to a single, variant-less card despite 4 designs existing.
  // ConstructionSectorDetailList is inserted through the ordinary "Sectors"
  // category (typedCategories.sectors) exactly like any other block — the
  // separate detail-page-types registry (backend/src/shared/detail-pages/)
  // only governs which entity a bound page renders, not how this picker
  // shows it, so it needs its variants registered too.
  variants: {
    ConstructionTopBar: ['1', '2', '3', '4'],
    ConstructionHeader: ['1', '2', '3', '4'],
    ConstructionHero: ['1', '2', '3', '4'],
    ConstructionInnerBanner: ['1', '2', '3', '4'],
    ConstructionFooter: ['1', '2', '3', '4'],
    ConstructionSectorDetailList: ['1', '2', '3', '4'],
    ConstructionMissionVision: ['1', '2', '3', '4'],
  },
}
