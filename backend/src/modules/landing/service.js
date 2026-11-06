import { prisma } from '../../config/database.js';
import { getDefaultProjectId } from '../../shared/default-project.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { createForm } from '../forms/service.js';
import { LANDING_TEMPLATES, buildLandingData, formSlugFor } from './templates.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

const projectIdOrThrow = async (client) => {
  const id = await getDefaultProjectId(client);
  if (!id) throw httpError(404, 'No project found');
  return id;
};

/** Landing sites of the project, each with its pages. */
export const listLandingSites = async (client = prisma) => {
  const projectId = await projectIdOrThrow(client);
  return client.site.findMany({
    where: { project_id: projectId, type: 'LANDING', deleted_at: null },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      project_id: true,
      slug: true,
      name: true,
      domain: true,
      created_at: true,
      pages: {
        where: { deleted_at: null },
        orderBy: { created_at: 'asc' },
        select: { id: true, slug: true, title: true, status: true },
      },
    },
  });
};

/**
 * "New Landing Page": one LANDING site plus its first page (draft), filled from a template.
 * The page slug equals the site slug, so it is also reachable at /p/<slug>. Both slugs must be free.
 * A template with a form also gets its enquiry form (forms module), created in the same transaction.
 */
export const createLandingPage = async ({ name, slug, template }, actorId, client = prisma) => {
  const projectId = await projectIdOrThrow(client);
  try {
    const { site, page } = await client.$transaction(async (tx) => {
      const site = await tx.site.create({
        data: { project_id: projectId, type: 'LANDING', slug, name },
        select: { id: true, slug: true, name: true },
      });
      const page = await tx.builderPage.create({
        data: {
          title: name,
          slug,
          status: 'DRAFT',
          data: buildLandingData(template, slug, name),
          created_by: actorId,
          project_id: projectId,
          site_id: site.id,
        },
        select: { id: true, slug: true, title: true, status: true },
      });
      if (LANDING_TEMPLATES[template].hasForm) {
        await createForm({ name: `${name} enquiry`, slug: formSlugFor(slug) }, actorId, tx, projectId);
      }
      return { site, page };
    });
    writeActivityAsync({
      actor: actorId,
      module: 'landing',
      action: 'created',
      subject_type: 'Site',
      subject_id: site.id,
      description: `Landing page "${name}" created from template "${template}"`,
    });
    return { ...site, pages: [page] };
  } catch (err) {
    if (err.code === 'P2002') throw httpError(409, `The slug "${slug}" is already in use`);
    throw err;
  }
};

/**
 * Deletes a landing page: its site, its pages and its own enquiry form (`<slug>-enquiry`, created with
 * the template) are soft-deleted, so the public page stops working and the list no longer shows it.
 * Page slugs are globally unique and a soft-deleted row keeps its slug, so each slug (and the custom
 * domain) is renamed on the way out: the same address can be used again for a new landing page.
 */
export const deleteLandingSite = async (siteId, actorId, client = prisma) => {
  const projectId = await projectIdOrThrow(client);
  const site = await client.site.findFirst({
    where: { id: siteId, project_id: projectId, type: 'LANDING', deleted_at: null },
    select: {
      id: true,
      slug: true,
      name: true,
      pages: { where: { deleted_at: null }, select: { id: true, slug: true } },
    },
  });
  if (!site) throw httpError(404, 'Landing page not found');

  const now = new Date();
  const tag = `--deleted-${now.getTime()}`;
  await client.$transaction(async (tx) => {
    for (const page of site.pages) {
      await tx.builderPage.update({
        where: { id: page.id },
        data: { deleted_at: now, slug: `${page.slug}${tag}` },
      });
    }
    const form = await tx.form.findFirst({
      where: { project_id: projectId, slug: formSlugFor(site.slug), deleted_at: null },
      select: { id: true, slug: true },
    });
    if (form)
      await tx.form.update({ where: { id: form.id }, data: { deleted_at: now, slug: `${form.slug}${tag}` } });
    await tx.site.update({
      where: { id: site.id },
      data: { deleted_at: now, slug: `${site.slug}${tag}`, domain: null },
    });
  });
  writeActivityAsync({
    actor: actorId,
    module: 'landing',
    action: 'deleted',
    subject_type: 'Site',
    subject_id: site.id,
    description: `Landing page "${site.name}" deleted`,
  });
};
