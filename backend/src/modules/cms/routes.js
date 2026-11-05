import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { successResponse } from '../../shared/utils/response.js';
import { prisma } from '../../config/database.js';
import { applyCmsSite, CMS_PAGES } from './pages.js';

const router = Router();
router.use(authenticate);

router.get('/status', requirePermission('cms', 'view'), async (_req, res, next) => {
  try {
    const pages = await prisma.builderPage.findMany({
      where: { slug: { in: CMS_PAGES.map((p) => p.slug) }, deleted_at: null },
      select: { slug: true, status: true },
    });
    successResponse(res, { pages });
  } catch (err) {
    next(err);
  }
});

// Re-adds any CMS page that is missing from the website (never touches existing pages).
router.post('/site', requirePermission('cms', 'edit'), async (req, res, next) => {
  try {
    successResponse(res, await applyCmsSite(prisma, { actorId: req.user?.id ?? null }));
  } catch (err) {
    next(err);
  }
});

export default router;
