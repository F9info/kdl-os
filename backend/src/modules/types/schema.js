import { z } from 'zod';

export const listTypesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    is_active: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['name', 'created_at', 'is_active']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    ownerModule: z.string().optional(),
  }),
});

export const getTypeSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createTypeSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    is_active: z.boolean().default(true),
  }),
});

export const updateTypeSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteTypeSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
