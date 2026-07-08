import { z } from 'zod';

export const uploadMediaSchema = z.object({
  body: z.object({
    folder_id: z.string().optional(),
  }).optional(),
});

export const listMediaSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    folder_id: z.string().optional(),
    type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER']).optional(),
    search: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    sort: z.enum(['created_at_desc', 'created_at_asc', 'name_asc', 'name_desc', 'size_desc']).optional(),
  }),
});

export const searchMediaSchema = z.object({
  query: z.object({
    q: z.string().max(500).optional(),
    type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER']).optional(),
    tags: z.string().optional(),      // csv
    meta: z.string().optional(),      // csv of slug:value
    folder_id: z.string().optional(),
    owner_id: z.string().optional(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    size_min: z.string().regex(/^\d+$/).optional(),
    size_max: z.string().regex(/^\d+$/).optional(),
    archived: z.enum(['true', 'false', 'all']).optional(),
    sort: z.enum(['created_at_desc', 'created_at_asc', 'name_asc', 'size_desc']).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

export const getMediaSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const deleteMediaSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const updateMediaSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title: z.string().optional(),
    alt_text: z.string().optional(),
    caption: z.string().optional(),
    original_name: z.string().optional(),
    tags: z.array(z.string().min(1).max(64)).max(50).optional(),
    meta: z.record(z.string().min(1), z.string().max(2000).nullable()).optional(),
  }),
});

// Tags
export const createTagSchema = z.object({
  body: z.object({ name: z.string().min(1).max(64) }),
});

export const updateTagSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ name: z.string().min(1).max(64) }),
});

export const deleteTagSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const tagMediaSchema = z.object({
  body: z.object({
    media_ids: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string().min(1).max(64)).min(1).max(50),
  }),
});

// Custom meta fields
const metaFieldSlug = z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9_-]*$/, 'slug must be lowercase alphanumeric with _ or -');

export const createMetaFieldSchema = z.object({
  body: z.object({
    slug: metaFieldSlug,
    label: z.string().min(1).max(255),
    field_type: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT']).optional(),
    options: z.array(z.string().min(1).max(255)).max(100).optional(),
  }).refine((b) => b.field_type !== 'SELECT' || (b.options && b.options.length > 0), {
    message: 'SELECT fields require options',
  }),
});

export const updateMetaFieldSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    slug: metaFieldSlug.optional(),
    label: z.string().min(1).max(255).optional(),
    field_type: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT']).optional(),
    options: z.array(z.string().min(1).max(255)).max(100).nullable().optional(),
  }),
});

export const deleteMetaFieldSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

// Collections
const collectionRules = z.record(z.string(), z.any());

export const createCollectionSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    is_smart: z.boolean().optional(),
    rules: collectionRules.optional(),
  }).refine((b) => !b.is_smart || b.rules, { message: 'Smart collections require rules' }),
});

export const updateCollectionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    rules: collectionRules.optional(),
  }),
});

export const collectionIdSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const collectionContentsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }).optional(),
});

export const collectionItemsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    media_ids: z.array(z.string().min(1)).min(1),
  }),
});

// Favorites / recents
export const mediaIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const pagedListSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }).optional(),
});

// Folder schemas
export const createFolderSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    parent_id: z.string().optional().nullable(),
  }),
});

export const updateFolderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    parent_id: z.string().optional().nullable(),
  }),
});

export const deleteFolderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({
    cascade: z.enum(['true', 'false']).optional(),
  }).optional(),
});

export const moveFolderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    parent_id: z.string().nullable(),
  }),
});

export const moveMediaSchema = z.object({
  body: z.object({
    media_ids: z.array(z.string().min(1)).min(1),
    folder_id: z.string().nullable(),
  }),
});

// Bulk / trash schemas
export const bulkDeleteSchema = z.object({
  body: z.object({
    media_ids: z.array(z.string().min(1)).min(1),
  }),
});

export const restoreTrashSchema = z.object({
  body: z.object({
    media_ids: z.array(z.string().min(1)).min(1),
  }),
});

export const registerUsageSchema = z.object({
  body: z.object({
    media_id: z.string().min(1),
    entity: z.string().min(1),
    entity_id: z.string().min(1),
  }),
});

export const releaseUsageSchema = z.object({
  body: z.object({
    media_id: z.string().min(1),
    entity: z.string().min(1),
    entity_id: z.string().min(1),
  }),
});
