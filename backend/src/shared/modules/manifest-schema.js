import { z } from 'zod';

// One sidebar entry. This (not the frontend) is the single place navigation is configured.
//   group / groupIcon / groupOrder  nest the entry under a collapsible sidebar group (e.g. "Settings")
//   order                           position among siblings (default 100; ties keep manifest order)
//   activeWhen                      highlight the entry on a different URL than `path`, for screens that
//                                   open as a stage of another page (e.g. the website stage views)
export const navActiveWhenSchema = z.object({
  pathStartsWith: z.string().optional(),
  pathEndsWith: z.string().optional(),
  view: z.string().optional(),
  viewNotIn: z.array(z.string()).optional(),
});

export const navItemSchema = z.object({
  label: z.string().min(1),
  path: z.string().startsWith('/'),
  icon: z.string().optional(),
  permission: z.string().optional(),
  group: z.string().optional(),
  groupIcon: z.string().optional(),
  groupOrder: z.number().optional(),
  order: z.number().optional(),
  activeWhen: navActiveWhenSchema.optional(),
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
  // Icon of the module's own sidebar entry when it is a bundle (umbrella), e.g. Content.
  icon: z.string().optional(),
  core: z.boolean().default(false),
  // Which product area the module belongs to (core, cms, membership, studio, platform, ...). Descriptive: the
  // install screen and dashboards group by it; it never gates routes (that is `core` + the enabled status).
  group: z.string().regex(/^[a-z0-9-]+$/, 'group must be lowercase alphanumeric with hyphens').optional(),
  // Umbrella = a bundle whose dependsOn modules install/enable/disable together with it.
  umbrella: z.boolean().default(false),
  apiPrefix: z.string().startsWith('/api/'),
  // Public/site pages the module owns that are not admin nav entries (admin pages come from `nav`).
  frontendRoutes: z.array(z.string().startsWith('/')).default([]),
  permissions: z.array(permissionEntrySchema).default([]),
  nav: z.array(navItemSchema).default([]),
  dependsOn: z.array(z.string()).default([]),
  conflictsWith: z.array(z.string()).default([]),
  navSuppressedByPeer: z.array(z.string()).default([]),
  visibleInCatalog: z.boolean().default(true),
  queues: z.array(z.string()).default([]),
  env: z.array(z.string()).default([]),
});
