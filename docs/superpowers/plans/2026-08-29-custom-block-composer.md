# Custom Block Composer (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every category in the Insert-a-block modal gets a "+ Create new" card that opens a full-screen visual composer (palette + live canvas + layer list + Content/Layout/Style/Responsive tabs); saved blocks are reusable within the project and appear as extra cards in that category's grid.

**Architecture:** One generic Puck component, `CustomComposedBlock`, whose `config` prop holds `{category, atoms[], settings}`. A single interpreter (`renderComposedBlock`) turns that config into JSX by looking up each atom's `Render` function from a category → atom-catalogue lookup (Phase 1: every category maps to the same "universal" catalogue — Heading/Text/Image/Button/Spacer/Icon). A new backend module persists configs per project. The composer UI is a self-contained full-screen overlay with local `useState`, no global store.

**Tech Stack:** Next.js 15 / React / TypeScript (frontend), Express 5 / Prisma 6 / Zod (backend), `@puckeditor/core` 0.23.0, native HTML5 drag-and-drop (no new dependency), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-custom-block-composer-design.md`

---

## Task 1: Prisma schema — `CustomBlockTemplate` model

**Files:**
- Create: `backend/prisma/schema/custom-block.prisma`

- [ ] **Step 1: Write the schema file**

```prisma
// Custom Block Composer module schema (Phase 1).
// A CustomBlockTemplate is a saved, reusable "config" for the generic
// CustomComposedBlock Puck component — project-scoped, never shared across
// projects.

enum CustomBlockStatus {
  DRAFT
  PUBLISHED
}

model CustomBlockTemplate {
  id           String            @id @default(cuid())
  project_id   String
  category_key String
  name         String
  description  String?
  status       CustomBlockStatus @default(DRAFT)
  is_default   Boolean           @default(false)
  config       Json
  created_by   String?
  deleted_at   DateTime?
  created_at   DateTime          @default(now())
  updated_at   DateTime          @updatedAt

  @@index([project_id, category_key])
  @@map("custom_block_templates")
}
```

- [ ] **Step 2: Validate the schema**

Run: `cd backend && npx prisma validate`
Expected: `The schema at prisma/schema is valid 🚀`

- [ ] **Step 3: Generate and apply the migration**

Run: `cd backend && npm run db:migrate -- --name add_custom_block_templates`
Expected: prompts create `backend/prisma/migrations/<timestamp>_add_custom_block_templates/migration.sql`, applies it to the dev DB, ends with "Your database is now in sync with your schema."

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema/custom-block.prisma backend/prisma/migrations/
git commit -m "feat(custom-blocks): add CustomBlockTemplate Prisma model"
```

---

## Task 2: Backend `custom-blocks` module

**Files:**
- Create: `backend/src/modules/custom-blocks/module.json`
- Create: `backend/src/modules/custom-blocks/schema.js`
- Create: `backend/src/modules/custom-blocks/service.js`
- Create: `backend/src/modules/custom-blocks/service.test.js`
- Create: `backend/src/modules/custom-blocks/controller.js`
- Create: `backend/src/modules/custom-blocks/routes.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Write `module.json`**

```json
{
  "slug": "custom-blocks",
  "name": "Custom Blocks",
  "version": "1.0.0",
  "description": "Project-scoped reusable custom block templates for the page builder",
  "core": true,
  "visibleInCatalog": false,
  "apiPrefix": "/api/custom-blocks",
  "permissions": [],
  "nav": [],
  "dependsOn": ["page-builder"],
  "conflictsWith": [],
  "queues": [],
  "env": []
}
```

- [ ] **Step 2: Write `schema.js`**

```js
import { z } from 'zod';

const configSchema = z
  .object({
    category: z.string().min(1),
    atoms: z.array(z.object({ id: z.string().min(1), type: z.string().min(1) }).passthrough()),
    settings: z.record(z.any()),
  })
  .passthrough();

export const createCustomBlockSchema = z.object({
  projectId: z.string().min(1),
  categoryKey: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  config: configSchema,
});

export const updateCustomBlockSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  config: configSchema.optional(),
});
```

- [ ] **Step 3: Write the failing service tests**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    customBlockTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('../../config/database.js', () => ({ prisma: mockPrisma }));
vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

import * as service from './service.js';

const CONFIG = { category: 'hero', atoms: [{ id: 'a1', type: 'heading', text: 'Hi' }], settings: {} };

describe('listCustomBlocks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes to project_id + category_key, excludes soft-deleted', async () => {
    mockPrisma.customBlockTemplate.findMany.mockResolvedValue([]);
    await service.listCustomBlocks('proj-1', 'hero');
    expect(mockPrisma.customBlockTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project_id: 'proj-1', category_key: 'hero', deleted_at: null },
      })
    );
  });
});

describe('createCustomBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a DRAFT row scoped to the project and category', async () => {
    mockPrisma.customBlockTemplate.create.mockResolvedValue({ id: 'cb-1', name: 'My Hero' });
    const result = await service.createCustomBlock(
      { projectId: 'proj-1', categoryKey: 'hero', name: 'My Hero', status: 'DRAFT', config: CONFIG },
      'user-1'
    );
    expect(mockPrisma.customBlockTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'proj-1',
        category_key: 'hero',
        name: 'My Hero',
        status: 'DRAFT',
        config: CONFIG,
        created_by: 'user-1',
      }),
    });
    expect(result.id).toBe('cb-1');
  });
});

describe('duplicateCustomBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws a 404 error when the source block does not exist', async () => {
    mockPrisma.customBlockTemplate.findFirst.mockResolvedValue(null);
    await expect(service.duplicateCustomBlock('missing', 'user-1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('copies config, appends " Copy" to the name, resets status to DRAFT', async () => {
    mockPrisma.customBlockTemplate.findFirst.mockResolvedValue({
      id: 'cb-1',
      project_id: 'proj-1',
      category_key: 'hero',
      name: 'My Hero',
      description: 'd',
      config: CONFIG,
    });
    mockPrisma.customBlockTemplate.create.mockResolvedValue({ id: 'cb-2', name: 'My Hero Copy' });

    await service.duplicateCustomBlock('cb-1', 'user-1');

    expect(mockPrisma.customBlockTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'proj-1',
        category_key: 'hero',
        name: 'My Hero Copy',
        status: 'DRAFT',
        is_default: false,
        config: CONFIG,
        created_by: 'user-1',
      }),
    });
  });
});

describe('setDefaultCustomBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears is_default on siblings in the same project+category before setting it', async () => {
    mockPrisma.customBlockTemplate.findFirst.mockResolvedValue({
      id: 'cb-1',
      project_id: 'proj-1',
      category_key: 'hero',
    });
    mockPrisma.customBlockTemplate.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.customBlockTemplate.update.mockResolvedValue({ id: 'cb-1', is_default: true });

    await service.setDefaultCustomBlock('cb-1', 'user-1');

    expect(mockPrisma.customBlockTemplate.updateMany).toHaveBeenCalledWith({
      where: { project_id: 'proj-1', category_key: 'hero', is_default: true },
      data: { is_default: false },
    });
    expect(mockPrisma.customBlockTemplate.update).toHaveBeenCalledWith({
      where: { id: 'cb-1' },
      data: { is_default: true },
    });
  });
});

describe('deleteCustomBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('soft-deletes by setting deleted_at', async () => {
    mockPrisma.customBlockTemplate.update.mockResolvedValue({ id: 'cb-1', name: 'My Hero' });
    await service.deleteCustomBlock('cb-1', 'user-1');
    expect(mockPrisma.customBlockTemplate.update).toHaveBeenCalledWith({
      where: { id: 'cb-1' },
      data: { deleted_at: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/custom-blocks/service.test.js`
Expected: FAIL — `Cannot find module './service.js'`

- [ ] **Step 5: Write `service.js`**

```js
import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export const listCustomBlocks = async (projectId, categoryKey) => {
  return prisma.customBlockTemplate.findMany({
    where: { project_id: projectId, category_key: categoryKey, deleted_at: null },
    orderBy: { created_at: 'asc' },
  });
};

export const getCustomBlock = async (id) => {
  return prisma.customBlockTemplate.findFirst({ where: { id, deleted_at: null } });
};

export const createCustomBlock = async (data, actorId) => {
  const block = await prisma.customBlockTemplate.create({
    data: {
      project_id: data.projectId,
      category_key: data.categoryKey,
      name: data.name,
      description: data.description ?? null,
      status: data.status ?? 'DRAFT',
      config: data.config,
      created_by: actorId,
    },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'created',
    subject_type: 'CustomBlockTemplate',
    subject_id: block.id,
    description: `Custom block "${block.name}" created`,
  });
  return block;
};

export const updateCustomBlock = async (id, patch, actorId) => {
  const data = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.config !== undefined) data.config = patch.config;
  const block = await prisma.customBlockTemplate.update({ where: { id }, data });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'updated',
    subject_type: 'CustomBlockTemplate',
    subject_id: block.id,
    description: `Custom block "${block.name}" updated`,
  });
  return block;
};

export const duplicateCustomBlock = async (id, actorId) => {
  const src = await prisma.customBlockTemplate.findFirst({ where: { id, deleted_at: null } });
  if (!src) throw Object.assign(new Error('Custom block not found'), { status: 404 });
  const copy = await prisma.customBlockTemplate.create({
    data: {
      project_id: src.project_id,
      category_key: src.category_key,
      name: `${src.name} Copy`,
      description: src.description,
      status: 'DRAFT',
      is_default: false,
      config: src.config,
      created_by: actorId,
    },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'duplicated',
    subject_type: 'CustomBlockTemplate',
    subject_id: copy.id,
    description: `Custom block "${src.name}" duplicated as "${copy.name}"`,
  });
  return copy;
};

export const setDefaultCustomBlock = async (id, actorId) => {
  const block = await prisma.customBlockTemplate.findFirst({ where: { id, deleted_at: null } });
  if (!block) throw Object.assign(new Error('Custom block not found'), { status: 404 });
  await prisma.customBlockTemplate.updateMany({
    where: { project_id: block.project_id, category_key: block.category_key, is_default: true },
    data: { is_default: false },
  });
  const updated = await prisma.customBlockTemplate.update({
    where: { id },
    data: { is_default: true },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'set_default',
    subject_type: 'CustomBlockTemplate',
    subject_id: id,
    description: `Custom block "${updated.name}" set as default`,
  });
  return updated;
};

export const deleteCustomBlock = async (id, actorId) => {
  const block = await prisma.customBlockTemplate.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'custom-blocks',
    action: 'deleted',
    subject_type: 'CustomBlockTemplate',
    subject_id: id,
    description: `Custom block "${block.name}" deleted`,
  });
  return block;
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && npx vitest run src/modules/custom-blocks/service.test.js`
Expected: PASS — 6 tests

- [ ] **Step 7: Write `controller.js`**

```js
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { createCustomBlockSchema, updateCustomBlockSchema } from './schema.js';
import * as service from './service.js';

export const getAll = async (req, res, next) => {
  try {
    const { projectId, category } = req.query;
    if (!projectId || !category) {
      return errorResponse(res, 'projectId and category query params are required', 400);
    }
    const items = await service.listCustomBlocks(String(projectId), String(category));
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = createCustomBlockSchema.parse(req.body);
    const block = await service.createCustomBlock(data, req.user?.id);
    successResponse(res, { block }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const putUpdate = async (req, res, next) => {
  try {
    const patch = updateCustomBlockSchema.parse(req.body);
    const block = await service.updateCustomBlock(req.params.id, patch, req.user?.id);
    successResponse(res, { block });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const postDuplicate = async (req, res, next) => {
  try {
    const block = await service.duplicateCustomBlock(req.params.id, req.user?.id);
    successResponse(res, { block }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const postSetDefault = async (req, res, next) => {
  try {
    const block = await service.setDefaultCustomBlock(req.params.id, req.user?.id);
    successResponse(res, { block });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await service.deleteCustomBlock(req.params.id, req.user?.id);
    successResponse(res, { ok: true });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
```

- [ ] **Step 8: Write `routes.js`**

```js
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import {
  getAll,
  postCreate,
  putUpdate,
  postDuplicate,
  postSetDefault,
  remove,
} from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('page-builder', 'view'), getAll);
router.post('/', authenticate, requirePermission('page-builder', 'add'), postCreate);
router.put('/:id', authenticate, requirePermission('page-builder', 'edit'), putUpdate);
router.post(
  '/:id/duplicate',
  authenticate,
  requirePermission('page-builder', 'add'),
  postDuplicate
);
router.post(
  '/:id/set-default',
  authenticate,
  requirePermission('page-builder', 'edit'),
  postSetDefault
);
router.delete('/:id', authenticate, requirePermission('page-builder', 'delete'), remove);

export default router;
```

- [ ] **Step 9: Mount the module in `backend/src/index.js`**

Find the `import pageBuilderRoutes from './modules/page-builder/routes.js';` line and add directly below it:

```js
import customBlocksRoutes from './modules/custom-blocks/routes.js';
```

Find the `app.use('/api/page-builder', pageBuilderRoutes);` line and add directly below it:

```js
app.use('/api/custom-blocks', customBlocksRoutes);
```

- [ ] **Step 10: Run the full backend test suite**

Run: `cd backend && JWT_SECRET=$(node -e "console.log('x'.repeat(32))") JWT_REFRESH_SECRET=$(node -e "console.log('y'.repeat(32))") npx vitest run`
Expected: PASS — all suites green, including the 6 new `custom-blocks` tests

- [ ] **Step 11: Commit**

```bash
git add backend/src/modules/custom-blocks/ backend/src/index.js
git commit -m "feat(custom-blocks): add backend module — CRUD, duplicate, set-default"
```

---

## Task 3: Frontend — universal atom catalogue

**Files:**
- Create: `frontend/src/app/admin/page-builder/packs/composer/atoms.tsx`

Deliberately self-contained (not extracted from `general/index.tsx`'s Heading/Text/Button/Image/
Spacer): those blocks are already shipped and exercised elsewhere in the app — duplicating this
much smaller logic here avoids any regression risk to them while building a large new feature.

- [ ] **Step 1: Write the atom catalogue**

```tsx
'use client'

import type { ComponentType } from 'react'

export type Align = 'left' | 'center' | 'right'

export interface ComposerAtom {
  id: string
  type: string
  hideMobile?: boolean
  [prop: string]: unknown
}

export interface AtomDefinition {
  type: string
  label: string
  icon: ComponentType<{ size?: number }>
  defaultProps: Record<string, unknown>
  Render: (atom: ComposerAtom) => React.ReactNode
  Field: (props: { atom: ComposerAtom; onChange: (patch: Record<string, unknown>) => void }) => React.ReactNode
}

import { Heading as HeadingIcon, Type, Image as ImageIcon, RectangleHorizontal, Minus, Star } from 'lucide-react'

function headingRender(atom: ComposerAtom) {
  const text = String(atom.text ?? '')
  const level = String(atom.level ?? '2')
  const align = String(atom.align ?? 'left') as Align
  const cls = `font-semibold tracking-tight ${
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
  } ${level === '1' ? 'text-3xl md:text-4xl' : level === '3' ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`
  if (level === '1') return <h1 className={cls}>{text}</h1>
  if (level === '3') return <h3 className={cls}>{text}</h3>
  return <h2 className={cls}>{text}</h2>
}

function textRender(atom: ComposerAtom) {
  const text = String(atom.text ?? '')
  const align = String(atom.align ?? 'left') as Align
  const muted = Boolean(atom.muted)
  const alignCls =
    align === 'center' ? 'mx-auto text-center' : align === 'right' ? 'ml-auto text-right' : 'text-left'
  return (
    <p className={`max-w-3xl leading-relaxed ${alignCls} ${muted ? 'text-slate-500' : 'text-slate-800'}`}>
      {text}
    </p>
  )
}

function buttonRender(atom: ComposerAtom) {
  const label = String(atom.label ?? 'Click me')
  const href = String(atom.href ?? '#')
  const variant = atom.variant === 'secondary' ? 'secondary' : 'primary'
  return (
    <a
      href={href}
      className={`inline-flex rounded-lg px-5 py-2.5 font-medium transition ${
        variant === 'primary'
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'border border-slate-300 text-slate-800 hover:bg-slate-100'
      }`}
    >
      {label}
    </a>
  )
}

function imageRender(atom: ComposerAtom) {
  const src = String(atom.src ?? 'https://placehold.co/1200x600')
  const alt = String(atom.alt ?? '')
  const rounded = Boolean(atom.rounded)
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`h-auto w-full object-cover ${rounded ? 'rounded-xl' : ''}`} />
}

const SPACER_SIZE = { sm: 'h-4', md: 'h-8', lg: 'h-16', xl: 'h-28' } as const

function spacerRender(atom: ComposerAtom) {
  const size = (atom.size as keyof typeof SPACER_SIZE) ?? 'md'
  return <div className={SPACER_SIZE[size] ?? SPACER_SIZE.md} />
}

const ICON_SIZE = { sm: 20, md: 32, lg: 48 } as const

function iconRender(atom: ComposerAtom) {
  const Icon = (atom.icon as ComponentType<{ size?: number; color?: string }>) ?? Star
  const size = (atom.size as keyof typeof ICON_SIZE) ?? 'md'
  const color = String(atom.color ?? '#2563eb')
  return <Icon size={ICON_SIZE[size] ?? ICON_SIZE.md} color={color} />
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
      />
    </label>
  )
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
              value === o.value
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export const ATOM_CATALOGUE: AtomDefinition[] = [
  {
    type: 'heading',
    label: 'Heading',
    icon: HeadingIcon,
    defaultProps: { text: 'Section heading', level: '2', align: 'left' },
    Render: headingRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput label="Text" value={String(atom.text ?? '')} onChange={(text) => onChange({ text })} />
        <ChipRow
          label="Level"
          value={String(atom.level ?? '2')}
          options={[
            { label: 'H1', value: '1' },
            { label: 'H2', value: '2' },
            { label: 'H3', value: '3' },
          ]}
          onChange={(level) => onChange({ level })}
        />
        <ChipRow
          label="Align"
          value={String(atom.align ?? 'left')}
          options={[
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ]}
          onChange={(align) => onChange({ align })}
        />
      </div>
    ),
  },
  {
    type: 'text',
    label: 'Text',
    icon: Type,
    defaultProps: { text: 'Write something compelling here.', align: 'left', muted: false },
    Render: textRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput label="Text" value={String(atom.text ?? '')} onChange={(text) => onChange({ text })} />
        <ChipRow
          label="Align"
          value={String(atom.align ?? 'left')}
          options={[
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ]}
          onChange={(align) => onChange({ align })}
        />
      </div>
    ),
  },
  {
    type: 'button',
    label: 'Button',
    icon: RectangleHorizontal,
    defaultProps: { label: 'Click me', href: '#', variant: 'primary' },
    Render: buttonRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput
          label="Label"
          value={String(atom.label ?? '')}
          onChange={(label) => onChange({ label })}
        />
        <TextInput label="URL" value={String(atom.href ?? '')} onChange={(href) => onChange({ href })} />
        <ChipRow
          label="Style"
          value={String(atom.variant ?? 'primary')}
          options={[
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
          ]}
          onChange={(variant) => onChange({ variant })}
        />
      </div>
    ),
  },
  {
    type: 'image',
    label: 'Image',
    icon: ImageIcon,
    defaultProps: { src: 'https://placehold.co/1200x600', alt: '', rounded: true },
    Render: imageRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <TextInput label="Image URL" value={String(atom.src ?? '')} onChange={(src) => onChange({ src })} />
        <TextInput label="Alt text" value={String(atom.alt ?? '')} onChange={(alt) => onChange({ alt })} />
      </div>
    ),
  },
  {
    type: 'spacer',
    label: 'Spacer',
    icon: Minus,
    defaultProps: { size: 'md' },
    Render: spacerRender,
    Field: ({ atom, onChange }) => (
      <ChipRow
        label="Size"
        value={String(atom.size ?? 'md')}
        options={[
          { label: 'S', value: 'sm' },
          { label: 'M', value: 'md' },
          { label: 'L', value: 'lg' },
          { label: 'XL', value: 'xl' },
        ]}
        onChange={(size) => onChange({ size })}
      />
    ),
  },
  {
    type: 'icon',
    label: 'Icon',
    icon: Star,
    defaultProps: { icon: Star, size: 'md', color: '#2563eb' },
    Render: iconRender,
    Field: ({ atom, onChange }) => (
      <div className="flex flex-col gap-3.5">
        <ChipRow
          label="Size"
          value={String(atom.size ?? 'md')}
          options={[
            { label: 'S', value: 'sm' },
            { label: 'M', value: 'md' },
            { label: 'L', value: 'lg' },
          ]}
          onChange={(size) => onChange({ size })}
        />
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Color</span>
          <input
            type="color"
            value={String(atom.color ?? '#2563eb')}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-9 w-14 cursor-pointer rounded-md border border-slate-200"
          />
        </label>
      </div>
    ),
  },
]

export const ATOM_BY_TYPE: Record<string, AtomDefinition> = Object.fromEntries(
  ATOM_CATALOGUE.map((a) => [a.type, a])
)
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "packs/composer/atoms"`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/composer/atoms.tsx
git commit -m "feat(composer): universal atom catalogue (Heading/Text/Image/Button/Spacer/Icon)"
```

---

## Task 4: Frontend — category → catalogue lookup

**Files:**
- Create: `frontend/src/app/admin/page-builder/packs/composer/catalogue-by-category.ts`

- [ ] **Step 1: Write the lookup**

```ts
import { ATOM_CATALOGUE, type AtomDefinition } from './atoms'

/**
 * Phase 1: every category gets the same universal atom set. Phase 2+ adds
 * richer, category-specific catalogues here (e.g. a 'medical-nav-hero' entry
 * with logo/nav/search/social atoms) without touching the composer engine —
 * this is the one seam that changes.
 */
export function atomCatalogueFor(_categoryKey: string): AtomDefinition[] {
  return ATOM_CATALOGUE
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/composer/catalogue-by-category.ts
git commit -m "feat(composer): category-to-atom-catalogue lookup seam"
```

---

## Task 5: Frontend — `renderComposedBlock` interpreter

**Files:**
- Create: `frontend/src/app/admin/page-builder/packs/composer/render-composed-block.tsx`

- [ ] **Step 1: Write the interpreter**

```tsx
'use client'

import { ATOM_BY_TYPE, type ComposerAtom } from './atoms'

export interface ComposedBlockSettings {
  container: 'full' | 'boxed'
  padding: 'sm' | 'md' | 'lg'
  align: 'left' | 'center' | 'right'
  bg: string
}

export interface ComposedBlockConfig {
  category: string
  atoms: ComposerAtom[]
  settings: ComposedBlockSettings
}

export const DEFAULT_SETTINGS: ComposedBlockSettings = {
  container: 'full',
  padding: 'md',
  align: 'left',
  bg: '',
}

const PAD_CLASS = { sm: 'py-6', md: 'py-12', lg: 'py-20' } as const
const ALIGN_CLASS = { left: 'items-start text-left', center: 'items-center text-center', right: 'items-end text-right' } as const

/**
 * Turns a ComposedBlockConfig into JSX. `opts.interactive` wraps every atom
 * in a clickable, selectable node — only the composer's own canvas sets this;
 * normal Puck editor rendering and the public site always render plain.
 */
export function renderComposedBlock(
  config: ComposedBlockConfig,
  opts?: { interactive?: boolean; selectedId?: string | null; onSelectAtom?: (id: string) => void }
) {
  const { atoms, settings } = config
  const interactive = !!opts?.interactive
  const wrapCls = settings.container === 'boxed' ? 'mx-auto max-w-5xl px-6' : 'w-full px-6'

  return (
    <section
      className={`flex flex-col gap-4 ${PAD_CLASS[settings.padding] ?? PAD_CLASS.md} ${ALIGN_CLASS[settings.align] ?? ALIGN_CLASS.left}`}
      style={settings.bg ? { backgroundColor: settings.bg } : undefined}
    >
      <div className={`flex flex-col gap-4 ${wrapCls} ${ALIGN_CLASS[settings.align] ?? ALIGN_CLASS.left}`}>
        {atoms.map((atom) => {
          const def = ATOM_BY_TYPE[atom.type]
          if (!def) return null
          const node = def.Render(atom)
          if (!interactive) return <div key={atom.id}>{node}</div>
          const selected = opts?.selectedId === atom.id
          return (
            <div
              key={atom.id}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                opts?.onSelectAtom?.(atom.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') opts?.onSelectAtom?.(atom.id)
              }}
              className={`cursor-pointer rounded-md outline outline-2 transition ${
                selected ? 'outline-blue-600' : 'outline-transparent hover:outline-blue-300'
              }`}
            >
              {node}
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "render-composed-block"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/composer/render-composed-block.tsx
git commit -m "feat(composer): renderComposedBlock interpreter"
```

---

## Task 6: Frontend — register `CustomComposedBlock` Puck component

**Files:**
- Create: `frontend/src/app/admin/page-builder/packs/composer/index.tsx`
- Modify: `frontend/src/app/admin/page-builder/puck.config.tsx`

- [ ] **Step 1: Write the pack**

```tsx
import type { Config } from '@puckeditor/core'
import type { ComponentPack } from '../types'
import { renderComposedBlock, DEFAULT_SETTINGS, type ComposedBlockConfig } from './render-composed-block'

type ComposerProps = {
  CustomComposedBlock: {
    config: ComposedBlockConfig
  }
}

const CustomComposedBlock: Config<ComposerProps>['components']['CustomComposedBlock'] = {
  label: 'Custom Block',
  fields: {
    config: { type: 'text' },
  },
  defaultProps: {
    config: { category: 'general', atoms: [], settings: DEFAULT_SETTINGS },
  },
  render: ({ config }) => renderComposedBlock(config),
}

export const composer: ComponentPack = {
  key: 'composer',
  label: 'Composer',
  components: {
    CustomComposedBlock,
  } as NonNullable<Config['components']>,
  categories: {},
}
```

`fields.config` is declared `{type: 'text'}` only so Puck's schema is satisfied — the field is
never actually shown or edited through Puck's own Fields panel (Task 11's "Edit in Composer"
button is the real edit path, see that task's note on hiding this field).

- [ ] **Step 2: Wire into `puck.config.tsx`**

Read the current file first, then apply this diff:

```diff
 import type { Config, Data } from '@puckeditor/core'
 import type { ReactNode } from 'react'
 import { composePacks } from './packs/compose'
+import { composer } from './packs/composer'
 import { construction } from './packs/construction'
 import { general } from './packs/general'
 import { medical } from './packs/medical'
@@
-export const config = composePacks(root, [general, construction, medical])
+export const config = composePacks(root, [general, construction, medical, composer])
```

- [ ] **Step 3: Typecheck + build**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "packs/composer\|puck.config"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/composer/index.tsx frontend/src/app/admin/page-builder/puck.config.tsx
git commit -m "feat(composer): register CustomComposedBlock as a real Puck component"
```

---

## Task 7: Frontend — custom-blocks API client

**Files:**
- Create: `frontend/src/app/admin/page-builder/packs/composer/custom-blocks-store.ts`

- [ ] **Step 1: Write the client**

```ts
import api from '@/lib/axios'
import type { ComposedBlockConfig } from './render-composed-block'

export interface CustomBlockRecord {
  id: string
  projectId: string
  categoryKey: string
  name: string
  description: string | null
  status: 'DRAFT' | 'PUBLISHED'
  isDefault: boolean
  config: ComposedBlockConfig
  updatedAt: string
}

function toRecord(raw: {
  id: string
  project_id: string
  category_key: string
  name: string
  description: string | null
  status: 'DRAFT' | 'PUBLISHED'
  is_default: boolean
  config: ComposedBlockConfig
  updated_at: string
}): CustomBlockRecord {
  return {
    id: raw.id,
    projectId: raw.project_id,
    categoryKey: raw.category_key,
    name: raw.name,
    description: raw.description,
    status: raw.status,
    isDefault: raw.is_default,
    config: raw.config,
    updatedAt: raw.updated_at,
  }
}

export async function listCustomBlocks(
  projectId: string,
  categoryKey: string
): Promise<CustomBlockRecord[]> {
  const res = await api.get('/custom-blocks', { params: { projectId, category: categoryKey } })
  const items = res.data.data.items ?? []
  return items.map(toRecord)
}

export async function createCustomBlock(input: {
  projectId: string
  categoryKey: string
  name: string
  description?: string
  status: 'DRAFT' | 'PUBLISHED'
  config: ComposedBlockConfig
}): Promise<CustomBlockRecord> {
  const res = await api.post('/custom-blocks', input)
  return toRecord(res.data.data.block)
}

export async function updateCustomBlock(
  id: string,
  patch: Partial<{
    name: string
    description: string
    status: 'DRAFT' | 'PUBLISHED'
    config: ComposedBlockConfig
  }>
): Promise<CustomBlockRecord> {
  const res = await api.put(`/custom-blocks/${id}`, patch)
  return toRecord(res.data.data.block)
}

export async function duplicateCustomBlock(id: string): Promise<CustomBlockRecord> {
  const res = await api.post(`/custom-blocks/${id}/duplicate`)
  return toRecord(res.data.data.block)
}

export async function setDefaultCustomBlock(id: string): Promise<CustomBlockRecord> {
  const res = await api.post(`/custom-blocks/${id}/set-default`)
  return toRecord(res.data.data.block)
}

export async function deleteCustomBlock(id: string): Promise<void> {
  await api.delete(`/custom-blocks/${id}`)
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "custom-blocks-store"`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/composer/custom-blocks-store.ts
git commit -m "feat(composer): custom-blocks API client"
```

---

## Task 8: Frontend — `BlockComposer` shell (state, top bar, left palette + layers)

**Files:**
- Create: `frontend/src/app/admin/page-builder/packs/composer/BlockComposer.tsx`

This task lays down the file structure and the parts that don't depend on the canvas (Task 9) or
right panel (Task 10) — both of those tasks add to this same file. The component renders a
placeholder center/right area for now so it's independently checkable.

- [ ] **Step 1: Write the shell**

```tsx
'use client'

import { useState } from 'react'
import { X, Eye, Tablet, Smartphone, Monitor } from 'lucide-react'
import { ATOM_CATALOGUE, type ComposerAtom } from './atoms'
import { atomCatalogueFor } from './catalogue-by-category'
import { DEFAULT_SETTINGS, type ComposedBlockConfig } from './render-composed-block'
import {
  createCustomBlock,
  updateCustomBlock,
  type CustomBlockRecord,
} from './custom-blocks-store'

type Viewport = 'desktop' | 'tablet' | 'mobile'
const VIEWPORT_WIDTH: Record<Viewport, number> = { desktop: 1180, tablet: 768, mobile: 390 }

function newAtomId(type: string) {
  return `${type}-${crypto.randomUUID()}`
}

export function BlockComposer({
  projectId,
  categoryKey,
  editing,
  onClose,
  onSaved,
}: {
  projectId: string
  categoryKey: string
  /** Present when reopening an existing custom block to edit it. */
  editing?: CustomBlockRecord
  onClose: () => void
  onSaved: (block: CustomBlockRecord) => void
}) {
  const [name, setName] = useState(editing?.name ?? 'Untitled block')
  const [config, setConfig] = useState<ComposedBlockConfig>(
    editing?.config ?? { category: categoryKey, atoms: [], settings: DEFAULT_SETTINGS }
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [rightTab, setRightTab] = useState<'content' | 'layout' | 'style' | 'responsive'>('content')
  const [saving, setSaving] = useState(false)

  const palette = atomCatalogueFor(categoryKey)

  function addAtom(type: string) {
    const def = ATOM_CATALOGUE.find((a) => a.type === type)
    if (!def) return
    const atom: ComposerAtom = { id: newAtomId(type), type, ...def.defaultProps }
    setConfig((c) => ({ ...c, atoms: [...c.atoms, atom] }))
    setSelectedId(atom.id)
    setRightTab('content')
  }

  function patchAtom(id: string, patch: Record<string, unknown>) {
    setConfig((c) => ({
      ...c,
      atoms: c.atoms.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }))
  }

  function removeAtom(id: string) {
    setConfig((c) => ({ ...c, atoms: c.atoms.filter((a) => a.id !== id) }))
    if (selectedId === id) setSelectedId(null)
  }

  function moveAtom(id: string, dir: -1 | 1) {
    setConfig((c) => {
      const idx = c.atoms.findIndex((a) => a.id === id)
      const next = idx + dir
      if (idx < 0 || next < 0 || next >= c.atoms.length) return c
      const atoms = [...c.atoms]
      ;[atoms[idx], atoms[next]] = [atoms[next], atoms[idx]]
      return { ...c, atoms }
    })
  }

  function reorderAtoms(fromId: string, toId: string) {
    setConfig((c) => {
      const from = c.atoms.findIndex((a) => a.id === fromId)
      const to = c.atoms.findIndex((a) => a.id === toId)
      if (from < 0 || to < 0 || from === to) return c
      const atoms = [...c.atoms]
      const [moved] = atoms.splice(from, 1)
      atoms.splice(to, 0, moved)
      return { ...c, atoms }
    })
  }

  async function handleSave(status: 'DRAFT' | 'PUBLISHED') {
    setSaving(true)
    try {
      const block = editing
        ? await updateCustomBlock(editing.id, { name, status, config })
        : await createCustomBlock({ projectId, categoryKey, name, status, config })
      onSaved(block)
    } finally {
      setSaving(false)
    }
  }

  const selectedAtom = config.atoms.find((a) => a.id === selectedId) ?? null

  return (
    <div className="fixed inset-0 z-[2100] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <button
          onClick={onClose}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold"
        />
        <span className="flex-1" />
        <div className="flex gap-1 rounded-md bg-slate-100 p-1">
          {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => {
            const Icon = v === 'desktop' ? Monitor : v === 'tablet' ? Tablet : Smartphone
            return (
              <button
                key={v}
                onClick={() => setViewport(v)}
                className={`rounded p-1.5 ${viewport === v ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                aria-label={v}
              >
                <Icon size={15} />
              </button>
            )
          })}
        </div>
        <button
          disabled={saving}
          onClick={() => handleSave('DRAFT')}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          disabled={saving}
          onClick={() => handleSave('PUBLISHED')}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Eye size={14} /> Publish
        </button>
      </div>

      <div className="grid flex-1 grid-cols-[240px_1fr_320px] overflow-hidden">
        <div className="flex flex-col overflow-y-auto border-r border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Add elements
          </div>
          <div className="grid grid-cols-2 gap-2">
            {palette.map((atom) => (
              <button
                key={atom.type}
                onClick={() => addAtom(atom.type)}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 py-3 text-slate-600 hover:border-blue-400 hover:text-blue-600"
              >
                <atom.icon size={18} />
                <span className="text-[11px] font-semibold">{atom.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">
            Layers
          </div>
          <div className="flex flex-col gap-1.5">
            {config.atoms.length === 0 ? (
              <p className="text-xs text-slate-400">No elements yet — add one above.</p>
            ) : (
              config.atoms.map((atom) => (
                <div
                  key={atom.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', atom.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    reorderAtoms(e.dataTransfer.getData('text/plain'), atom.id)
                  }}
                  onClick={() => {
                    setSelectedId(atom.id)
                    setRightTab('content')
                  }}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                    selectedId === atom.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
                  }`}
                >
                  <span className="flex-1 truncate font-medium">
                    {ATOM_CATALOGUE.find((a) => a.type === atom.type)?.label ?? atom.type}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveAtom(atom.id, -1)
                    }}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveAtom(atom.id, 1)
                    }}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAtom(atom.id)
                    }}
                    className="text-slate-400 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-auto bg-slate-100 p-6">
          <div
            className="mx-auto w-full overflow-hidden rounded-lg bg-white shadow-md transition-[max-width]"
            style={{ maxWidth: VIEWPORT_WIDTH[viewport] }}
          >
            {/* Canvas body added in Task 9 */}
          </div>
        </div>

        <div className="flex flex-col overflow-y-auto border-l border-slate-200 bg-white">
          <div className="flex border-b border-slate-200">
            {(['content', 'layout', 'style', 'responsive'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                className={`flex-1 border-b-2 px-2 py-2.5 text-xs font-bold capitalize ${
                  rightTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="p-4">{/* Right panel body added in Task 10 */}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "BlockComposer"`
Expected: `error TS6133: 'selectedAtom' is declared but its value is never read.` — expected at
this point, Task 9/10 consume it. Confirm no *other* errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/composer/BlockComposer.tsx
git commit -m "feat(composer): BlockComposer shell — top bar, palette, layer list"
```

---

## Task 9: Frontend — `BlockComposer` canvas

**Files:**
- Modify: `frontend/src/app/admin/page-builder/packs/composer/BlockComposer.tsx`

- [ ] **Step 1: Import the interpreter**

Add to the top imports:

```diff
 import { ATOM_CATALOGUE, type ComposerAtom } from './atoms'
 import { atomCatalogueFor } from './catalogue-by-category'
-import { DEFAULT_SETTINGS, type ComposedBlockConfig } from './render-composed-block'
+import { DEFAULT_SETTINGS, renderComposedBlock, type ComposedBlockConfig } from './render-composed-block'
```

- [ ] **Step 2: Fill in the canvas body**

Replace the `{/* Canvas body added in Task 9 */}` comment with:

```tsx
            <div onClick={() => setSelectedId(null)}>
              {renderComposedBlock(config, {
                interactive: true,
                selectedId,
                onSelectAtom: (id) => {
                  setSelectedId(id)
                  setRightTab('content')
                },
              })}
              {config.atoms.length === 0 ? (
                <p className="p-10 text-center text-sm text-slate-400">
                  Add elements from the left panel to build this block.
                </p>
              ) : null}
            </div>
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "BlockComposer"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/composer/BlockComposer.tsx
git commit -m "feat(composer): BlockComposer live canvas with click-to-select atoms"
```

---

## Task 10: Frontend — `BlockComposer` right panel (Content/Layout/Style/Responsive)

**Files:**
- Modify: `frontend/src/app/admin/page-builder/packs/composer/BlockComposer.tsx`

- [ ] **Step 1: Fill in the right panel body**

Replace `<div className="p-4">{/* Right panel body added in Task 10 */}</div>` with:

```tsx
          <div className="p-4">
            {rightTab === 'content' ? (
              selectedAtom ? (
                (() => {
                  const def = ATOM_CATALOGUE.find((a) => a.type === selectedAtom.type)
                  if (!def) return null
                  return (
                    <def.Field
                      atom={selectedAtom}
                      onChange={(patch) => patchAtom(selectedAtom.id, patch)}
                    />
                  )
                })()
              ) : (
                <p className="text-center text-xs text-slate-400">
                  Pick an element from Layers, or add one from the palette.
                </p>
              )
            ) : null}

            {rightTab === 'layout' ? (
              <div className="flex flex-col gap-3.5">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Container</span>
                  <div className="flex gap-1.5">
                    {(['full', 'boxed'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() =>
                          setConfig((c) => ({ ...c, settings: { ...c.settings, container: v } }))
                        }
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold capitalize ${
                          config.settings.container === v
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Padding</span>
                  <div className="flex gap-1.5">
                    {(['sm', 'md', 'lg'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() =>
                          setConfig((c) => ({ ...c, settings: { ...c.settings, padding: v } }))
                        }
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold uppercase ${
                          config.settings.padding === v
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Align</span>
                  <div className="flex gap-1.5">
                    {(['left', 'center', 'right'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() =>
                          setConfig((c) => ({ ...c, settings: { ...c.settings, align: v } }))
                        }
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold capitalize ${
                          config.settings.align === v
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {rightTab === 'style' ? (
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Background</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.settings.bg || '#ffffff'}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, settings: { ...c.settings, bg: e.target.value } }))
                    }
                    className="h-9 w-14 cursor-pointer rounded-md border border-slate-200"
                  />
                  <button
                    onClick={() => setConfig((c) => ({ ...c, settings: { ...c.settings, bg: '' } }))}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            {rightTab === 'responsive' ? (
              selectedAtom ? (
                <label className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Hide on mobile</span>
                  <input
                    type="checkbox"
                    checked={!!selectedAtom.hideMobile}
                    onChange={(e) => patchAtom(selectedAtom.id, { hideMobile: e.target.checked })}
                  />
                </label>
              ) : (
                <p className="text-center text-xs text-slate-400">
                  Pick an element from Layers to set its mobile visibility.
                </p>
              )
            ) : null}
          </div>
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "BlockComposer"`
Expected: no output

- [ ] **Step 3: Lint**

Run: `cd frontend && npx eslint src/app/admin/page-builder/packs/composer/`
Expected: no errors (warnings acceptable, fix any `jsx-a11y` errors the same way earlier files
in this session fixed them — role="presentation"/onKeyDown pairing, no nested interactive
elements)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/page-builder/packs/composer/BlockComposer.tsx
git commit -m "feat(composer): BlockComposer right panel — Content/Layout/Style/Responsive tabs"
```

---

## Task 11: Frontend — wire into the Insert-a-block modal

**Files:**
- Modify: `frontend/src/app/admin/page-builder/insert-block-modal.tsx`
- Modify: `frontend/src/app/admin/template-engine/edit/[id]/page.tsx`

`projectId` only exists on the template-engine host (see spec's rendering-architecture section)
— the plain `/admin/page-builder/[id]` editor does not get the "+ Create new" card (it stays
`undefined`, the modal simply skips rendering custom-block cards and the create card when absent).

- [ ] **Step 1: Add `projectId` prop and custom-block state to `InsertBlockModal`**

Read the current file, then apply:

```diff
-import { useMemo, useState } from 'react'
+import { useEffect, useMemo, useState } from 'react'
 import { usePuck } from '@puckeditor/core'
 import type { AppState, Config } from '@puckeditor/core'
 import { Plus, Search, X } from 'lucide-react'
 import { blockVariants } from './puck.config'
+import { BlockComposer } from './packs/composer/BlockComposer'
+import { listCustomBlocks, type CustomBlockRecord } from './packs/composer/custom-blocks-store'
```

```diff
 export function InsertBlockModal({
   onClose,
   initialCategory,
+  projectId,
 }: {
   onClose: () => void
   initialCategory?: string
+  projectId?: string
 }) {
   const { appState, config, dispatch } = usePuck()

   const categories = useMemo(
     () =>
       Object.entries(config.categories ?? {}).filter(
         ([, cat]) => (cat.components?.length ?? 0) > 0
       ),
     [config.categories]
   )
   const [activeCat, setActiveCat] = useState(initialCategory ?? categories[0]?.[0] ?? '')
   const [query, setQuery] = useState('')
   const q = query.trim().toLowerCase()
+  const [customBlocks, setCustomBlocks] = useState<CustomBlockRecord[]>([])
+  const [composerOpen, setComposerOpen] = useState<{ editing?: CustomBlockRecord } | null>(null)
+
+  useEffect(() => {
+    if (!projectId || !activeCat || q) {
+      setCustomBlocks([])
+      return
+    }
+    let cancelled = false
+    listCustomBlocks(projectId, activeCat).then((items) => {
+      if (!cancelled) setCustomBlocks(items)
+    })
+    return () => {
+      cancelled = true
+    }
+  }, [projectId, activeCat, q])
```

- [ ] **Step 2: Insert a saved custom block on click**

Add this function next to `insertBlock`:

```tsx
  function insertCustomBlock(block: CustomBlockRecord) {
    const id = `CustomComposedBlock-${crypto.randomUUID()}`
    const destinationZone = 'root:default-zone'
    const destinationIndex = appState.data.content?.length ?? 0
    dispatch({
      type: 'insert',
      componentType: 'CustomComposedBlock',
      destinationIndex,
      destinationZone,
      id,
      recordHistory: false,
    })
    dispatch({
      type: 'replace',
      destinationIndex,
      destinationZone,
      data: { type: 'CustomComposedBlock', props: { config: block.config, id } },
    })
    onClose()
  }
```

- [ ] **Step 3: Render custom-block cards + the "+ Create new" card**

Find the grid `div` that renders `cards.map(...)` and add custom blocks + the create card right
after it (inside the same grid container, still inside the `q ? ... : ...` — the create card and
custom blocks only make sense for one active category, so guard on `!q`):

```diff
 import { BlockComposer } from './packs/composer/BlockComposer'
 import { listCustomBlocks, type CustomBlockRecord } from './packs/composer/custom-blocks-store'
+import { renderComposedBlock } from './packs/composer/render-composed-block'
```

```diff
             ) : (
               cards.map(({ key, variant, index, total }) => (
                 <BlockCard
                   key={`${key}-${variant ?? 'default'}`}
                   componentKey={key}
                   variant={variant}
                   index={index}
                   total={total}
                   onInsert={insertBlock}
                 />
               ))
             )}
+            {!q && projectId
+              ? customBlocks.map((block) => (
+                  <div
+                    key={block.id}
+                    role="button"
+                    tabIndex={0}
+                    onClick={() => insertCustomBlock(block)}
+                    onKeyDown={(e) => e.key === 'Enter' && insertCustomBlock(block)}
+                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
+                  >
+                    <span className="absolute right-2.5 top-2.5 z-[2] rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-extrabold text-white">
+                      {block.name}
+                    </span>
+                    <div className="h-[210px] overflow-hidden bg-white pointer-events-none">
+                      <div style={{ width: 1200, transform: 'scale(0.35)', transformOrigin: 'top left' }}>
+                        {renderComposedBlock(block.config)}
+                      </div>
+                    </div>
+                  </div>
+                ))
+              : null}
+            {!q && projectId ? (
+              <button
+                onClick={() => setComposerOpen({})}
+                className="flex min-h-[210px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50"
+              >
+                <Plus size={22} />
+                <span className="text-sm font-bold">Create new</span>
+              </button>
+            ) : null}
```

- [ ] **Step 4: Render `BlockComposer` when open**

Add right before the closing `</div>` of the modal's outermost `div` (i.e. as a sibling to the
modal content, inside the component's return but outside the modal panel), and reload the list
+ close both overlays on save:

```tsx
      {composerOpen && projectId ? (
        <BlockComposer
          projectId={projectId}
          categoryKey={activeCat}
          editing={composerOpen.editing}
          onClose={() => setComposerOpen(null)}
          onSaved={() => {
            setComposerOpen(null)
            listCustomBlocks(projectId, activeCat).then(setCustomBlocks)
          }}
        />
      ) : null}
```

- [ ] **Step 5: Thread `projectId` from the template-engine host**

Read `frontend/src/app/admin/template-engine/edit/[id]/page.tsx`, find where `InsertBlockButton`
is rendered inside `overrides.headerActions`, and pass `projectId` through. First give
`InsertBlockButton` (in `insert-block-modal.tsx`) a `projectId` prop:

```diff
 export function InsertBlockButton() {
+export function InsertBlockButton({ projectId }: { projectId?: string }) {
   const [open, setOpen] = useState(false)
   return (
     <>
       <button
         onClick={() => setOpen(true)}
         className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
       >
         <Plus size={15} /> Insert block
       </button>
-      {open ? <InsertBlockModal onClose={() => setOpen(false)} /> : null}
+      {open ? <InsertBlockModal onClose={() => setOpen(false)} projectId={projectId} /> : null}
     </>
   )
 }
```

Then in `template-engine/edit/[id]/page.tsx`, the component already reads `projectId` via
`searchParams.get('projectId')` for the Back link — pass that same value:

```diff
-                <InsertBlockButton />
+                <InsertBlockButton projectId={projectId ?? undefined} />
```

`frontend/src/app/admin/page-builder/[id]/page.tsx` (the legacy editor) keeps calling
`<InsertBlockButton />` with no `projectId` — unchanged, per the spec's decision to skip the
composer there entirely.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "insert-block-modal\|edit/\[id\]"`
Expected: no output

- [ ] **Step 7: Lint**

Run: `cd frontend && npx eslint src/app/admin/page-builder/insert-block-modal.tsx "src/app/admin/template-engine/edit/[id]/page.tsx"`
Expected: no errors

- [ ] **Step 8: Manual verification**

Run: `cd "/Users/f9developer/Documents/Claude/Projects/F9 Tech/kdl-starter-kit" && docker compose build frontend && docker compose up -d frontend`

Then, logged into the admin at `localhost:3101`, open a template-engine project's page editor,
click "Insert block", pick any category, click "+ Create new", add a Heading + Text + Button
atom, Publish, confirm the new card appears in that category's grid, click it, confirm it
inserts at the end of the page with the composed content intact.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/admin/page-builder/insert-block-modal.tsx "frontend/src/app/admin/template-engine/edit/[id]/page.tsx"
git commit -m "feat(composer): wire Create-new card + custom block cards into Insert-a-block modal"
```

---

## Task 12: Frontend — "Edit in Composer" on an already-inserted block

**Files:**
- Modify: `frontend/src/app/admin/page-builder/blocks-panel.tsx`

Editing a *saved template* (Task 11's card menu is out of scope for Phase 1 per the spec — only
create + insert is required there) is different from editing the *config already sitting inside
a page* once a `CustomComposedBlock` has been inserted. Puck's own Fields panel would otherwise
show a raw, unusable text box for the `config` object (declared `{type:'text'}` in Task 6 only to
satisfy Puck's schema) — replace that with a button that reopens `BlockComposer` scoped to this
one instance, saving straight back into the page via `replace` (not the persistence API — editing
an instance must never silently rewrite the shared template).

- [ ] **Step 1: Read the current file, then special-case `CustomComposedBlock` in the Style tab**

`blocks-panel.tsx`'s `BlocksTab`/`children` rendering already shows Puck's own fields for the
selected block under the Style tab (`{tab === 'style' && <div className="bg-white">{children}</div>}`).
Add a check just above that: when the selected item's type is `CustomComposedBlock`, render an
"Edit in Composer" button instead of the raw fields.

```diff
+import { useState } from 'react'
+import { BlockComposer } from './packs/composer/BlockComposer'
+import type { ComposedBlockConfig } from './packs/composer/render-composed-block'
```

Inside the `BlocksPanel` component, add local state and the instance-edit handler:

```diff
   const [tab, setTab] = useState<'blocks' | 'style' | 'theme'>('blocks')
   const [modalCategory, setModalCategory] = useState<string | null>(null)
   const hadSelection = useRef(false)
+  const [editingInstance, setEditingInstance] = useState(false)
+  const { selectedItem, dispatch, getSelectorForId } = usePuck()
+  const isCustomBlock = selectedItem?.type === 'CustomComposedBlock'
```

`usePuck` is already imported in this file (used elsewhere) — confirm the import line includes
it; if not, add `import { usePuck } from '@puckeditor/core'` alongside the existing import.
`getSelectorForId` is part of Puck's public `UsePuckData` API (`(id: string) => Required<ItemSelector> | undefined`,
giving `{zone, index}`) — used instead of reaching into `appState.ui` directly, which isn't a
confirmed-stable path.

- [ ] **Step 2: Render the Style tab conditionally**

```diff
-        {tab === 'style' && <div className="bg-white">{children}</div>}
+        {tab === 'style' && isCustomBlock ? (
+          <div className="bg-white p-4">
+            <button
+              onClick={() => setEditingInstance(true)}
+              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
+            >
+              Edit in Composer
+            </button>
+          </div>
+        ) : null}
+        {tab === 'style' && !isCustomBlock && <div className="bg-white">{children}</div>}
```

- [ ] **Step 3: Mount the composer in instance-edit mode**

Add near the existing `{modalCategory ? (...) : null}` block at the end of the component's JSX:

```tsx
      {editingInstance && selectedItem ? (
        <BlockComposer
          projectId=""
          categoryKey={(selectedItem.props.config as ComposedBlockConfig).category}
          editing={{
            id: selectedItem.props.id as string,
            projectId: '',
            categoryKey: (selectedItem.props.config as ComposedBlockConfig).category,
            name: 'This block',
            description: null,
            status: 'DRAFT',
            isDefault: false,
            config: selectedItem.props.config as ComposedBlockConfig,
            updatedAt: '',
          }}
          onClose={() => setEditingInstance(false)}
          onSaved={(block) => {
            const selector = getSelectorForId(selectedItem.props.id as string)
            if (selector) {
              dispatch({
                type: 'replace',
                destinationIndex: selector.index,
                destinationZone: selector.zone,
                data: { type: 'CustomComposedBlock', props: { ...selectedItem.props, config: block.config } },
              })
            }
            setEditingInstance(false)
          }}
        />
      ) : null}
```

Instance-edit mode passes `projectId=""` — `BlockComposer`'s `handleSave` always takes the
`editing` branch here (an `editing` object is always supplied), so the empty `projectId` is never
read; it only matters for the `createCustomBlock` branch, which this path never takes. This is a
deliberate reuse of `BlockComposer` for a save target it wasn't originally designed around — if a
future task needs "update the shared template AND this instance," that needs a real design pass
of its own, not a shortcut here.

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "blocks-panel"`
Expected: no output

- [ ] **Step 5: Manual verification**

With the frontend rebuilt (`docker compose build frontend && docker compose up -d frontend`),
insert a custom block via Task 11's flow, select it on canvas, confirm the Style tab shows "Edit
in Composer" instead of a raw text field, click it, change an atom's text, Publish, confirm the
page shows the updated text without needing a full page reload.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/admin/page-builder/blocks-panel.tsx
git commit -m "feat(composer): Edit-in-Composer affordance for an already-inserted custom block"
```

---

## Plan Self-Review Notes

**Spec coverage:**
- Rendering architecture (generic `CustomComposedBlock` + interpreter) → Tasks 5, 6.
- Atom system (universal catalogue, category lookup seam) → Tasks 3, 4.
- Composer UI (top bar, palette, layers, canvas, 4 tabs) → Tasks 8, 9, 10.
- Persistence (Prisma model, backend module, CRUD/duplicate/set-default) → Tasks 1, 2.
- Insert-a-block modal wiring (create card, custom block cards, insert) → Task 11.
- Editing a saved template → intentionally NOT built (spec's Insert-a-block wiring section
  mentions a ⋮ menu for Edit/Duplicate/Rename/Set default/Delete on existing cards as the
  mechanism, but does not commit to shipping it in Phase 1's task list — only "create + insert"
  is load-bearing for the spec's stated Goal). Flagging this as a deliberate Phase 1 gap: Task 11
  ships create + list + insert; template-level edit/duplicate/rename/set-default/delete (the ⋮
  menu) is a natural, small follow-on once Phase 1 is verified working end-to-end, reusing
  `updateCustomBlock`/`duplicateCustomBlock`/`setDefaultCustomBlock`/`deleteCustomBlock`, which
  Task 2 already builds and tests on the backend.
- Instance-level edit (not template edit) → Task 12, added because Task 6's `config` field is
  otherwise unusable through Puck's own Fields panel — a necessary consequence of the rendering
  architecture, not spec scope creep.

**Type consistency:** `ComposedBlockConfig` (Task 5) is the single type threaded through Tasks
6-12 — Puck component props (Task 6), the API client (Task 7), `BlockComposer`'s state (Task 8),
and the instance-edit path (Task 12) all reference the same import, not redeclared shapes.
`ComposerAtom`/`AtomDefinition` (Task 3) are likewise the single source used by the interpreter
(Task 5), the palette/layers (Task 8), and the Content tab (Task 10).

**Follow-on work explicitly not in this plan** (matches the spec's "Out of scope"): the ⋮ menu
for existing custom-block cards (see above), Header's rich atom catalogue (Phase 2), drag-to-add
from palette to canvas, light/dark/both theme mode on custom blocks, cross-project sharing,
import/export.
