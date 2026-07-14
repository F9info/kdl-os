import { z } from 'zod';
import { INPUT_TYPE_KEYS } from '../../shared/constants/inputTypes.js';

const inputTypeEnum = z.enum(INPUT_TYPE_KEYS);

export const listFieldsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    type_id: z.string().optional(),
    category_id: z.string().optional(),
    input_type: inputTypeEnum.optional(),
    sortBy: z.enum(['field_name', 'created_at', 'sort']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    ownerModule: z.string().optional(),
  }),
});

export const getFieldSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const createFieldSchema = z.object({
  body: z.object({
    field_name: z.string().min(1).max(150),
    input_type: inputTypeEnum,
    options: z.string().max(2000).nullish(),
    type_id: z.string().min(1),
    category_id: z.string().min(1).nullish(),
    sort: z.number().int().min(0).optional(),
  }),
});

export const updateFieldSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    field_name: z.string().min(1).max(150).optional(),
    input_type: inputTypeEnum.optional(),
    options: z.string().max(2000).nullish(),
    type_id: z.string().min(1).optional(),
    category_id: z.string().min(1).nullish(),
    sort: z.number().int().min(0).optional(),
  }),
});

export const deleteFieldSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const reorderFieldsSchema = z.object({
  body: z.object({
    // Ordered list of field ids; index becomes the new `sort`.
    ids: z.array(z.string().min(1)).min(1).max(500),
  }),
});

export const byTypeSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
});

export const valueBySlugSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
});

export const saveValuesSchema = z.object({
  body: z.object({
    type_id: z.string().min(1),
    values: z
      .array(
        z.object({
          id: z.string().min(1),
          value: z.string().nullish(),
          alt_text: z.string().max(500).nullish(),
        })
      )
      .max(500),
  }),
});

export const removeGalleryItemSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    index: z.string().regex(/^\d+$/),
  }),
});
