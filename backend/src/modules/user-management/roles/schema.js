import { z } from 'zod';

export const listRolesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const getRoleSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(255).optional(),
    permission_ids: z.array(z.string().min(1)).default([]),
  }),
});

export const updateRoleSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(255).optional().nullable(),
    permission_ids: z.array(z.string().min(1)).optional(),
  }),
});

export const deleteRoleSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
