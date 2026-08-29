import 'dotenv/config';
import './config/env-preflight.js';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { prisma } from './config/database.js';
import { redis } from './config/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { successResponse, errorResponse } from './shared/utils/response.js';
import { logger } from './shared/utils/logger.js';
import { ensureBucketExists } from './shared/services/storage.service.js';

import { emailWorker } from './shared/workers/email.worker.js';
import { mediaWorker } from './modules/media/media.worker.js';
import { startProcessingWorker, closeProcessingWorker } from './modules/media/processing.queue.js';
import { integrationsWorker } from './modules/integrations/integrations.worker.js';
import { notificationsWorker, notificationsRetentionWorker, startRetentionJob } from './modules/notifications/notifications.worker.js';
import { startExpiryJob } from './modules/media/media.expiry.worker.js';
import { startBrandKitExpiryJob } from './modules/brand-kit/brand-kit.queue.js';

import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/users/routes.js';
import settingsRoutes from './modules/settings/routes.js';
import mediaRoutes from './modules/media/routes.js';
import mediaImportPublicRoutes from './modules/media/import/public-routes.js';
import typeRoutes from './modules/types/routes.js';
import categoryRoutes from './modules/categories/routes.js';
import settingFieldRoutes from './modules/setting-fields/routes.js';
import roleRoutes from './modules/user-management/roles/routes.js';
import permissionRoutes from './modules/user-management/permissions/routes.js';
import activityLogRoutes from './modules/user-management/activity/routes.js';
import moduleRoutes from './modules/modules/routes.js';
import storageSettingsRoutes from './modules/storage-settings/routes.js';
import themeEngineRoutes from './modules/theme-engine/routes.js';
import pageBuilderRoutes from './modules/page-builder/routes.js';
import customBlocksRoutes from './modules/custom-blocks/routes.js';
import projectRoutes from './modules/projects/routes.js';
import { verifyLocalPresignToken } from './shared/services/storage/drivers/local.driver.js';
import { loadModules, checkDependencyIntegrity } from './shared/modules/module-loader.js';

const app = express();
const PORT = process.env.APP_PORT || 4000;

app.set('trust proxy', 1);
app.use(helmet());

// CORS: explicit origin allowlist (comma-separated). Fail fast when unset —
// an undefined origin would make cors() reflect the request origin, which
// combined with credentials:true allows any site to make authenticated calls.
const corsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (corsOrigins.length === 0) {
  logger.error('CORS_ORIGIN is required (comma-separated allowlist of origins). Refusing to start.');
  process.exit(1);
}
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({
  verify(req, _res, buf) { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Dev bumped 1000 -> 50000: all traffic through the Next.js rewrite proxy
  // (what both a real browser session AND Playwright-driven verification use)
  // shares ONE bucket keyed by the proxy's source IP — not per browser tab or
  // per test run — so a single long dev session doing live editor use plus
  // repeated automated verification runs was exhausting even 5000/15min and
  // 429ing real Publish/save requests, not just automated retries. There's
  // no real attacker to rate-limit against on a local dev stack, so this is
  // effectively "off" in dev. Production's 100 is unaffected.
  max: process.env.NODE_ENV === 'production' ? 100 : 50000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.get('/health', (req, res) => {
  successResponse(res, { status: 'ok', uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
// Unauthenticated OAuth callback (Phase D8 cloud imports) — must be registered
// before the authenticated media router since both share the /api/media prefix.
app.use('/api/media/import/oauth', mediaImportPublicRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/types', typeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/setting-fields', settingFieldRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/activity-log', activityLogRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/storage-settings', storageSettingsRoutes);

// ─── Web Vitals telemetry stub (KDL-295) ──────────────────────────────────────
// Accepts CWV payloads from the frontend's useReportWebVitals hook.
// Real persistence/dashboarding is a follow-up observability task.
app.post('/api/vitals', express.json({ limit: '4kb' }), (req, res) => {
  res.status(204).end();
});

// ─── Local storage file server ────────────────────────────────────────────────
// Serves files stored by the local FS driver.
// Security: HMAC-signed time-limited tokens (same model as S3 presigned URLs)
// + path traversal guard. Token is generated by local.driver.js presign().
app.use('/api/storage/local', (req, res) => {
  const { token, exp } = req.query;
  const rawPath = req.path.slice(1); // strip leading /
  const objectName = rawPath.split('/').map(decodeURIComponent).join('/');

  if (!verifyLocalPresignToken(objectName, token, exp)) {
    return res.status(403).end();
  }

  const storageDir = path.resolve(process.env.LOCAL_STORAGE_PATH || 'uploads/media');
  const resolved = path.resolve(path.join(storageDir, objectName));

  if (!resolved.startsWith(storageDir + path.sep)) {
    return res.status(403).end();
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return res.status(404).end();
  }
  res.sendFile(resolved);
});

app.use('/api/theme-engine', themeEngineRoutes);
app.use('/api/page-builder', pageBuilderRoutes);
app.use('/api/custom-blocks', customBlocksRoutes);
app.use('/api/projects', projectRoutes);

// Mount plugin modules (those with module.json + routes.js) behind moduleGate
await loadModules(app);

// KDL-593: detect dependency drift — ENABLED modules whose deps are not ENABLED.
// Logs loudly; never auto-enables dependencies.
{
  const enabledMods = await prisma.module.findMany({ where: { status: 'ENABLED' }, select: { slug: true } });
  const violations = checkDependencyIntegrity(enabledMods.map((m) => m.slug));
  if (violations.length > 0) {
    for (const { module, disabledDep } of violations) {
      logger.error(
        `module-integrity: ENABLED module "${module}" has non-ENABLED dependency "${disabledDep}". ` +
        `Routes for "${disabledDep}" are unmounted — calls will 404 at runtime. ` +
        `Fix: enable "${disabledDep}" first, or disable "${module}".`
      );
    }
    logger.error(
      `module-integrity: ${violations.length} dependency violation(s) detected. ` +
      `This is likely stale data from a manifest change. Check the Module admin panel.`
    );
  }
}

// Start background jobs
startProcessingWorker();
startRetentionJob().catch((err) => logger.error(`Retention job init failed: ${err.message}`));
startExpiryJob().catch((err) => logger.error(`Expiry job init failed: ${err.message}`));
startBrandKitExpiryJob().catch((err) => logger.error(`Brand-kit expiry job init failed: ${err.message}`));

// ─── Public share routes (no auth) ───────────────────────────────────────────
// These live outside /api so they are not subject to the API rate limiter.
const shareRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /share/:token — resolve a share token and return media/folder metadata
app.get('/share/:token', shareRateLimiter, async (req, res) => {
  const { resolveShare } = await import('./modules/media/sharing.service.js');
  try {
    const result = await resolveShare(req.params.token, undefined);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// POST /share/:token — same as GET but accepts a password in the request body
app.post('/share/:token', shareRateLimiter, express.json(), async (req, res) => {
  const { resolveShare } = await import('./modules/media/sharing.service.js');
  try {
    const result = await resolveShare(req.params.token, req.body?.password);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// GET /share/:token/qr — return QR PNG for a share link
app.get('/share/:token/qr', shareRateLimiter, async (req, res) => {
  const { getShareQr } = await import('./modules/media/sharing.service.js');
  try {
    const baseUrl = req.protocol + '://' + req.get('host');
    const buf = await getShareQr(req.params.token, baseUrl);
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
    return res.send(buf);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
});

app.use((req, res) => errorResponse(res, 'Not found', 404));
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`Backend running on port ${PORT}`);
});

// Ensure the active storage backend is ready (creates bucket/directory if needed).
ensureBucketExists()
  .then(() => logger.info('Storage backend ready'))
  .catch((err) => logger.error(`Storage init failed: ${err.message}`));

const shutdown = async () => {
  logger.info('Shutting down...');
  await emailWorker.close();
  await mediaWorker.close();
  await closeProcessingWorker();
  await integrationsWorker.close();
  if (notificationsWorker) await notificationsWorker.close();
  if (notificationsRetentionWorker) await notificationsRetentionWorker.close();
  server.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
