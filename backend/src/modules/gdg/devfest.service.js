import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { slugify } from '../../shared/utils/slug.js';
import { keepImage } from './images.js';

// Image fields that get a permanent copy when a media-library link is saved.
const IMAGE_FIELDS = ['photo_url', 'logo_url'];
async function keepImages(data) {
  for (const f of IMAGE_FIELDS) if (typeof data[f] === 'string') data[f] = await keepImage(data[f]);
}

// DevFest content: editions (one per year) and the speakers, sessions, sponsors and team of each.

export const KINDS = {
  editions: { model: 'devfestEdition', label: 'Edition', title: 'name', orderBy: [{ year: 'desc' }] },
  speakers: {
    model: 'devfestSpeaker',
    label: 'Speaker',
    title: 'name',
    slugFrom: 'name',
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
  },
  sessions: {
    model: 'devfestSession',
    label: 'Session',
    title: 'title',
    slugFrom: 'title',
    orderBy: [{ starts_at: 'asc' }, { sort_order: 'asc' }, { title: 'asc' }],
  },
  sponsors: { model: 'devfestSponsor', label: 'Sponsor', title: 'name', orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] },
  team: { model: 'devfestTeamMember', label: 'Team member', title: 'name', orderBy: [{ sort_order: 'asc' }, { name: 'asc' }] },
};

const fail = (status, message) => Object.assign(new Error(message), { status });

const log = (actorId, action, description, properties) =>
  writeActivityAsync({ actor: actorId, module: 'gdg', action, description, properties });

/** A slug free inside the edition: `base`, else `base-2`, `base-3`... */
export async function freeSlug(model, editionId, base, exceptId) {
  const root = base || 'item';
  const taken = new Set(
    (
      await prisma[model].findMany({
        where: { edition_id: editionId, slug: { startsWith: root }, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
        select: { slug: true },
      })
    ).map((r) => r.slug)
  );
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

async function editionOf(projectId, editionId) {
  const edition = await prisma.devfestEdition.findUnique({ where: { id: editionId }, select: { id: true, project_id: true } });
  if (!edition || edition.project_id !== projectId) throw fail(400, 'That edition does not belong to this project');
  return edition;
}

/** Sessions may only point at speakers of their own edition. */
async function checkSpeakers(editionId, ids) {
  if (!ids?.length) return;
  const found = await prisma.devfestSpeaker.count({ where: { edition_id: editionId, id: { in: ids } } });
  if (found !== new Set(ids).size) throw fail(400, 'Pick speakers from the same edition');
}

const uniqueError = (err, kind) => {
  if (err?.code !== 'P2002') return err;
  return fail(409, kind === 'editions' ? 'This year already has an edition' : 'That web address is already used in this edition');
};

export const list = (kind, { project_id, edition_id }) =>
  prisma[KINDS[kind].model].findMany({
    where: kind === 'editions' ? { project_id } : { project_id, edition_id },
    orderBy: KINDS[kind].orderBy,
  });

export const get = (kind, id) => prisma[KINDS[kind].model].findUnique({ where: { id } });

export async function create(kind, data, actorId) {
  const cfg = KINDS[kind];
  const row = { ...data };
  try {
    if (kind === 'editions') {
      const item = await prisma.$transaction(async (tx) => {
        if (row.is_current) await tx.devfestEdition.updateMany({ where: { project_id: row.project_id }, data: { is_current: false } });
        return tx.devfestEdition.create({ data: row });
      });
      log(actorId, 'devfest_created', `DevFest edition "${item.name}" created`, { kind, id: item.id });
      return item;
    }
    await editionOf(row.project_id, row.edition_id);
    await keepImages(row);
    if (kind === 'sessions') await checkSpeakers(row.edition_id, row.speaker_ids);
    if (cfg.slugFrom) row.slug = await freeSlug(cfg.model, row.edition_id, row.slug || slugify(row[cfg.slugFrom]));
    const item = await prisma[cfg.model].create({ data: row });
    log(actorId, 'devfest_created', `${cfg.label} "${item[cfg.title]}" created`, { kind, id: item.id });
    return item;
  } catch (err) {
    throw uniqueError(err, kind);
  }
}

export async function update(kind, id, data, actorId) {
  const cfg = KINDS[kind];
  const current = await prisma[cfg.model].findUnique({ where: { id } });
  if (!current) return null;
  const patch = { ...data };
  try {
    if (kind === 'editions') {
      const item = await prisma.$transaction(async (tx) => {
        if (patch.is_current) {
          await tx.devfestEdition.updateMany({ where: { project_id: current.project_id, NOT: { id } }, data: { is_current: false } });
        }
        return tx.devfestEdition.update({ where: { id }, data: patch });
      });
      log(actorId, 'devfest_updated', `DevFest edition "${item.name}" updated`, { kind, id, fields: Object.keys(patch) });
      return item;
    }
    await keepImages(patch);
    if (kind === 'sessions' && patch.speaker_ids) await checkSpeakers(current.edition_id, patch.speaker_ids);
    if (cfg.slugFrom && patch.slug !== undefined) {
      patch.slug = await freeSlug(cfg.model, current.edition_id, patch.slug || slugify(patch[cfg.slugFrom] ?? current[cfg.slugFrom]), id);
    }
    const item = await prisma[cfg.model].update({ where: { id }, data: patch });
    log(actorId, 'devfest_updated', `${cfg.label} "${item[cfg.title]}" updated`, { kind, id, fields: Object.keys(patch) });
    return item;
  } catch (err) {
    throw uniqueError(err, kind);
  }
}

export async function remove(kind, id, actorId) {
  const cfg = KINDS[kind];
  const current = await prisma[cfg.model].findUnique({ where: { id } });
  if (!current) return false;
  if (kind === 'speakers') {
    // Take the speaker off every session that lists them, in the same step.
    const sessions = await prisma.devfestSession.findMany({
      where: { edition_id: current.edition_id, speaker_ids: { has: id } },
      select: { id: true, speaker_ids: true },
    });
    await prisma.$transaction([
      ...sessions.map((s) =>
        prisma.devfestSession.update({ where: { id: s.id }, data: { speaker_ids: s.speaker_ids.filter((x) => x !== id) } })
      ),
      prisma.devfestSpeaker.delete({ where: { id } }),
    ]);
  } else {
    await prisma[cfg.model].delete({ where: { id } });
  }
  log(actorId, 'devfest_deleted', `${cfg.label} "${current[cfg.title]}" deleted`, { kind, id });
  return true;
}

// ─── Public read ─────────────────────────────────────────────────────────────

const iso = (d) => (d ? d.toISOString() : null);

/**
 * One edition for the website, with only what is switched on. The edition is the asked `year`, else the
 * one marked current, else the newest. `editions` lists every year so pages can link to past years.
 */
export async function getPublicDevfest(projectId, year) {
  const editions = await prisma.devfestEdition.findMany({
    where: { project_id: projectId },
    orderBy: { year: 'desc' },
    select: { id: true, year: true, name: true, is_current: true },
  });
  const pick = year ? editions.find((e) => e.year === year) : (editions.find((e) => e.is_current) ?? editions[0]);
  const years = editions.map((e) => ({ year: e.year, name: e.name, current: e.is_current }));
  if (!pick) return { edition: null, editions: years, speakers: [], sessions: [], sponsors: [], team: [] };

  const visible = { edition_id: pick.id, is_visible: true };
  const [e, speakers, sessions, sponsors, team] = await Promise.all([
    prisma.devfestEdition.findUnique({ where: { id: pick.id } }),
    prisma.devfestSpeaker.findMany({ where: visible, orderBy: KINDS.speakers.orderBy }),
    prisma.devfestSession.findMany({ where: visible, orderBy: KINDS.sessions.orderBy }),
    prisma.devfestSponsor.findMany({ where: visible, orderBy: KINDS.sponsors.orderBy }),
    prisma.devfestTeamMember.findMany({ where: visible, orderBy: KINDS.team.orderBy }),
  ]);
  const shown = new Set(speakers.map((s) => s.id));
  return {
    edition: {
      year: e.year,
      name: e.name,
      theme: e.theme ?? '',
      start: iso(e.start_date),
      end: iso(e.end_date),
      venue: e.venue ?? '',
      address: e.venue_address ?? '',
      map: e.map_url ?? '',
      tickets: e.ticket_url ?? '',
      cfp: e.cfp_url ?? '',
      cfpCloses: iso(e.cfp_closes),
      // The call for speakers form takes proposals (switch on, closing time not passed).
      cfpOpen: Boolean(e.cfp_open) && (!e.cfp_closes || e.cfp_closes > new Date()),
      tracks: Array.isArray(e.tracks) ? e.tracks : [],
      stats: Array.isArray(e.stats) ? e.stats : [],
      current: e.is_current,
    },
    editions: years,
    speakers: speakers.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      photo: s.photo_url ?? '',
      role: s.role ?? '',
      company: s.company ?? '',
      bio: s.bio ?? '',
      links: s.links && typeof s.links === 'object' ? s.links : {},
      badges: s.badges,
      featured: s.is_featured,
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      abstract: s.abstract ?? '',
      kind: s.kind,
      track: s.track ?? '',
      level: s.level ?? '',
      room: s.room ?? '',
      start: iso(s.starts_at),
      end: iso(s.ends_at),
      speakers: s.speaker_ids.filter((id) => shown.has(id)),
      slides: s.slides_url ?? '',
      video: s.video_url ?? '',
    })),
    sponsors: sponsors.map((s) => ({ id: s.id, name: s.name, logo: s.logo_url ?? '', tier: s.tier, url: s.url ?? '' })),
    team: team.map((t) => ({ id: t.id, name: t.name, role: t.role ?? '', photo: t.photo_url ?? '', url: t.url ?? '' })),
  };
}
