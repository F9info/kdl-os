import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { requirePermission, loadPermissions } from '../../middleware/permission.js';
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
  listTrash, restoreTrash, purgeTrash, purgeSingle,
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
  recognizeMedia, qrDecodeMedia,
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
import {
  getImportProviders, listImportConnections, createImportConnection, deleteImportConnection,
  startImportOAuth, listImportFiles, importRemoteFiles,
} from './import/controller.js';
import {
  connectionIdParamSchema, oauthStartParamSchema, createManualConnectionSchema,
  listRemoteFilesSchema, importFilesSchema,
} from './import/schema.js';

const router = Router();

router.use(authenticate);

// KDL-MEDIA-12: every route below is guarded by its own per-feature action
// (not the generic view/add/edit/delete) so a role can be granted exactly
// one feature — see module.json's permissions array for the full action list.

// Folders
router.get('/folders', requirePermission('media', 'view'), listFolders);
router.post('/folders', requirePermission('media', 'folders'), validate(createFolderSchema), createFolder);
router.patch('/folders/:id', requirePermission('media', 'folders'), validate(updateFolderSchema), updateFolder);
router.delete('/folders/:id', requirePermission('media', 'folders'), validate(deleteFolderSchema), deleteFolder);

// Move files between folders
router.post('/move', requirePermission('media', 'folders'), validate(moveMediaSchema), moveMedia);

// Bulk ops
router.post('/bulk-delete', requirePermission('media', 'soft-delete'), validate(bulkDeleteSchema), bulkDelete);

// Trash
router.get('/trash', requirePermission('media', 'trash-view'), listTrash);
router.post('/trash/restore', requirePermission('media', 'restore'), validate(restoreTrashSchema), restoreTrash);
router.delete('/trash/purge', requirePermission('media', 'purge'), purgeTrash);
// Single-file permanent delete — literal routes above must stay registered first
// so 'purge'/'restore' are never matched as an :id.
router.delete('/trash/:id', requirePermission('media', 'purge'), validate(mediaIdParamSchema), purgeSingle);

// Upload (multi-file)
router.post('/upload', requirePermission('media', 'upload'), upload.array('files', 20), uploadMedia);

// Backward-compat single-file upload alias
router.post('/upload/single', requirePermission('media', 'upload'), upload.single('file'), uploadMedia);

// Chunked + resumable upload (50MB+ files)
router.post('/upload/chunked/init', requirePermission('media', 'upload'), validate(chunkInitSchema), chunkInit);
router.put('/upload/chunked/:uploadId/part', requirePermission('media', 'upload'), upload.single('chunk'), validate(chunkPartSchema), chunkPart);
router.get('/upload/chunked/:uploadId/status', requirePermission('media', 'upload'), validate(chunkSessionSchema), chunkStatus);
router.post('/upload/chunked/:uploadId/complete', requirePermission('media', 'upload'), validate(chunkSessionSchema), chunkComplete);

// Imports (zip/url — bulk uploads, distinct from the cloud-provider import feature below)
router.post('/import/zip', requirePermission('media', 'upload'), upload.single('file'), validate(zipImportSchema), importZip);
router.post('/import/url', requirePermission('media', 'upload'), validate(urlImportSchema), importUrl);

// Archive flag (bulk)
router.post('/archive', requirePermission('media', 'metadata-edit'), validate(archiveMediaSchema), archiveMedia);

// Usage tracking (test + integration endpoints)
router.post('/usage/register', requirePermission('media', 'metadata-edit'), validate(registerUsageSchema), registerUsage);
router.post('/usage/release', requirePermission('media', 'metadata-edit'), validate(releaseUsageSchema), releaseUsage);

// Search (MeiliSearch-backed, faceted)
router.get('/search', requirePermission('media', 'view'), validate(searchMediaSchema), searchMedia);
router.post('/search/reindex', requirePermission('media', 'metadata-edit'), reindexMedia);

// Tags
router.get('/tags', requirePermission('media', 'view'), listTags);
router.post('/tags', requirePermission('media', 'tags'), validate(createTagSchema), createTag);
router.patch('/tags/:id', requirePermission('media', 'tags'), validate(updateTagSchema), renameTag);
router.delete('/tags/:id', requirePermission('media', 'tags'), validate(deleteTagSchema), deleteTag);
router.post('/tag', requirePermission('media', 'tags'), validate(tagMediaSchema), tagMedia);
router.post('/untag', requirePermission('media', 'tags'), validate(tagMediaSchema), untagMedia);

// Collections (smart + static)
router.get('/collections', requirePermission('media', 'view'), listCollections);
router.post('/collections', requirePermission('media', 'collections'), validate(createCollectionSchema), createCollection);
router.get('/collections/:id', requirePermission('media', 'view'), validate(collectionContentsSchema), getCollectionContents);
router.patch('/collections/:id', requirePermission('media', 'collections'), validate(updateCollectionSchema), updateCollection);
router.delete('/collections/:id', requirePermission('media', 'collections'), validate(collectionIdSchema), deleteCollection);
router.post('/collections/:id/items', requirePermission('media', 'collections'), validate(collectionItemsSchema), addCollectionItems);
router.delete('/collections/:id/items', requirePermission('media', 'collections'), validate(collectionItemsSchema), removeCollectionItems);

// Favorites + recents
router.get('/favorites', requirePermission('media', 'favorites'), validate(pagedListSchema), listFavorites);
router.get('/recent', requirePermission('media', 'view'), validate(pagedListSchema), listRecents);

// Custom meta fields (admin-defined field schema)
router.get('/meta-fields', requirePermission('media', 'view'), listMetaFields);
router.post('/meta-fields', requirePermission('media', 'custom-fields'), validate(createMetaFieldSchema), createMetaField);
router.patch('/meta-fields/:id', requirePermission('media', 'custom-fields'), validate(updateMetaFieldSchema), updateMetaField);
router.delete('/meta-fields/:id', requirePermission('media', 'custom-fields'), validate(deleteMetaFieldSchema), deleteMetaField);

// Processing jobs status
router.get('/jobs/:jobId', requirePermission('media', 'view'), validate(jobIdSchema), getJob);

// AI provider config (Phase D — keep above the generic /:id routes)
router.get('/ai/status', requirePermission('media', 'view'), getAiStatus);
router.get('/ai/drivers', requirePermission('media', 'ai-providers'), listAiDrivers);
router.get('/ai/providers', requirePermission('media', 'ai-providers'), listAiProviders);
router.post('/ai/providers', requirePermission('media', 'ai-providers'), createAiProvider);
router.patch('/ai/providers/:id', requirePermission('media', 'ai-providers'), updateAiProvider);
router.delete('/ai/providers/:id', requirePermission('media', 'ai-providers'), deleteAiProvider);

// Cloud imports (Phase D8) — keep above the generic /:id routes. OAuth callback
// itself lives in import/public-routes.js (mounted before this router, unauthenticated).
router.get('/import/providers', requirePermission('media', 'cloud-import'), getImportProviders);
router.get('/import/connections', requirePermission('media', 'cloud-import'), listImportConnections);
router.post('/import/connections', requirePermission('media', 'cloud-import'), validate(createManualConnectionSchema), createImportConnection);
router.delete('/import/connections/:id', requirePermission('media', 'cloud-import'), validate(connectionIdParamSchema), deleteImportConnection);
router.get('/import/oauth/:provider/start', requirePermission('media', 'cloud-import'), validate(oauthStartParamSchema), startImportOAuth);
router.get('/import/connections/:id/files', requirePermission('media', 'cloud-import'), validate(listRemoteFilesSchema), listImportFiles);
router.post('/import/connections/:id/import', requirePermission('media', 'cloud-import'), validate(importFilesSchema), importRemoteFiles);

// AI suggestions (Phase D2) — keep above the generic /:id routes
router.post('/suggestions/:id/accept', requirePermission('media', 'metadata-edit'), validate(mediaIdParamSchema), acceptMediaSuggestion);
router.post('/suggestions/:id/reject', requirePermission('media', 'metadata-edit'), validate(mediaIdParamSchema), rejectMediaSuggestion);

// Transform (B2) — on-the-fly image resize/format/filter; cached in MinIO. This
// is what renders the preview/lightbox image, so it's gated by 'preview'.
router.get('/:id/t', requirePermission('media', 'preview'), validate(transformQuerySchema), getTransform);

// Share management (B4) — authenticated CRUD; static paths before /:id wildcards
router.post('/shares', requirePermission('media', 'share'), validate(createShareSchema), createShareLink);
router.delete('/shares/:id', requirePermission('media', 'share'), validate(shareIdParamSchema), revokeShareLink);
router.get('/shares/:token/qr', requirePermission('media', 'share'), validate(shareTokenParamSchema), shareQr);
router.get('/shares/:token/embed', requirePermission('media', 'share'), validate(shareTokenParamSchema), shareEmbed);
router.get('/:id/shares', requirePermission('media', 'share'), validate(mediaIdParamSchema), listShareLinks);

// Versioning (B5) — re-upload file onto existing media record → new MediaVersion
router.post('/:id/upload', requirePermission('media', 'upload'), upload.single('file'), validate(reuploadVersionSchema), reuploadAsVersion);

// Comments (B5)
router.get('/:id/comments', requirePermission('media', 'view'), validate(mediaIdParamSchema), listComments);
router.post('/:id/comments', requirePermission('media', 'metadata-edit'), validate(createCommentSchema), createComment);
router.delete('/:id/comments/:commentId', requirePermission('media', 'metadata-edit'), validate(commentIdParamSchema), deleteComment);

// Workflow (B6) — route loads permissions only; per-transition authorization is
// enforced by transitionWorkflow() in workflow.service.js (the single source of
// truth). Removing the blanket media:approve gate here fixes KDL-242 so users
// with media:edit or media:publish can reach submit/publish transitions.
router.patch('/:id/workflow', loadPermissions(), validate(workflowTransitionSchema), transitionWorkflow);

// List + CRUD
router.get('/', requirePermission('media', 'view'), validate(listMediaSchema), listMedia);
router.post('/:id/favorite', requirePermission('media', 'favorites'), validate(mediaIdParamSchema), favoriteMedia);
router.delete('/:id/favorite', requirePermission('media', 'favorites'), validate(mediaIdParamSchema), unfavoriteMedia);
router.post('/:id/touch', requirePermission('media', 'view'), validate(mediaIdParamSchema), touchMedia);
router.post('/:id/copy', requirePermission('media', 'upload'), validate(copyMediaSchema), copyMedia);
router.get('/:id/usage', requirePermission('media', 'view'), validate(getMediaSchema), getMediaUsage);
// Versions
router.get('/:id/versions', requirePermission('media', 'view'), validate(mediaIdParamSchema), listVersions);
router.post('/:id/versions/:versionId/restore', requirePermission('media', 'edit-image'), validate(restoreVersionSchema), restoreVersion);
// Processing ops — all "edit the file" operations share the edit-image permission
router.post('/:id/edit', requirePermission('media', 'edit-image'), validate(editMediaSchema), editMedia);
router.post('/:id/pdf-op', requirePermission('media', 'edit-image'), validate(pdfOpSchema), pdfOp);
router.post('/:id/video-op', requirePermission('media', 'edit-image'), validate(videoOpSchema), videoOp);
router.post('/:id/audio-op', requirePermission('media', 'edit-image'), validate(audioOpSchema), audioOp);
router.post('/:id/convert', requirePermission('media', 'edit-image'), validate(convertMediaSchema), convertMedia);
// AI analyze (Phase D2) — 501 via requireFeature when vision is unconfigured
router.post('/:id/analyze', requirePermission('media', 'edit-image'), validate(mediaIdParamSchema), requireFeature('vision'), analyzeMedia);
router.get('/:id/suggestions', requirePermission('media', 'view'), validate(mediaIdParamSchema), listMediaSuggestions);
// OCR (Phase D3) — local tesseract job, works without any AI provider
router.post('/:id/ocr', requirePermission('media', 'edit-image'), validate(mediaIdParamSchema), ocrMedia);
// Speech-to-text (Phase D4) — 501 via requireFeature when unconfigured
router.post('/:id/transcribe', requirePermission('media', 'edit-image'), validate(transcribeMediaSchema), requireFeature('speech_to_text'), transcribeMedia);
router.get('/:id/transcript', requirePermission('media', 'view'), validate(getTranscriptSchema), getTranscript);
// AI image ops (Phase D6) — bg-removal/upscale/enhance/object-removal → new version; 501 via requireFeature when unconfigured
router.post('/:id/ai-image-op', requirePermission('media', 'edit-image'), validate(aiImageOpSchema), requireFeature('image_ops'), aiImageOp);
// AI recognition (Phase D7) — OPTIONAL, default OFF: labels/logos/landmarks/products → tag suggestion; 501 via requireFeature when unconfigured
router.post('/:id/recognize', requirePermission('media', 'edit-image'), validate(mediaIdParamSchema), requireFeature('vision'), recognizeMedia);
// QR/barcode decode (Phase D7) — local zxing job, works without any AI provider
router.post('/:id/qr-decode', requirePermission('media', 'edit-image'), validate(mediaIdParamSchema), qrDecodeMedia);
// PDF merge (no parent id)
router.post('/pdf-merge', requirePermission('media', 'edit-image'), validate(pdfOpSchema), pdfOp);
router.get('/:id', requirePermission('media', 'view'), validate(getMediaSchema), getMedia);
// Metadata edit + visibility toggle share this endpoint — controller checks
// which permission applies based on which body fields are present.
router.patch('/:id', requirePermission('media', 'metadata-edit'), validate(updateMediaSchema), updateMedia);
router.delete('/:id', requirePermission('media', 'soft-delete'), validate(deleteMediaSchema), deleteMedia);

export default router;
