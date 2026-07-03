import { z } from 'zod';

const userStatusEnum = z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']);

export const listUsersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: userStatusEnum.optional(),
    role: z.string().optional(),
    is_active: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createUserSchema = z.object({
  params: z.object({}),
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().toLowerCase(),
    password: z.string().min(8).max(100),
    is_active: z.boolean().optional().default(true),
    status: userStatusEnum.optional().default('ACTIVE'),
    role_ids: z.array(z.string().min(1)).optional().default([]),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().toLowerCase().optional(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'USER']).optional(),
    is_active: z.boolean().optional(),
    status: userStatusEnum.optional(),
    role_ids: z.array(z.string().min(1)).optional(),
    avatar_media_id: z.string().optional().nullable(),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const resetPasswordSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    password: z.string().min(8).max(100),
  }),
});

export const updateOverridesSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    overrides: z
      .array(
        z.object({
          permission_id: z.string().min(1),
          mode: z.enum(['GRANT', 'DENY']),
        }),
      )
      .optional()
      .default([]),
  }),
});
