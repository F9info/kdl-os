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
  // approval stage may carry brandKitVersion on the accept call;
  // website stage may carry templatePack (KDL-558) to pick which Puck
  // pack (general/medical/construction) seeds the assembled pages.
  body: z
    .object({
      brandKitVersion: z.number().int().positive().optional(),
      templatePack: z.enum(['general', 'medical', 'construction']).optional(),
    })
    .optional(),
});

export const stageRecoveryParamSchema = z.object({
  params: z.object({
    runId: z.string().min(1),
    stage: stageSlugEnum,
  }),
});
