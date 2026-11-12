import { getDefaultProjectId } from '../../shared/default-project.js';
import { createForm } from '../forms/service.js';
import { formSlugFor } from './templates.js';
import { ensureBuiltinTemplates, getLibraryTemplate, buildLandingData } from './template-library.js';

// The four demo landing pages created when the Frontend module is enabled. Keys are template keys; the
// page slug equals the key, so they open at /p/business, /p/saas, /p/agency and /p/startup.
export const DEMO_LANDING = [
  { key: 'business', title: 'Business / Corporate' },
  { key: 'saas', title: 'SaaS / Technology' },
  { key: 'agency', title: 'Agency / Portfolio' },
  { key: 'startup', title: 'Startup / Product launch' },
];

/**
 * Creates the demo landing pages (published) from the built-in templates. Idempotent: a slug that already
 * exists, even soft-deleted or edited, is never recreated or overwritten. `client` is a Prisma client or a
 * transaction. Returns { created: [slug], skipped: [slug] }.
 */
export async function seedDemoLandingPages(client, actorId = null) {
  const out = { created: [], skipped: [] };
  const projectId = await getDefaultProjectId(client);
  if (!projectId) return out;
  await ensureBuiltinTemplates(client);
  for (const { key, title } of DEMO_LANDING) {
    const taken =
      (await client.builderPage.findFirst({ where: { slug: key }, select: { id: true } })) ||
      (await client.site.findFirst({ where: { slug: key }, select: { id: true } }));
    if (taken) {
      out.skipped.push(key);
      continue;
    }
    const tpl = await getLibraryTemplate(key, client);
    const site = await client.site.create({
      data: { project_id: projectId, type: 'LANDING', slug: key, name: title },
      select: { id: true },
    });
    await client.builderPage.create({
      data: {
        title,
        slug: key,
        status: 'PUBLISHED',
        data: buildLandingData(tpl, key, title),
        created_by: actorId,
        project_id: projectId,
        site_id: site.id,
      },
    });
    if (tpl.has_form) await createForm({ name: `${title} enquiry`, slug: formSlugFor(key) }, actorId, client, projectId);
    out.created.push(key);
  }
  return out;
}
