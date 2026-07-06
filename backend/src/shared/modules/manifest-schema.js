import { z } from 'zod';

export const navItemSchema = z.object({
  label: z.string().min(1),
  path: z.string().startsWith('/'),
  icon: z.string().optional(),
  permission: z.string().optional(),
});

export const manifestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver'),
  description: z.string().optional(),
  core: z.boolean().default(false),
  apiPrefix: z.string().startsWith('/api/'),
  permissions: z.array(z.string()).default([]),
  nav: z.array(navItemSchema).default([]),
  dependsOn: z.array(z.string()).default([]),
  queues: z.array(z.string()).default([]),
  env: z.array(z.string()).default([]),
});
