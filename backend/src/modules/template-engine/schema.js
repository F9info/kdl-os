import { z } from 'zod';

// Canonical stage slugs per TEMPLATE_ENGINE_ARCH.md §3.
export const DAG_STAGE_SLUGS = [
  'intake',
  'palette',
  'inference',
  'approval',
  'guidelines',
  'collateral',
  'website',
  'preflight',
  'export',
];

const stageSlugEnum = z.enum(DAG_STAGE_SLUGS);

export const createRunBodySchema = z.object({
  body: z.object({
    projectId: z.string().min(1),
  }),
});

export const listRunsQuerySchema = z.object({
  query: z.object({
    projectId: z.string().min(1),
  }),
});

export const runParamSchema = z.object({
  params: z.object({
    runId: z.string().min(1),
  }),
});

export const advanceStageSchema = z.object({
  params: z.object({
    runId: z.string().min(1),
    stage: stageSlugEnum,
  }),
  // approval stage may carry brandKitVersion on the accept call
  body: z
    .object({
      brandKitVersion: z.number().int().positive().optional(),
    })
    .optional(),
});
