// Zod schemas for POST /api/ai/brand-inference (KDL-471 §4.3, KDL-510).
// Single source of truth for the HTTP request shape and the model-output
// contract used by the repair loop.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { z } from 'zod';

const __dir = fileURLToPath(new URL('.', import.meta.url));

export const FONT_PAIRINGS = JSON.parse(
  readFileSync(join(__dir, 'data/font-pairings.json'), 'utf8'),
);

export const INFERENCE_RULES = JSON.parse(
  readFileSync(join(__dir, 'data/inference-rules.json'), 'utf8'),
);

export const PAIRING_IDS = FONT_PAIRINGS.pairings.map((p) => p.id);
export const PAIRING_BY_ID = new Map(FONT_PAIRINGS.pairings.map((p) => [p.id, p]));

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb hex colour');

export const brandInferenceRequestSchema = z
  .object({
    projectId: z.string().min(1).max(128),
    companyName: z.string().min(1).max(200),
    industry: z.string().min(1).max(120),
    tagline: z.string().max(300).optional(),
    locale: z.string().min(2).max(35).default('en'),
    paletteSummary: z.object({
      primaryHex: hexColour,
      neutralHex: hexColour,
      chroma: z.number().min(0).max(1),
      hueName: z.string().min(1).max(40),
    }),
    // Logo-image input is OPT-IN and OFF by default (BRAND_INFERENCE_IMAGE_ENABLED).
    // KDL-490 owns the A/B that decides whether to flip it on — do not pre-empt.
    logoImage: z
      .object({
        data: z.string().min(1), // base64, no data: URL prefix
        mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']).default('image/png'),
      })
      .optional(),
  })
  .strip();

// What the model must return. `.strip()` drops anything schema-external —
// including colour fields, which are input-only by construction (palette is
// deterministic local compute, never the model's to change).
export const modelOutputSchema = z
  .object({
    typography: z
      .object({
        pairingId: z.enum(PAIRING_IDS),
        scaleRatio: z.union([
          z.literal(1.125),
          z.literal(1.2),
          z.literal(1.25),
          z.literal(1.333),
        ]),
        rationale: z.string().min(10).max(400),
      })
      .strip(),
    tone: z
      .object({
        voice: z.string().min(40).max(500),
        adjectives: z.array(z.string().min(2).max(30)).min(3).max(5),
        dos: z.array(z.string().min(5).max(120)).min(3).max(6),
        donts: z.array(z.string().min(5).max(120)).min(3).max(6),
      })
      .strip(),
    strategy: z
      .object({
        positioning: z.string().min(80).max(600),
        audienceNotes: z.string().min(80).max(800),
        elevatorPitch: z.string().min(40).max(300),
      })
      .strip(),
    confidence: z.number().min(0).max(1),
  })
  .strip();

export const FALLBACK_CODES = [
  'F1_NO_KEY',
  'F2_AUTH',
  'F3_TIMEOUT',
  'F4_RATE_LIMIT',
  'F5_BUDGET',
  'F6_BAD_OUTPUT',
  'F7_LOW_CONFIDENCE',
];

// Response envelope — used by tests to pin the §4.3 contract.
export const envelopeSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.enum(['ai', 'fallback']),
  fallbackReason: z.enum(FALLBACK_CODES).nullable(),
  rulesVersion: z.string().nullable(),
  model: z.string().nullable(),
  usage: z
    .object({ input_tokens: z.number(), output_tokens: z.number() })
    .nullable(),
  estimatedCostUsd: z.number().min(0),
  priceTableVersion: z.string(),
  confidence: z.number().min(0).max(1),
  attempts: z.number().int().min(0),
  typography: z.object({
    pairingId: z.enum(PAIRING_IDS),
    heading: z.object({
      family: z.string(),
      weights: z.array(z.number()),
      fallbackStack: z.string(),
    }),
    body: z.object({
      family: z.string(),
      weights: z.array(z.number()),
      fallbackStack: z.string(),
    }),
    scaleRatio: z.number(),
    rationale: z.string(),
  }),
  tone: z.object({
    voice: z.string(),
    adjectives: z.array(z.string()).min(3).max(5),
    dos: z.array(z.string()).min(3).max(6),
    donts: z.array(z.string()).min(3).max(6),
  }),
  strategy: z.object({
    positioning: z.string().max(600),
    audienceNotes: z.string().max(800),
    elevatorPitch: z.string().max(300),
  }),
});
