import { z } from 'zod';
import { OAUTH_PROVIDERS, MANUAL_PROVIDERS } from './drivers/index.js';

export const connectionIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const oauthStartParamSchema = z.object({
  params: z.object({ provider: z.enum(OAUTH_PROVIDERS) }),
});

export const createManualConnectionSchema = z.object({
  body: z.object({
    provider: z.enum(MANUAL_PROVIDERS),
    label: z.string().min(1).max(100),
    credentials: z.record(z.unknown()),
  }),
});

export const listRemoteFilesSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({
    folder_id: z.string().optional(),
    cursor: z.string().optional(),
  }),
});

export const importFilesSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    file_ids: z.array(z.string().min(1)).min(1).max(50),
    folder_id: z.string().optional(),
  }),
});
