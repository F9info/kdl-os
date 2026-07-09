import { prisma } from '../../../config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { getActiveProvider } from './ai-provider.service.js';

const TRANSCRIBE_TYPES = new Set(['AUDIO', 'VIDEO']);

async function readMediaBuffer(media) {
  const { minio } = await import('../../../config/minio.js');
  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Keep only the segment fields the captions panel + SRT/VTT export need —
// whisper verbose_json carries token/probability noise we never read.
export const normalizeSegments = (segments) =>
  (Array.isArray(segments) ? segments : [])
    .filter((s) => s && typeof s.start === 'number' && typeof s.end === 'number')
    .map((s) => ({ start: s.start, end: s.end, text: String(s.text ?? '').trim() }));

// Processing-job entry point ('ai-transcribe' case in processing.service.js).
export async function runTranscribeJob({ mediaId, language }) {
  const provider = await getActiveProvider('speech_to_text');
  if (!provider) {
    throw Object.assign(new Error('AI feature "speech_to_text" is not configured'), { status: 501 });
  }

  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);
  if (!TRANSCRIBE_TYPES.has(media.type)) {
    throw Object.assign(new Error('Transcription is only supported for audio/video'), { status: 422 });
  }

  const audio = await readMediaBuffer(media);
  // Whisper endpoints accept container formats directly (mp3/wav/mp4/webm/m4a) —
  // pass the original file with its real name so the server sniffs the format.
  const { text, segments, language: detected } = await provider.driver.transcribe({
    credentials: provider.credentials,
    config: provider.config,
    audio,
    filename: media.original_name,
    language,
  });

  const normalized = normalizeSegments(segments);
  await prisma.media.update({
    where: { id: mediaId },
    data: {
      transcript: normalized,
      transcript_text: text?.trim() || null,
      transcript_lang: detected ?? null,
    },
  });

  const { enqueueReindex } = await import('../media-search.service.js');
  enqueueReindex(mediaId);
  const { enqueueEmbed } = await import('./media-semantic.service.js');
  enqueueEmbed(mediaId);

  logger.info(`Transcription complete for media ${mediaId} (${normalized.length} segments)`);
  return { segments: normalized.length, language: detected ?? null };
}

// ─── SRT / VTT export ─────────────────────────────────────────────────────────

const pad = (n, w = 2) => String(n).padStart(w, '0');

const formatTimestamp = (seconds, sep) => {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
};

export const segmentsToSrt = (segments) =>
  segments
    .map((s, i) =>
      `${i + 1}\n${formatTimestamp(s.start, ',')} --> ${formatTimestamp(s.end, ',')}\n${s.text}\n`)
    .join('\n');

export const segmentsToVtt = (segments) =>
  `WEBVTT\n\n${segments
    .map((s) => `${formatTimestamp(s.start, '.')} --> ${formatTimestamp(s.end, '.')}\n${s.text}\n`)
    .join('\n')}`;
