import { z } from 'zod';
import { IDENTITY_FIELDS } from '../identity/schema.js';
import { WORKFLOW_STEPS } from './workflow.js';

export const PROJECT_KINDS = ['ADMIN', 'WEBSITE', 'LANDING', 'STATIC'];
export const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

// A project holds a SET of kinds (it can combine admin, website, landing, static). ADMIN is always implied,
// so it is added by normalizeKinds() and never needs to be sent.
const kindsField = z.array(z.enum(PROJECT_KINDS)).min(1).max(PROJECT_KINDS.length);
const configField = z.record(z.string(), z.unknown());

export const normalizeKinds = (kinds) => ['ADMIN', ...PROJECT_KINDS.filter((k) => k !== 'ADMIN' && kinds?.includes(k))];

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    is_default: z.boolean().optional().default(false),
    kinds: kindsField.optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    config: configField.optional(),
  }),
});

export const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
      .optional(),
    is_default: z.boolean().optional(),
    kinds: kindsField.optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    config: configField.optional(),
  }),
});

export const answerOnboardingSchema = z.object({
  body: z.object({ frontend: z.enum(['yes', 'no']) }),
});

const layoutSlot = z.object({
  enabled: z.boolean(),
  // '1'-'5' (built-in designs), 'f9' (the F9 Tech header/footer blocks) or custom:<id> (a saved Section Builder
  // block); same rule as template-engine.
  variant: z.string().regex(/^([1-5]|f9|landing:[1-4]|custom:[A-Za-z0-9_-]+)$/),
  // Settings of the chosen design (the F9 blocks' props), kept with the layout so every page shares them.
  config: z.record(z.string(), z.string()).optional(),
});

export const saveLayoutSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({ topHeader: layoutSlot.optional(), header: layoutSlot.optional(), footer: layoutSlot.optional() })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Send at least one of topHeader, header, footer' }),
});

// Identity fields a site may override (T5.5). Missing or empty = inherit the project's value.
// Colours are not on the list: they are not applied to sites.
export const SITE_IDENTITY_KEYS = [
  'app_name',
  'app_title',
  'description',
  'logo_light',
  'logo_dark',
  'favicon',
  // Footer details: a landing page may show other contact details than the company.
  'contact_email',
  'contact_email_secondary',
  'contact_phone',
  'contact_phone_secondary',
  'contact_address',
  'copyright',
  'social_facebook',
  'social_x',
  'social_instagram',
  'social_linkedin',
  'social_youtube',
];
const siteIdentityFields = Object.fromEntries(SITE_IDENTITY_KEYS.map((k) => [k, IDENTITY_FIELDS[k]]));

export const siteIdentityParamsSchema = z.object({
  params: z.object({ id: z.string().min(1), siteId: z.string().min(1) }),
});

// Same field rules as the project Identity; '' removes an override.
export const saveSiteIdentitySchema = z.object({
  params: siteIdentityParamsSchema.shape.params,
  body: z.object(siteIdentityFields).partial().strict(),
});

export const workflowStepSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ step: z.enum(WORKFLOW_STEPS), done: z.boolean() }),
});

export const launchSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ force: z.boolean().default(false) }).default({}),
});

// Layout library (header / footer / top header layouts). Same variant rule and config as a layout slot.
const layoutVariant = z.string().regex(/^([1-5]|f9|landing:[1-4]|custom:[A-Za-z0-9_-]+)$/);
const layoutConfig = z.record(z.string(), z.string());
const layoutParams = z.object({ id: z.string().min(1), layoutId: z.string().min(1) });

export const listLayoutsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({ kind: z.enum(['TOP_HEADER', 'HEADER', 'FOOTER']).optional() }),
});
export const createLayoutSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      kind: z.enum(['TOP_HEADER', 'HEADER', 'FOOTER']),
      name: z.string().trim().min(1).max(120),
      variant: layoutVariant,
      config: layoutConfig.optional(),
      status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    })
    .strict(),
});
export const updateLayoutSchema = z.object({
  params: layoutParams,
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      variant: layoutVariant.optional(),
      config: layoutConfig.optional(),
      status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to change' }),
});
export const layoutIdSchema = z.object({ params: layoutParams });
export const deleteLayoutSchema = z.object({
  params: layoutParams,
  query: z.object({ force: z.enum(['true', 'false']).optional() }),
});
