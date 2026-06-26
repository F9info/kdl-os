import { z } from 'zod';

export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']).optional(),
    is_active: z.enum(['true', 'false']).optional(),
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']).optional(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
