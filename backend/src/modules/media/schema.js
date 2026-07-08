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
    archived: z.enum(['true', 'false', 'all']).optional(),
    sort: z.enum(['created_at_desc', 'created_at_asc', 'name_asc', 'name_desc', 'size_desc']).optional(),
  }),
});

// File ops (A5)
export const copyMediaSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    folder_id: z.string().nullable().optional(),
  }).optional(),
});

export const archiveMediaSchema = z.object({
  body: z.object({
    media_ids: z.array(z.string().min(1)).min(1),
    archived: z.boolean(),
  }),
});

export const chunkInitSchema = z.object({
  body: z.object({
    filename: z.string().min(1).max(255),
    size: z.number().int().positive(),
    mime_type: z.string().min(1).max(255),
    folder_id: z.string().nullable().optional(),
    total_parts: z.number().int().positive(),
  }),
});

export const chunkPartSchema = z.object({
  params: z.object({ uploadId: z.string().uuid() }),
  query: z.object({ index: z.string().regex(/^\d+$/) }),
});

export const chunkSessionSchema = z.object({
  params: z.object({ uploadId: z.string().uuid() }),
});

export const zipImportSchema = z.object({
  body: z.object({
    folder_id: z.string().nullable().optional(),
  }).optional(),
});

export const urlImportSchema = z.object({
  body: z.object({
    url: z.string().min(1).max(2000),
    folder_id: z.string().nullable().optional(),
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

// ─── Processing schemas (Phase C) ───────────────────────────────────────────

export const jobIdSchema = z.object({
  params: z.object({ jobId: z.string().min(1) }),
});

export const versionIdSchema = z.object({
  params: z.object({ id: z.string().cuid(), versionId: z.string().min(1) }),
});

export const restoreVersionSchema = z.object({
  params: z.object({ id: z.string().cuid(), versionId: z.string().cuid() }),
});

// Image edit ops
const cropOp = z.object({ op: z.literal('crop'), left: z.number().int().min(0), top: z.number().int().min(0), width: z.number().int().min(1), height: z.number().int().min(1) });
const resizeOp = z.object({ op: z.literal('resize'), width: z.number().int().min(1).optional(), height: z.number().int().min(1).optional(), fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).default('inside') });
const rotateOp = z.object({ op: z.literal('rotate'), angle: z.number(), background: z.string().optional() });
const flipOp = z.object({ op: z.literal('flip') });
const flopOp = z.object({ op: z.literal('flop') });
const brightnessOp = z.object({ op: z.literal('brightness'), factor: z.number().min(0).max(10) });
const contrastOp = z.object({ op: z.literal('contrast'), factor: z.number().min(0).max(10) });
const saturationOp = z.object({ op: z.literal('saturation'), factor: z.number().min(0).max(10) });
const grayscaleOp = z.object({ op: z.literal('grayscale') });
const blurOp = z.object({ op: z.literal('blur'), sigma: z.number().min(0.3).max(1000).optional() });
const sharpenOp = z.object({ op: z.literal('sharpen') });
const negateOp = z.object({ op: z.literal('negate') });
const textWatermarkOp = z.object({ op: z.literal('text_watermark'), text: z.string().min(1).max(200), position: z.enum(['top-left','top-center','top-right','center','bottom-left','bottom-center','bottom-right']).default('bottom-right'), opacity: z.number().min(0).max(1).default(0.7), font_size: z.number().int().min(8).max(200).default(24), color: z.string().default('#ffffff') });
const logoWatermarkOp = z.object({ op: z.literal('logo_watermark'), logo_media_id: z.string().cuid(), position: z.enum(['top-left','top-center','top-right','center','bottom-left','bottom-center','bottom-right']).default('bottom-right'), opacity: z.number().min(0).max(1).default(0.7), scale: z.number().min(0.01).max(1).default(0.2) });
const compressOp = z.object({ op: z.literal('compress'), quality: z.number().int().min(1).max(100).default(80), format: z.enum(['jpeg','webp','avif','png']).optional() });

const imageOpSchema = z.discriminatedUnion('op', [
  cropOp, resizeOp, rotateOp, flipOp, flopOp,
  brightnessOp, contrastOp, saturationOp,
  grayscaleOp, blurOp, sharpenOp, negateOp,
  textWatermarkOp, logoWatermarkOp, compressOp,
]);

export const editMediaSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object({
    ops: z.array(imageOpSchema).min(1).max(20),
    note: z.string().max(500).optional(),
  }),
});

// PDF ops
export const pdfOpSchema = z.object({
  params: z.object({ id: z.string().cuid().optional() }).optional(),
  body: z.discriminatedUnion('op', [
    z.object({ op: z.literal('merge'), ids: z.array(z.string().cuid()).min(2).max(50), folder_id: z.string().cuid().optional(), name: z.string().max(255).optional() }),
    z.object({ op: z.literal('split'), id: z.string().cuid(), ranges: z.array(z.object({ start: z.number().int().min(1), end: z.number().int().min(1) })).min(1).max(50) }),
    z.object({ op: z.literal('compress'), id: z.string().cuid() }),
    z.object({ op: z.literal('password_protect'), id: z.string().cuid(), password: z.string().min(1).max(200) }),
    z.object({ op: z.literal('password_remove'), id: z.string().cuid(), password: z.string().min(1).max(200) }),
    z.object({ op: z.literal('watermark'), id: z.string().cuid(), text: z.string().min(1).max(200), opacity: z.number().min(0).max(1).default(0.3) }),
    z.object({ op: z.literal('thumbnail'), id: z.string().cuid() }),
    z.object({ op: z.literal('info'), id: z.string().cuid() }),
  ]),
});

// Video ops
export const videoOpSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.discriminatedUnion('op', [
    z.object({ op: z.literal('thumbnail'), time: z.number().min(0).default(1) }),
    z.object({ op: z.literal('poster'), time: z.number().min(0).default(1) }),
    z.object({ op: z.literal('preview_clip'), duration: z.number().min(1).max(30).default(5) }),
    z.object({ op: z.literal('trim'), start: z.number().min(0), end: z.number().min(0) }),
    z.object({ op: z.literal('transcode'), preset: z.enum(['1080p','720p','480p','360p']), format: z.enum(['mp4','webm']).default('mp4') }),
    z.object({ op: z.literal('watermark'), text: z.string().min(1).max(200), position: z.enum(['top-left','top-right','bottom-left','bottom-right']).default('bottom-right'), opacity: z.number().min(0).max(1).default(0.7) }),
    z.object({ op: z.literal('multi_resolution'), presets: z.array(z.enum(['1080p','720p','480p','360p'])).min(1).max(4) }),
    z.object({ op: z.literal('hls'), presets: z.array(z.enum(['1080p','720p','480p'])).min(1).max(3) }),
  ]),
});

// Audio ops
export const audioOpSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.discriminatedUnion('op', [
    z.object({ op: z.literal('waveform') }),
    z.object({ op: z.literal('trim'), start: z.number().min(0), end: z.number().min(0) }),
    z.object({ op: z.literal('normalize') }),
    z.object({ op: z.literal('convert'), format: z.enum(['mp3','wav','aac','ogg','flac']) }),
  ]),
});

// Speech-to-text (Phase D4)
export const transcribeMediaSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    language: z.string().min(2).max(8).optional(),
  }).optional(),
});

export const getTranscriptSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  query: z.object({
    format: z.enum(['json', 'srt', 'vtt']).optional(),
  }).optional(),
});

// Conversions
export const convertMediaSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z.object({
    to: z.enum(['webp','avif','png','jpeg','jpg','mp4','webm','mp3','wav']),
    quality: z.number().int().min(1).max(100).optional(),
  }),
});
