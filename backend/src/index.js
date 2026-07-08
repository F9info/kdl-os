import 'dotenv/config';
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
import { integrationsWorker } from './modules/integrations/integrations.worker.js';
import { notificationsWorker, notificationsRetentionWorker, startRetentionJob } from './modules/notifications/notifications.worker.js';

import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/users/routes.js';
import settingsRoutes from './modules/settings/routes.js';
import mediaRoutes from './modules/media/routes.js';
import typeRoutes from './modules/types/routes.js';
import categoryRoutes from './modules/categories/routes.js';
import settingFieldRoutes from './modules/setting-fields/routes.js';
import roleRoutes from './modules/user-management/roles/routes.js';
import permissionRoutes from './modules/user-management/permissions/routes.js';
import activityLogRoutes from './modules/user-management/activity/routes.js';
import moduleRoutes from './modules/modules/routes.js';
import { loadModules } from './shared/modules/module-loader.js';

const app = express();
const PORT = process.env.APP_PORT || 4000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({
  verify(req, _res, buf) { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
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
app.use('/api/media', mediaRoutes);
app.use('/api/types', typeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/setting-fields', settingFieldRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/activity-log', activityLogRoutes);
app.use('/api/modules', moduleRoutes);

// Mount plugin modules (those with module.json + routes.js) behind moduleGate
await loadModules(app);

// Start background jobs
startRetentionJob().catch((err) => logger.error(`Retention job init failed: ${err.message}`));

app.use((req, res) => errorResponse(res, 'Not found', 404));
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`Backend running on port ${PORT}`);
});

// Ensure the storage bucket exists so media / setting-field uploads succeed.
ensureBucketExists()
  .then(() => logger.info(`MinIO bucket "${process.env.MINIO_BUCKET}" ready`))
  .catch((err) => logger.error(`MinIO bucket init failed: ${err.message}`));

const shutdown = async () => {
  logger.info('Shutting down...');
  await emailWorker.close();
  await mediaWorker.close();
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
