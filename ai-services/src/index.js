import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { chatController } from './controllers/chat.js';
import { embedController } from './controllers/embed.js';
import { transcribeController } from './controllers/transcribe.js';
import { brandInferenceController } from './controllers/brand-inference.js';
import { authenticate } from './middleware/auth.js';
import { successResponse, errorResponse } from './utils/response.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.AI_PORT ?? 5000;

// Behind nginx in every deployed topology — trust exactly one proxy hop so
// express-rate-limit keys on the real client IP, not the proxy's.
app.set('trust proxy', 1);

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

// CORS: explicit allowlist only — a bare cors() reflects any origin, which
// combined with cookie auth lets arbitrary sites call these endpoints.
const corsOrigins = [
  ...(process.env.CORS_ORIGIN ?? '').split(','),
  ...(process.env.FRONTEND_URL ?? '').split(','),
].map((o) => o.trim()).filter(Boolean);
if (corsOrigins.length === 0) {
  logger.error('CORS_ORIGIN or FRONTEND_URL is required (comma-separated origin allowlist). Refusing to start.');
  process.exit(1);
}
app.use(helmet());
app.use(cors({ origin: [...new Set(corsOrigins)], credentials: true }));
app.use(limiter);
// Body limits: only transcribe (base64 audio) needs 10mb; everything else keeps
// the express default (100kb) so other endpoints can't be used for
// memory-pressure abuse. The path-scoped parser must run first — once it has
// parsed the body, the global parser is a no-op for that request.
app.use('/api/ai/transcribe', express.json({ limit: '10mb' }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  successResponse(res, { status: 'ok', service: 'ai-services', ts: new Date().toISOString() });
});

app.post('/api/ai/chat', authenticate, chatController);
app.post('/api/ai/embed', authenticate, embedController);
app.post('/api/ai/transcribe', authenticate, transcribeController);
app.post('/api/ai/brand-inference', authenticate, brandInferenceController);

app.use((req, res) => errorResponse(res, 'Not found', 404));

app.use((err, req, res, _next) => {
  logger.error(err);
  const message = process.env.NODE_ENV !== 'development'
    ? 'Internal server error'
    : (err.message ?? 'Internal server error');
  errorResponse(res, message, err.statusCode ?? 500);
});

app.listen(PORT, () => {
  logger.info(`Running on port ${PORT}`);
});

export default app;
