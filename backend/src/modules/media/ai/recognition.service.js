import { prisma } from '../../../config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { getActiveProvider } from './ai-provider.service.js';

// Face recognition is EXCLUDED in v1 (decision MEDIA-002, DPDP privacy) — the prompt
// deliberately asks only for labels/logos/landmarks/products and never identities.
const RECOGNITION_PROMPT = `Identify what is visible in this image for a digital asset management system. Respond with ONLY a JSON object (no markdown fences, no prose) shaped exactly like:
{"labels": ["general", "subjects"], "logos": ["brand or logo names"], "landmarks": ["famous places"], "products": ["specific product names"]}
Use short lowercase phrases. Use empty arrays for categories with nothing confidently identifiable. Never identify or name people.`;

const asStringList = (v) =>
  Array.isArray(v) ? v.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()) : [];

// Model output sometimes wraps JSON in prose or code fences — pull the first {...} block out.
export function parseRecognitionResult(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI response did not contain a JSON object');
  const parsed = JSON.parse(match[0]);
  return {
    labels: asStringList(parsed.labels),
    logos: asStringList(parsed.logos),
    landmarks: asStringList(parsed.landmarks),
    products: asStringList(parsed.products),
  };
}

async function readMediaBuffer(media) {
  const { minio } = await import('../../../config/minio.js');
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Processing-job entry point ('ai-recognize' case in processing.service.js).
// Recognized entities land directly as tags (per PHASE D table: "vision driver → tags").
export async function runRecognitionJob({ mediaId }) {
  const provider = await getActiveProvider('vision');
  if (!provider) throw Object.assign(new Error('AI feature "vision" is not configured'), { status: 501 });

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  if (media.type !== 'IMAGE') {
    throw Object.assign(new Error('Recognition is only supported for images in v1'), { status: 422 });
  }

  const image = await readMediaBuffer(media);
  const { text } = await provider.driver.analyzeImage({
    credentials: provider.credentials,
    config: provider.config,
    image,
    mimeType: media.mime_type,
    prompt: RECOGNITION_PROMPT,
  });

  const result = parseRecognitionResult(text);
  const tags = [...new Set([...result.labels, ...result.logos, ...result.landmarks, ...result.products])];
  if (tags.length) {
    const { tagMedia } = await import('../tags.service.js');
    await tagMedia([mediaId], tags, null);
    const { enqueueEmbed } = await import('./media-semantic.service.js');
    enqueueEmbed(mediaId);
  }

  logger.info(`Recognition tagged media ${mediaId} with ${tags.length} tag(s)`);
  return { tags };
}
