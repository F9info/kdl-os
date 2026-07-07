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
} from './schema.js';
import {
  uploadMedia, listMedia, getMedia, updateMedia, deleteMedia, bulkDelete,
  listFolders, createFolder, updateFolder, deleteFolder, moveMedia,
  listTrash, restoreTrash, purgeTrash,
  getMediaUsage, registerUsage, releaseUsage,
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

// List + CRUD
router.get('/', requirePermission('media', 'view'), validate(listMediaSchema), listMedia);
router.get('/:id/usage', requirePermission('media', 'view'), validate(getMediaSchema), getMediaUsage);
router.get('/:id', requirePermission('media', 'view'), validate(getMediaSchema), getMedia);
router.patch('/:id', requirePermission('media', 'edit'), validate(updateMediaSchema), updateMedia);
router.delete('/:id', requirePermission('media', 'delete'), validate(deleteMediaSchema), deleteMedia);

export default router;
