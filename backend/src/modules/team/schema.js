import { z } from 'zod';

export const listTeamMembersSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
    is_active: z.enum(['true', 'false']).optional(),
  }),
});

export const getTeamMemberSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createTeamMemberSchema = z.object({
  body: z.object({
    project_id: z.string().min(1).nullish(),
    name: z.string().min(1).max(150),
    role: z.string().min(1).max(150),
    bio: z.string().max(2000).nullish(),
    photo_url: z.string().min(1).nullish(),
    order: z.number().int().default(0),
    is_active: z.boolean().default(true),
  }),
});

export const updateTeamMemberSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    project_id: z.string().min(1).nullish(),
    name: z.string().min(1).max(150).optional(),
    role: z.string().min(1).max(150).optional(),
    bio: z.string().max(2000).nullish(),
    photo_url: z.string().min(1).nullish(),
    order: z.number().int().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const deleteTeamMemberSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
