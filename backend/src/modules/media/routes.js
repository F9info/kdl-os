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
} from './controller.js';

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

// List + CRUD
router.get('/', requirePermission('media', 'view'), validate(listMediaSchema), listMedia);
router.post('/:id/favorite', requirePermission('media', 'view'), validate(mediaIdParamSchema), favoriteMedia);
router.delete('/:id/favorite', requirePermission('media', 'view'), validate(mediaIdParamSchema), unfavoriteMedia);
router.post('/:id/touch', requirePermission('media', 'view'), validate(mediaIdParamSchema), touchMedia);
router.get('/:id/usage', requirePermission('media', 'view'), validate(getMediaSchema), getMediaUsage);
router.get('/:id', requirePermission('media', 'view'), validate(getMediaSchema), getMedia);
router.patch('/:id', requirePermission('media', 'edit'), validate(updateMediaSchema), updateMedia);
router.delete('/:id', requirePermission('media', 'delete'), validate(deleteMediaSchema), deleteMedia);

export default router;
