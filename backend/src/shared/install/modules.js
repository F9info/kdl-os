import { prisma } from '../../config/database.js';
import { loadedManifests } from '../modules/module-loader.js';
import { ONBOARDING_KEY } from '../demo-content.js';
import { APP_TYPES, FRONTEND_MODULE, modulesFor } from './app-types.js';
import { getSetting, setSetting } from './status.js';
import { markStep, logInstall } from './progress.js';

// The wizard's "Modules" step: what the chosen application type will install (read-only, with each module's
// dependencies and status), which optional extras the admin may add, and whether to create the sample content.
// Everything comes from the module manifests, so a new module shows up here with no change to this file.

export const EXTRA_KEY = 'install.extra_modules'; // JSON array of slugs the admin added on top of the type
export const DEMO_CHOICE = ONBOARDING_KEY; // 'yes' | 'no', the same answer the CMS seed already reads

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const manifestOf = (slug) => loadedManifests.get(slug);
const nameOf = (slug) => manifestOf(slug)?.name ?? slug;

const parseList = (raw) => {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

/** Dependencies first, the module itself last. Unknown slugs are skipped (a missing manifest is reported elsewhere). */
function closure(slug, seen = new Set(), out = []) {
  if (seen.has(slug) || !manifestOf(slug)) return out;
  seen.add(slug);
  for (const dep of manifestOf(slug).dependsOn ?? []) closure(dep, seen, out);
  out.push(slug);
  return out;
}

async function statusMap() {
  const rows = await prisma.module.findMany({ select: { slug: true, status: true } });
  return new Map(rows.map((r) => [r.slug, r.status]));
}

const describe = (slug, status) => {
  const m = manifestOf(slug);
  return {
    slug,
    name: m.name,
    description: m.description ?? '',
    group: m.group ?? (m.core ? 'core' : 'other'),
    core: !!m.core,
    // Direct dependencies by name; core ones are always on so they are not worth listing.
    dependsOn: (m.dependsOn ?? []).filter((d) => !manifestOf(d)?.core).map((d) => ({ slug: d, name: nameOf(d) })),
    status: status.get(slug) ?? 'AVAILABLE',
  };
};

/** Modules the admin may add to a type: installable, visible, no missing env vars, no clash with the type. */
function eligibleExtras(typeSlugs, status) {
  const base = new Set(typeSlugs.flatMap((s) => closure(s)));
  const out = [];
  for (const [slug, m] of loadedManifests) {
    if (m.core || m.visibleInCatalog === false || base.has(slug)) continue;
    const missingEnv = (m.env ?? []).filter((k) => !process.env[k]);
    const chain = closure(slug).filter((s) => !manifestOf(s).core && !base.has(s));
    const clash = chain.find((s) =>
      [...base, ...chain].some(
        (o) => o !== s && ((manifestOf(s).conflictsWith ?? []).includes(o) || (manifestOf(o)?.conflictsWith ?? []).includes(s))
      )
    );
    out.push({
      ...describe(slug, status),
      // Everything that comes with it (its dependencies not already part of the type), for "adds X, Y".
      includes: chain.filter((s) => s !== slug).map((s) => ({ slug: s, name: nameOf(s) })),
      blocked: missingEnv.length ? `Needs ${missingEnv.join(', ')} on the server` : clash ? `Conflicts with ${nameOf(clash)}` : null,
    });
  }
  return out.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

export async function readSelection() {
  const [extras, demo] = await Promise.all([getSetting(EXTRA_KEY), getSetting(DEMO_CHOICE)]);
  return { extra: parseList(extras), demo: demo === 'yes' ? true : demo === 'no' ? false : null };
}

/** Does this selection create a website (and so have sample content to opt into)? */
export const hasWebsite = (type, extra = []) =>
  [...(APP_TYPES[type]?.modules ?? []), ...extra].some((s) => closure(s).includes(FRONTEND_MODULE));

export async function moduleChoices(type) {
  if (!APP_TYPES[type]) throw fail('Choose an application type first', 422);
  const status = await statusMap();
  const typeSlugs = modulesFor(type, loadedManifests);
  const selection = await readSelection();
  const core = [...loadedManifests.keys()].filter((s) => manifestOf(s).core).map((s) => describe(s, status));
  return {
    type,
    core, // always on, shown first
    included: typeSlugs.map((s) => describe(s, status)), // what the type needs (dependencies included)
    optional: eligibleExtras(typeSlugs, status),
    selected: selection.extra,
    // The question only exists when a website is being created; default yes, as before.
    demo: { available: hasWebsite(type, selection.extra), value: selection.demo ?? true },
  };
}

export async function saveModules(type, { modules = [], demo }) {
  if (!APP_TYPES[type]) throw fail('Choose an application type first', 422);
  const status = await statusMap();
  const allowed = new Map(eligibleExtras(modulesFor(type, loadedManifests), status).map((m) => [m.slug, m]));
  const extra = [...new Set(modules)];
  for (const slug of extra) {
    const m = allowed.get(slug);
    if (!m) throw fail(`"${slug}" cannot be added to this application type`, 422);
    if (m.blocked) throw fail(`"${m.name}" cannot be added: ${m.blocked}`, 422);
  }
  await setSetting(EXTRA_KEY, JSON.stringify(extra), prisma, 'Extra modules chosen in the installer');
  // Without a website there is nothing for sample content to attach to, so no answer is stored.
  if (hasWebsite(type, extra) && typeof demo === 'boolean') {
    await setSetting(DEMO_CHOICE, demo ? 'yes' : 'no', prisma, 'First-run answer: sample website content (yes/no)');
  }
  await markStep('modules', { status: 'done', extra });
  await logInstall('modules', 'info', `modules: ${extra.length ? `type + ${extra.map(nameOf).join(', ')}` : 'type only'}; sample content: ${demo === false ? 'no' : 'yes'}`);
  return moduleChoices(type);
}
