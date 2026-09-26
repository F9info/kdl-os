import { z } from 'zod';

export const listCaseStudiesSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    is_active: z.enum(['true', 'false']).optional(),
  }),
});

export const getCaseStudySchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

const caseStudyBody = {
  project_id: z.string().min(1).nullish(),
  title: z.string().min(1).max(200),
  eyebrow: z.string().max(200).nullish(),
  tags: z.string().max(500).nullish(),
  image: z.string().max(500).nullish(),
  description: z.string().max(4000).nullish(),
  cta_label: z.string().max(100).nullish(),
  cta_href: z.string().max(500).nullish(),
  link_label: z.string().max(200).nullish(),
  link_href: z.string().max(500).nullish(),
  order: z.number().int().default(0),
  is_active: z.boolean().default(true),
};

export const createCaseStudySchema = z.object({ body: z.object(caseStudyBody) });

export const updateCaseStudySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ ...caseStudyBody, title: caseStudyBody.title.optional(), order: z.number().int().optional(), is_active: z.boolean().optional() }),
});

export const deleteCaseStudySchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
