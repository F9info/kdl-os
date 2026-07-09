import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/permission.js';
import {
  listMediaSchema, getMediaSchema, deleteMediaSchema, updateMediaSchema,
  createFolderSchema, updateFolderSchema, deleteFolderSchema,
  moveMediaSchema, bulkDeleteSchema, restoreTrashSchema,
  registerUsageSchema, releaseUsageSchema,
  createTagSchema, updateTagSchema, deleteTagSchema, tagMediaSchema,
  createMetaFieldSchema, updateMetaFieldSchema, deleteMetaFieldSchema,
  searchMediaSchema,
  createCollectionSchema, updateCollectionSchema, collectionIdSchema,
  collectionContentsSchema, collectionItemsSchema,
  mediaIdParamSchema, pagedListSchema,
  copyMediaSchema, archiveMediaSchema,
  chunkInitSchema, chunkPartSchema, chunkSessionSchema,
  zipImportSchema, urlImportSchema,
  editMediaSchema, jobIdSchema, versionIdSchema, restoreVersionSchema,
  pdfOpSchema, videoOpSchema, audioOpSchema, convertMediaSchema,
  transcribeMediaSchema, getTranscriptSchema, aiImageOpSchema,
  createShareSchema, shareIdParamSchema, shareTokenParamSchema,
  transformQuerySchema, createCommentSchema, commentIdParamSchema,
  reuploadVersionSchema, workflowTransitionSchema,
} from './schema.js';
import {
  uploadMedia, listMedia, getMedia, updateMedia, deleteMedia, bulkDelete,
  listFolders, createFolder, updateFolder, deleteFolder, moveMedia,
  listTrash, restoreTrash, purgeTrash,
  getMediaUsage, registerUsage, releaseUsage,
  listTags, createTag, renameTag, deleteTag, tagMedia, untagMedia,
  listMetaFields, createMetaField, updateMetaField, deleteMetaField,
  searchMedia, reindexMedia,
  listCollections, createCollection, updateCollection, deleteCollection,
  getCollectionContents, addCollectionItems, removeCollectionItems,
  favoriteMedia, unfavoriteMedia, listFavorites, touchMedia, listRecents,
  copyMedia, archiveMedia,
  chunkInit, chunkPart, chunkStatus, chunkComplete,
  importZip, importUrl,
  editMedia, getJob,
  listVersions, restoreVersion,
  pdfOp, videoOp, audioOp, convertMedia,
  analyzeMedia, listMediaSuggestions, acceptMediaSuggestion, rejectMediaSuggestion,
  ocrMedia, transcribeMedia, getTranscript, aiImageOp,
  getTransform,
  listComments, createComment, deleteComment,
  transitionWorkflow, reuploadAsVersion,
  createShareLink, revokeShareLink, listShareLinks, shareQr, shareEmbed,
} from './controller.js';
import {
  getAiStatus, listAiDrivers, listAiProviders,
  createAiProvider, updateAiProvider, deleteAiProvider,
} from './ai/controller.js';
import { requireFeature } from './ai/ai-provider.service.js';

const router = Router();

router.use(authenticate);

// Folders
router.get('/folders', requirePermission('media', 'view'), listFolders);
router.post('/folders', requirePermission('media', 'add'), validate(createFolderSchema), createFolder);
router.patch('/folders/:id', requirePermission('media', 'edit'), validate(updateFolderSchema), updateFolder);
router.delete('/folders/:id', requirePermission('media', 'delete'), validate(deleteFolderSchema), deleteFolder);

// Move files between folders
router.post('/move', requirePermission('media', 'edit'), validate(moveMediaSchema), moveMedia);

// Bulk ops
router.post('/bulk-delete', requirePermission('media', 'delete'), validate(bulkDeleteSchema), bulkDelete);

// Trash
router.get('/trash', requirePermission('media', 'delete'), listTrash);
router.post('/trash/restore', requirePermission('media', 'delete'), validate(restoreTrashSchema), restoreTrash);
router.delete('/trash/purge', requirePermission('media', 'delete'), purgeTrash);

// Upload (multi-file)
router.post('/upload', requirePermission('media', 'add'), upload.array('files', 20), uploadMedia);

// Backward-compat single-file upload alias
router.post('/upload/single', requirePermission('media', 'add'), upload.single('file'), uploadMedia);

// Chunked + resumable upload (50MB+ files)
router.post('/upload/chunked/init', requirePermission('media', 'add'), validate(chunkInitSchema), chunkInit);
router.put('/upload/chunked/:uploadId/part', requirePermission('media', 'add'), upload.single('chunk'), validate(chunkPartSchema), chunkPart);
router.get('/upload/chunked/:uploadId/status', requirePermission('media', 'add'), validate(chunkSessionSchema), chunkStatus);
router.post('/upload/chunked/:uploadId/complete', requirePermission('media', 'add'), validate(chunkSessionSchema), chunkComplete);

// Imports
router.post('/import/zip', requirePermission('media', 'add'), upload.single('file'), validate(zipImportSchema), importZip);
router.post('/import/url', requirePermission('media', 'add'), validate(urlImportSchema), importUrl);

// Archive flag (bulk)
router.post('/archive', requirePermission('media', 'edit'), validate(archiveMediaSchema), archiveMedia);

// Usage tracking (test + integration endpoints)
router.post('/usage/register', requirePermission('media', 'edit'), validate(registerUsageSchema), registerUsage);
router.post('/usage/release', requirePermission('media', 'edit'), validate(releaseUsageSchema), releaseUsage);

// Search (MeiliSearch-backed, faceted)
router.get('/search', requirePermission('media', 'view'), validate(searchMediaSchema), searchMedia);
router.post('/search/reindex', requirePermission('media', 'edit'), reindexMedia);

// Tags
router.get('/tags', requirePermission('media', 'view'), listTags);
router.post('/tags', requirePermission('media', 'edit'), validate(createTagSchema), createTag);
router.patch('/tags/:id', requirePermission('media', 'edit'), validate(updateTagSchema), renameTag);
router.delete('/tags/:id', requirePermission('media', 'edit'), validate(deleteTagSchema), deleteTag);
router.post('/tag', requirePermission('media', 'edit'), validate(tagMediaSchema), tagMedia);
router.post('/untag', requirePermission('media', 'edit'), validate(tagMediaSchema), untagMedia);

// Collections (smart + static)
router.get('/collections', requirePermission('media', 'view'), listCollections);
router.post('/collections', requirePermission('media', 'edit'), validate(createCollectionSchema), createCollection);
router.get('/collections/:id', requirePermission('media', 'view'), validate(collectionContentsSchema), getCollectionContents);
router.patch('/collections/:id', requirePermission('media', 'edit'), validate(updateCollectionSchema), updateCollection);
router.delete('/collections/:id', requirePermission('media', 'edit'), validate(collectionIdSchema), deleteCollection);
router.post('/collections/:id/items', requirePermission('media', 'edit'), validate(collectionItemsSchema), addCollectionItems);
router.delete('/collections/:id/items', requirePermission('media', 'edit'), validate(collectionItemsSchema), removeCollectionItems);

// Favorites + recents
router.get('/favorites', requirePermission('media', 'view'), validate(pagedListSchema), listFavorites);
router.get('/recent', requirePermission('media', 'view'), validate(pagedListSchema), listRecents);

// Custom meta fields (admin)
router.get('/meta-fields', requirePermission('media', 'view'), listMetaFields);
router.post('/meta-fields', requirePermission('media', 'edit'), validate(createMetaFieldSchema), createMetaField);
router.patch('/meta-fields/:id', requirePermission('media', 'edit'), validate(updateMetaFieldSchema), updateMetaField);
router.delete('/meta-fields/:id', requirePermission('media', 'edit'), validate(deleteMetaFieldSchema), deleteMetaField);

// Processing jobs status
router.get('/jobs/:jobId', requirePermission('media', 'view'), validate(jobIdSchema), getJob);

// AI provider config (Phase D — keep above the generic /:id routes)
router.get('/ai/status', requirePermission('media', 'view'), getAiStatus);
router.get('/ai/drivers', requirePermission('media', 'edit'), listAiDrivers);
router.get('/ai/providers', requirePermission('media', 'edit'), listAiProviders);
router.post('/ai/providers', requirePermission('media', 'edit'), createAiProvider);
router.patch('/ai/providers/:id', requirePermission('media', 'edit'), updateAiProvider);
router.delete('/ai/providers/:id', requirePermission('media', 'edit'), deleteAiProvider);

// AI suggestions (Phase D2) — keep above the generic /:id routes
router.post('/suggestions/:id/accept', requirePermission('media', 'edit'), validate(mediaIdParamSchema), acceptMediaSuggestion);
router.post('/suggestions/:id/reject', requirePermission('media', 'edit'), validate(mediaIdParamSchema), rejectMediaSuggestion);

// Transform (B2) — on-the-fly image resize/format/filter; cached in MinIO
router.get('/:id/t', requirePermission('media', 'view'), validate(transformQuerySchema), getTransform);

// Share management (B4) — authenticated CRUD; static paths before /:id wildcards
router.post('/shares', requirePermission('media', 'share'), validate(createShareSchema), createShareLink);
router.delete('/shares/:id', requirePermission('media', 'share'), validate(shareIdParamSchema), revokeShareLink);
router.get('/shares/:token/qr', requirePermission('media', 'share'), validate(shareTokenParamSchema), shareQr);
router.get('/shares/:token/embed', requirePermission('media', 'share'), validate(shareTokenParamSchema), shareEmbed);
router.get('/:id/shares', requirePermission('media', 'share'), validate(mediaIdParamSchema), listShareLinks);

// Versioning (B5) — re-upload file onto existing media record → new MediaVersion
router.post('/:id/upload', requirePermission('media', 'edit'), upload.single('file'), validate(reuploadVersionSchema), reuploadAsVersion);

// Comments (B5)
router.get('/:id/comments', requirePermission('media', 'view'), validate(mediaIdParamSchema), listComments);
router.post('/:id/comments', requirePermission('media', 'view'), validate(createCommentSchema), createComment);
router.delete('/:id/comments/:commentId', requirePermission('media', 'view'), validate(commentIdParamSchema), deleteComment);

// Workflow (B6)
router.patch('/:id/workflow', requirePermission('media', 'approve'), validate(workflowTransitionSchema), transitionWorkflow);

// List + CRUD
router.get('/', requirePermission('media', 'view'), validate(listMediaSchema), listMedia);
router.post('/:id/favorite', requirePermission('media', 'view'), validate(mediaIdParamSchema), favoriteMedia);
router.delete('/:id/favorite', requirePermission('media', 'view'), validate(mediaIdParamSchema), unfavoriteMedia);
router.post('/:id/touch', requirePermission('media', 'view'), validate(mediaIdParamSchema), touchMedia);
router.post('/:id/copy', requirePermission('media', 'add'), validate(copyMediaSchema), copyMedia);
router.get('/:id/usage', requirePermission('media', 'view'), validate(getMediaSchema), getMediaUsage);
// Versions
router.get('/:id/versions', requirePermission('media', 'view'), validate(mediaIdParamSchema), listVersions);
router.post('/:id/versions/:versionId/restore', requirePermission('media', 'edit'), validate(restoreVersionSchema), restoreVersion);
// Processing ops
router.post('/:id/edit', requirePermission('media', 'edit'), validate(editMediaSchema), editMedia);
router.post('/:id/pdf-op', requirePermission('media', 'edit'), validate(pdfOpSchema), pdfOp);
router.post('/:id/video-op', requirePermission('media', 'edit'), validate(videoOpSchema), videoOp);
router.post('/:id/audio-op', requirePermission('media', 'edit'), validate(audioOpSchema), audioOp);
router.post('/:id/convert', requirePermission('media', 'edit'), validate(convertMediaSchema), convertMedia);
// AI analyze (Phase D2) — 501 via requireFeature when vision is unconfigured
router.post('/:id/analyze', requirePermission('media', 'edit'), validate(mediaIdParamSchema), requireFeature('vision'), analyzeMedia);
router.get('/:id/suggestions', requirePermission('media', 'view'), validate(mediaIdParamSchema), listMediaSuggestions);
// OCR (Phase D3) — local tesseract job, works without any AI provider
router.post('/:id/ocr', requirePermission('media', 'edit'), validate(mediaIdParamSchema), ocrMedia);
// Speech-to-text (Phase D4) — 501 via requireFeature when unconfigured
router.post('/:id/transcribe', requirePermission('media', 'edit'), validate(transcribeMediaSchema), requireFeature('speech_to_text'), transcribeMedia);
router.get('/:id/transcript', requirePermission('media', 'view'), validate(getTranscriptSchema), getTranscript);
// AI image ops (Phase D6) — bg-removal/upscale/enhance/object-removal → new version; 501 via requireFeature when unconfigured
router.post('/:id/ai-image-op', requirePermission('media', 'edit'), validate(aiImageOpSchema), requireFeature('image_ops'), aiImageOp);
// PDF merge (no parent id)
router.post('/pdf-merge', requirePermission('media', 'add'), validate(pdfOpSchema), pdfOp);
router.get('/:id', requirePermission('media', 'view'), validate(getMediaSchema), getMedia);
router.patch('/:id', requirePermission('media', 'edit'), validate(updateMediaSchema), updateMedia);
router.delete('/:id', requirePermission('media', 'delete'), validate(deleteMediaSchema), deleteMedia);

export default router;
