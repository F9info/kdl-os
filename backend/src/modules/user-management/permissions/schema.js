import { z } from 'zod';

export const matrixSchema = z.object({});

export const createModuleSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    label: z.string().min(2).max(100),
    sort_order: z.coerce.number().int().default(0),
  }),
});

export const updateModuleSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    label: z.string().min(2).max(100).optional(),
    sort_order: z.coerce.number().int().optional(),
  }),
});

export const deleteModuleSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
