import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import * as storage from '../services/storage.service.js';
import { loadedManifests } from '../modules/module-loader.js';
import { installModule, enableModule } from '../../modules/modules/service.js';
import { updateIdentity, getIdentity, getAppConfig } from '../../modules/identity/service.js';
import { APP_TYPES, APP_TYPE_KEYS, hasFrontend, modulesFor } from './app-types.js';
import { K, STALE_RUN_MS, getSetting, setSetting, isInstalled } from './status.js';

const fail = (message, status = 400, details) => Object.assign(new Error(message), { status, details });

// Logo: PNG, JPEG or WebP, 2 MB. The type comes from the file's own bytes, not the name the browser
// sent. SVG is not accepted here: served from the storage origin it could carry script, and the
// sanitiser that makes it safe lives in the Brand Kit module, which is not installed yet.
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export function sniffImage(buf) {
  if (buf.length > 12 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return { ext: 'png', mime: 'image/png' };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP')
    return { ext: 'webp', mime: 'image/webp' };
  return null;
}

export async function saveLogo(file) {
  if (!file) throw fail('Choose a logo image');
  if (file.size > MAX_LOGO_BYTES) throw fail('Logo must be 2 MB or smaller');
  const kind = sniffImage(file.buffer);
  if (!kind) throw fail('Upload a PNG, JPEG or WebP image');
  const path = `identity/${randomUUID()}.${kind.ext}`;
  await storage.uploadFile({ ...file, mimetype: kind.mime }, path);
  return { path, url: await storage.getFileUrl(path) };
}

// What a type will do, against what is already installed. Nothing is changed.
export async function previewType(type) {
  if (!APP_TYPES[type]) throw fail('Unknown application type', 422);
  const slugs = modulesFor(type, loadedManifests);
  const rows = await prisma.module.findMany({ where: { slug: { in: slugs } }, select: { slug: true, status: true } });
  const state = new Map(rows.map((r) => [r.slug, r.status]));
  return {
    type,
    frontend: hasFrontend(type),
    modules: slugs.map((slug) => ({
      slug,
      name: loadedManifests.get(slug)?.name ?? slug,
      status: state.get(slug) ?? 'AVAILABLE',
    })),
  };
}

export async function typeCatalog() {
  return Promise.all(
    APP_TYPE_KEYS.map(async (key) => {
      const { name, description, icon } = APP_TYPES[key];
      const p = await previewType(key);
      return { key, name, description, icon, frontend: p.frontend, modules: p.modules };
    })
  );
}

/** Install (if missing) and enable every module the type needs, through the normal module lifecycle. */
export async function applyType(type, actorId = null) {
  const { modules } = await previewType(type);
  const done = [];
  for (const { slug } of modules) {
    let row = await prisma.module.findUnique({ where: { slug } });
    if (!row) await installModule(slug, actorId);
    row = await prisma.module.findUnique({ where: { slug } });
    if (row?.status !== 'ENABLED') await enableModule(slug, actorId);
    done.push(slug);
  }
  await setSetting(K.appType, type);
  return done;
}

// What the wizard needs to resume after a refresh. Public, so only company-facing fields.
export async function getState() {
  const installed = await isInstalled();
  if (installed) return { installed: true };
  const [status, step, appType, identity] = await Promise.all([
    getSetting(K.status),
    getSetting(K.step),
    getSetting(K.appType),
    getIdentity(),
  ]);
  const cfg = identity.company_name ? await getAppConfig() : {};
  return {
    installed: false,
    status: status === 'running' ? 'running' : 'pending',
    step: Number(step ?? 0),
    app_type: appType,
    company: {
      name: identity.company_name ?? '',
      phone: identity.contact_phone ?? '',
      email: identity.contact_email ?? '',
      logo_path: identity.logo_light ?? '',
      logo_url: cfg.logo_light ?? '',
    },
  };
}

// Creates the status row as 'pending' when absent; an existing value (running, completed) is left alone.
const ensureRow = () =>
  prisma.appSetting.upsert({
    where: { key: K.status },
    update: {},
    create: { key: K.status, value: 'pending', type: 'string', description: 'First-run installation', is_public: false },
  });

async function assertOpen() {
  if (await isInstalled()) throw fail('Installation is already complete', 409);
}

export async function saveCompany({ name, phone, email, logo_path }) {
  await assertOpen();
  if (!logo_path) throw fail('Company logo is required', 422);
  const patch = {
    company_name: name,
    app_name: name,
    logo_light: logo_path,
    company_logo_light: logo_path,
    contact_phone: phone ?? '',
    contact_email: email ?? '',
  };
  await updateIdentity(patch);
  await ensureRow();
  if (Number(await getSetting(K.step)) < 1) await setSetting(K.step, 1);
  return getState();
}

export async function saveType(type) {
  await assertOpen();
  const preview = await previewType(type);
  await setSetting(K.appType, type);
  if (Number(await getSetting(K.step)) < 2) await setSetting(K.step, 2);
  return preview;
}

async function superAdminExists() {
  return (
    (await prisma.userRole.count({ where: { role: { slug: 'super-admin' }, user: { deleted_at: null } } })) > 0
  );
}

// Launch. One run at a time (compare-and-set on the status row); a crashed run is retried after
// STALE_RUN_MS. "completed" is written last, so any failure leaves the install open and the
// same button works again. Installing a module twice is a no-op, so a retry never duplicates data.
export async function complete() {
  await assertOpen();
  const [identity, type] = await Promise.all([getIdentity(), getSetting(K.appType)]);
  if (!identity.company_name || !identity.logo_light) throw fail('Finish step 1 first: logo and company name are required', 422);
  if (!APP_TYPES[type]) throw fail('Finish step 2 first: choose an application type', 422);
  if (!(await superAdminExists())) {
    throw fail('No Super Admin account exists yet. Run the database seed (npm run db:seed), then try again.', 409);
  }

  await ensureRow(); // never resets a running install
  const stale = new Date(Date.now() - STALE_RUN_MS);
  const lock = await prisma.appSetting.updateMany({
    where: { key: K.status, OR: [{ value: 'pending' }, { value: 'running', updated_at: { lt: stale } }] },
    data: { value: 'running' },
  });
  if (lock.count === 0) throw fail('Installation is already running', 409);

  try {
    const modules = await applyType(type, null);
    await setSetting(K.completedAt, new Date().toISOString());
    await setSetting(K.status, 'completed'); // last: everything above succeeded
    await redis.del('identity:raw', 'identity:app-config').catch(() => {});
    return { installed: true, app_type: type, modules, frontend: hasFrontend(type) };
  } catch (err) {
    await setSetting(K.status, 'pending').catch(() => {});
    throw fail(`Installation stopped: ${err.message}. Nothing was marked complete; try Launch again.`, err.status >= 400 && err.status < 500 ? err.status : 500);
  }
}

// After login: change the type. A configuration change, never a reinstall: only missing modules
// are added, nothing is disabled or deleted, existing content is untouched.
export async function changeType(type, actorId) {
  if (!(await isInstalled())) throw fail('Finish the installation first', 409);
  const before = await getSetting(K.appType);
  const modules = await applyType(type, actorId);
  return { type, previous: before, added_or_enabled: modules, preview: await previewType(type) };
}

export async function currentType() {
  return { type: await getSetting(K.appType), types: await typeCatalog() };
}
