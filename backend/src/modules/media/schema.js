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
  }),
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
