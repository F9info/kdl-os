import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { chatController } from './controllers/chat.js';
import { embedController } from './controllers/embed.js';
import { transcribeController } from './controllers/transcribe.js';
import { authenticate } from './middleware/auth.js';
import { successResponse, errorResponse } from './utils/response.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.AI_PORT ?? 5000;

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  successResponse(res, { status: 'ok', service: 'ai-services', ts: new Date().toISOString() });
});

app.post('/api/ai/chat', authenticate, chatController);
app.post('/api/ai/embed', authenticate, embedController);
app.post('/api/ai/transcribe', authenticate, transcribeController);

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
