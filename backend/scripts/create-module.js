#!/usr/bin/env node
/**
 * Module scaffold generator.
 * Usage: node scripts/create-module.js --slug=blog --name="Blog"
 *   OR:  npm run module:create -- --slug=blog --name="Blog"
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FRONTEND_ROOT = join(ROOT, '..', 'frontend');

// ── Parse args ───────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, ...v] = a.slice(2).split('=');
      return [k, v.join('=')];
    })
);

const slug = args.slug?.toLowerCase();
const name = args.name;

if (!slug || !name) {
  console.error('Usage: npm run module:create -- --slug=<slug> --name="<Name>"');
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error('slug must be lowercase alphanumeric with hyphens only');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function write(p, content) {
  await mkdir(dirname(p), { recursive: true });
  if (await exists(p)) {
    console.warn(`  SKIP (exists): ${p}`);
    return;
  }
  await writeFile(p, content, 'utf8');
  console.log(`  CREATE: ${p}`);
}

const pascal = slug
  .split('-')
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join('');

// ── Backend files ────────────────────────────────────────────────────────────

const moduleDir = join(ROOT, 'src', 'modules', slug);
const schemaFile = join(ROOT, 'prisma', 'schema', `${slug}.prisma`);

await write(join(moduleDir, 'module.json'), JSON.stringify({
  slug,
  name,
  version: '1.0.0',
  description: `${name} module`,
  core: false,
  apiPrefix: `/api/${slug}`,
  permissions: [`${slug}`],
  nav: [
    { label: name, path: `/admin/${slug}`, icon: 'Package', permission: `${slug}:view` },
  ],
  dependsOn: [],
  queues: [],
  env: [],
}, null, 2) + '\n');

await write(join(moduleDir, 'schema.js'), `import { z } from 'zod';

export const create${pascal}Schema = z.object({
  // TODO: add fields
});

export const update${pascal}Schema = create${pascal}Schema.partial();
`);

await write(join(moduleDir, 'service.js'), `import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export const list${pascal}s = async () => {
  // TODO: implement
  return [];
};

export const create${pascal} = async (data, actorId) => {
  // TODO: implement
  writeActivityAsync({
    actor: actorId,
    module: 'user-management/${slug}',
    action: 'created',
    description: \`${name} created\`,
  });
};
`);

await write(join(moduleDir, 'controller.js'), `import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { create${pascal}Schema } from './schema.js';
import { list${pascal}s, create${pascal} } from './service.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await list${pascal}s();
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = create${pascal}Schema.parse(req.body);
    const item = await create${pascal}(data, req.user?.id);
    successResponse(res, { item }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
`);

await write(join(moduleDir, 'routes.js'), `import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { getAll, postCreate } from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('${slug}', 'view'), getAll);
router.post('/', authenticate, requirePermission('${slug}', 'add'), postCreate);

export default router;
`);

await write(join(moduleDir, 'seed.js'), `import { prisma } from '../../config/database.js';

export async function seed${pascal}(prismaClient = prisma) {
  // TODO: add idempotent seed data for ${name}
  console.log('${slug}.seed: no seed data defined');
}
`);

await write(schemaFile, `// ${name} module schema
// Add Prisma models for this module here.
// Each model must be in this file only — never mix with other modules.

// model ${pascal} {
//   id         String   @id @default(cuid())
//   created_at DateTime @default(now())
//   updated_at DateTime @updatedAt
//
//   @@map("${slug.replace(/-/g, '_')}s")
// }
`);

// ── Frontend files ────────────────────────────────────────────────────────────

const frontendPageDir = join(FRONTEND_ROOT, 'src', 'app', 'admin', slug);

await write(join(frontendPageDir, 'page.tsx'), `'use client'

import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'

export default function ${pascal}Page() {
  return (
    <ModuleGuard slug="${slug}">
      <div className="p-6">
        <PageHeader title="${name}" />
        <p className="mt-4 text-gray-500">TODO: implement ${name} UI</p>
      </div>
    </ModuleGuard>
  )
}
`);

// ── Print new module checklist ───────────────────────────────────────────────

console.log(`
✅ Scaffold created for module "${slug}" (${name})

New Module Checklist — satisfy before the review gate:
  [ ] manifest valid (Zod), slug matches folder + schema file + apiPrefix
  [ ] all models in own prisma/schema/${slug}.prisma; migration applies clean
  [ ] all routes behind moduleGate(slug) + authenticate + requirePermission
  [ ] permissions registered via manifest only (never manual seeder edits)
  [ ] every mutation calls writeActivity
  [ ] frontend pages wrapped in ModuleGuard; nav via frontend manifest only
  [ ] module works when OTHER modules are disabled
  [ ] disable → re-enable round-trip leaves no orphan state
`);
