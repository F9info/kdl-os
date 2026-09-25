// Zod schemas for POST /api/ai/website-copy — generates all 3 Hero slide
// variants + About body copy from intake data in one call. Deliberately
// simpler than brand-inference-schemas.js: one repair attempt on invalid
// output, no F1-F7 fallback taxonomy — the caller's fallback is "leave the
// static seed text alone", not a generated substitute, so there's nothing
// here to construct on failure.

import { z } from 'zod';

export const websiteCopyRequestSchema = z
  .object({
    projectId: z.string().min(1).max(128),
    companyName: z.string().min(1).max(200),
    businessDescription: z.string().min(1).max(2000),
  })
  .strip();

const heroVariantSchema = z
  .object({
    badge: z.string().min(1).max(40),
    headline: z.string().min(4).max(120),
    subheadline: z.string().min(20).max(300),
    ctaLabel: z.string().min(2).max(30),
  })
  .strip();

export const websiteCopyOutputSchema = z
  .object({
    // Exactly 3 — matches CONSTRUCTION_HERO_HOME's 3 seeded d1Slides. One
    // model call returns all 3 variants; each must lead with a distinct
    // benefit/angle (enforced in the prompt, not the schema).
    hero: z.array(heroVariantSchema).length(3),
    about: z
      .object({
        eyebrow: z.string().min(1).max(40),
        heading: z.string().min(4).max(120),
        paragraph: z.string().min(40).max(600),
      })
      .strip(),
  })
  .strip();
