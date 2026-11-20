import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { logger } from '../../shared/utils/logger.js';
import { categoryOf, readChapter } from './chapter-feed.js';

// Fields a sync owns on a synced (source = 'gdg') event. Admins can only change the admin fields
// (category, is_featured, is_hidden) on those rows; editing the rest would be undone by the next sync.
export const SYNCED_FIELDS = [
  'title',
  'start_date',
  'end_date',
  'venue',
  'event_type',
  'image_url',
  'banner_url',
  'register_url',
  'page_url',
  'description',
  'tags',
];

const log = (actorId, action, description, properties) =>
  writeActivityAsync({ actor: actorId, module: 'gdg', action, description, properties });

// ─── Events ──────────────────────────────────────────────────────────────────

export const listEvents = (query) => {
  const where = { project_id: query.project_id };
  if (query.source) where.source = query.source;
  return prisma.chapterEvent.findMany({ where, orderBy: { start_date: 'desc' } });
};

export const getEventById = (id) => prisma.chapterEvent.findUnique({ where: { id } });

export const createEvent = async (data, actorId) => {
  const item = await prisma.chapterEvent.create({ data: { ...data, source: 'manual', source_id: null } });
  log(actorId, 'created', `Event "${item.title}" created`, { event_id: item.id });
  return item;
};

export const updateEvent = async (id, data, actorId) => {
  const current = await prisma.chapterEvent.findUnique({ where: { id } });
  if (!current) return null;
  const patch = { ...data };
  if (current.source !== 'manual') for (const f of SYNCED_FIELDS) delete patch[f];
  const item = await prisma.chapterEvent.update({ where: { id }, data: patch });
  log(actorId, 'updated', `Event "${item.title}" updated`, { event_id: id, fields: Object.keys(patch) });
  return item;
};

export const deleteEvent = async (id, actorId) => {
  const current = await prisma.chapterEvent.findUnique({ where: { id } });
  if (!current) return false;
  await prisma.chapterEvent.delete({ where: { id } });
  log(actorId, 'deleted', `Event "${current.title}" deleted`, { event_id: id });
  return true;
};

// ─── Chapter sync ────────────────────────────────────────────────────────────

export const getSyncSettings = (projectId) =>
  prisma.chapterSyncSetting.findUnique({ where: { project_id: projectId } });

export const saveSyncSettings = async (projectId, data, actorId) => {
  const item = await prisma.chapterSyncSetting.upsert({
    where: { project_id: projectId },
    create: { project_id: projectId, ...data },
    update: data,
  });
  log(actorId, 'sync_settings_saved', 'Chapter sync settings saved', { chapter_id: item.chapter_id });
  return item;
};

/**
 * Pull the chapter's events into the project: new events are created, known ones updated (synced
 * fields only). Events that disappeared from the chapter page are kept, since they may still be
 * linked from pages. Records the outcome on the settings row and returns it.
 */
export async function runSync(projectId, { actorId, fetchJson } = {}) {
  const settings = await getSyncSettings(projectId);
  if (!settings?.chapter_id) {
    const err = new Error('Set the chapter id first.');
    err.status = 400;
    throw err;
  }
  let result;
  try {
    const { events, team, chapter } = await readChapter(
      { chapterId: settings.chapter_id, chapterSlug: settings.chapter_slug },
      fetchJson
    );
    const known = new Set(
      (
        await prisma.chapterEvent.findMany({
          where: { project_id: projectId, source: 'gdg' },
          select: { source_id: true },
        })
      ).map((e) => e.source_id)
    );
    await prisma.$transaction(
      events.map((e) =>
        prisma.chapterEvent.upsert({
          where: { project_id_source_source_id: { project_id: projectId, source: 'gdg', source_id: e.source_id } },
          create: { project_id: projectId, ...e },
          update: Object.fromEntries(SYNCED_FIELDS.map((f) => [f, e[f]])),
        })
      )
    );
    const created = events.filter((e) => !known.has(e.source_id)).length;
    result = { ok: true, created, updated: events.length - created, total: events.length };
    await prisma.chapterSyncSetting.update({
      where: { project_id: projectId },
      data: {
        last_synced_at: new Date(),
        last_result: result,
        ...(team ? { team } : {}),
        ...(chapter ? { members_count: chapter.members_count, logo_url: chapter.logo_url } : {}),
      },
    });
  } catch (err) {
    result = { ok: false, error: String(err?.message ?? err).slice(0, 300) };
    await prisma.chapterSyncSetting.update({ where: { project_id: projectId }, data: { last_result: result } });
  }
  log(actorId, 'synced', result.ok ? `Chapter sync: ${result.created} new, ${result.updated} updated` : 'Chapter sync failed', result);
  return result;
}

/** The scheduled job: every project with auto sync on. One failing project never stops the others. */
export async function runAutoSyncs(opts = {}) {
  const rows = await prisma.chapterSyncSetting.findMany({
    where: { auto_sync: true, chapter_id: { not: null } },
    select: { project_id: true },
  });
  for (const { project_id } of rows) {
    try {
      await runSync(project_id, opts);
    } catch (err) {
      logger.error(`Events: auto sync failed for project ${project_id}: ${err.message}`);
    }
  }
  return rows.length;
}

// ─── Public feed ─────────────────────────────────────────────────────────────

/** What the website blocks need, in one read: visible events (with category) and chapter facts. */
export async function getPublicFeed(projectId) {
  const [events, settings] = await Promise.all([
    prisma.chapterEvent.findMany({
      where: { project_id: projectId, is_hidden: false },
      orderBy: { start_date: 'desc' },
    }),
    getSyncSettings(projectId),
  ]);
  return {
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start_date,
      end: e.end_date,
      venue: e.venue ?? '',
      type: e.event_type ?? '',
      img: e.image_url ?? '',
      banner: e.banner_url ?? '',
      url: e.register_url ?? e.page_url ?? '',
      page: e.page_url ?? '',
      desc: e.description ?? '',
      tags: e.tags,
      cat: e.category || categoryOf(e.title),
      featured: e.is_featured,
    })),
    chapter: {
      members: settings?.members_count ?? null,
      logo: settings?.logo_url ?? '',
      slug: settings?.chapter_slug ?? '',
      url: settings?.chapter_slug ? `https://gdg.community.dev/${settings.chapter_slug}/` : '',
      synced_at: settings?.last_synced_at ?? null,
    },
    team: Array.isArray(settings?.team) ? settings.team : [],
  };
}
