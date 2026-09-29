import { z } from 'zod';

const linkType = z.enum(['page', 'custom', 'external']);

// Blocks javascript:/data:/vbscript: hrefs (stored-XSS via menu URL) while
// still allowing relative paths, http(s), mailto, and tel.
const safeUrl = z
  .string()
  .max(1000)
  .refine(
    (v) => {
      if (!v) return true;
      if (v.startsWith('#')) return true;
      if (v.startsWith('/') && !v.startsWith('//')) return true;
      try {
        const scheme = new URL(v).protocol;
        return ['http:', 'https:', 'mailto:', 'tel:'].includes(scheme);
      } catch {
        return false;
      }
    },
    { message: 'URL must be http(s), mailto, tel, or a relative path' }
  )
  .nullish();

export const listMenusSchema = z.object({
  query: z.object({
    project_id: z.string().min(1).optional(),
  }),
});

export const getMenuSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const publicMenuSchema = z.object({
  query: z.object({
    key: z.string().min(1),
    project_id: z.string().min(1).optional(),
  }),
});

export const ensureMenuSchema = z.object({
  body: z.object({
    project_id: z.string().min(1).nullish(),
    key: z.string().min(1).max(50),
    name: z.string().min(1).max(150),
  }),
});

export const updateMenuSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
  }),
});

export const deleteMenuSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const createMenuItemSchema = z.object({
  params: z.object({ menuId: z.string().min(1) }),
  body: z.object({
    parent_id: z.string().min(1).nullish(),
    label: z.string().min(1).max(150),
    link_type: linkType.default('custom'),
    page_id: z.string().min(1).nullish(),
    url: safeUrl,
    open_in_new_tab: z.boolean().default(false),
    is_active: z.boolean().default(true),
    no_page: z.boolean().default(false),
    order: z.number().int().default(0),
  }),
});

export const updateMenuItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    label: z.string().min(1).max(150).optional(),
    link_type: linkType.optional(),
    page_id: z.string().min(1).nullish(),
    url: safeUrl,
    open_in_new_tab: z.boolean().optional(),
    is_active: z.boolean().optional(),
    no_page: z.boolean().optional(),
  }),
});

export const deleteMenuItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

// Bulk reorder/reparent — sent after every drag-and-drop operation with the
// whole tree's new flat shape (id, parent_id, order). Simpler and less
// error-prone than diffing individual moves client-side.
export const reorderMenuItemsSchema = z.object({
  params: z.object({ menuId: z.string().min(1) }),
  body: z.object({
    items: z
      .array(
        z.object({
          id: z.string().min(1),
          parent_id: z.string().min(1).nullable(),
          order: z.number().int().min(0),
        })
      )
      .min(1)
      .max(500),
  }),
});
