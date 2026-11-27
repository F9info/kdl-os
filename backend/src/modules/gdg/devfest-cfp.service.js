import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { slugify } from '../../shared/utils/slug.js';
import { freeSlug } from './devfest.service.js';
import { savePhoto, dropImage } from './images.js';

// Call for speakers: visitors send talk proposals for the current edition; organizers review them in
// Admin → GDG Chapter → DevFest → Proposals and accept the ones they want.

const fail = (status, message) => Object.assign(new Error(message), { status });
const log = (actorId, action, description, properties) =>
  writeActivityAsync({ actor: actorId, module: 'gdg', action, description, properties });

/** At most this many proposals per email address and edition. */
export const MAX_PER_EMAIL = 3;

/** Proposals are taken while the edition's switch is on and the closing time has not passed. */
export const isCfpOpen = (edition, now = new Date()) =>
  Boolean(edition?.cfp_open) && (!edition.cfp_closes || edition.cfp_closes > now);

const currentEdition = async (projectId) =>
  (await prisma.devfestEdition.findFirst({ where: { project_id: projectId, is_current: true } })) ??
  prisma.devfestEdition.findFirst({ where: { project_id: projectId }, orderBy: { year: 'desc' } });

/**
 * Saves a proposal for the current edition. A filled-in trap field (bots) is accepted without saving.
 * Returns { id } or { ignored: true }.
 */
export async function submitProposal(projectId, body, photo) {
  const { consent: _consent, company_site: trap, project_id: _p, ...data } = body;
  if (trap) return { ignored: true };
  // A photo is required: accepted speakers are shown with it on the website.
  if (!photo) throw fail(400, 'Add your photo. We show it on the website if your talk is selected.');
  const edition = await currentEdition(projectId);
  if (!edition || !isCfpOpen(edition)) throw fail(403, 'The call for speakers is closed.');
  const tracks = Array.isArray(edition.tracks) ? edition.tracks.map((t) => t?.name).filter(Boolean) : [];
  if (data.track && tracks.length && !tracks.includes(data.track)) throw fail(400, 'Pick one of the listed tracks.');
  const sent = await prisma.devfestProposal.count({ where: { edition_id: edition.id, email: data.email } });
  if (sent >= MAX_PER_EMAIL) throw fail(429, `You have already sent ${MAX_PER_EMAIL} proposals for ${edition.name}.`);
  // The photo is stored only once everything else has passed.
  const photo_url = photo ? await savePhoto(photo) : null;
  const item = await prisma.devfestProposal.create({
    data: { ...data, photo_url, project_id: projectId, edition_id: edition.id },
  });
  log(null, 'devfest_proposal_received', `Talk proposal "${item.title}" received for ${edition.name}`, {
    id: item.id,
    edition_id: edition.id,
  });
  return { id: item.id };
}

export const listProposals = ({ project_id, edition_id, status }) =>
  prisma.devfestProposal.findMany({
    where: { project_id, edition_id, ...(status ? { status } : {}) },
    orderBy: { created_at: 'desc' },
  });

export const getProposal = (id) => prisma.devfestProposal.findUnique({ where: { id } });

export async function updateProposal(id, patch, actorId) {
  const current = await getProposal(id);
  if (!current) return null;
  if (patch.status && patch.status !== 'accepted' && current.speaker_id) {
    throw fail(409, 'This proposal is already accepted: its speaker and session exist. Delete them first to change it.');
  }
  if (patch.status === 'accepted' && !current.speaker_id) {
    throw fail(400, 'Use "Accept and add as speaker" so the speaker and session are created.');
  }
  const item = await prisma.devfestProposal.update({ where: { id }, data: patch });
  log(actorId, 'devfest_proposal_updated', `Talk proposal "${item.title}" set to ${item.status}`, {
    id,
    fields: Object.keys(patch),
  });
  return item;
}

export async function removeProposal(id, actorId) {
  const current = await getProposal(id);
  if (!current) return false;
  await prisma.devfestProposal.delete({ where: { id } });
  // Its photo goes too, unless an accepted speaker still shows it.
  if (current.photo_url) {
    const used = await prisma.devfestSpeaker.count({ where: { photo_url: current.photo_url } });
    if (!used) await dropImage(current.photo_url);
  }
  log(actorId, 'devfest_proposal_deleted', `Talk proposal "${current.title}" deleted`, { id });
  return true;
}

const SESSION_KIND = { talk: 'talk', lightning: 'talk', workshop: 'workshop', panel: 'panel' };

/**
 * Accepting a proposal adds its speaker and session to the edition, both hidden, so organizers can
 * check them and announce them by turning on Shown. Returns the updated proposal, or null.
 */
export async function acceptProposal(id, actorId) {
  const p = await getProposal(id);
  if (!p) return null;
  if (p.speaker_id) throw fail(409, 'This proposal is already accepted.');
  const [speakerSlug, sessionSlug] = await Promise.all([
    freeSlug('devfestSpeaker', p.edition_id, slugify(p.name)),
    freeSlug('devfestSession', p.edition_id, slugify(p.title)),
  ]);
  const links = {};
  if (p.linkedin) links.LinkedIn = p.linkedin;
  if (p.website) links.Website = p.website;
  const item = await prisma.$transaction(async (tx) => {
    const speaker = await tx.devfestSpeaker.create({
      data: {
        project_id: p.project_id,
        edition_id: p.edition_id,
        slug: speakerSlug,
        name: p.name,
        role: p.role,
        company: p.company,
        bio: p.bio,
        photo_url: p.photo_url,
        links,
        is_visible: false,
      },
    });
    const session = await tx.devfestSession.create({
      data: {
        project_id: p.project_id,
        edition_id: p.edition_id,
        slug: sessionSlug,
        title: p.title,
        abstract: p.abstract,
        kind: SESSION_KIND[p.format] ?? 'talk',
        track: p.track,
        level: p.level,
        speaker_ids: [speaker.id],
        is_visible: false,
      },
    });
    return tx.devfestProposal.update({
      where: { id },
      data: { status: 'accepted', speaker_id: speaker.id, session_id: session.id },
    });
  });
  log(actorId, 'devfest_proposal_accepted', `Talk proposal "${p.title}" accepted; speaker and session added`, {
    id,
    speaker_id: item.speaker_id,
    session_id: item.session_id,
  });
  return item;
}
