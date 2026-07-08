import { prisma } from '../../../config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { getActiveProvider } from './ai-provider.service.js';

const ANALYZE_PROMPT = `Analyze this image for a digital asset management system. Respond with ONLY a JSON object (no markdown fences, no prose) shaped exactly like:
{"tags": ["short", "lowercase", "keywords"], "title": "short descriptive title", "description": "one or two sentence description", "alt_text": "concise accessibility alt text", "seo_keywords": ["seo", "keyword", "phrases"]}`;

// Model output sometimes wraps JSON in prose or code fences — pull the first {...} block out.
export function parseAnalysisResult(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI response did not contain a JSON object');
  const parsed = JSON.parse(match[0]);
  return {
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === 'string' && t.trim()) : [],
    title: typeof parsed.title === 'string' ? parsed.title.trim() : null,
    description: typeof parsed.description === 'string' ? parsed.description.trim() : null,
    alt_text: typeof parsed.alt_text === 'string' ? parsed.alt_text.trim() : null,
    seo_keywords: Array.isArray(parsed.seo_keywords)
      ? parsed.seo_keywords.filter((t) => typeof t === 'string' && t.trim())
      : [],
  };
}

async function readMediaBuffer(media) {
  const { minio } = await import('../../../config/minio.js');
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Replace any still-PENDING suggestions of these types with a fresh batch from this run —
// avoids piling up stale suggestions across repeated "Analyze" calls.
async function replaceSuggestions(mediaId, result) {
  const rows = [
    result.tags.length && { type: 'TAGS', value: result.tags },
    result.title && { type: 'TITLE', value: result.title },
    result.description && { type: 'DESCRIPTION', value: result.description },
    result.alt_text && { type: 'ALT_TEXT', value: result.alt_text },
    result.seo_keywords.length && { type: 'SEO_KEYWORDS', value: result.seo_keywords },
  ].filter(Boolean);

  return prisma.$transaction(async (tx) => {
    await tx.mediaSuggestion.deleteMany({
      where: { media_id: mediaId, status: 'PENDING', type: { in: rows.map((r) => r.type) } },
    });
    if (!rows.length) return [];
    await tx.mediaSuggestion.createMany({
      data: rows.map((r) => ({ media_id: mediaId, type: r.type, value: r.value, source: 'ai' })),
    });
    return tx.mediaSuggestion.findMany({
      where: { media_id: mediaId, status: 'PENDING', type: { in: rows.map((r) => r.type) } },
    });
  });
}

// Processing-job entry point (see processing.service.js executeProcessingJob case 'ai-analyze').
export async function runAnalyzeJob({ mediaId }) {
  const provider = await getActiveProvider('vision');
  if (!provider) throw Object.assign(new Error('AI feature "vision" is not configured'), { status: 501 });

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  if (media.type !== 'IMAGE') {
    throw Object.assign(new Error('AI analyze is only supported for images in v1'), { status: 422 });
  }

  const image = await readMediaBuffer(media);
  const { text } = await provider.driver.analyzeImage({
    credentials: provider.credentials,
    config: provider.config,
    image,
    mimeType: media.mime_type,
    prompt: ANALYZE_PROMPT,
  });

  const result = parseAnalysisResult(text);
  const suggestions = await replaceSuggestions(mediaId, result);
  logger.info(`AI analyze produced ${suggestions.length} suggestion(s) for media ${mediaId}`);
  return { suggestion_ids: suggestions.map((s) => s.id) };
}
