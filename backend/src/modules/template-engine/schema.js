import { z } from 'zod';

// Design '1'-'4', or `custom:<id>` = a saved Section Builder block
// (CustomBlockTemplate) chosen for that slot.
const layoutVariant = z.string().regex(/^([1-4]|custom:[A-Za-z0-9_-]+)$/);

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
  // pack (general/medical/construction) seeds the assembled pages, and
  // navigationPages — the page names chosen in the Navigation step — to
  // pick WHICH pages get created (falls back to the default Home/About/
  // Contact set when omitted).
  body: z
    .object({
      brandKitVersion: z.number().int().positive().optional(),
      templatePack: z.enum(['general', 'medical', 'construction']).optional(),
      navigationPages: z.array(z.string().min(1)).optional(),
      // Layout settings (the dedicated Layout picker page) — toggle and pick
      // a design variant ('1'-'4', same variant scale as every other Puck
      // block) for the top-header/header/footer blocks on every assembled
      // page. Each section is independently optional (see patchLayout in
      // drivers/website-seed-content.js) — omitted keys are left untouched.
      layout: z
        .object({
          topHeader: z
            .object({
              enabled: z.boolean().optional(),
              variant: layoutVariant.optional(),
            })
            .optional(),
          header: z
            .object({
              enabled: z.boolean().optional(),
              variant: layoutVariant.optional(),
            })
            .optional(),
          footer: z
            .object({
              enabled: z.boolean().optional(),
              variant: layoutVariant.optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export const stageRecoveryParamSchema = z.object({
  params: z.object({
    runId: z.string().min(1),
    stage: stageSlugEnum,
  }),
});
