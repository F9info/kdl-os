import { prisma } from '../../../config/database.js';
import { writeActivityAsync } from '../../user-management/shared/activity-logger.js';
import { enqueueReindex } from '../media-search.service.js';
import { enqueueEmbed } from './media-semantic.service.js';
import { tagMedia } from '../tags.service.js';

export const listSuggestions = (mediaId) =>
  prisma.mediaSuggestion.findMany({
    where: { media_id: mediaId, status: 'PENDING' },
    orderBy: { created_at: 'desc' },
  });

// Apply an accepted suggestion's value onto the Media row (or its tags), then
// mark it accepted. The suggestion row is kept for audit — status flips, value doesn't.
async function applySuggestion(suggestion, actorId) {
  const { media_id: mediaId, type, value } = suggestion;
  switch (type) {
    case 'TAGS':
    case 'SEO_KEYWORDS':
      await tagMedia([mediaId], value, actorId);
      break;
    case 'TITLE':
      await prisma.media.update({ where: { id: mediaId }, data: { title: value } });
      break;
    case 'DESCRIPTION':
      await prisma.media.update({ where: { id: mediaId }, data: { caption: value } });
      break;
    case 'ALT_TEXT':
      await prisma.media.update({ where: { id: mediaId }, data: { alt_text: value } });
      break;
    default:
      throw new Error(`Unknown suggestion type: ${type}`);
  }
}

export async function acceptSuggestion(id, actorId) {
  const suggestion = await prisma.mediaSuggestion.findUnique({ where: { id } });
  if (!suggestion) return null;
  if (suggestion.status !== 'PENDING') return suggestion;

  await applySuggestion(suggestion, actorId);
  const updated = await prisma.mediaSuggestion.update({ where: { id }, data: { status: 'ACCEPTED' } });
  enqueueReindex(suggestion.media_id);
  enqueueEmbed(suggestion.media_id);
  writeActivityAsync({
    actor: actorId,
    module: 'media',
    action: 'ai_suggestion_accepted',
    description: `AI ${suggestion.type.toLowerCase()} suggestion accepted for media ${suggestion.media_id}`,
    properties: { media_id: suggestion.media_id, suggestion_id: id, type: suggestion.type },
  });
  return updated;
}

export async function rejectSuggestion(id, actorId) {
  const suggestion = await prisma.mediaSuggestion.findUnique({ where: { id } });
  if (!suggestion) return null;
  if (suggestion.status !== 'PENDING') return suggestion;

  const updated = await prisma.mediaSuggestion.update({ where: { id }, data: { status: 'REJECTED' } });
  writeActivityAsync({
    actor: actorId,
    module: 'media',
    action: 'ai_suggestion_rejected',
    description: `AI ${suggestion.type.toLowerCase()} suggestion rejected for media ${suggestion.media_id}`,
    properties: { media_id: suggestion.media_id, suggestion_id: id, type: suggestion.type },
  });
  return updated;
}
