import { z } from 'zod';

export const navItemSchema = z.object({
  label: z.string().min(1),
  path: z.string().startsWith('/'),
  icon: z.string().optional(),
  permission: z.string().optional(),
});

// A permission entry is either a bare module-name string (gets the default
// 5 CRUD actions) or an object naming an explicit action list — lets a
// module register per-feature permissions instead of the generic 5.
export const permissionEntrySchema = z.union([
  z.string(),
  z.object({ name: z.string(), actions: z.array(z.string()).min(1) }),
]);

export const manifestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver'),
  description: z.string().optional(),
  core: z.boolean().default(false),
  // visibleInCatalog controls whether the module appears in the /admin/modules catalog UI.
  // Set to false for internal-only dependency modules that should not be managed independently
  // by the user (e.g. transitive deps of template-engine like brand-kit, collateral, credits,
  // projects). Defaults to true so existing modules are unaffected. Does NOT affect
  // install/enable/disable behaviour — purely a catalog-listing flag.
  visibleInCatalog: z.boolean().default(true),
  apiPrefix: z.string().startsWith('/api/'),
  permissions: z.array(permissionEntrySchema).default([]),
  nav: z.array(navItemSchema).default([]),
  dependsOn: z.array(z.string()).default([]),
  conflictsWith: z.array(z.string()).default([]),
  queues: z.array(z.string()).default([]),
  env: z.array(z.string()).default([]),
});
