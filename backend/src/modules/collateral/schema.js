import { z } from 'zod';

export const collateralTypeEnum = z.enum(['VISITING_CARD', 'LETTERHEAD', 'TSHIRT', 'ID_CARD']);
export const renderFormatEnum = z.enum(['PDF_PRINT', 'PDF_DIGITAL', 'DOCX', 'PNG']);

export const createAssetSchema = z.object({
  body: z.object({
    projectId: z.string().min(1),
    type: collateralTypeEnum,
    name: z.string().min(1).max(200),
    brandKitVersion: z.number().int().positive(),
  }),
});

export const listAssetsQuerySchema = z.object({
  query: z.object({
    projectId: z.string().min(1),
  }),
});

export const assetParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const updateAssetSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    spec: z.record(z.unknown()).optional(),
    name: z.string().min(1).max(200).optional(),
  }),
});

export const renderParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    format: renderFormatEnum,
    variant: z.string().optional(),
  }),
});

export const renderIdParamSchema = z.object({
  params: z.object({
    renderId: z.string().min(1),
  }),
});
