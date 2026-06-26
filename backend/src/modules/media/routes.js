import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';
import { validate } from '../../middleware/validate.js';
import { listMediaSchema, deleteMediaSchema } from './schema.js';
import { uploadMedia, listMedia, deleteMedia } from './controller.js';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), uploadMedia);
router.get('/', validate(listMediaSchema), listMedia);
router.delete('/:id', validate(deleteMediaSchema), deleteMedia);

export default router;
