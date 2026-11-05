import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { revalidatePublicPages } from '../../shared/frontend-revalidate.js';
import { enqueueSiteBuild } from '../template-engine/site/queue.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

// Draft / publish / versions (T6.2).
//   builder_pages.data        = LIVE content (what visitors see while status = PUBLISHED)
//   builder_pages.draft_data  = unpublished edits of a PUBLISHED page (null = none)
//   page_versions             = immutable snapshot per publish; the live one is the newest while PUBLISHED
// Pages bound to a shared template (template_id) are not versioned: the template owns their content.

const httpError = (status, message) => Object.assign(new Error(message), { status });

const jsonOrNull = (v) => (v === null || v === undefined ? Prisma.DbNull : v);
const sameJson = (a, b) => isDeepStrictEqual(a ?? null, b ?? null);

/** Content the editor works on: pending edits when there are any, else the live content. */
export const workingData = (page) => page.draft_data ?? page.data;

export const hasUnpublishedChanges = (page) =>
  page.draft_data != null && !sameJson(page.draft_data, page.data);

/** A page as the editor needs it: working copy as `data`, plus its publish state. */
export async function withPublishState(page) {
  const { draft_data: _draft, ...rest } = page;
  if (page.template_id) return { ...rest, has_unpublished_changes: false, live_version: null };
  const live =
    page.status === 'PUBLISHED'
      ? await prisma.pageVersion.findFirst({
          where: { page_id: page.id },
          orderBy: { version: 'desc' },
          select: { version: true },
        })
      : null;
  return {
    ...rest,
    data: workingData(page),
    has_unpublished_changes: hasUnpublishedChanges(page),
    live_version: live?.version ?? null,
  };
}

/** Versions of a page, newest first. `is_live` marks the one visitors see. */
export async function listVersions(pageId) {
  const page = await prisma.builderPage.findFirst({
    where: { id: pageId, deleted_at: null },
    select: { id: true, status: true },
  });
  if (!page) throw httpError(404, 'Page not found');
  const rows = await prisma.pageVersion.findMany({
    where: { page_id: pageId },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, title: true, note: true, created_by: true, created_at: true },
  });
  return rows.map((v, i) => ({ ...v, is_live: page.status === 'PUBLISHED' && i === 0 }));
}

/**
 * Makes `patch` (data/title/seo, each optional; defaults to the pending draft and current values) the
 * live content and records it as a new version. Publishing what is already live changes nothing.
 * `existing` is the page row. Returns the updated page with `live_version`.
 */
export async function publishPage(existing, patch, actorId, note = null) {
  const data = patch.data ?? workingData(existing);
  const title = patch.title ?? existing.title;
  const seo = patch.seo !== undefined ? patch.seo : existing.seo;

  const { page, version, changed } = await prisma.$transaction(async (tx) => {
    let latest = await tx.pageVersion.findFirst({
      where: { page_id: existing.id },
      orderBy: { version: 'desc' },
    });
    // A page that went live before versions existed: keep its current live content as version 1,
    // so it can still be restored after the first new publish.
    if (!latest && existing.status === 'PUBLISHED') {
      latest = await tx.pageVersion.create({
        data: {
          page_id: existing.id,
          version: 1,
          title: existing.title,
          data: existing.data,
          seo: jsonOrNull(existing.seo),
          note: 'Live content before versioning',
          created_by: null,
        },
      });
    }
    const unchanged =
      existing.status === 'PUBLISHED' &&
      latest &&
      sameJson(latest.data, data) &&
      latest.title === title &&
      sameJson(latest.seo ?? {}, seo ?? {});
    if (unchanged) {
      const page =
        existing.draft_data == null
          ? existing
          : await tx.builderPage.update({ where: { id: existing.id }, data: { draft_data: Prisma.DbNull } });
      return { page, version: latest, changed: false };
    }
    const version = await tx.pageVersion.create({
      data: {
        page_id: existing.id,
        version: (latest?.version ?? 0) + 1,
        title,
        data,
        seo: jsonOrNull(seo),
        note,
        created_by: actorId ?? null,
      },
    });
    const page = await tx.builderPage.update({
      where: { id: existing.id },
      data: { data, title, seo: jsonOrNull(seo), status: 'PUBLISHED', draft_data: Prisma.DbNull },
    });
    return { page, version, changed: true };
  });

  if (changed) {
    writeActivityAsync({
      actor: actorId,
      module: 'page-builder',
      action: 'published',
      subject_type: 'BuilderPage',
      subject_id: page.id,
      description: `Page "${page.title}" published (v${version.version})`,
    });
    enqueueSiteBuild(page.project_id);
    revalidatePublicPages();
  }
  const { draft_data: _draft, ...rest } = page;
  return { ...rest, live_version: version.version, version_changed: changed };
}

/**
 * Takes the page off the public site. The pending draft (if any) becomes the page's content, so the
 * editor shows the latest work; all versions are kept for a later re-publish or restore.
 */
export async function unpublishPage(existing, patch, actorId) {
  const data = patch.data ?? workingData(existing);
  const page = await prisma.builderPage.update({
    where: { id: existing.id },
    data: { ...patch, data, status: 'DRAFT', draft_data: Prisma.DbNull },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: 'unpublished',
    subject_type: 'BuilderPage',
    subject_id: page.id,
    description: `Page "${page.title}" unpublished`,
  });
  enqueueSiteBuild(page.project_id);
  revalidatePublicPages();
  const { draft_data: _draft, ...rest } = page;
  return rest;
}

/** Publishes the content of an older version as a new version (history stays linear and immutable). */
export async function restoreVersion(existing, versionId, actorId) {
  if (existing.template_id) throw httpError(409, 'Template pages have no versions');
  const old = await prisma.pageVersion.findFirst({ where: { id: versionId, page_id: existing.id } });
  if (!old) throw httpError(404, 'Version not found');
  return publishPage(
    existing,
    { data: old.data, title: old.title, seo: old.seo ?? {} },
    actorId,
    `Restored from v${old.version}`
  );
}
