import { z } from 'zod';

const projectParamsSchema = z.object({
  params: z.object({ projectId: z.string().min(1) }),
});

export const getKitSchema = projectParamsSchema;

export const uploadLogoSchema = projectParamsSchema;

export const extractSchema = projectParamsSchema;

export const inferSchema = z.object({
  params: z.object({ projectId: z.string().min(1) }),
  body: z.object({
    industry: z.string().max(200).optional(),
    // Phase 2 (KDL-510): forwarded to POST /api/ai/brand-inference as AI context
    companyName: z.string().max(200).optional(),
    tagline: z.string().max(300).optional(),
    locale: z.string().min(2).max(35).optional(),
  }).optional().default({}),
});

export const patchKitSchema = z.object({
  params: z.object({ projectId: z.string().min(1) }),
  body: z.object({
    typography: z.record(z.unknown()).optional(),
    tone: z.record(z.unknown()).optional(),
    palette: z.record(z.unknown()).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  }),
});

export const approveSchema = z.object({
  params: z.object({ projectId: z.string().min(1) }),
  body: z.object({
    // Array of contrast adjustment IDs the user explicitly acknowledged
    acknowledgedAdjustmentIds: z.array(z.string()).default([]),
  }),
});

export const getTokensSchema = z.object({
  params: z.object({ projectId: z.string().min(1) }),
  query: z.object({
    platform: z.enum(['webapp', 'tv', 'android', 'ios']).optional().default('webapp'),
  }),
});

export const renderGuidelinesSchema = z.object({
  params: z.object({ projectId: z.string().min(1) }),
});
