import { z } from 'zod';

export const listCategoriesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    type_id: z.string().optional(),
    is_active: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['name', 'created_at', 'is_active']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    ownerModule: z.string().min(1).optional(),
  }),
});

export const getCategorySchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    type_id: z.string().min(1).nullish(),
    is_active: z.boolean().default(true),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    type_id: z.string().min(1).nullish(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteCategorySchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
