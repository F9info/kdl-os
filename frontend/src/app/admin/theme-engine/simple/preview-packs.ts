// Which real page-builder blocks the Simple view's "See" card renders per pack.
// Kept apart from PreviewBlocks.tsx so the big pack bundle is only fetched when
// the preview actually mounts. `key` / `label` match the packs in
// app/admin/page-builder/packs; `blocks` are keys of `config.components`
// (puck.config.tsx): a hero, a services/feature section, a call to action and a
// footer (Medical has no footer, so it closes on its contact block).

// The blocks are laid out as on a desktop screen this wide, then scaled down to
// fit the card (their responsive classes follow the viewport, not the card).
export const PREVIEW_CANVAS_WIDTH = 1024

export const PREVIEW_PACKS = [
  {
    key: 'construction',
    label: 'Construction',
    blocks: [
      'ConstructionHero',
      'ConstructionServicesGrid',
      'ConstructionQuoteCTA',
      'ConstructionFooter',
    ],
  },
  {
    key: 'general',
    label: 'General',
    blocks: ['Hero', 'FeatureCards', 'StatsStrip', 'Footer'],
  },
  {
    key: 'medical',
    label: 'Medical',
    blocks: ['MedicalHero', 'MedicalServicesList', 'MedicalAppointmentCTA', 'MedicalContactHours'],
  },
] as const

export type PreviewPack = (typeof PREVIEW_PACKS)[number]
