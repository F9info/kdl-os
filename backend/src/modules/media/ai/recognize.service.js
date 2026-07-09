import { prisma } from '../../../config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { getActiveProvider } from './ai-provider.service.js';

// Labels/logos/landmarks/products only — face recognition is explicitly EXCLUDED
// v1 (DPDP privacy, see .agents/DECISIONS.md MEDIA-002). Do not add a face path here.
const RECOGNIZE_PROMPT = `Analyze this image for a digital asset management system. Identify any recognizable labels, brand logos, landmarks, and products. Respond with ONLY a JSON object (no markdown fences, no prose) shaped exactly like:
{"labels": ["general object/scene labels"], "logos": ["brand names"], "landmarks": ["landmark names"], "products": ["specific product names"]}
If a category has no matches, use an empty array for it. Never identify or describe human faces or identities.`;

export function parseRecognitionResult(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI response did not contain a JSON object');
  const parsed = JSON.parse(match[0]);
  const toList = (v) => (Array.isArray(v) ? v.filter((t) => typeof t === 'string' && t.trim()) : []);
  const labels = toList(parsed.labels);
  const logos = toList(parsed.logos);
  const landmarks = toList(parsed.landmarks);
  const products = toList(parsed.products);
  const tags = [...new Set([...labels, ...logos, ...landmarks, ...products].map((t) => t.trim().toLowerCase()))];
  return { labels, logos, landmarks, products, tags };
}

async function readMediaBuffer(media) {
  const { minio } = await import('../../../config/minio.js');
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Processing-job entry point ('ai-recognize' case in processing.service.js).
// Optional feature, default OFF: only ever runs when explicitly triggered via
// POST /:id/recognize AND a vision provider is configured (requireFeature 501s
// otherwise) — nothing calls this automatically on upload.
export async function runRecognizeJob({ mediaId }) {
  const provider = await getActiveProvider('vision');
  if (!provider) throw Object.assign(new Error('AI feature "vision" is not configured'), { status: 501 });

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  if (media.type !== 'IMAGE') {
    throw Object.assign(new Error('AI recognition is only supported for images in v1'), { status: 422 });
  }

  const image = await readMediaBuffer(media);
  const { text } = await provider.driver.analyzeImage({
    credentials: provider.credentials,
    config: provider.config,
    image,
    mimeType: media.mime_type,
    prompt: RECOGNIZE_PROMPT,
  });

  const result = parseRecognitionResult(text);
  let suggestion = null;
  if (result.tags.length) {
    suggestion = await prisma.mediaSuggestion.create({
      data: { media_id: mediaId, type: 'TAGS', value: result.tags, source: 'ai-recognition' },
    });
  }

  logger.info(`AI recognize found ${result.tags.length} tag(s) for media ${mediaId} (${result.logos.length} logo(s), ${result.landmarks.length} landmark(s), ${result.products.length} product(s))`);
  return { suggestion_id: suggestion?.id ?? null, ...result };
}
